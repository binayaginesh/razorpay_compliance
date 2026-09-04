"""
Decision gate.

This is the "bounded and gated" half of the buildathon's own bar. The rules
engine (rules.py) classifies WHAT is happening to the merchant's account.
This module decides what investigation outcome state the account gets —
because a confident-sounding wrong guess sent straight to a merchant is
worse than a system that says "I'm not sure, here's why."

Gate logic (deliberately simple and inspectable, not a black-box score):
  - HEALTHY trigger                              -> CLEAR
  - confidence >= 0.8 and single clean trigger   -> REVIEW_REQUIRED
  - conflicting_signals or medium confidence     -> CONFLICTING_SIGNALS
  - UNKNOWN trigger or confidence < 0.4          -> INSUFFICIENT_DATA

WARDEN never makes the actual compliance decision. These states describe
what the investigation found — a human operator has sole authority to act.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from app.audit.store import find_by_hash
from app.engine.idempotency import compute_assessment_hash
from app.models import (
    AuditRecord,
    Decision,
    InvestigationResult,
    TriggerAssessment,
    TriggerCategory,
)


def gate(
    assessment: TriggerAssessment,
    investigation_result: Optional[InvestigationResult] = None,
) -> tuple[Decision, str, AuditRecord, bool]:
    """Returns (decision, rationale, record, is_replay) — is_replay=True means
    `record` is a PRIOR record being returned, not a new one to write."""
    assessment_hash = compute_assessment_hash(assessment)

    existing = find_by_hash(assessment.account_id, assessment_hash)
    if existing is not None:
        # Same account, same conclusion, already recorded — return the prior
        # record instead of writing a duplicate.
        return existing.decision, existing.rationale, existing, True

    if assessment.predicted_trigger == TriggerCategory.HEALTHY:
        decision = Decision.CLEAR
        rationale = (
            "No trigger signals fired above threshold; account reads as healthy. "
            "CLEAR means no configured review trigger is currently supported by "
            "the available evidence — not that the merchant is approved."
        )

    elif assessment.predicted_trigger == TriggerCategory.UNKNOWN:
        decision = Decision.INSUFFICIENT_DATA
        rationale = (
            "Evidence does not cleanly match any known trigger category "
            "in the taxonomy. Flagging for manual review rather than forcing a guess."
        )

    elif assessment.conflicting_signals and assessment.confidence < 0.5:
        decision = Decision.CONFLICTING_SIGNALS
        rationale = (
            "Multiple signals point in different directions and none is strong "
            "enough on its own. Meaningful evidence exists in both directions — "
            "a human operator must resolve the ambiguity."
        )

    elif assessment.confidence < 0.4:
        decision = Decision.INSUFFICIENT_DATA
        rationale = (
            f"Confidence {assessment.confidence:.2f} is below the minimum threshold "
            "for a reliable investigation assessment. Available data is insufficient."
        )

    elif assessment.confidence >= 0.8 and not assessment.conflicting_signals:
        decision = Decision.REVIEW_REQUIRED
        rationale = (
            f"Single clean trigger ({assessment.predicted_trigger.value}) with "
            f"confidence {assessment.confidence:.2f} and no conflicting evidence. "
            "Evidence sufficiently supports one or more configured investigation triggers. "
            "Human operator review required."
        )

    else:
        decision = Decision.REVIEW_REQUIRED
        rationale = (
            f"Confidence {assessment.confidence:.2f} with possible conflicting signals. "
            "Draft investigation prepared and held for human review."
        )

    record = AuditRecord(
        record_id=str(uuid.uuid4()),
        account_id=assessment.account_id,
        timestamp=datetime.utcnow(),
        stage="decision_gate",
        evidence=assessment.evidence,
        rule_or_model="decision_gate.gate v2 (deterministic)",
        decision=decision,
        rationale=rationale,
        confidence=assessment.confidence,
        assessment_hash=assessment_hash,
        investigation_result=investigation_result,
    )

    return decision, rationale, record, False
