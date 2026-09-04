"""
Resolution planning: turn a trigger investigation into a full evidence pack
and operator checklist.

DRAFT ONLY — no send/sent_at/dispatch_status field by design. The human
operator is the sole authority to send any communication or submit evidence.

Expanded per § 7.7 to include: trigger, relevant signals, thresholds,
supporting evidence, contradicting evidence, missing information,
investigation summary, and audit record ID — the complete evidence pack
a compliance operator needs to act.
"""
from __future__ import annotations

import os
from typing import Optional

from app.models import (
    Evidence,
    InvestigationResult,
    ResolutionPlan,
    TriggerAssessment,
    TriggerCategory,
)

CHECKLISTS: dict[TriggerCategory, list[str]] = {
    TriggerCategory.KYC_DOCUMENTATION_GAP: [
        "PAN card matching registered business name exactly",
        "GST certificate with current registered address",
        "Authorized signatory ID proof (Aadhaar/Passport/DL)",
        "Latest cancelled cheque or bank proof (not older than 3 months)",
    ],
    TriggerCategory.VOLUME_SPIKE: [
        "Purchase orders or invoices explaining the volume increase",
        "Updated projected monthly volume declaration",
        "Proof of underlying business event (sale, campaign, seasonal demand)",
    ],
    TriggerCategory.CHARGEBACK_RATIO: [
        "Chargeback-by-chargeback evidence log (delivery proof, customer comms)",
        "Refund/return policy as displayed to customers at checkout",
        "Root-cause summary per disputed transaction category",
    ],
    TriggerCategory.MCC_MISMATCH: [
        "Description of actual goods/services sold, with sample invoices",
        "Updated MCC/category correction request",
        "Confirmation that no restricted-category items are being sold",
    ],
    TriggerCategory.THIRD_PARTY_FRAUD_LINKAGE: [
        "Explanation of relationship (if any) to the linked flagged account(s)",
        "Transaction-level evidence distinguishing your activity from theirs",
        "Any law-enforcement or bank correspondence already on file",
    ],
}

OPERATOR_CHECKS: dict[TriggerCategory, list[str]] = {
    TriggerCategory.KYC_DOCUMENTATION_GAP: [
        "Verify KYC document expiry dates and field completeness",
        "Cross-check business name across PAN, GST, and bank proof",
        "Check if signatory ID matches the registered account holder",
    ],
    TriggerCategory.VOLUME_SPIKE: [
        "Compare the trailing 3-day volume against declared baseline in merchant profile",
        "Check for seasonal patterns or known promotional events",
        "Review transaction categories for MCC consistency during the spike period",
    ],
    TriggerCategory.CHARGEBACK_RATIO: [
        "Pull chargeback log and categorize by dispute reason code",
        "Check if chargebacks cluster around specific product lines or dates",
        "Review refund policy visibility on merchant checkout page",
    ],
    TriggerCategory.MCC_MISMATCH: [
        "Review actual transaction category codes vs. declared MCC",
        "Check for restricted-category transaction patterns",
        "Confirm merchant's business description matches observed transaction types",
    ],
    TriggerCategory.THIRD_PARTY_FRAUD_LINKAGE: [
        "Verify nature and recency of fraud linkage (shared device/bank/UPI vs. entity)",
        "Review cybercrime complaint details if available",
        "Check if merchant has prior escalations or account flags",
    ],
}

SLA_HOURS: dict[TriggerCategory, int] = {
    TriggerCategory.KYC_DOCUMENTATION_GAP: 48,
    TriggerCategory.VOLUME_SPIKE: 24,
    TriggerCategory.CHARGEBACK_RATIO: 72,
    TriggerCategory.MCC_MISMATCH: 48,
    TriggerCategory.THIRD_PARTY_FRAUD_LINKAGE: 96,
}


def _template_draft(trigger: TriggerCategory, evidence: list[Evidence], merchant_name: str) -> str:
    evidence_lines = "\n".join(
        f"  - {e.signal}: {e.observed_value} (ref: {e.threshold_or_reference})"
        for e in evidence
    )
    checklist = "\n".join(f"  - {item}" for item in CHECKLISTS.get(trigger, []))
    return (
        f"Subject: Account review follow-up — {merchant_name}\n\n"
        f"Hi team,\n\n"
        f"We'd like to resolve the current account review as quickly as possible. "
        f"Based on the signals below, this appears to be a {trigger.value.replace('_', ' ')} case:\n\n"
        f"{evidence_lines}\n\n"
        f"We're attaching the following documentation to address this directly:\n\n"
        f"{checklist}\n\n"
        f"Please let us know if anything further is needed. Thank you for your time.\n"
    )


def build_resolution_plan(
    assessment: TriggerAssessment,
    merchant_name: str,
    investigation_result: Optional[InvestigationResult] = None,
    audit_record_id: str = "",
) -> ResolutionPlan | None:
    trigger = assessment.predicted_trigger
    if trigger not in CHECKLISTS:
        return None  # HEALTHY / UNKNOWN never get a merchant-facing plan

    draft = _template_draft(trigger, assessment.evidence, merchant_name)

    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            draft = _llm_draft(trigger, assessment.evidence, merchant_name, fallback=draft)
        except Exception:
            # Never let an LLM/network hiccup break the demo — template draft still stands.
            pass

    # Build evidence pack from investigation result if available
    supporting_summary = []
    contradicting_summary = []
    missing_info = []
    inv_summary = ""

    if investigation_result:
        ph = investigation_result.primary_hypothesis
        supporting_summary = [
            f"{e.signal}: {e.observed_value}" for e in ph.supporting_evidence
        ]
        contradicting_summary = [
            f"{e.signal}: {e.observed_value}" for e in ph.contradicting_evidence
        ]
        missing_info = ph.missing_information
        inv_summary = investigation_result.investigation_summary
    else:
        supporting_summary = [
            f"{e.signal}: {e.observed_value}" for e in assessment.evidence
        ]

    relevant_signals = [
        f"{e.signal} = {e.observed_value} (threshold: {e.threshold_or_reference})"
        for e in assessment.evidence
    ]

    return ResolutionPlan(
        account_id=assessment.account_id,
        trigger=trigger,
        document_checklist=CHECKLISTS[trigger],
        operator_checks=OPERATOR_CHECKS.get(trigger, []),
        escalation_draft=draft,
        sla_target_hours=SLA_HOURS[trigger],
        trigger_label=trigger.value.replace("_", " ").title(),
        relevant_signals=relevant_signals,
        supporting_evidence_summary=supporting_summary,
        contradicting_evidence_summary=contradicting_summary,
        missing_information=missing_info,
        investigation_summary=inv_summary,
        audit_record_id=audit_record_id,
    )


def _llm_draft(
    trigger: TriggerCategory, evidence: list[Evidence], merchant_name: str, fallback: str
) -> str:
    """Optional LLM-polished version of the escalation message. Requires anthropic package + API key."""
    import anthropic  # local import so the whole app works without the package installed

    client = anthropic.Anthropic()
    evidence_desc = "; ".join(f"{e.signal}={e.observed_value}" for e in evidence)
    prompt = (
        f"Write a concise, professional escalation email from a merchant named "
        f"'{merchant_name}' to a payment gateway's compliance team, responding to an "
        f"account review triggered by: {trigger.value.replace('_', ' ')}. "
        f"Evidence on file: {evidence_desc}. "
        f"Keep it under 150 words, factual, no exaggerated claims."
    )
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in resp.content if hasattr(b, "text"))
    return text.strip() or fallback
