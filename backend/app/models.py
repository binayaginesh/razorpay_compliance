"""
Warden — shared data contracts.

Every object here is deliberately a typed, serializable record. The whole
point of this system is that nothing happens without a written-down reason,
so these schemas ARE the audit trail's backbone, not an afterthought bolted
on at the end.

Major revision: classifier → investigation copilot.
  - Decision states renamed: CLEAR / REVIEW_REQUIRED / CONFLICTING_SIGNALS / INSUFFICIENT_DATA
  - Evidence gains a `weight` field (rule-defined contribution score)
  - AccountSnapshot gains `days_before_actual_action` (eval-only, no-leakage)
  - InvestigationFinding + InvestigationResult added (AI Investigator output)
  - AuditRecord stores linked InvestigationResult
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TriggerCategory(str, Enum):
    """
    Freeze/hold trigger categories, taken directly from Razorpay's own
    published guidance on why payment gateway accounts get frozen:
    KYC/documentation gaps, sudden volume spikes, chargeback ratio creep,
    MCC/category mismatch, and IP/velocity or third-party fraud linkage.
    Kept as a closed enum on purpose — if a case doesn't fit, the system
    should say UNKNOWN rather than force-fit it into a category.
    """

    KYC_DOCUMENTATION_GAP = "kyc_documentation_gap"
    VOLUME_SPIKE = "volume_spike"
    CHARGEBACK_RATIO = "chargeback_ratio"
    MCC_MISMATCH = "mcc_mismatch"
    THIRD_PARTY_FRAUD_LINKAGE = "third_party_fraud_linkage"
    HEALTHY = "healthy"
    UNKNOWN = "unknown"


class Decision(str, Enum):
    """
    The outcome state of WARDEN's investigation gate — not a judgment on the merchant.

    CLEAR:               No configured compliance-risk pattern is sufficiently supported
                         by the available evidence. Does NOT mean "merchant is approved."
    REVIEW_REQUIRED:     Evidence sufficiently supports one or more configured triggers.
                         Human operator must act.
    CONFLICTING_SIGNALS: Meaningful evidence in both directions, or competing hypotheses
                         that can't be safely resolved. A correct, desired outcome for
                         genuinely ambiguous accounts.
    INSUFFICIENT_DATA:   Available data is insufficient for a reliable investigation
                         assessment (e.g. a cold-start account).

    Historical names (ALLOW / DENY / UNCERTAIN) are superseded — see docs/DECISIONS.md.
    """

    CLEAR = "clear"
    REVIEW_REQUIRED = "review_required"
    CONFLICTING_SIGNALS = "conflicting_signals"
    INSUFFICIENT_DATA = "insufficient_data"


class AccountSnapshot(BaseModel):
    """A point-in-time (or windowed) view of one merchant account's signals."""

    account_id: str
    merchant_name: str
    snapshot_date: datetime

    # KYC / documentation signals
    kyc_status: str = Field(description="verified | pending | mismatch | expired")
    kyc_fields_flagged: list[str] = Field(default_factory=list)

    # Volume signals
    declared_avg_daily_volume_inr: float
    trailing_3d_avg_daily_volume_inr: float

    # Chargeback signals
    chargeback_ratio_pct: float
    chargeback_ratio_threshold_pct: float = 1.0  # RBI/industry-typical soft threshold

    # Category signals
    declared_mcc: str
    observed_txn_categories: list[str] = Field(default_factory=list)

    # Third-party / fraud-linkage signals
    linked_flagged_accounts: int = 0
    recent_cybercrime_complaint: bool = False

    # Ground truth for eval only — NEVER read by rules.py, investigator.py,
    # or decision_gate.py at inference time.
    true_trigger: Optional[TriggerCategory] = None

    # Eval/demo field only — lead time between detected pattern and synthetic
    # evaluation event. Same no-leakage rule as true_trigger: the engine must
    # never read this at inference time.
    days_before_actual_action: Optional[int] = None


class Evidence(BaseModel):
    """One piece of evidence a rule used to reach its conclusion."""

    signal: str
    observed_value: str
    threshold_or_reference: str
    contributes_to: TriggerCategory
    weight: float = Field(
        default=0.1,
        description=(
            "Rule-defined contribution score (not a learned weight). "
            "Higher weight = stronger contribution to the overall confidence score. "
            "Displayed as a ranked list in the dashboard."
        ),
    )


class TriggerAssessment(BaseModel):
    """Output of the deterministic rules engine for one account."""

    account_id: str
    predicted_trigger: TriggerCategory
    confidence: float  # 0-1
    evidence: list[Evidence]
    conflicting_signals: bool = False


class InvestigationFinding(BaseModel):
    """
    The AI Investigator's structured output for one hypothesis.
    Every field must be grounded in supplied Evidence — no invented facts.
    """

    hypothesis: TriggerCategory
    confidence: float
    supporting_evidence: list[Evidence]
    contradicting_evidence: list[Evidence]
    missing_information: list[str]
    what_would_change_my_mind: list[str]
    why_not: dict[str, str]  # TriggerCategory.value → one-line explanation why ruled out
    rationale: str


class InvestigationResult(BaseModel):
    """
    Full investigation output from the AI Investigator.
    Produced from TriggerAssessment + Evidence list — never from raw snapshot data.
    """

    account_id: str
    primary_hypothesis: InvestigationFinding
    alternative_hypotheses: list[InvestigationFinding]
    overall_confidence: float
    investigation_summary: str
    recommended_next_steps: list[str]
    evidence_coverage: float = Field(
        default=1.0,
        description="Fraction of factual claims traceable to a known Evidence item. Target: 1.0.",
    )
    ai_available: bool = Field(
        default=True,
        description="False when AI investigation is unavailable and deterministic fallback was used.",
    )


class ResolutionPlan(BaseModel):
    """
    The operator-facing output: what to gather, what to check, what to draft.
    DRAFT ONLY — no send/sent_at/dispatch_status field by design.
    """

    account_id: str
    trigger: TriggerCategory
    document_checklist: list[str]
    operator_checks: list[str] = Field(default_factory=list)
    escalation_draft: str
    sla_target_hours: int
    # Evidence pack fields (expanded per § 7.7)
    trigger_label: str = ""
    relevant_signals: list[str] = Field(default_factory=list)
    supporting_evidence_summary: list[str] = Field(default_factory=list)
    contradicting_evidence_summary: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    investigation_summary: str = ""
    audit_record_id: str = ""


class AuditRecord(BaseModel):
    """
    One immutable log line: what evidence went in, what rule/model fired,
    what decision came out, and why. This is the artifact judges are meant
    to be able to open and follow without asking 'how did it get here?'
    """

    record_id: str
    account_id: str
    timestamp: datetime
    stage: str  # "trigger_assessment" | "decision_gate" | "resolution_draft"
    evidence: list[Evidence]
    rule_or_model: str
    decision: Decision
    rationale: str
    confidence: float
    assessment_hash: str = ""  # see engine/idempotency.py
    investigation_result: Optional[InvestigationResult] = None
