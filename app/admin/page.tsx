import { BarChart3, Images, Sparkles, Upload, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { services } from "@/lib/catalog";

export default function AdminDashboard(){
 const cards=[{label:"تعداد لیدها",icon:Users},{label:"درخواست‌های جدید",icon:Sparkles},{label:"تعداد شبیه‌سازی‌ها",icon:BarChart3},{label:"تعداد آپلود عکس",icon:Upload},{label:"تعداد رفرنس‌ها",icon:Images},{label:"تعداد نمونه‌کارها",icon:Images}];
 return <AdminShell title="داشبورد" subtitle="نمای کلی کسب‌وکار"><div className="metric-grid">{cards.map(({label,icon:Icon})=><article key={label}><Icon/><b>—</b><span>{label}</span><small>پس از اتصال داده نمایش داده می‌شود</small></article>)}</div><section className="admin-panel"><h2>وضعیت سیستم</h2><div className="status-list"><span><i className="ok"/> {services.length} لاین خدمات در fallback محلی فعال است</span><span><i className="ok"/> تولید تصویر: Mock (بدون API پولی)</span><span><i/> آمار واقعی پس از تنظیم Supabase نمایش داده می‌شود</span></div></section></AdminShell>
}
