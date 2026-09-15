"use client";

const storageKey = "marvaa.public.session.v2";
let pendingSession: Promise<PublicSession> | undefined;
export type PublicSession = { tenantId: string; sessionId: string; sessionProof: string; tenant: { id: string; slug: string; salonName: string } };

export function getOrCreatePublicSession(): Promise<PublicSession> {
  if (typeof window === "undefined") return Promise.reject(new Error("PUBLIC_SESSION_REQUIRES_BROWSER"));
  const stored = sessionStorage.getItem(storageKey);
  if (stored) try {
    const value = JSON.parse(stored) as PublicSession;
    if (value.sessionId && value.sessionProof && value.tenantId === value.tenant?.id) return Promise.resolve(value);
  } catch { sessionStorage.removeItem(storageKey); }
  if (!pendingSession) pendingSession = createSession().finally(() => { pendingSession = undefined; });
  return pendingSession;
}
async function createSession() {
  const slug = new URLSearchParams(location.search).get("tenant") || undefined;
  const response = await fetch("/api/public/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
  const value = await response.json() as PublicSession;
  if (!response.ok) throw new Error("PUBLIC_SESSION_UNAVAILABLE");
  value.tenantId = value.tenant.id;
  sessionStorage.setItem(storageKey, JSON.stringify(value));
  return value;
}
