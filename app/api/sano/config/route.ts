import { NextResponse } from "next/server";
import { isPublicProviderConfigured } from "@/lib/sano/providers";

export function GET() { return NextResponse.json({ configured: isPublicProviderConfigured() }); }
