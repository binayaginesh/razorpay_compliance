from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.audit.store import read_all, read_for_account, write
from app.engine.decision_gate import gate
from app.engine.investigator import investigate
from app.engine.resolution import build_resolution_plan
from app.engine.rules import classify_account
from app.models import AccountSnapshot, Decision, TriggerCategory

# Load .env
load_dotenv()

app = FastAPI(title="WARDEN — Merchant Compliance Investigation Copilot", version="2.0.0")

_ALLOWED_ORIGINS = (
    # In production on Vercel, the frontend and backend share one domain, so
    # the /api rewrite is same-origin and CORS isn't strictly needed.
    # We allow the Vercel deployment domain + localhost for local dev.
    os.environ.get("ALLOWED_ORIGINS", "*").split(",")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


DATASET_PATH = Path(__file__).parent / "data" / "synthetic_accounts.json"


def _load_accounts() -> list[AccountSnapshot]:
    if not DATASET_PATH.exists():
        return []
    raw = json.loads(DATASET_PATH.read_text())
    return [AccountSnapshot.model_validate(r) for r in raw]


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0", "ai_available": bool(os.environ.get("GEMINI_API_KEY"))}


@app.get("/accounts")
def list_accounts():
    """
    Returns all accounts with a lightweight proactive risk badge computed
    from the deterministic rules engine only (no LLM call, no full investigation).
    This makes 'detect' real without making every page load expensive.
    """
    accounts = _load_accounts()
    result = []
    for a in accounts:
        assessment = classify_account(a)
        decision, _, _, _ = gate(assessment)
        result.append({
            "account_id": a.account_id,
            "merchant_name": a.merchant_name,
            "snapshot_date": a.snapshot_date.isoformat(),
            # Proactive risk badge — deterministic only, no LLM
            "risk_badge": {
                "trigger": assessment.predicted_trigger.value,
                "confidence": round(assessment.confidence, 2),
                "decision": decision.value,
                "conflicting_signals": assessment.conflicting_signals,
                "evidence_count": len(assessment.evidence),
            },
        })
    return result


@app.post("/accounts/{account_id}/assess")
def assess_account(account_id: str):
    """
    Full investigation pipeline:
      1. Rules engine (deterministic) — extract evidence, detect triggers
      2. AI Investigator (Gemini) — reason over evidence, produce hypotheses
      3. Decision Gate (deterministic, final authority) — gate the outcome
      4. Resolution Planner — draft evidence pack and checklist
    """
    accounts = {a.account_id: a for a in _load_accounts()}
    snapshot = accounts.get(account_id)
    if not snapshot:
        raise HTTPException(404, f"Unknown account {account_id}")

    # Step 1: Deterministic rules engine
    assessment = classify_account(snapshot)

    # Step 2: AI Investigator (reasons over evidence only)
    investigation_result = investigate(assessment, snapshot.merchant_name)

    # Step 3: Decision Gate (deterministic, final authority)
    decision, rationale, record, is_replay = gate(assessment, investigation_result)
    if not is_replay:
        write(record)

    # Step 4: Resolution Planner (draft only, no send authority)
    plan = build_resolution_plan(
        assessment,
        snapshot.merchant_name,
        investigation_result=investigation_result,
        audit_record_id=record.record_id,
    )

    return {
        "account_id": account_id,
        "merchant_name": snapshot.merchant_name,
        # Deterministic engine output
        "predicted_trigger": assessment.predicted_trigger.value,
        "confidence": assessment.confidence,
        "conflicting_signals": assessment.conflicting_signals,
        "evidence": [e.model_dump() for e in assessment.evidence],
        # Decision Gate output
        "decision": decision.value,
        "rationale": rationale,
        "is_replay": is_replay,
        "audit_record_id": record.record_id,
        # AI Investigator output
        "investigation": investigation_result.model_dump() if investigation_result else None,
        # Resolution plan
        "resolution_plan": plan.model_dump() if plan else None,
    }


@app.get("/audit")
def get_audit_trail():
    return [r.model_dump() for r in read_all()]


@app.get("/audit/{account_id}")
def get_audit_for_account(account_id: str):
    return [r.model_dump() for r in read_for_account(account_id)]


@app.post("/redteam/run")
def run_redteam():
    """
    Run all 7 Red Team safety scenarios and return pass/fail per scenario.
    Shown in the dashboard's Red Team panel.
    """
    from app.redteam.scenarios import run_all
    return run_all()


from pydantic import BaseModel, Field


class ChatTroubleshootRequest(BaseModel):
    account_id: str
    message: str
    history: list[dict] = Field(default_factory=list)


@app.post("/chat/troubleshoot")
def chat_troubleshoot(req: ChatTroubleshootRequest):
    """
    Real-time interactive troubleshoot chat assistant for merchants whose
    accounts or settlements are temporarily on hold.
    """
    accounts = {a.account_id: a for a in _load_accounts()}
    snapshot = accounts.get(req.account_id)
    if not snapshot:
        raise HTTPException(404, f"Unknown account {req.account_id}")

    from app.engine.troubleshoot_chat import generate_troubleshoot_reply
    return generate_troubleshoot_reply(snapshot, req.message, req.history)

