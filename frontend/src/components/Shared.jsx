import React from "react";

const DECISION_CONFIG = {
  clear: { label: "CLEAR", cls: "badge-clear", icon: "✓", color: "var(--green)" },
  review_required: { label: "REVIEW REQUIRED", cls: "badge-review", icon: "⚠", color: "var(--yellow)" },
  conflicting_signals: { label: "CONFLICTING SIGNALS", cls: "badge-conflicting", icon: "⟷", color: "var(--orange)" },
  insufficient_data: { label: "INSUFFICIENT DATA", cls: "badge-insufficient", icon: "?", color: "var(--purple)" },
};

const TRIGGER_CONFIG = {
  kyc_documentation_gap: { label: "KYC Gap", cls: "badge-kyc", icon: "📋" },
  volume_spike: { label: "Volume Spike", cls: "badge-volume", icon: "📈" },
  chargeback_ratio: { label: "Chargeback", cls: "badge-chargeback", icon: "↩" },
  mcc_mismatch: { label: "MCC Mismatch", cls: "badge-mcc", icon: "⚡" },
  third_party_fraud_linkage: { label: "Fraud Linkage", cls: "badge-fraud", icon: "🔗" },
  healthy: { label: "Healthy", cls: "badge-healthy", icon: "✓" },
  unknown: { label: "Unknown", cls: "badge-unknown", icon: "?" },
};

export function DecisionBadge({ decision }) {
  const cfg = DECISION_CONFIG[decision] || DECISION_CONFIG.insufficient_data;
  return <span className={`badge ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>;
}

export function TriggerBadge({ trigger }) {
  const cfg = TRIGGER_CONFIG[trigger] || TRIGGER_CONFIG.unknown;
  return <span className={`badge ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>;
}

export function ConfidenceBar({ value, color }) {
  const pct = Math.round(value * 100);
  const barColor = color || (pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--orange)");
  return (
    <div className="confidence-bar">
      <div className="confidence-label">
        <span>Confidence</span>
        <span className="font-mono fw-700">{pct}%</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

export function EvidenceItem({ evidence, type = "supporting" }) {
  const icon = type === "supporting" ? "🟢" : type === "contradicting" ? "🔴" : "⚪";
  return (
    <div className="evidence-item">
      <span className="evidence-icon">{icon}</span>
      <div style={{ flex: 1 }}>
        <div className="evidence-signal">{evidence.signal}</div>
        <div className="evidence-value">{evidence.observed_value}</div>
        <div className="evidence-ref">ref: {evidence.threshold_or_reference}</div>
      </div>
      {evidence.weight != null && (
        <span className="evidence-weight">w={evidence.weight.toFixed(2)}</span>
      )}
    </div>
  );
}

export function CardSection({ title, icon, children }) {
  return (
    <div className="card">
      <div className="card-title">
        {icon && <span className="card-title-icon">{icon}</span>}
        {title}
      </div>
      {children}
    </div>
  );
}

export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

export function getDecisionConfig(d) {
  return DECISION_CONFIG[d] || DECISION_CONFIG.insufficient_data;
}

export function getTriggerConfig(t) {
  return TRIGGER_CONFIG[t] || TRIGGER_CONFIG.unknown;
}
