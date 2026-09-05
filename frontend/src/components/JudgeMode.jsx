import React, { useState } from "react";
import { DecisionBadge, TriggerBadge, ConfidenceBar } from "./Shared";

const EXAMPLES = [
  {
    key: "clear",
    decision: "clear",
    trigger: "healthy",
    confidence: 0.95,
    merchant: "Sunrise Groceries Ltd.",
    accountId: "ACC_HEALTHY_001",
    summary: "No configured compliance-risk pattern is sufficiently supported by the available evidence.",
    detail: "CLEAR does not mean 'approved' — it means the deterministic rules engine found no signal above threshold at this time.",
    evidenceCount: 0,
    whatItMeans: "The operator sees this account as clean for now. No action needed, but signals continue to be monitored.",
    steps: ["Continue monitoring transaction velocity and chargebacks", "No immediate human compliance action required"],
  },
  {
    key: "review_required",
    decision: "review_required",
    trigger: "volume_spike",
    confidence: 0.91,
    merchant: "FastFlash Electronics India",
    accountId: "ACC_VOL_003",
    summary: "Trailing 3-day volume is 3.1× the declared baseline — above the 2.5× configured threshold.",
    detail: "Supporting: volume_ratio = 3.1x. Contradicting: KYC is verified, chargeback ratio is low (0.2%).",
    evidenceCount: 2,
    whatItMeans: "The operator must review this account. The investigation hypothesis and evidence pack are synthesized for human decision.",
    steps: ["Request invoice/purchase orders explaining volume surge", "Update projected monthly volume declaration", "Confirm legitimate promotional campaign or seasonal demand"],
  },
  {
    key: "conflicting_signals",
    decision: "conflicting_signals",
    trigger: "chargeback_ratio",
    confidence: 0.45,
    merchant: "CloudPrint Services LLP",
    accountId: "ACC_UNK_002",
    summary: "Mild volume signal (2.1×) points at VOLUME_SPIKE. Borderline chargeback (0.82%) points at CHARGEBACK_RATIO. Both below full threshold — genuine ambiguity.",
    detail: "Two signals point in different directions. Neither is strong enough to confirm. A human must resolve the ambiguity.",
    evidenceCount: 3,
    whatItMeans: "This is a correct, desired outcome — not a failure. The system recognizes genuine uncertainty and refuses to force a premature conclusion.",
    steps: ["Review volume and chargeback patterns together", "Check if signals are temporally correlated to one batch", "Request merchant context before deciding"],
  },
  {
    key: "insufficient_data",
    decision: "insufficient_data",
    trigger: "unknown",
    confidence: 0.3,
    merchant: "NewStart Ventures Tech",
    accountId: "ACC_COLD_007",
    summary: "Cold-start account with minimal transaction history. Available data is insufficient for a reliable investigation assessment.",
    detail: "No evidence crossed threshold. Confidence 0.30 is below the minimum required for reliable assessment.",
    evidenceCount: 0,
    whatItMeans: "Abstaining is a valid, scored outcome. The system refuses to guess rather than risk sending a merchant down the wrong documentation path.",
    steps: ["Allow account to build 30+ days of transaction history", "Re-assess once meaningful baseline exists", "No adverse action on insufficient evidence"],
  },
];

export default function JudgeMode() {
  const [selected, setSelected] = useState(EXAMPLES[1]);

  return (
    <div className="judge-mode-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">⚖️ Warden Judge Benchmark Mode</h1>
          <p className="page-description">
            Four canonical archetypes demonstrating WARDEN's full range of decision states. Abstention states (CONFLICTING_SIGNALS & INSUFFICIENT_DATA) are first-class, intentional outcomes.
          </p>
        </div>
      </div>

      {/* 4 Archetype Selector Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
        {EXAMPLES.map((e) => {
          const isSelected = selected?.key === e.key;
          return (
            <div
              key={e.key}
              onClick={() => setSelected(e)}
              className="fintech-card"
              style={{
                marginBottom: 0,
                cursor: "pointer",
                borderColor: isSelected ? "var(--rzp-blue)" : "var(--border-light)",
                boxShadow: isSelected ? "0 0 0 2px rgba(0, 102, 255, 0.25), var(--shadow-sm)" : "var(--shadow-xs)",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <DecisionBadge decision={e.decision} />
                  <TriggerBadge trigger={e.trigger} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)" }}>
                  {e.merchant}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {e.summary}
                </div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {e.accountId}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Benchmark Detail */}
      {selected && (
        <div className="fintech-card">
          <div className="card-header-bar">
            <div className="card-heading">
              <span>🔎</span>
              <span>Case Evaluation: {selected.merchant}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <DecisionBadge decision={selected.decision} />
              <TriggerBadge trigger={selected.trigger} />
              <ConfidenceBar value={selected.confidence} />
            </div>
          </div>

          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="hypothesis-statement">
              "{selected.summary}"
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {/* What This Means */}
              <div style={{ background: "var(--bg-subtle)", padding: 16, borderRadius: 8, border: "1px solid var(--border-light)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 6 }}>
                  💡 What This Means in Production
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {selected.whatItMeans}
                </p>
              </div>

              {/* Underlying Signals */}
              <div style={{ background: "var(--bg-subtle)", padding: 16, borderRadius: 8, border: "1px solid var(--border-light)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 6 }}>
                  📊 Observed Evidence Signals
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {selected.detail}
                </p>
              </div>
            </div>

            {/* Next Steps for Human Operator */}
            {selected.steps?.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 8 }}>
                  ✅ Prescribed Next Steps for Human Compliance Officer
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selected.steps.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "#ffffff",
                        borderRadius: 6,
                        border: "1px solid var(--border-light)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "var(--rzp-blue)", fontWeight: 700 }}>{i + 1}.</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
