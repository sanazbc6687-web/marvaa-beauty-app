import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={title:"آینه مروا | Future Mirror",description:"قبل از تغییر، خودت را یک قدم جلوتر ببین."};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#050407"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>}
