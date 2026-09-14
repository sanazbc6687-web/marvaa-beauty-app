import "server-only";
import { OpenAIBeautyImageProvider } from "@/lib/simulation/provider";
import { SupabaseProvider } from "./supabase";

function required(name: string, fallback?: string) { const value = process.env[name] || (fallback ? process.env[fallback] : undefined); if (!value) throw new Error(`${name}_NOT_CONFIGURED`); return value; }
export function isPublicProviderConfigured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)); }

export function getPublicProviders() {
  const supabase = new SupabaseProvider(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  return { auth: supabase, database: supabase, objectStore: supabase };
}
export function getServiceProviders() {
  const supabase = new SupabaseProvider(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
  return { auth: supabase, database: supabase, objectStore: supabase, ai: new OpenAIBeautyImageProvider() };
}
