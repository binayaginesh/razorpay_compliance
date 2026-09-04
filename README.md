# WARDEN — Merchant Compliance Investigation Copilot

> **Razorpay AI Buildathon 2026 Submission**

WARDEN is an AI-powered compliance investigation copilot for Razorpay's compliance operations team. It classifies merchant account compliance triggers, runs AI investigations using Google Gemini, and produces structured evidence packs for human operators — without ever acting autonomously.

---

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env        # add your GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000

# Dataset
python -m app.data.generate_synthetic

# Tests
pytest tests/ -v

# Frontend
cd frontend
npm install
npm run dev
```

- **Dashboard:** http://localhost:5173  
- **API:** http://localhost:8000  
- **API Docs:** http://localhost:8000/docs

---

## Architecture

```
Merchant Account Signals
         │
         ▼
  [DETERMINISTIC]  rules.py — evidence extraction + trigger scoring
         │
         ▼
  [AI REASONING]   investigator.py — Gemini 2.0 Flash, evidence-grounded
         │
         ▼
  [DETERMINISTIC]  decision_gate.py — absolute authority on final outcome
         │
         ▼
  [DRAFT ONLY]     resolution.py — evidence pack + checklist + SLA
         │
         ▼
  Human Operator (Dashboard) — FINAL AUTHORITY
```

The AI **cannot override the deterministic gate**. It can only reason over evidence and produce hypotheses, which the gate uses as a signal but never as the sole source of truth.

---

## Decision States

| State | Meaning |
|-------|---------|
| `CLEAR` | No configured risk pattern is supported above threshold |
| `REVIEW_REQUIRED` | One or more triggers confirmed — human review needed |
| `CONFLICTING_SIGNALS` | Multiple patterns partially match — genuine ambiguity |
| `INSUFFICIENT_DATA` | Not enough evidence for a reliable assessment |

Abstention states (`CONFLICTING_SIGNALS`, `INSUFFICIENT_DATA`) are **first-class outcomes**, not failures.

---

## Red Team Safety Guarantees

7 adversarial scenarios are included and runnable via `POST /redteam/run`:

1. **Ambiguous signals** → must not produce `CLEAR`
2. **Duplicate assessment** → exactly 1 audit record
3. **Concurrent assessment (10 threads)** → no corruption, 1 record
4. **LLM failure/unavailability** → deterministic fallback, never fails open
5. **Prompt injection via merchant name** → policy outcome unchanged
6. **Stale reassessment (signals changed)** → new record, old records immutable
7. **Cross-account hash collision** → different accounts always produce separate records

---

## Project Structure

```
backend/
  app/
    models.py              # Pydantic data contracts
    main.py                # FastAPI endpoints
    engine/
      rules.py             # Deterministic evidence extractor
      decision_gate.py     # Final decision authority
      investigator.py      # AI investigator (Gemini)
      resolution.py        # Resolution planner + evidence pack
      idempotency.py       # Assessment hash (account_id-scoped)
    audit/store.py         # Immutable audit log
    redteam/scenarios.py   # 7 adversarial safety tests
    data/
      generate_synthetic.py   # 217-account synthetic dataset
      synthetic_accounts.json
  tests/test_adversarial.py  # 9/9 passing

frontend/
  src/
    App.jsx
    api.js
    components/
      AccountList.jsx       # Sidebar with proactive risk badges
      InvestigationView.jsx # Full investigation result
      JudgeMode.jsx         # 4 canned example outcomes
      RedTeamPanel.jsx      # Live red team runner
      AuditTrail.jsx        # Immutable investigation log
```

---

## Key Design Decisions

- **AI ≠ Decision Maker**: Gemini provides hypotheses grounded exclusively in extracted evidence. The decision gate (a simple Python function) has absolute authority.
- **Evidence Grounding Constraint**: The AI investigator receives only `TriggerAssessment` + `Evidence` — never raw merchant data or instructions that could be injected.
- **Idempotency via Account-Scoped Hash**: `account_id` is part of the assessment hash, preventing cross-account hash collisions.
- **No Send Authority**: `ResolutionPlan` has no `sent`, `sent_at`, or `dispatch_status` field. The system produces drafts; humans send them.
- **Deterministic Fallback**: If the Gemini API is unavailable, `investigator.py` returns a structured fallback result — the overall system never fails open.
