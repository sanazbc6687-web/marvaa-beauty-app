import "server-only";
import type { AuthProvider, DatabaseProvider, ObjectStore, Principal, ProviderRequest } from "./contracts";

export class ProviderHttpError extends Error { constructor(readonly status: number) { super("PROVIDER_REQUEST_FAILED"); } }

export class SupabaseProvider implements AuthProvider, DatabaseProvider, ObjectStore {
  constructor(private readonly url: string, private readonly key: string) {}
  private async raw<T>(path: string, init: RequestInit = {}, token = this.key): Promise<T> {
    const response = await fetch(`${this.url}${path}`, { ...init, cache: "no-store", headers: { apikey: this.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { console.warn("SANO_PROVIDER_REQUEST_FAILED", { provider: "supabase", status: response.status }); throw new ProviderHttpError(response.status); }
    return body as T;
  }
  request<T>({ path, init, accessToken }: ProviderRequest) { return this.raw<T>(path, init, accessToken); }
  authenticate(accessToken: string) { return this.raw<{ id: string; email?: string }>("/auth/v1/user", {}, accessToken).then(user => ({ userId: user.id, email: user.email }) satisfies Principal); }
  signIn(email: string, password: string) { return this.raw("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) }); }
  refresh(refreshToken: string) { return this.raw("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }); }
  async signOut(accessToken: string) { await this.raw("/auth/v1/logout", { method: "POST" }, accessToken); }
  async upload(bucket: string, key: string, body: Blob, accessToken?: string) { await this.raw(`/storage/v1/object/${bucket}/${key}`, { method: "POST", headers: { "Content-Type": body.type || "application/octet-stream", "x-upsert": "false" }, body }, accessToken); }
  async delete(bucket: string, keys: string[], accessToken?: string) { await this.raw(`/storage/v1/object/${bucket}`, { method: "DELETE", body: JSON.stringify({ prefixes: keys }) }, accessToken); }
  async createDownloadUrl(bucket: string, key: string, expiresIn = 300, accessToken?: string) { const result = await this.raw<{ signedURL: string }>(`/storage/v1/object/sign/${bucket}/${key}`, { method: "POST", body: JSON.stringify({ expiresIn }) }, accessToken); return `${this.url}/storage/v1${result.signedURL}`; }
  publicUrl(bucket: string, key: string) { return `${this.url}/storage/v1/object/public/${bucket}/${key}`; }
}
