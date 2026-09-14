export type SafeProviderError = { status: number; code: string };
export function sanitizeProviderStatus(status: number): SafeProviderError {
  if (status === 401) return { status: 401, code: "UPSTREAM_UNAUTHORIZED" };
  if (status === 403) return { status: 403, code: "UPSTREAM_FORBIDDEN" };
  if (status === 409) return { status: 409, code: "UPSTREAM_CONFLICT" };
  if (status >= 400 && status < 500) return { status: 400, code: "UPSTREAM_REQUEST_REJECTED" };
  return { status: 502, code: "UPSTREAM_UNAVAILABLE" };
}
