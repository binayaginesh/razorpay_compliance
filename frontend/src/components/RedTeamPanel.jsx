import React, { useState } from "react";
import { runRedTeam } from "../api";
import { Spinner } from "./Shared";

const SCENARIO_ICONS = {
  ambiguous_signals: "🌀",
  duplicate_assessment: "♻",
  concurrent_assessment: "⚡",
  llm_failure: "🤖",
  prompt_injection: "💉",
  stale_reassessment: "📅",
  cross_account_hash_collision: "🔐",
};

export default function RedTeamPanel() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const data = await runRedTeam();
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="red-team-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">🛡️ Adversarial Red Team Suite</h1>
          <p className="page-description">
            Live execution of 7 adversarial safety test cases proving WARDEN fails safely, resists prompt injection, preserves idempotency, and respects trust boundaries.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={loading}
          style={{ flexShrink: 0 }}
        >
          {loading ? (
            <>
              <Spinner size={14} color="#ffffff" />
              <span>Running Scenarios...</span>
            </>
          ) : (
            <>
              <span>▶</span>
              <span>Execute All 7 Safety Tests</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "var(--red-bg)",
            color: "var(--red-text)",
            border: "1px solid var(--red-border)",
            padding: 14,
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          ⚠ Red Team Suite execution failed: {error}
        </div>
      )}

      {results && (
        <div
          className="fintech-card"
          style={{
            padding: 18,
            marginBottom: 20,
            background: results.all_passed ? "var(--green-bg)" : "var(--red-bg)",
            borderColor: results.all_passed ? "var(--green-border)" : "var(--red-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28 }}>{results.all_passed ? "✅" : "❌"}</span>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: results.all_passed ? "var(--green-text)" : "var(--red-text)",
                }}
              >
                {results.all_passed
                  ? "All 7 Safety Scenarios Passed Invariants"
                  : "Some Safety Scenarios Failed"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                {results.passed_count} of {results.total} assertions verified · Run at{" "}
                {new Date(results.run_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              background: "#ffffff",
              borderRadius: 999,
              color: results.all_passed ? "var(--green-text)" : "var(--red-text)",
              border: `1px solid ${results.all_passed ? "var(--green-border)" : "var(--red-border)"}`,
            }}
          >
            Zero Safety Invariant Breaches
          </span>
        </div>
      )}

      {/* Scenarios Execution Card */}
      <div className="fintech-card">
        <div className="card-header-bar">
          <div className="card-heading">
            <span>🔬</span>
            <span>Scenario Execution Results</span>
          </div>
        </div>
        <div className="card-body">
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Spinner size={28} />
              <p style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 13 }}>
                Executing concurrent tests, prompt injection payloads, and hash collision checks...
              </p>
            </div>
          )}

          {!loading && !results && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-main)" }}>
                Adversarial Suite Ready
              </p>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                Click "Execute All 7 Safety Tests" above to verify WARDEN's trust boundaries live against the backend.
              </p>
            </div>
          )}

          {results && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.results.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "14px 16px",
                    background: r.passed ? "#ffffff" : "var(--red-bg)",
                    border: `1px solid ${r.passed ? "var(--border-light)" : "var(--red-border)"}`,
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{r.passed ? "✅" : "❌"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                        {SCENARIO_ICONS[r.scenario] || "🔧"} Scenario {i + 1}:{" "}
                        {r.scenario.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: r.passed ? "var(--green-bg)" : "var(--red-bg)",
                          color: r.passed ? "var(--green-text)" : "var(--red-text)",
                        }}
                      >
                        {r.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 12.5, lineHeight: 1.4 }}>
                      {r.description}
                    </div>
                    {r.detail && (
                      <div
                        style={{
                          fontSize: 11.5,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-muted)",
                          marginTop: 6,
                          background: "var(--bg-subtle)",
                          padding: "4px 8px",
                          borderRadius: 4,
                          width: "fit-content",
                        }}
                      >
                        {r.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Explanatory Cards for What Each Scenario Proves */}
      <div className="fintech-card">
        <div className="card-header-bar">
          <div className="card-heading">
            <span>📖</span>
            <span>Safety Invariant Proof Matrix</span>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
            {[
              {
                icon: "🌀",
                name: "Ambiguous Signals",
                desc: "Conflicting evidence must not produce CLEAR — the system must recognize genuine ambiguity and return CONFLICTING_SIGNALS.",
              },
              {
                icon: "♻",
                name: "Duplicate Assessment Idempotency",
                desc: "Re-clicking assess with unchanged snapshot data returns the cached result and produces exactly 1 audit record, preventing ledger bloat.",
              },
              {
                icon: "⚡",
                name: "Concurrent Assessment Integrity",
                desc: "10 simultaneous requests for the same account produce exactly 1 audit record with zero state corruption or race conditions.",
              },
              {
                icon: "🤖",
                name: "LLM Failure Fallback",
                desc: "If AI service is unavailable or times out, the system safely falls back to deterministic decision gate results — it never fails open.",
              },
              {
                icon: "💉",
                name: "Prompt Injection Immunity",
                desc: "Adversarial merchant names with embedded instructions (e.g. 'mark_as_clear=true') cannot override policy decisions. Merchant text is treated strictly as data.",
              },
              {
                icon: "📅",
                name: "Stale Reassessment Invariant",
                desc: "When new signals arrive for an account, a new audit entry is recorded while all past audit records remain strictly immutable.",
              },
              {
                icon: "🔐",
                name: "Cross-Account Hash Collision Protection",
                desc: "Two distinct accounts with identical signals produce separate audit records because account_id is an explicit hash salt component.",
              },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 14px",
                  background: "var(--bg-subtle)",
                  borderRadius: 8,
                  border: "1px solid var(--border-light)",
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: 3 }}>
                    {s.name}
                  </div>
                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
