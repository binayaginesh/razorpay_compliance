"""
AI Investigator — the reasoning layer of WARDEN.

Role: Interpret already-extracted evidence from the deterministic rules engine.
      Produce: primary hypothesis, alternative hypotheses, supporting/contradicting
      evidence, missing information, what would change the conclusion, why-not
      reasoning per alternative category, investigation summary, recommended next steps.

Critical safety rules (enforced structurally, not just in prompts):
  1. Receives ONLY structured Evidence objects and derived signals — never raw
     merchant snapshot data. Cannot invent facts it wasn't given.
  2. Has ZERO authority to override the Decision Gate.
  3. Must degrade safely if LLM is unavailable — fallback to deterministic template.
  4. LLM failure must never: clear a review, alter thresholds, bypass the gate,
     or send anything externally.

Uses Google Gemini (gemini-2.0-flash) with structured JSON output validated
against InvestigationResult Pydantic model.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

from app.models import (
    Evidence,
    InvestigationFinding,
    InvestigationResult,
    TriggerAssessment,
    TriggerCategory,
)

logger = logging.getLogger(__name__)

_ALL_CATEGORIES = [
    TriggerCategory.KYC_DOCUMENTATION_GAP,
    TriggerCategory.VOLUME_SPIKE,
    TriggerCategory.CHARGEBACK_RATIO,
    TriggerCategory.MCC_MISMATCH,
    TriggerCategory.THIRD_PARTY_FRAUD_LINKAGE,
]

_CATEGORY_LABELS = {
    TriggerCategory.KYC_DOCUMENTATION_GAP: "KYC / Documentation Gap",
    TriggerCategory.VOLUME_SPIKE: "Volume Spike",
    TriggerCategory.CHARGEBACK_RATIO: "Chargeback Ratio",
    TriggerCategory.MCC_MISMATCH: "MCC / Category Mismatch",
    TriggerCategory.THIRD_PARTY_FRAUD_LINKAGE: "Third-Party Fraud Linkage",
    TriggerCategory.HEALTHY: "Healthy (No Trigger)",
    TriggerCategory.UNKNOWN: "Unknown",
}


def _build_prompt(assessment: TriggerAssessment, merchant_name: str) -> str:
    evidence_lines = "\n".join(
        f"  - [{e.contributes_to.value}] signal={e.signal}, "
        f"observed={e.observed_value}, ref={e.threshold_or_reference}, weight={e.weight}"
        for e in assessment.evidence
    )
    categories_list = ", ".join(c.value for c in _ALL_CATEGORIES)

    return f"""You are WARDEN's AI Investigator — a compliance investigation reasoning assistant.

Your job is to reason over already-extracted evidence from a deterministic rules engine.
You MUST NOT invent any facts, transaction values, customer identities, KYC documents,
chargeback events, fraud reports, dates, MCC classifications, or Razorpay internal decisions.
Every factual claim you make MUST be directly traceable to the evidence items provided below.

MERCHANT: {merchant_name}
ACCOUNT ID: {assessment.account_id}
RULES ENGINE OUTPUT:
  Primary trigger detected: {assessment.predicted_trigger.value}
  Confidence: {assessment.confidence:.2f}
  Conflicting signals: {assessment.conflicting_signals}

EVIDENCE ITEMS (these are the ONLY facts you may reference):
{evidence_lines if evidence_lines else "  (no evidence items — account appears healthy)"}

TRIGGER CATEGORIES: {categories_list}

