import React, { useState, useRef, useEffect } from "react";
import { assessAccount, sendTroubleshootChat } from "../api";
import { DecisionBadge, TriggerBadge, ConfidenceBar, Spinner } from "./Shared";
import { getMerchantDisplayName, getMerchantInitials } from "../utils/merchantNames";

// Demo scenarios — each simulates a different type of freeze event
const DEMO_SCENARIOS = [
  {
    id: "volume_spike",
    icon: "📈",
    accountId: "ACC_VOL_001",
    displayName: "FlashFest Electronics",
    business: "E-Commerce / Retail",
    location: "Surat, GJ",
    initials: "FE",
    balance: "₹12,45,230",
    pendingPayout: "₹2,45,000",
    recentTxns: [
      { id: "TXN-8821", amount: "+₹38,500", desc: "Customer Payment — Bulk Order", time: "2 mins ago" },
      { id: "TXN-8820", amount: "+₹21,200", desc: "Customer Payment — Festival Sale", time: "5 mins ago" },
      { id: "TXN-8819", amount: "+₹57,800", desc: "Customer Payment — Wholesale", time: "9 mins ago" },
      { id: "TXN-8818", amount: "+₹14,900", desc: "Customer Payment — Online Store", time: "14 mins ago" },
    ],
    triggerLabel: "Unusual Volume Surge Detected",
    triggerDetail: "3-day trailing transaction volume is 3.1× your declared monthly baseline — above the 2.5× compliance threshold.",
    actionLabel: "Simulate Diwali Sale Volume Surge",
  },
  {
    id: "kyc_gap",
    icon: "📋",
    accountId: "ACC_KYC_001",
    displayName: "Anand Traders Chandni Chowk",
    business: "Proprietorship / MSME",
    location: "Delhi NCR",
    initials: "AT",
    balance: "₹3,82,100",
    pendingPayout: "₹78,500",
    recentTxns: [
      { id: "TXN-5541", amount: "+₹8,200", desc: "Customer Payment — B2B Invoice", time: "1 min ago" },
      { id: "TXN-5540", amount: "+₹14,500", desc: "Customer Payment — Retail", time: "7 mins ago" },
      { id: "TXN-5539", amount: "+₹6,800", desc: "Customer Payment — Bulk", time: "12 mins ago" },
    ],
    triggerLabel: "KYC Documentation Mismatch",
    triggerDetail: "PAN number on file does not match the GST-linked entity. Settlement payouts are held pending KYC re-verification.",
    actionLabel: "Simulate KYC Verification Failure",
  },
  {
    id: "chargeback",
    icon: "↩",
    accountId: "ACC_NOISY_016",
    displayName: "Glamour Luxe Jewelry Online",
    business: "Digital Goods / Luxury",
    location: "Mumbai, MH",
    initials: "GL",
    balance: "₹8,12,400",
    pendingPayout: "₹1,20,000",
    recentTxns: [
      { id: "TXN-9921", amount: "+₹45,200", desc: "Customer Payment — Premium Jewelry", time: "3 mins ago" },
      { id: "TXN-9920", amount: "-₹18,500", desc: "Dispute Chargeback Filed — Customer", time: "8 mins ago", isChargeback: true },
      { id: "TXN-9919", amount: "+₹62,100", desc: "Customer Payment — Gold Necklace", time: "15 mins ago" },
      { id: "TXN-9918", amount: "-₹12,400", desc: "Dispute Chargeback Filed — Customer", time: "22 mins ago", isChargeback: true },
    ],
    triggerLabel: "Chargeback Ratio Elevated",
    triggerDetail: "Chargeback ratio reached 1.74% of processed volume — exceeding the 1.0% compliance threshold. Payout reserves activated.",
    actionLabel: "Simulate Chargeback Spike",
  },
];

const SUGGESTION_PILLS = [
  "Can I still accept customer payments?",
  "What documents do I need to upload?",
  "How long will this review take?",
  "Why was my account flagged automatically?",
  "Will this affect my Razorpay payment links?",
];

