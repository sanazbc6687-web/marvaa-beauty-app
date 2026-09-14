import { NextResponse } from "next/server";
import { getPublicProviders } from "@/lib/sano/providers";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { action: "signIn" | "refresh" | "signOut" | "verify"; email?: string; password?: string; refreshToken?: string };
    const auth = getPublicProviders().auth;
    if (body.action === "signIn" && body.email && body.password) return NextResponse.json(await auth.signIn(body.email, body.password));
    if (body.action === "refresh" && body.refreshToken) return NextResponse.json(await auth.refresh(body.refreshToken));
    if (body.action === "signOut") { const token = bearer(request); if (token) await auth.signOut(token); return new NextResponse(null, { status: 204 }); }
    if (body.action === "verify") { const token = bearer(request); if (!token) throw new Error("AUTH_REQUIRED"); return NextResponse.json(await auth.authenticate(token)); }
    return NextResponse.json({ error: "INVALID_AUTH_REQUEST" }, { status: 400 });
  } catch { return NextResponse.json({ error: "AUTH_REQUEST_FAILED" }, { status: 401 }); }
}
function bearer(request: Request) { const value = request.headers.get("authorization"); return value?.startsWith("Bearer ") ? value.slice(7) : undefined; }
