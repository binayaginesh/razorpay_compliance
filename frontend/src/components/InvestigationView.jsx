import React, { useState } from "react";
import {
  DecisionBadge, TriggerBadge, ConfidenceBar,
  EvidenceItem, CardSection, Spinner, getDecisionConfig
} from "./Shared";

function WhyNotSection({ whyNot }) {
  if (!whyNot || Object.keys(whyNot).length === 0) return null;
  return (
    <div>
      <div className="section-label">🚫 Why Not Other Categories</div>
      <div className="why-not-grid">
        {Object.entries(whyNot).map(([cat, reason]) => (
          <div key={cat} className="why-not-item">
            <span className="why-not-cat">{cat.replace(/_/g, " ")}</span>
            <span>{reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingSection({ finding, isPrimary }) {
  const [expanded, setExpanded] = useState(isPrimary);

  return (
    <div className="hypothesis-section">
      <div className="hypothesis-header" onClick={() => setExpanded(e => !e)}>
        <TriggerBadge trigger={finding.hypothesis} />
        {isPrimary && <span className="badge badge-blue" style={{ fontSize: 10 }}>PRIMARY</span>}
        <span className="hypothesis-confidence" style={{ color: finding.confidence >= 0.7 ? "var(--green)" : "var(--yellow)" }}>
          {Math.round(finding.confidence * 100)}%
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="hypothesis-body">
          {finding.rationale && (
            <div className="investigation-summary" style={{ borderLeftColor: isPrimary ? "var(--blue)" : "var(--text-muted)" }}>
              {finding.rationale}
            </div>
          )}

          {finding.supporting_evidence?.length > 0 && (
            <div>
              <div className="section-label">🟢 Supporting Evidence</div>
              <div className="item-list">
                {finding.supporting_evidence.map((e, i) => (
                  <EvidenceItem key={i} evidence={e} type="supporting" />
                ))}
              </div>
            </div>
          )}

          {finding.contradicting_evidence?.length > 0 && (
            <div>
              <div className="section-label">🔴 Contradicting Evidence</div>
              <div className="item-list">
                {finding.contradicting_evidence.map((e, i) => (
                  <EvidenceItem key={i} evidence={e} type="contradicting" />
                ))}
              </div>
            </div>
          )}

          {finding.missing_information?.length > 0 && (
            <div>
              <div className="section-label">❓ Missing Information</div>
              <div className="item-list">
                {finding.missing_information.map((m, i) => (
                  <div key={i} className="item-list-item">
                    <span className="item-bullet">·</span> {m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {finding.what_would_change_my_mind?.length > 0 && (
            <div>
              <div className="section-label">🔄 What Would Change My Mind</div>
              <div className="item-list">
                {finding.what_would_change_my_mind.map((w, i) => (
                  <div key={i} className="item-list-item">
                    <span className="item-bullet">→</span> {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isPrimary && <WhyNotSection whyNot={finding.why_not} />}
        </div>
      )}
    </div>
  );
}

export default function InvestigationView({ data, loading, onAssess }) {
  if (loading) {
    return (
      <div className="detail-panel" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="loading-row" style={{ flexDirection: "column", gap: 12 }}>
          <Spinner size={32} />
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Running investigation...</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Deterministic rules → AI Investigator → Decision Gate</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="detail-panel" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Select a merchant to investigate</div>
          <div className="empty-sub">Choose an account from the list and click Investigate to run the full AI-powered compliance investigation.</div>
        </div>
      </div>
    );
  }

  const { investigation, resolution_plan, evidence } = data;
  const decisionCfg = getDecisionConfig(data.decision);
  const aiAvailable = investigation?.ai_available !== false;

  return (
    <div className="detail-panel">
      {/* ── Header ── */}
      <div className="assessment-header">
        <div className="row" style={{ marginBottom: 12 }}>
          <div>
            <div className="merchant-name">{data.merchant_name}</div>
            <div className="merchant-id">{data.account_id}</div>
          </div>
          <div className="ml-auto row">
            {aiAvailable
              ? <span className="ai-label">🤖 AI Investigation</span>
              : <span className="fallback-label">⚡ Deterministic Mode</span>
            }
            {data.is_replay && (
              <span className="badge badge-loading">♻ Cached</span>
            )}
          </div>
        </div>

        <div className="decision-row">
          <DecisionBadge decision={data.decision} />
          <ConfidenceBar value={data.confidence} />
          <button className="btn btn-primary" onClick={onAssess}>
            🔄 Re-investigate
          </button>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Rationale:</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{data.rationale}</span>
        </div>
      </div>

      {/* ── Investigation Summary ── */}
      {investigation?.investigation_summary && (
        <CardSection title="Investigation Summary" icon="🔬">
          <div className="investigation-summary">
            {investigation.investigation_summary}
          </div>
        </CardSection>
      )}

      {/* ── Primary Hypothesis ── */}
      {investigation?.primary_hypothesis && (
        <CardSection title="Primary Hypothesis" icon="🎯">
          <FindingSection finding={investigation.primary_hypothesis} isPrimary />
        </CardSection>
      )}

      {/* ── Alternative Hypotheses ── */}
      {investigation?.alternative_hypotheses?.length > 0 && (
        <CardSection title="Alternative Hypotheses" icon="⚖">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {investigation.alternative_hypotheses.map((h, i) => (
              <FindingSection key={i} finding={h} isPrimary={false} />
            ))}
          </div>
        </CardSection>
      )}

      {/* ── Recommended Next Steps ── */}
      {investigation?.recommended_next_steps?.length > 0 && (
        <CardSection title="Recommended Next Steps" icon="✅">
          <div className="item-list">
            {investigation.recommended_next_steps.map((s, i) => (
              <div key={i} className="item-list-item">
                <span className="item-bullet" style={{ color: "var(--blue)" }}>{i + 1}.</span>
                {s}
              </div>
            ))}
          </div>
        </CardSection>
      )}

      {/* ── Raw Evidence (deterministic) ── */}
      {evidence?.length > 0 && (
        <CardSection title="Deterministic Evidence" icon="⚙">
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
            Evidence extracted by the rules engine — ranked by weight
          </div>
          <div className="item-list">
            {[...evidence].sort((a, b) => (b.weight || 0) - (a.weight || 0)).map((e, i) => (
              <EvidenceItem key={i} evidence={e} type="supporting" />
            ))}
          </div>
        </CardSection>
      )}

      {/* ── Resolution Plan ── */}
      {resolution_plan && (
        <CardSection title="Resolution Plan" icon="📋">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="row">
              <TriggerBadge trigger={resolution_plan.trigger} />
              <span className="sla-badge">⏱ SLA: {resolution_plan.sla_target_hours}h</span>
            </div>

            {resolution_plan.operator_checks?.length > 0 && (
              <div>
                <div className="section-label">👁 Operator Checks</div>
                <div className="item-list">
                  {resolution_plan.operator_checks.map((c, i) => (
                    <div key={i} className="checklist-item">
                      <span className="checklist-icon">☐</span> {c}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="section-label">📄 Document Checklist</div>
              <div className="item-list">
                {resolution_plan.document_checklist.map((c, i) => (
                  <div key={i} className="checklist-item">
                    <span className="checklist-icon">📎</span> {c}
                  </div>
                ))}
              </div>
            </div>

            {resolution_plan.missing_information?.length > 0 && (
              <div>
                <div className="section-label">❓ Missing Information</div>
                <div className="item-list">
                  {resolution_plan.missing_information.map((m, i) => (
                    <div key={i} className="item-list-item">
                      <span className="item-bullet">·</span> {m}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="section-label">✉ Escalation Draft</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                ⚠ Draft only — human operator must review and send
              </div>
              <div className="escalation-draft">{resolution_plan.escalation_draft}</div>
            </div>
          </div>
        </CardSection>
      )}
    </div>
  );
}
