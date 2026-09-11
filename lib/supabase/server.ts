import "server-only";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function assertServerSupabase() {
  if (!url || !serviceKey) throw new Error("SERVER_SUPABASE_NOT_CONFIGURED");
  return { url, serviceKey };
}

export async function serverRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = assertServerSupabase();
  const response = await fetch(`${config.url}${path}`, { ...init, cache: "no-store", headers: {
    apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json", ...init.headers,
  }});
  const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error("SUPABASE_ERROR_DETAIL", {
    status: response.status,
    path,
    responseBody: body,
  });

  throw new Error(`SUPABASE_SERVER_REQUEST_FAILED_${response.status}`);
}
  return body as T;
}

export async function serverUpload(bucket: string, path: string, body: Blob, upsert = false) {
  const config = assertServerSupabase();
  const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${path}`, { method: "POST", body, headers: {
    apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, "Content-Type": body.type, "x-upsert": String(upsert),
  }});
  if (!response.ok) throw new Error(`SUPABASE_SERVER_UPLOAD_FAILED_${response.status}`);
}

export async function serverSignedUrl(bucket: string, path: string) {
  const result = await serverRequest<{ signedURL: string }>(`/storage/v1/object/sign/${bucket}/${path}`, { method: "POST", body: JSON.stringify({ expiresIn: 300 }) });
  return `${assertServerSupabase().url}/storage/v1${result.signedURL}`;
}
