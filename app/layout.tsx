import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "مروا | مشاور زیبایی شما", description: "قبل از تغییر، خودت را ببین." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f3e9" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
