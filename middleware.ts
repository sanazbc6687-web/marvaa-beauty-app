import { NextRequest,NextResponse } from "next/server";
export async function middleware(request:NextRequest){
 const {pathname}=request.nextUrl;if(!pathname.startsWith("/admin")||pathname==="/admin/login")return NextResponse.next();
 const token=request.cookies.get("marvaa-admin-token")?.value;if(!token)return NextResponse.redirect(new URL("/admin/login",request.url));
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.redirect(new URL("/admin/login?reason=configuration",request.url));
 const valid=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}}).then(r=>r.ok).catch(()=>false);
 return valid?NextResponse.next():NextResponse.redirect(new URL("/admin/login?reason=session",request.url));
}
export const config={matcher:["/admin/:path*"]};
