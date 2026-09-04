import React, { useState } from "react";
import { DecisionBadge, TriggerBadge, ConfidenceBar, CardSection } from "./Shared";

const EXAMPLES = [
  {
    key: "clear",
    decision: "clear",
    trigger: "healthy",
    confidence: 0.95,
    merchant: "Sunrise Groceries Ltd.",
    accountId: "ACC_HEALTHY_001",
    summary: "No configured compliance-risk pattern is sufficiently supported by the available evidence.",
    detail: "CLEAR does not mean 'approved' — it means the rules engine found no signal above threshold at this time.",
    evidenceCount: 0,
    whatItMeans: "The operator sees this account as clean for now. No action needed, but signals are monitored.",
    steps: ["Continue monitoring transaction patterns", "No immediate action required"],
  },
  {
    key: "review_required",
    decision: "review_required",
    trigger: "volume_spike",
    confidence: 0.91,
    merchant: "FastFlash Electronics",
    accountId: "ACC_VOL_003",
    summary: "Trailing 3-day volume is 3.1× the declared baseline — above the 2.5× configured threshold.",
    detail: "Supporting: volume_ratio = 3.1x. Contradicting: KYC is verified, chargeback ratio is 0.2%.",
    evidenceCount: 2,
    whatItMeans: "The operator must review this account. The investigation is ready — a human decides what to do with it.",
    steps: ["Request invoice/purchase orders explaining volume surge", "Update projected monthly volume declaration", "Confirm business event (campaign, seasonal demand)"],
  },
  {
    key: "conflicting_signals",
    decision: "conflicting_signals",
    trigger: "chargeback_ratio",
    confidence: 0.45,
    merchant: "CloudPrint Services",
    accountId: "ACC_UNK_002",
    summary: "Mild volume signal (2.1×) points at VOLUME_SPIKE. Borderline chargeback (0.82%) points at CHARGEBACK_RATIO. Both below full threshold — genuine ambiguity.",
    detail: "Two signals point in different directions. Neither is strong enough to confirm. A human must resolve the ambiguity.",
    evidenceCount: 3,
    whatItMeans: "This is a correct, desired outcome — not a failure. The system recognizes genuine uncertainty and refuses to force a conclusion.",
    steps: ["Review both volume and chargeback patterns together", "Check if signals are temporally correlated", "Request merchant context before deciding"],
  },
  {
    key: "insufficient_data",
    decision: "insufficient_data",
    trigger: "unknown",
    confidence: 0.3,
    merchant: "NewStart Ventures",
    accountId: "ACC_COLD_007",
    summary: "Cold-start account with minimal transaction history. Available data is insufficient for a reliable investigation assessment.",
    detail: "No evidence crossed threshold. Confidence 0.30 is below the minimum for reliable assessment.",
    evidenceCount: 0,
    whatItMeans: "Abstaining is a valid, scored outcome. The system refuses to guess rather than risk sending a merchant down the wrong documentation path.",
    steps: ["Allow account to build 30+ days of transaction history", "Re-assess once meaningful baseline exists", "No action on insufficient evidence"],
  },
];

function JudgeCard({ example, selected, onClick }) {
  return (
    <div
      className={`judge-card ${example.key}`}
      onClick={() => onClick(example)}
      style={{ outline: selected ? "2px solid var(--blue)" : "none", outlineOffset: 2 }}
    >
      <div className="row" style={{ marginBottom: 10 }}>
        <DecisionBadge decision={example.decision} />
        <TriggerBadge trigger={example.trigger} />
      </div>
      <div className="judge-card-title">{example.merchant}</div>
      <div className="judge-card-desc">{example.summary}</div>
      <div className="judge-card-example">{example.accountId}</div>
    </div>
  );
}

export default function JudgeMode() {
  const [selected, setSelected] = useState(EXAMPLES[1]);

  return (
    <div className="full-page">
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
          ⚖ Judge Mode
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 600 }}>
          Four canned examples showing WARDEN's full range of outcomes. The two abstention states
          (CONFLICTING_SIGNALS and INSUFFICIENT_DATA) are first-class outcomes — not edge cases.
        </p>
      </div>

      <div className="judge-grid">
        {EXAMPLES.map(e => (
          <JudgeCard
            key={e.key}
            example={e}
            selected={selected?.key === e.key}
            onClick={setSelected}
          />
        ))}
      </div>

      {selected && (
        <CardSection title={`Example: ${selected.merchant}`} icon="🔎">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="row" style={{ gap: 12 }}>
              <DecisionBadge decision={selected.decision} />
              <TriggerBadge trigger={selected.trigger} />
              <ConfidenceBar value={selected.confidence} />
            </div>

            <div className="investigation-summary">
              {selected.summary}
            </div>

            <div>
              <div className="section-label">💡 What This Means</div>
              <div style={{
                padding: "12px 14px",
                background: "var(--bg-secondary)",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}>
                {selected.whatItMeans}
              </div>
            </div>

            <div>
              <div className="section-label">📊 Evidence</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                {selected.detail}
              </div>
            </div>

            {selected.steps?.length > 0 && (
              <div>
                <div className="section-label">✅ Next Steps for Human Operator</div>
                <div className="item-list">
                  {selected.steps.map((s, i) => (
                    <div key={i} className="item-list-item">
                      <span className="item-bullet" style={{ color: "var(--blue)" }}>{i + 1}.</span> {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              padding: "10px 14px",
              background: "var(--blue-dim)",
              border: "1px solid var(--border-accent)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--blue)",
            }}>
              🔒 <strong>Human operator has final authority.</strong> WARDEN prepares the investigation.
              A human decides what to send, what to act on, and whether to restrict the account.
            </div>
          </div>
        </CardSection>
      )}
    </div>
  );
}
