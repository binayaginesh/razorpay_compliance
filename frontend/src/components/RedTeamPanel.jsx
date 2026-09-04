import React, { useState } from "react";
import { runRedTeam } from "../api";
import { CardSection, Spinner } from "./Shared";

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
    <div className="full-page">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
            🛡 Red Team Mode
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 560 }}>
            Seven adversarial safety scenarios that prove WARDEN fails safely.
            Each test verifies one specific safety guarantee — run these when a judge asks
            "how do I know it won't do something it shouldn't?"
          </p>
        </div>
        <button className="btn btn-danger" onClick={handleRun} disabled={loading} style={{ flexShrink: 0 }}>
          {loading ? <><Spinner size={16} /> Running...</> : "▶ Run All Scenarios"}
        </button>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(252,129,129,0.08)",
          border: "1px solid rgba(252,129,129,0.2)",
          borderRadius: 8,
          color: "var(--red)",
          fontSize: 13,
        }}>
          ⚠ {error}
        </div>
      )}

      {results && (
        <div style={{
          padding: "14px 16px",
          background: results.all_passed ? "rgba(104,211,145,0.06)" : "rgba(252,129,129,0.06)",
          border: `1px solid ${results.all_passed ? "rgba(104,211,145,0.2)" : "rgba(252,129,129,0.2)"}`,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>{results.all_passed ? "✅" : "❌"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: results.all_passed ? "var(--green)" : "var(--red)" }}>
              {results.all_passed ? "All scenarios passed" : "Some scenarios failed"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {results.passed_count}/{results.total} passed · Run at {new Date(results.run_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      <CardSection title="Safety Scenarios" icon="🔬">
        {loading && (
          <div className="loading-row">
            <Spinner /> Running 7 safety scenarios...
          </div>
        )}

        {!loading && !results && (
          <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
            Click "Run All Scenarios" to execute the adversarial test suite
          </div>
        )}

        {results && (
          <div className="redteam-grid">
            {results.results.map((r, i) => (
              <div key={i} className={`redteam-item ${r.passed ? "pass" : "fail"}`}>
                <span className="redteam-icon">
                  {r.passed ? "✅" : "❌"}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="redteam-name">
                    {SCENARIO_ICONS[r.scenario] || "🔧"} Scenario {i + 1}: {r.scenario.replace(/_/g, " ")}
                  </div>
                  <div className="redteam-desc">{r.description}</div>
                  {r.detail && (
                    <div className="redteam-detail">{r.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardSection>

      <CardSection title="What Each Scenario Proves" icon="📖">
        <div className="redteam-grid">
          {[
            { icon: "🌀", name: "Ambiguous Signals", desc: "Conflicting evidence must not produce CLEAR — the system must recognize genuine ambiguity." },
            { icon: "♻", name: "Duplicate Assessment", desc: "Re-clicking Assess with unchanged data produces exactly 1 audit record, not 2." },
            { icon: "⚡", name: "Concurrent Assessment", desc: "10 simultaneous requests produce exactly 1 audit record with no corruption." },
            { icon: "🤖", name: "LLM Failure", desc: "If AI is unavailable, the system falls back to deterministic results — never fails open." },
            { icon: "💉", name: "Prompt Injection", desc: "Adversarial merchant names cannot change the policy outcome. Text is data, not instructions." },
            { icon: "📅", name: "Stale Reassessment", desc: "Changed signals produce a new record while old records stay immutable." },
            { icon: "🔐", name: "Cross-Account Hash Collision", desc: "Two accounts with identical evidence produce two separate records — account_id is in the hash." },
          ].map((s, i) => (
            <div key={i} style={{
              display: "flex",
              gap: 10,
              padding: "10px 12px",
              background: "var(--bg-secondary)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </CardSection>
    </div>
  );
}
