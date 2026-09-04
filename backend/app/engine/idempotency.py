"""
Idempotency for the decision pipeline.

Why this exists: a merchant/operator re-clicking "Assess" on the dashboard,
a retried API call after a timeout, or a replayed webhook should never
produce two audit entries for the same underlying conclusion. This module
computes a stable hash of "what the engine concluded" (not "when") so the
gate can recognize a repeat and reuse the prior record instead of writing
a new one.

Deliberately hashes the CONCLUSION (trigger + confidence + evidence), not
the raw input snapshot — if the account's signals genuinely changed between
two assessments, that's a new conclusion and SHOULD get a new audit entry.
Only a truly repeated result is deduplicated.
"""
from __future__ import annotations

import hashlib
import json

from app.models import TriggerAssessment


def compute_assessment_hash(assessment: TriggerAssessment) -> str:
    payload = {
        "account_id": assessment.account_id,
        "predicted_trigger": assessment.predicted_trigger.value,
        "confidence": round(assessment.confidence, 4),
        "conflicting_signals": assessment.conflicting_signals,
        "evidence": sorted(
            f"{e.signal}:{e.observed_value}:{e.contributes_to.value}" for e in assessment.evidence
        ),
    }
    blob = json.dumps(payload, sort_keys=True).encode()
    return hashlib.sha256(blob).hexdigest()[:16]
