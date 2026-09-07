import { TenantConfig } from "./types";

// In production this record is resolved by hostname and loaded from Supabase.
export const demoTenant: TenantConfig = {
  id: "00000000-0000-0000-0000-000000000001", salonName: "استودیو زیبایی مروا",
  consultant: { name: "مروا", englishName: "Marvaa", title: "مشاور زیبایی شما", initials: "م", videoEnabled: true, welcomeMessage: "سلام، من مروا هستم، خوش اومدی. اینجا می‌تونی قبل از اینکه تغییری توی ظاهرت ایجاد کنی، ببینی چه رنگ، مدل یا استایلی بیشتر بهت میاد. اگه هم هنوز نمی‌دونی چی بهت میاد، من کنارت هستم تا با هم پیداش کنیم." },
  theme: { background: "#f8f3e9", surface: "#fffdf8", accent: "#b49a68", rose: "#d8b7ad", text: "#352f2a" },
  contact: { phone: "۰۲۱ ۲۲۳۳ ۴۴۵۵", instagram: "marvaa.beauty", whatsapp: "", telegram: "" }, limits: { anonymous: 1, withContact: 3 }
};