export default function LiveFreezeDemo() {
  const [selectedScenario, setSelectedScenario] = useState(DEMO_SCENARIOS[0]);
  const [phase, setPhase] = useState("idle"); // idle | operating | freezing | frozen
  const [freezeData, setFreezeData] = useState(null);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom of chat on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function handleScenarioChange(scenario) {
    setSelectedScenario(scenario);
    setPhase("idle");
    setFreezeData(null);
    setChatOpen(false);
    setMessages([]);
    setSubmitted(false);
  }

  // Step 1: Show "operating" for 1.5s, then freeze
  async function handleSimulateAction() {
    setPhase("operating");
    setFreezeLoading(true);
    setChatOpen(false);
    setMessages([]);
    setSubmitted(false);

    // Kick off backend assessment at the same time
    const assessPromise = assessAccount(selectedScenario.accountId);

    // Show brief "processing" state, then trigger the freeze
    await new Promise((r) => setTimeout(r, 1600));
    setPhase("freezing");

    try {
      const data = await assessPromise;
      setFreezeData(data);
    } catch (e) {
      console.error("Assessment failed:", e);
    }

    await new Promise((r) => setTimeout(r, 900));
    setPhase("frozen");
    setFreezeLoading(false);

    // Auto-open WARDEN chat after freeze
    setTimeout(() => {
      setChatOpen(true);
      openChatWithGreeting();
    }, 700);
  }

  function openChatWithGreeting() {
    const scenario = selectedScenario;
    const greeting = `Hello! I'm WARDEN Copilot, your AI compliance assistant.\n\n⚡ I've detected a **${scenario.triggerLabel}** on your account. ${scenario.triggerDetail}\n\nYour **incoming customer payments are not affected** — only outgoing settlement payouts to your bank account are temporarily reserved.\n\nHow can I help you resolve this quickly?`;
    setMessages([
      { role: "assistant", text: greeting, time: new Date() },
    ]);
  }

  async function sendMessage(text) {
    if (!text.trim() || chatLoading) return;
    setInputValue("");

    const userMsg = { role: "user", text: text.trim(), time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await sendTroubleshootChat(
        selectedScenario.accountId,
        text.trim(),
        messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.text }))
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.reply, time: new Date() },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "⚠️ Connection issue — please try again. Your account status has not changed.",
          time: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmitDocuments() {
    setSubmitted(true);
    const msg = {
      role: "assistant",
      text: `✅ **Documents submitted successfully!**\n\nYour invoice proofs and compliance documentation have been received by our team. Your case has been escalated to **Expedited Compliance Review**.\n\n⏱️ **SLA: 24 hours** — A Razorpay compliance officer will review your submission and re-enable settlement payouts once verified.\n\nYou can track status under **Razorpay Dashboard → Compliance → Active Cases**.`,
      time: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Page Header */}
      <div className="page-header-row" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">⚡ Live Freeze & WARDEN Troubleshooter Demo</h1>
          <p className="page-description">
            Experience what a merchant sees when their account suddenly freezes — and how WARDEN instantly explains why and what to do.
          </p>
        </div>
        {/* Scenario Selector */}
        <div style={{ display: "flex", gap: 8 }}>
          {DEMO_SCENARIOS.map((s) => (
            <button
              key={s.id}
              className={`btn ${selectedScenario.id === s.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => handleScenarioChange(s)}
            >
              <span>{s.icon}</span>
              <span style={{ fontSize: 12 }}>{s.displayName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Demo Area */}
      <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>

        {/* LEFT: Merchant Portal Simulation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

          {/* Merchant Portal Header */}
          <div
            style={{
              background: phase === "frozen" || phase === "freezing"
                ? "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)"
                : "linear-gradient(135deg, #0c2340 0%, #1e3a5f 100%)",
              borderRadius: 12,
              padding: "16px 20px",
              color: "#fff",
              transition: "background 0.6s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Animated warning flicker */}
            {phase === "freezing" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(239, 68, 68, 0.15)",
                  animation: "alertPulse 0.4s ease-in-out 3",
                  borderRadius: 12,
                }}
              />
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {selectedScenario.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{selectedScenario.displayName}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{selectedScenario.business} · {selectedScenario.location}</div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>WARDEN Surveillance</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: phase === "frozen" ? "#ef4444" : "#10b981",
                      boxShadow: phase === "frozen"
                        ? "0 0 12px #ef4444"
                        : "0 0 8px #10b981",
                      display: "inline-block",
                      animation: phase === "freezing" ? "alertPulse 0.6s infinite" : "none",
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {phase === "idle" && "Monitoring Active"}
                    {phase === "operating" && "Processing Payout..."}
                    {phase === "freezing" && "⚠ Alert Detected!"}
                    {phase === "frozen" && "🔴 Hold Activated"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* FREEZE ALERT BANNER */}
          {(phase === "freezing" || phase === "frozen") && (
            <div
              style={{
                background: "var(--red-bg)",
                border: "2px solid var(--red)",
                borderRadius: 10,
                padding: "14px 18px",
                animation: phase === "freezing" ? "slideDown 0.4s ease" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>🔴</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--red-text)" }}>
                    Settlement Payouts Temporarily Suspended
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--red-text)", opacity: 0.85 }}>
                    Compliance Action Required · Razorpay Merchant Services
                  </div>
                </div>
              </div>

              {/* WARDEN Root Cause — immediate diagnosis */}
              {freezeData && (
                <div
                  style={{
                    background: "rgba(220, 38, 38, 0.06)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    borderRadius: 8,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>✦</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--red-text)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      WARDEN Root Cause Analysis — Immediate
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        background: "var(--red-text)",
                        color: "#fff",
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontWeight: 700,
                      }}
                    >
                      {freezeData.decision?.toUpperCase().replace("_", " ")}
                    </span>
                  </div>

                  {/* Trigger & Confidence */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <TriggerBadge trigger={freezeData.predicted_trigger} />
                    <ConfidenceBar value={freezeData.confidence} />
                  </div>

                  {/* Evidence Signals */}
                  {freezeData.evidence && freezeData.evidence.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {freezeData.evidence.map((ev, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12.5,
                            padding: "7px 10px",
                            background: "#fff",
                            borderRadius: 6,
                            border: "1px solid rgba(220,38,38,0.15)",
                          }}
                        >
                          <span style={{ color: "#374151", fontWeight: 500 }}>{ev.signal}</span>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#dc2626" }}>
                              {ev.observed_value}
                            </span>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>
                              (Threshold: {ev.threshold_or_reference})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* What's still working */}
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 12,
                      fontSize: 12.5,
                    }}
                  >
                    <span style={{ color: "var(--green-text)", fontWeight: 600 }}>
                      ✓ Customer payments: ACTIVE
                    </span>
                    <span style={{ color: "var(--red-text)", fontWeight: 600 }}>
                      ✗ Bank payouts: SUSPENDED
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Balances & Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Available Balance", value: selectedScenario.balance, ok: true },
              {
                label: "Pending Settlement Payout",
                value: selectedScenario.pendingPayout,
                ok: phase !== "frozen",
                warning: phase === "frozen",
              },
              { label: "Today's Received Payments", value: "₹1,32,400", ok: true },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: stat.warning ? "var(--amber-bg)" : "#ffffff",
                  border: `1px solid ${stat.warning ? "var(--amber-border)" : "var(--border-light)"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: stat.warning ? "var(--amber-text)" : "var(--text-main)" }}>
                  {stat.value}
                </div>
                {stat.warning && (
                  <div style={{ fontSize: 11, color: "var(--amber-text)", marginTop: 2 }}>
                    On hold — compliance review
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recent Transactions */}
          <div className="fintech-card" style={{ flex: 1 }}>
            <div className="card-header-bar">
              <div className="card-heading">
                <span>💳</span>
                <span>Recent Transactions</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Live feed</span>
            </div>
            <div className="table-responsive">
              <table className="rzp-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "right" }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedScenario.recentTxns.map((txn) => (
                    <tr key={txn.id}>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{txn.id}</span>
                      </td>
                      <td style={{ fontSize: 13, color: txn.isChargeback ? "var(--red-text)" : "var(--text-main)" }}>
                        {txn.isChargeback ? "↩ " : ""}{txn.desc}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)", color: txn.isChargeback ? "var(--red-text)" : "var(--green-text)" }}>
                        {txn.amount}
                      </td>
                      <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-muted)" }}>
                        {txn.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ display: "flex", gap: 10 }}>
            {phase === "idle" && (
              <>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleSimulateAction}
                >
                  <span>💸</span>
                  <span>Initiate Instant Payout to Bank (₹{selectedScenario.pendingPayout})</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={handleSimulateAction}
                >
                  <span>{selectedScenario.icon}</span>
                  <span>{selectedScenario.actionLabel}</span>
                </button>
              </>
            )}
            {(phase === "operating" || phase === "freezing") && (
              <div
                style={{
                  flex: 1,
                  background: "#f8fafc",
                  border: "1px solid var(--border-light)",
                  borderRadius: 8,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                <Spinner size={16} />
                <span>
                  {phase === "operating" ? "Processing payout request..." : "⚠ Compliance alert detected — investigating..."}
                </span>
              </div>
            )}
            {phase === "frozen" && (
              <button
                className="btn btn-warden"
                style={{ flex: 1 }}
                onClick={() => {
                  setChatOpen(true);
                  if (messages.length === 0) openChatWithGreeting();
                }}
              >
                <span>✦</span>
                <span>Open WARDEN Troubleshooter Chat</span>
              </button>
            )}
            {phase === "frozen" && (
              <button
                className="btn btn-secondary"
                onClick={() => handleScenarioChange(selectedScenario)}
              >
                ↺ Reset Demo
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: WARDEN Troubleshooter Chat */}
        {chatOpen && (
          <div
            style={{
              width: 400,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              border: "1px solid var(--warden-border)",
              borderRadius: 14,
              boxShadow: "var(--shadow-warden)",
              overflow: "hidden",
              animation: "slideInRight 0.35s ease",
            }}
          >
            {/* Chat Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #0c2340 0%, #1e1b4b 100%)",
                padding: "14px 18px",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>✦</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>WARDEN Copilot</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>AI Compliance Troubleshooter</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, opacity: 0.8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", display: "inline-block" }} />
                <span>Active</span>
              </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    gap: 8,
                    alignItems: "flex-end",
                  }}
                >
                  {msg.role === "assistant" && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      ✦
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "9px 13px",
                      borderRadius: msg.role === "user"
                        ? "14px 14px 4px 14px"
                        : "14px 14px 14px 4px",
                      background: msg.role === "user"
                        ? "var(--rzp-blue)"
                        : "#f1f5f9",
                      color: msg.role === "user" ? "#fff" : "var(--text-main)",
                      fontSize: 13,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: "#fff", flexShrink: 0,
                    }}
                  >
                    ✦
                  </div>
                  <div style={{ padding: "10px 14px", background: "#f1f5f9", borderRadius: "14px 14px 14px 4px", display: "flex", gap: 5, alignItems: "center" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--warden-indigo)", animation: "dotPulse 1.2s infinite 0s", display: "inline-block" }} />
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--warden-indigo)", animation: "dotPulse 1.2s infinite 0.2s", display: "inline-block" }} />
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--warden-indigo)", animation: "dotPulse 1.2s infinite 0.4s", display: "inline-block" }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick-Reply Suggestion Pills */}
            {!submitted && (
              <div style={{ padding: "12px 14px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGGESTION_PILLS.map((pill) => (
                  <button
                    key={pill}
                    onClick={() => sendMessage(pill)}
                    disabled={chatLoading}
                    style={{
                      background: "var(--warden-surface)",
                      border: "1px solid var(--warden-border)",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 11.5,
                      color: "var(--warden-indigo)",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {pill}
                  </button>
                ))}
              </div>
            )}

            {/* Submit Documents CTA */}
            {!submitted && messages.length > 1 && (
              <div style={{ padding: "10px 14px 0" }}>
                <button
                  className="btn btn-warden"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleSubmitDocuments}
                >
                  <span>📤</span>
                  <span>Upload Invoices & Request Expedited Review</span>
                </button>
              </div>
            )}

            {submitted && (
              <div
                style={{
                  margin: "10px 14px 0",
                  padding: "10px 14px",
                  background: "var(--green-bg)",
                  border: "1px solid var(--green-border)",
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: "var(--green-text)",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                ✓ Under Expedited Compliance Review — SLA: 24 Hours
              </div>
            )}

            {/* Text Input */}
            <div
              style={{
                padding: "12px 14px 14px",
                display: "flex",
                gap: 8,
                borderTop: "1px solid var(--border-light)",
                marginTop: 10,
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputValue);
                  }
                }}
                placeholder="Ask WARDEN anything about this hold..."
                disabled={chatLoading}
                style={{
                  flex: 1,
                  border: "1px solid var(--border-medium)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "var(--font-sans)",
                  background: chatLoading ? "var(--bg-subtle)" : "#fff",
                }}
              />
              <button
                className="btn btn-warden"
                style={{ padding: "8px 14px", flexShrink: 0 }}
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || chatLoading}
              >
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe animations injected via style tag */}
      <style>{`
        @keyframes alertPulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.4; }
        }
        @keyframes slideDown {
          from { transform: translateY(-12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
