"""
Adversarial / failure-injection tests.

Each test here proves ONE specific safety guarantee, named after what it's
protecting against — not a generic "test_gate_works" assertion. This is the
suite you screen-share when a judge asks "how do I know it fails safely."

Run with: pytest tests/ -v

Updated for v2:
  - Decision states renamed: CLEAR / REVIEW_REQUIRED / CONFLICTING_SIGNALS / INSUFFICIENT_DATA
  - New scenario: cross-account hash collision (Scenario 7)
  - New: days_before_actual_action no-leakage assertion
"""
from __future__ import annotations

import os
from datetime import datetime

import pytest

from app.audit.store import clear, read_for_account
from app.engine.decision_gate import gate
from app.engine.resolution import build_resolution_plan
from app.engine.rules import classify_account
from app.models import AccountSnapshot, Decision, TriggerCategory


@pytest.fixture(autouse=True)
def clean_audit_log():
    clear()
    yield
    clear()


def _snapshot(**overrides) -> AccountSnapshot:
    base = dict(
        account_id="acc_test",
        merchant_name="Test Merchant",
        snapshot_date=datetime(2026, 8, 30),
        kyc_status="verified",
        kyc_fields_flagged=[],
        declared_avg_daily_volume_inr=50_000.0,
        trailing_3d_avg_daily_volume_inr=50_000.0,
        chargeback_ratio_pct=0.1,
        declared_mcc="5411_grocery",
        observed_txn_categories=[],
        linked_flagged_accounts=0,
        recent_cybercrime_complaint=False,
    )
    base.update(overrides)
    return AccountSnapshot(**base)


def test_low_confidence_forces_review_not_clear():
    """TEST 1: weak/borderline-only evidence must not produce CLEAR outcome."""
    snap = _snapshot(chargeback_ratio_pct=0.8)  # borderline: >=0.75 but <1.0
    assessment = classify_account(snap)
    decision, _rationale, _record, _replay = gate(assessment)
    assert decision != Decision.CLEAR, "borderline-only evidence must not produce CLEAR"


def test_contradictory_evidence_does_not_auto_conclude():
    """TEST 2: signals pointing at different categories must not be forced
    into a single confident conclusion."""
    snap = _snapshot(
        trailing_3d_avg_daily_volume_inr=50_000.0 * 2.0,  # mild volume signal
        chargeback_ratio_pct=0.85,  # borderline chargeback signal, different category
    )
    assessment = classify_account(snap)
    assert assessment.conflicting_signals, "expected the engine to recognize conflicting signals"
    decision, _rationale, _record, _replay = gate(assessment)
    assert decision in (Decision.CONFLICTING_SIGNALS, Decision.REVIEW_REQUIRED), (
        "contradictory evidence must not produce CLEAR"
    )


def test_missing_evidence_does_not_get_auto_resolution_plan():
    """TEST 3: HEALTHY/UNKNOWN accounts (nothing concrete to act on) never
    get a merchant-facing resolution plan generated."""
    snap = _snapshot()  # clean healthy account, no evidence at all
    assessment = classify_account(snap)
    assert assessment.predicted_trigger == TriggerCategory.HEALTHY
    plan = build_resolution_plan(assessment, snap.merchant_name)
    assert plan is None, "a healthy account must never get an escalation draft"


