import React from "react";

export const DECISION_CONFIG = {
  clear: {
    label: "CLEAR",
    cls: "badge-clear",
    icon: "✓",
    color: "var(--green)",
    desc: "Within normal operating thresholds",
  },
  review_required: {
    label: "REVIEW REQUIRED",
    cls: "badge-review",
    icon: "⚠",
    color: "var(--amber)",
    desc: "Deterministic rule triggered; requires operator attention",
  },
  conflicting_signals: {
    label: "CONFLICTING SIGNALS",
    cls: "badge-conflicting",
    icon: "⟷",
    color: "var(--orange)",
    desc: "Mixed signals detected; human deliberation needed",
  },
  insufficient_data: {
    label: "INSUFFICIENT DATA",
    cls: "badge-insufficient",
    icon: "?",
    color: "var(--purple)",
    desc: "Incomplete snapshot or missing evidence",
  },
};

export const TRIGGER_CONFIG = {
  kyc_documentation_gap: { label: "KYC Gap", icon: "📋", category: "Documentation" },
  volume_spike: { label: "Volume Spike", icon: "📈", category: "Transaction Velocity" },
  chargeback_ratio: { label: "Chargeback Ratio", icon: "↩", category: "Dispute Rate" },
  mcc_mismatch: { label: "MCC Mismatch", icon: "⚡", category: "Category Integrity" },
  third_party_fraud_linkage: { label: "Fraud Linkage", icon: "🔗", category: "Risk Intelligence" },
  healthy: { label: "Healthy", icon: "✓", category: "Standard" },
  unknown: { label: "Unknown Trigger", icon: "•", category: "General" },
};

export function DecisionBadge({ decision }) {
  const cfg = DECISION_CONFIG[decision] || DECISION_CONFIG.insufficient_data;
  return (
    <span className={`badge ${cfg.cls}`}>
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function TriggerBadge({ trigger }) {
  const cfg = TRIGGER_CONFIG[trigger] || TRIGGER_CONFIG.unknown;
  return (
    <span className="badge badge-trigger">
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function ConfidenceBar({ value, showScore = true }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--orange)";

  return (
    <div className="confidence-container">
      <div className="confidence-bar-bg" title={`${pct}% Confidence`}>
        <div
          className="confidence-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showScore && <span className="confidence-score">{pct}%</span>}
    </div>
  );
}

export function StatCard({ label, value, subtext, icon, type, onClick }) {
  let cardClass = "metric-card";
  if (type === "urgent") cardClass += " urgent";
  if (type === "warden") cardClass += " warden-glow-card";

  return (
    <div
      className={cardClass}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {icon && <span className="metric-icon">{icon}</span>}
      </div>
      <div className="metric-value">{value}</div>
      {subtext && <div className="metric-sub">{subtext}</div>}
    </div>
  );
}

export function WardenCopilotChip({ status = "Active" }) {
  return (
    <div className="warden-indicator-chip">
      <span className="warden-spark">
        <span style={{ fontSize: 13 }}>✦</span>
        <span>WARDEN COPILOT</span>
      </span>
      <span style={{ opacity: 0.85, fontSize: 10 }}>{status}</span>
    </div>
  );
}

export function Spinner({ size = 16, color = "var(--rzp-blue)" }) {
  return (
    <div
      className="spinner"
      style={{
        width: size,
        height: size,
        borderTopColor: color,
      }}
    />
  );
}
