import Link from "next/link";
import { demoTenant } from "@/lib/tenant";
export function Brand({ admin=false }: { admin?: boolean }) { return <header className="brand"><div className="brand-mark">{demoTenant.consultant.initials}</div><div><b>{demoTenant.consultant.englishName}</b><small>{admin ? "پنل مدیریت سالن" : demoTenant.consultant.title}</small></div>{!admin && <Link href="/admin" className="admin-link">مدیریت</Link>}</header> }
export function Advisor({ children }: { children: React.ReactNode }) { return <div className="advisor"><div className="avatar">{demoTenant.consultant.initials}<i /></div><div className="bubble">{children}</div></div> }
