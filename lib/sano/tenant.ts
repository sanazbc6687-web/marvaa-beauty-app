import "server-only";
import type { AuthProvider, DatabaseProvider, Principal } from "./providers/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class AuthorizationError extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }

export function requireTenantId(value: unknown): string { if (typeof value !== "string" || !UUID.test(value)) throw new AuthorizationError(400, "INVALID_TENANT"); return value; }
export async function authorizeTenant(auth: AuthProvider, database: DatabaseProvider, accessToken: string, tenantId: string): Promise<Principal> {
  const principal = await auth.authenticate(accessToken).catch(() => { throw new AuthorizationError(401, "AUTH_REQUIRED"); });
  const rows = await database.request<{ id: string }[]>({ path: `/rest/v1/salons?select=id&id=eq.${tenantId}&limit=1`, accessToken });
  if (!rows.length) throw new AuthorizationError(403, "TENANT_ACCESS_DENIED");
  return principal;
}
