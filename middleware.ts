import { NextRequest,NextResponse } from "next/server";
export async function middleware(request:NextRequest){
 const {pathname}=request.nextUrl;if(!pathname.startsWith("/admin")||pathname==="/admin/login")return NextResponse.next();
 const token=request.cookies.get("marvaa-admin-token")?.value;if(!token)return NextResponse.redirect(new URL("/admin/login",request.url));
 const valid=await fetch(new URL("/api/sano/auth",request.url),{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action:"verify"})}).then(r=>r.ok).catch(()=>false);
 return valid?NextResponse.next():NextResponse.redirect(new URL("/admin/login?reason=session",request.url));
}
export const config={matcher:["/admin/:path*"]};
