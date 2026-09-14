import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type Claims = { v: 1; tenantId: string; sessionId: string; exp: number };
const encode = (value: string | Buffer) => Buffer.from(value).toString("base64url");
export function issueSessionProof(tenantId: string, sessionId: string, now = Date.now()) {
  const claims: Claims = { v: 1, tenantId, sessionId, exp: Math.floor(now / 1000) + 60 * 60 * 8 };
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${signature(payload)}`;
}
export function verifySessionProof(token: string, tenantId: string, sessionId: string, now = Date.now()): Claims {
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) throw new SessionProofError();
  const expected = signature(payload);
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new SessionProofError();
  let claims: Claims;
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims; } catch { throw new SessionProofError(); }
  if (claims.v !== 1 || claims.tenantId !== tenantId || claims.sessionId !== sessionId || claims.exp <= Math.floor(now / 1000)) throw new SessionProofError();
  return claims;
}
function signature(payload: string) {
  const secret = process.env.PUBLIC_SESSION_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error("PUBLIC_SESSION_SIGNING_SECRET_NOT_CONFIGURED");
  return encode(createHmac("sha256", secret).update(payload).digest());
}
export class SessionProofError extends Error { readonly status = 403; constructor() { super("INVALID_SESSION_PROOF"); } }
