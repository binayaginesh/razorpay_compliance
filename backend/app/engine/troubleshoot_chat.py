"""
Troubleshoot Chat Engine — Real-time AI Assistant for Merchants on Compliance Hold.

Grounds all answers in the merchant's actual detected trigger, observed signals,
and resolution plan. Never hallucinates internal Razorpay policies or promises
unauthorized instant unfreezing.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from app.engine.resolution import build_resolution_plan
from app.engine.rules import classify_account
from app.models import AccountSnapshot

logger = logging.getLogger(__name__)


def _deterministic_chat_response(
    message: str,
    trigger_val: str,
    evidence_items: list[dict],
    plan_dict: Optional[dict],
    merchant_name: str,
) -> str:
    """Intelligent evidence-grounded fallback response when Gemini is offline."""
    msg = message.lower()

    # Question: Can I still accept payments?
    if any(w in msg for w in ["accept", "incoming", "customer pay", "transaction", "receive"]):
        if trigger_val == "third_party_fraud_linkage":
            return (
                f"⚠️ For {merchant_name}, incoming transactions are currently restricted due to a verified fraud signal linkage. "
                "Immediate identity and banking verification is required before transaction processing can resume."
            )
        return (
            f"✅ Yes, your customers can still make payments normally through your Razorpay checkout. "
            f"Only your outbound settlement payouts to your bank account are temporarily held in reserve "
            f"while our compliance team verifies the recent {trigger_val.replace('_', ' ')}."
        )

    # Question: What documents are needed?
    if any(w in msg for w in ["document", "upload", "proof", "checklist", "what do i need", "attach"]):
        docs = plan_dict.get("document_checklist", []) if plan_dict else []
        if docs:
            doc_str = "\n".join(f"  • {d}" for d in docs)
            return (
                f"📋 To expedite unfreezing your settlement payouts, please upload the following documentation:\n\n"
                f"{doc_str}\n\n"
                "You can submit these via the 'Upload Invoices & Request Review' button right here in the portal."
            )
        return "Please upload your recent customer GST invoices, delivery proof receipts, and updated projected monthly sales declaration."

    # Question: How long will it take? / SLA
    if any(w in msg for w in ["how long", "time", "sla", "hours", "days", "when", "turnaround"]):
        sla = plan_dict.get("sla_target_hours", 48) if plan_dict else 48
        return (
            f"⏱️ Our compliance team reviews submitted documentation within {sla} hours. "
            "Once our compliance officer validates the invoice proofs and confirms legitimate business activity, "
            "the settlement hold is removed and regular bank payouts resume."
        )

    # Question: Why was I flagged / what happened?
    if any(w in msg for w in ["why", "reason", "flag", "what happened", "freeze", "cause"]):
        ev_summaries = []
        for e in evidence_items:
            ev_summaries.append(f"  • {e.get('signal')}: observed {e.get('observed_value')} (Threshold: {e.get('threshold_or_reference')})")
        ev_str = "\n".join(ev_summaries) if ev_summaries else "Automated compliance surveillance trigger fired."
        return (
            f"🔍 Your payouts were put on hold because WARDEN's continuous surveillance engine detected a {trigger_val.replace('_', ' ')} alert:\n\n"
            f"{ev_str}\n\n"
            "This automated reserve hold is triggered proactively to protect against unauthorized account takeover and sudden chargeback liabilities."
        )

    # Default helpful response
    return (
        f"I'm here to help resolve your account hold. WARDEN detected a {trigger_val.replace('_', ' ')} alert on {merchant_name}. "
        "Your customer checkout remains active, while bank payouts are temporarily reserved. "
        "You can ask me about required documents, review timelines, or submit your invoice proofs for expedited verification."
    )


def generate_troubleshoot_reply(
    snapshot: AccountSnapshot,
    user_message: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Generate an evidence-grounded AI reply to a merchant's compliance doubt.
    """
    # Deterministic signals & plan
    assessment = classify_account(snapshot)
    plan = build_resolution_plan(assessment, snapshot.merchant_name)
    plan_dict = plan.model_dump() if plan else None
    evidence_items = [e.model_dump() for e in assessment.evidence]
    trigger_val = assessment.predicted_trigger.value

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        reply = _deterministic_chat_response(
            user_message, trigger_val, evidence_items, plan_dict, snapshot.merchant_name
        )
        return {
            "reply": reply,
            "trigger": trigger_val,
            "sla_hours": plan_dict.get("sla_target_hours", 48) if plan_dict else 48,
            "ai_used": False,
        }

    try:
        import google.generativeai as genai  # type: ignore

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        evidence_str = "\n".join(
            f"- {e.get('signal')}: {e.get('observed_value')} (ref: {e.get('threshold_or_reference')})"
            for e in evidence_items
        )
        doc_checklist_str = "\n".join(f"- {d}" for d in (plan_dict.get("document_checklist", []) if plan_dict else []))
        sla_hours = plan_dict.get("sla_target_hours", 48) if plan_dict else 48

        prompt = f"""You are WARDEN Merchant Copilot, a helpful, transparent, and empathetic AI assistant built into Razorpay's Merchant Dashboard.
A merchant ({snapshot.merchant_name}) has had their outbound settlement payouts temporarily placed on hold due to a compliance trigger detected by WARDEN's continuous surveillance engine.

GROUND TRUTH CONTEXT (You must stick strictly to these facts; do NOT invent other policies or promise instant unfreezing):
- Account ID: {snapshot.account_id}
- Merchant Business: {snapshot.merchant_name}
- Compliance Alert Trigger: {trigger_val}
- Observed Evidence Signals:
{evidence_str}
- Required Document Checklist:
{doc_checklist_str}
- Review Turnaround SLA: {sla_hours} hours once documents are submitted
- Incoming Payments Status: Incoming customer payments via checkout remain active (unless trigger is fraud linkage). Only daily bank settlement payouts are temporarily reserved.
- Authority Rule: You are an advisory troubleshooting copilot. A human Razorpay compliance officer makes the final decision once invoices are submitted.

MERCHANT'S QUESTION:
"{user_message}"

Respond to the merchant in a supportive, professional, fintech tone (2-4 concise paragraphs max). Be clear, direct, and give concrete next steps. Explain exactly why this happened and how they can resolve it quickly. Do not use robotic boilerplate."""

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=1024,
            ),
        )
        reply_text = response.text.strip()

        return {
            "reply": reply_text,
            "trigger": trigger_val,
            "sla_hours": sla_hours,
            "ai_used": True,
        }

    except Exception as e:
        logger.error(f"Troubleshoot chat failed with Gemini ({e}), using deterministic fallback.")
        reply = _deterministic_chat_response(
            user_message, trigger_val, evidence_items, plan_dict, snapshot.merchant_name
        )
        return {
            "reply": reply,
            "trigger": trigger_val,
            "sla_hours": plan_dict.get("sla_target_hours", 48) if plan_dict else 48,
            "ai_used": False,
        }
