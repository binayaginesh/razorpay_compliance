// In production (Vercel), all API calls go to /api/... which is rewritten
// to the backend service internally. In local dev, proxy via vite.config.js.
const BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL  // Vercel service binding (server-side build only)
  : "/api";                              // Browser: relative path, works on Vercel + local proxy

export async function getHealth() {
  const r = await fetch(`${BASE}/health`);
  return r.json();
}

export async function getAccounts() {
  const r = await fetch(`${BASE}/accounts`);
  if (!r.ok) throw new Error("Failed to load accounts");
  return r.json();
}

export async function assessAccount(accountId) {
  const r = await fetch(`${BASE}/accounts/${accountId}/assess`, { method: "POST" });
  if (!r.ok) throw new Error("Assessment failed");
  return r.json();
}

export async function getAuditTrail() {
  const r = await fetch(`${BASE}/audit`);
  if (!r.ok) throw new Error("Failed to load audit trail");
  return r.json();
}

export async function getAuditForAccount(accountId) {
  const r = await fetch(`${BASE}/audit/${accountId}`);
  if (!r.ok) throw new Error("Failed to load account audit");
  return r.json();
}

export async function runRedTeam() {
  const r = await fetch(`${BASE}/redteam/run`, { method: "POST" });
  if (!r.ok) throw new Error("Red Team run failed");
  return r.json();
}

export async function sendTroubleshootChat(accountId, message, history = []) {
  const r = await fetch(`${BASE}/chat/troubleshoot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: accountId,
      message,
      history,
    }),
  });
  if (!r.ok) throw new Error("Failed to send chat message");
  return r.json();
}
