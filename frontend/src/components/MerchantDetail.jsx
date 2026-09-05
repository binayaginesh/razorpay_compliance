import React, { useState } from "react";
import { DecisionBadge, TriggerBadge, ConfidenceBar, Spinner } from "./Shared";
import { getMerchantDisplayName, getMerchantLocation, getMerchantCategory, getMerchantInitials } from "../utils/merchantNames";

export default function MerchantDetail({
  account,
  investigationData,
  investigating,
  onRunInvestigation,
  onBack,
  onViewAuditRecord,
}) {
  const [copiedDraft, setCopiedDraft] = useState(false);

  if (!account) return null;

  const displayName = getMerchantDisplayName(account);
  const location = getMerchantLocation(account);
  const category = getMerchantCategory(account.risk_badge?.trigger);
  const initials = getMerchantInitials(displayName);

  // Unpack backend response structure
  const inv = investigationData?.investigation;
  const finding = inv?.primary_hypothesis || inv?.primary_finding;
  const gate = investigationData
    ? {
        decision: investigationData.decision,
        confidence: investigationData.confidence,
        conflicting_signals: investigationData.conflicting_signals,
        rationale: investigationData.rationale,
        predicted_trigger: investigationData.predicted_trigger,
      }
    : null;
  const resolution = investigationData?.resolution_plan;

  // Evidence list can come from finding supporting_evidence or top-level evidence
  const observedSignals =
    finding?.supporting_evidence && finding.supporting_evidence.length > 0
      ? finding.supporting_evidence
      : investigationData?.evidence || [];

  function handleCopyDraft(text) {
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  }

  return (
    <div className="merchant-detail-page">
      {/* Top Action Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <span>←</span>
          <span>Back to Directory</span>
        </button>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Snapshot Date: {account.snapshot_date ? new Date(account.snapshot_date).toLocaleDateString() : "Live"}
          </span>
          <button
            className="btn btn-warden"
            onClick={() => onRunInvestigation(account.account_id)}
            disabled={investigating}
          >
            {investigating ? (
              <>
                <Spinner size={14} color="#ffffff" />
                <span>Running Warden AI...</span>
              </>
            ) : (
              <>
                <span>✦</span>
                <span>{investigationData ? "Re-run Investigation" : "Investigate with Warden"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Left Profile & Signals, Right Warden Copilot */}
      <div className="merchant-detail-grid">
        {/* Left Column: Merchant Profile & Raw Evidence Signals */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Profile Card */}
          <div className="merchant-profile-card">
            <div className="merchant-avatar-row">
              <div className="merchant-avatar-large">{initials}</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>
                  {displayName}
                </h2>
                <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {account.account_id}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, borderTop: "1px solid var(--border-light)", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Industry Segment</span>
                <span style={{ fontWeight: 600 }}>{category}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Operating Hub</span>
                <span style={{ fontWeight: 600 }}>{location}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Proactive Alert Status</span>
                <DecisionBadge decision={account.risk_badge?.decision} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Signal Category</span>
                <TriggerBadge trigger={account.risk_badge?.trigger} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)" }}>Baseline Confidence</span>
                <ConfidenceBar value={account.risk_badge?.confidence} />
              </div>
            </div>
          </div>

          {/* Deterministic Rule Signals */}
          <div className="fintech-card">
            <div className="card-header-bar">
              <div className="card-heading">
                <span>📡</span>
                <span>Deterministic Observed Signals</span>
              </div>
              <span className="weight-tag">{observedSignals.length || account.risk_badge?.evidence_count || 0} signals</span>
            </div>
            <div className="card-body">
              {observedSignals.length > 0 ? (
                <div className="signal-list">
                  {observedSignals.map((ev, idx) => (
                    <div key={idx} className="signal-row">
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span className="signal-name">{ev.signal}</span>
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                          Ref: {ev.threshold_or_reference}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="signal-val">{ev.observed_value}</div>
                        {ev.weight != null && (
                          <span className="weight-tag">w={ev.weight.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                  {investigating
                    ? "Evaluating evidence signals..."
                    : "Run an investigation to view granular evidence weights."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: WARDEN Intelligence Workspace */}
        <div className="warden-intelligence-container">
          {/* Warden Copilot Banner */}
          <div className="warden-banner">
            <div className="warden-banner-left">
              <div className="warden-banner-badge">
                <span>✦</span>
                <span>Warden Intelligence Copilot</span>
              </div>
              <h3 className="warden-banner-title">AI Compliance Investigation Layer</h3>
              <p className="warden-banner-desc">
                Surfaces the "why" to human operators — reasons over verified signals without send authority.
              </p>
            </div>
          </div>

          {investigating ? (
            <div
              className="fintech-card"
              style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}
            >
              <Spinner size={32} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-main)", marginTop: 16 }}>
                Synthesizing Evidence & Formulating Hypotheses...
              </h3>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                Warden AI is analyzing deterministic signals, evaluating contradictions, and detecting missing data.
              </p>
            </div>
          ) : !investigationData ? (
            <div
              className="fintech-card"
              style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-main)" }}>
                No Active Investigation Session
              </h3>
              <p style={{ fontSize: 13, marginTop: 4, maxWidth: 440, margin: "4px auto 16px" }}>
                Click below to launch Warden AI for deep hypothesis comparison, contradicting signal evaluation, and resolution preparation.
              </p>
              <button
                className="btn btn-warden"
                onClick={() => onRunInvestigation(account.account_id)}
              >
                <span>✦</span>
                <span>Investigate Merchant with Warden</span>
              </button>
            </div>
          ) : (
            <>
              {/* 1. Authoritative Decision Gate Card */}
              {gate && (
                <div className={`decision-gate-card ${gate.decision}`}>
                  <div className="decision-gate-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>
                        {gate.decision === "clear"
                          ? "✓"
                          : gate.decision === "review_required"
                          ? "⚠"
                          : gate.decision === "conflicting_signals"
                          ? "⟷"
                          : "?"}
                      </span>
                      <div>
                        <div className="gate-badge-authoritative">
                          Deterministic Decision Gate · Authoritative
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                          <DecisionBadge decision={gate.decision} />
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Gate Confidence</div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                        {Math.round((gate.confidence || 0) * 100)}%
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 13.5, color: "var(--text-main)", lineHeight: 1.5 }}>
                    <strong>Gate Outcome Rationale:</strong> {gate.rationale || "Evaluated by deterministic rules."}
                  </div>

                  {gate.conflicting_signals && (
                    <div
                      style={{
                        fontSize: 12,
                        background: "var(--orange-bg)",
                        color: "var(--orange-text)",
                        border: "1px solid var(--orange-border)",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontWeight: 500,
                      }}
                    >
                      ⚠ Conflicting signals detected. The system abstains from a definitive recommendation, requiring human operator judgment.
                    </div>
                  )}
                </div>
              )}

              {/* 2. Primary Hypothesis from AI Investigator */}
              {finding && (
                <div className="hypothesis-box">
                  <div className="hypothesis-title">
                    <span>💡</span>
                    <span>Primary Investigation Hypothesis</span>
                    {inv?.ai_available ? (
                      <span className="badge badge-clear" style={{ fontSize: 10, marginLeft: "auto" }}>
                        AI Augmented
                      </span>
                    ) : (
                      <span className="badge badge-review" style={{ fontSize: 10, marginLeft: "auto" }}>
                        Deterministic Fallback
                      </span>
                    )}
                  </div>

                  <div className="hypothesis-statement">
                    "{finding.hypothesis || `Merchant triggered alert for ${account.risk_badge?.trigger}`}"
                  </div>

                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <strong>Investigation Summary:</strong> {finding.rationale || inv?.investigation_summary}
                  </div>

                  {/* Supporting Evidence */}
                  {finding.supporting_evidence && finding.supporting_evidence.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                        SUPPORTING EVIDENCE (WEIGHTED)
                      </div>
                      <div className="evidence-list">
                        {finding.supporting_evidence.map((ev, i) => (
                          <div key={i} className="evidence-item-card">
                            <div className="evidence-left">
                              <div className="evidence-icon-circle supporting">✓</div>
                              <div>
                                <span style={{ fontWeight: 600 }}>{ev.signal}</span>:{" "}
                                <span style={{ fontFamily: "var(--font-mono)", color: "var(--rzp-blue)" }}>
                                  {ev.observed_value}
                                </span>{" "}
                                <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                                  (Ref: {ev.threshold_or_reference})
                                </span>
                              </div>
                            </div>
                            {ev.weight != null && (
                              <span className="weight-tag">w={ev.weight.toFixed(2)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contradicting Evidence */}
                  {finding.contradicting_evidence && finding.contradicting_evidence.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--red-text)", marginBottom: 6 }}>
                        CONTRADICTING EVIDENCE (SIGNALS ARGUING AGAINST HYPOTHESIS)
                      </div>
                      <div className="evidence-list">
                        {finding.contradicting_evidence.map((ev, i) => (
                          <div key={i} className="evidence-item-card" style={{ borderColor: "var(--red-border)" }}>
                            <div className="evidence-left">
                              <div className="evidence-icon-circle contradicting">⟷</div>
                              <div>
                                <span style={{ fontWeight: 600 }}>{ev.signal}</span>:{" "}
                                <span style={{ fontFamily: "var(--font-mono)", color: "var(--red)" }}>
                                  {ev.observed_value}
                                </span>{" "}
                                <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                                  (Ref: {ev.threshold_or_reference})
                                </span>
                              </div>
                            </div>
                            {ev.weight != null && (
                              <span className="weight-tag">w={ev.weight.toFixed(2)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Alternative Hypotheses & "Why Not" Reasoning */}
              {finding?.why_not && Object.keys(finding.why_not).length > 0 && (
                <div className="fintech-card">
                  <div className="card-header-bar">
                    <div className="card-heading">
                      <span>⚖️</span>
                      <span>Alternative Hypotheses & Why-Not Analysis</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
                      Why other candidate explanations were ruled out or ranked lower:
                    </p>
                    <div className="why-not-grid">
                      {Object.entries(finding.why_not).map(([candidate, whyReason]) => (
                        <div key={candidate} className="why-not-card">
                          <div className="why-not-header">
                            <TriggerBadge trigger={candidate} />
                          </div>
                          <div style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                            {whyReason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Missing Information & What Would Change My Mind */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                {/* Missing Information */}
                <div className="fintech-card" style={{ marginBottom: 0 }}>
                  <div className="card-header-bar">
                    <div className="card-heading">
                      <span>❓</span>
                      <span>Missing Information</span>
                    </div>
                  </div>
                  <div className="card-body">
                    {finding?.missing_information && finding.missing_information.length > 0 ? (
                      <ul style={{ paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 6 }}>
                        {finding.missing_information.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                        No missing evidence items identified.
                      </div>
                    )}
                  </div>
                </div>

                {/* What Would Change My Mind */}
                <div className="fintech-card" style={{ marginBottom: 0 }}>
                  <div className="card-header-bar">
                    <div className="card-heading">
                      <span>🔄</span>
                      <span>What Would Change My Mind</span>
                    </div>
                  </div>
                  <div className="card-body">
                    {finding?.what_would_change_my_mind && finding.what_would_change_my_mind.length > 0 ? (
                      <ul style={{ paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 6 }}>
                        {finding.what_would_change_my_mind.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                        No specific threshold reversals recorded.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Resolution Plan & Evidence Pack */}
              {resolution && (
                <div className="fintech-card">
                  <div className="card-header-bar">
                    <div className="card-heading">
                      <span>📋</span>
                      <span>Operator Resolution Plan & Evidence Pack</span>
                    </div>
                    {resolution.sla_target_hours && (
                      <span className="badge badge-trigger">
                        SLA: {resolution.sla_target_hours} Hours Target
                      </span>
                    )}
                  </div>
                  <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Operator Checks */}
                    {resolution.operator_checks && resolution.operator_checks.length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>
                          Operator Action Checklist:
                        </div>
                        <div className="resolution-checklist">
                          {resolution.operator_checks.map((check, i) => (
                            <label key={i} className="checklist-item">
                              <input type="checkbox" className="checklist-checkbox" />
                              <span>{check}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Document Checklist */}
                    {resolution.document_checklist && resolution.document_checklist.length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>
                          Required Merchant Documentation:
                        </div>
                        <div className="resolution-checklist">
                          {resolution.document_checklist.map((doc, i) => (
                            <label key={i} className="checklist-item">
                              <input type="checkbox" className="checklist-checkbox" />
                              <span>{doc}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Escalation Communication Draft */}
                    {resolution.escalation_draft && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
                            Generated Merchant Communication Draft (Read-Only Advice)
                          </span>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleCopyDraft(resolution.escalation_draft)}
                          >
                            {copiedDraft ? "✓ Copied" : "📋 Copy Draft"}
                          </button>
                        </div>
                        <div className="draft-box">{resolution.escalation_draft}</div>
                      </div>
                    )}

                    {/* Immutable Audit Link */}
                    {resolution.audit_record_id && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "var(--bg-subtle)",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>🔒</span>
                          <span style={{ color: "var(--text-muted)" }}>Immutable Audit Record ID:</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                            {resolution.audit_record_id}
                          </span>
                        </div>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => onViewAuditRecord(resolution.audit_record_id)}
                        >
                          View in Audit Log →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
