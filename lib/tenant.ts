import { TenantConfig } from "./types";

// Hostname-based tenant resolution can replace this fallback without changing UI code.
export const demoTenant: TenantConfig = {
  id: "00000000-0000-0000-0000-000000000001", salonName: "استودیو زیبایی مروا", salonNameEn: "Marvaa Beauty Studio",
  consultant: { name: "مروا", englishName: "Marvaa", title: "مشاور زیبایی هوشمند", initials: "م", videoEnabled: true, videoUrl: "/videos/marvaa-welcome.mp4", posterUrl: "/images/video-poster.svg", welcomeMessage: "اینجا قبل از هر تغییر، نسخه‌های تازه‌ی خودت رو در آینه می‌بینی؛ با انتخاب خودت یا پیشنهاد من." },
  theme: { background: "#050407", surface: "#100d16", accent: "#d8bd82", purple: "#6f3cff", text: "#f6f0e5" },
  contact: { phone: "۰۲۱ ۲۲۳۳ ۴۴۵۵", instagram: "marvaa.beauty", whatsapp: "", telegram: "" },
  limits: { anonymous: 1, extraAfterLead: 2, maximum: 3, generationEnabled: true }
};