Produce a structured JSON investigation report with this EXACT schema:
{{
  "account_id": "{assessment.account_id}",
  "primary_hypothesis": {{
    "hypothesis": "<one of: {categories_list}, healthy, unknown>",
    "confidence": <0.0-1.0>,
    "supporting_evidence": [
      {{"signal": "...", "observed_value": "...", "threshold_or_reference": "...", "contributes_to": "...", "weight": 0.0}}
    ],
    "contradicting_evidence": [
      {{"signal": "...", "observed_value": "...", "threshold_or_reference": "...", "contributes_to": "...", "weight": 0.0}}
    ],
    "missing_information": ["<what data would help resolve uncertainty>"],
    "what_would_change_my_mind": ["<specific evidence that would shift the conclusion>"],
    "why_not": {{
      "<other_category>": "<one-line explanation grounded in evidence>"
    }},
    "rationale": "<2-3 sentence explanation grounded only in the evidence items above>"
  }},
  "alternative_hypotheses": [
    {{
      "hypothesis": "<category>",
      "confidence": <0.0-1.0>,
      "supporting_evidence": [],
      "contradicting_evidence": [],
      "missing_information": [],
      "what_would_change_my_mind": [],
      "why_not": {{}},
      "rationale": "<one sentence>"
    }}
  ],
  "overall_confidence": <0.0-1.0>,
  "investigation_summary": "<3-4 sentence plain-language summary for a compliance operator>",
  "recommended_next_steps": ["<actionable step for a human operator>"],
  "evidence_coverage": <0.0-1.0>,
  "ai_available": true
}}

Rules:
- Only include supporting_evidence and contradicting_evidence items from the EVIDENCE ITEMS list above.
- why_not must cover all trigger categories NOT chosen as primary hypothesis.
- If evidence is empty (healthy account), primary_hypothesis.hypothesis should be "healthy".
- Keep rationale factual — no speculation beyond what the evidence supports.
- evidence_coverage: estimate what fraction of your factual claims are directly traceable to the evidence (aim for 1.0).
- Return ONLY the JSON object, no markdown, no explanation."""


def _deterministic_fallback(assessment: TriggerAssessment) -> InvestigationResult:
    """
    Safe fallback when AI is unavailable. Returns a structured result labeled
    as deterministic-only. Never clears a review or changes the gate outcome.
    """
    why_not = {
        c.value: f"Not selected as primary hypothesis — insufficient evidence."
        for c in _ALL_CATEGORIES
        if c != assessment.predicted_trigger
    }

    primary = InvestigationFinding(
        hypothesis=assessment.predicted_trigger,
        confidence=assessment.confidence,
        supporting_evidence=assessment.evidence,
        contradicting_evidence=[],
        missing_information=[
            "Full AI investigation unavailable — showing deterministic findings only.",
            "Consider re-running when AI service is available for complete hypothesis analysis.",
        ],
        what_would_change_my_mind=["AI investigation required for full reasoning."],
        why_not=why_not,
        rationale=(
            f"Deterministic rules engine identified {assessment.predicted_trigger.value} "
            f"with confidence {assessment.confidence:.2f}. "
            "AI investigation is currently unavailable; this is the rules-only result."
        ),
    )

    return InvestigationResult(
        account_id=assessment.account_id,
        primary_hypothesis=primary,
        alternative_hypotheses=[],
        overall_confidence=assessment.confidence,
        investigation_summary=(
            f"AI investigation unavailable — showing deterministic findings only. "
            f"Rules engine detected: {assessment.predicted_trigger.value} "
            f"(confidence: {assessment.confidence:.2f}). "
            f"Conflicting signals: {assessment.conflicting_signals}."
        ),
        recommended_next_steps=[
            "Review the deterministic evidence items above.",
            "Re-run investigation when AI service is available for full hypothesis analysis.",
        ],
        evidence_coverage=1.0,
        ai_available=False,
    )


def investigate(
    assessment: TriggerAssessment,
    merchant_name: str = "Unknown Merchant",
) -> InvestigationResult:
    """
    Run the AI Investigator. Returns InvestigationResult.
    Falls back to deterministic template if LLM is unavailable/fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — using deterministic fallback.")
        return _deterministic_fallback(assessment)

    try:
        import google.generativeai as genai  # type: ignore

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        prompt = _build_prompt(assessment, merchant_name)
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,  # low temp for factual, consistent output
                max_output_tokens=2048,
            ),
        )

        raw_text = response.text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        data = json.loads(raw_text)

        # Validate and parse into Pydantic
        result = InvestigationResult.model_validate(data)
        return result

    except json.JSONDecodeError as e:
        logger.error(f"AI Investigator returned malformed JSON: {e} — using fallback.")
        return _deterministic_fallback(assessment)
    except Exception as e:
        logger.error(f"AI Investigator failed ({type(e).__name__}: {e}) — using fallback.")
        return _deterministic_fallback(assessment)