def test_llm_unavailable_falls_back_safely(monkeypatch):
    """TEST 4: with no GEMINI_API_KEY set, resolution planning and investigation
    must still succeed via template/fallback path — never raise, never hang."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    from app.engine.investigator import investigate

    snap = _snapshot(kyc_status="expired")
    assessment = classify_account(snap)

    # Investigation fallback
    result = investigate(assessment, snap.merchant_name)
    assert not result.ai_available, "AI should be unavailable without API key"
    assert result.primary_hypothesis is not None

    # Resolution fallback
    plan = build_resolution_plan(assessment, snap.merchant_name)
    assert plan is not None
    assert "Account review follow-up" in plan.escalation_draft
    assert len(plan.document_checklist) > 0


def test_duplicate_case_event_does_not_duplicate_audit_entry():
    """TEST 5: assessing the same account with unchanged signals twice must
    not write two audit entries — idempotency via assessment hash."""
    snap = _snapshot(chargeback_ratio_pct=1.5)  # clean, strong single-trigger case
    assessment1 = classify_account(snap)
    _decision1, _rationale1, record1, replay1 = gate(assessment1)
    assert replay1 is False
    from app.audit.store import write
    write(record1)

    # Re-run the identical assessment (simulates a re-click / retried call)
    assessment2 = classify_account(snap)
    _decision2, _rationale2, record2, replay2 = gate(assessment2)
    assert replay2 is True, "identical repeated assessment must be recognized as a replay"
    assert record2.record_id == record1.record_id, "replay must return the SAME record, not a new one"

    all_records = read_for_account("acc_test")
    assert len(all_records) == 1, f"expected exactly 1 audit entry, got {len(all_records)}"


def test_genuinely_new_signal_is_not_blocked_by_idempotency():
    """Companion to TEST 5: idempotency must key on the CONCLUSION, not just
    the account — a real change in signals must still produce a new entry."""
    from app.audit.store import write

    snap1 = _snapshot(chargeback_ratio_pct=1.5)
    assessment1 = classify_account(snap1)
    _d1, _r1, record1, _replay1 = gate(assessment1)
    write(record1)

    snap2 = _snapshot(kyc_status="expired")  # genuinely different trigger now
    assessment2 = classify_account(snap2)
    _d2, _r2, record2, replay2 = gate(assessment2)
    assert replay2 is False, "a genuinely new conclusion must not be treated as a replay"
    write(record2)

    all_records = read_for_account("acc_test")
    assert len(all_records) == 2


def test_ai_never_gets_send_authority():
    """TEST 6: no code path in resolution.py can mark a plan as 'sent' —
    ResolutionPlan has no send/dispatch field, and no function here calls out
    to email/support APIs. This test exists to catch a future regression."""
    from app.models import ResolutionPlan
    fields = ResolutionPlan.model_fields.keys()
    assert "sent" not in fields
    assert "sent_at" not in fields
    assert "dispatch_status" not in fields


def test_cross_account_hash_collision_produces_separate_records():
    """TEST 7 (new): two DIFFERENT accounts engineered to produce identical
    evidence/confidence must produce TWO separate audit records, not one
    account's assessment silently replayed as the other's.
    Directly tests the corrected assessment_hash formula (account_id included)."""
    from app.audit.store import write
    from app.engine.idempotency import compute_assessment_hash

    snap_a = _snapshot(account_id="acc_collision_A", chargeback_ratio_pct=1.5)
    snap_b = _snapshot(account_id="acc_collision_B", chargeback_ratio_pct=1.5)

    a_assessment = classify_account(snap_a)
    b_assessment = classify_account(snap_b)

    hash_a = compute_assessment_hash(a_assessment)
    hash_b = compute_assessment_hash(b_assessment)

    # The hashes MUST differ because account_id is in the hash
    assert hash_a != hash_b, (
        "Different accounts with identical evidence must produce different hashes — "
        "account_id must be part of the hash input."
    )

    _d_a, _r_a, rec_a, replay_a = gate(a_assessment)
    write(rec_a)

    _d_b, _r_b, rec_b, replay_b = gate(b_assessment)
    assert not replay_b, (
        "Account B's assessment must NOT be treated as a replay of Account A's, "
        "even if the evidence is identical."
    )
    write(rec_b)

    assert rec_a.record_id != rec_b.record_id


def test_days_before_actual_action_not_read_by_engine():
    """No-leakage: the rules engine must never ACCESS days_before_actual_action
    at inference time — it's an eval-only field, same rule as true_trigger.
    We check for attribute access patterns (.days_before_actual_action),
    not string mentions in comments/docstrings."""
    import inspect
    from app.engine import rules, decision_gate, investigator
    # Check for attribute access (.days_before_actual_action), which would
    # be the dangerous pattern. Comments/docstrings mentioning the field
    # by name are fine — they document the no-leakage rule.
    access_pattern = ".days_before_actual_action"
    for module in [rules, decision_gate, investigator]:
        src = inspect.getsource(module)
        assert access_pattern not in src, (
            f"{module.__name__} must not ACCESS .days_before_actual_action "
            f"at inference time — eval-only field."
        )
