import { NextResponse } from "next/server";
import { getPublicProviders } from "@/lib/sano/providers";

export function GET(_request: Request, context: { params: Promise<{ bucket: string; key: string[] }> }) {
  return context.params.then(({ bucket, key }) => {
    if (bucket !== "salon-portfolio" || key.some(part => part === "..")) return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });
    return NextResponse.redirect(getPublicProviders().objectStore.publicUrl(bucket, key.join("/")));
  });
}
