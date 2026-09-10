export const IRANIAN_MOBILE_ERROR="شماره موبایل باید ۱۱ رقمی باشد و با ۰۹ شروع شود.";

const persianDigits="۰۱۲۳۴۵۶۷۸۹";
const arabicIndicDigits="٠١٢٣٤٥٦٧٨٩";

/** Normalizes local digits and harmless visual separators without rewriting country codes. */
export function normalizeIranianMobile(value:string){
 return value
  .replace(/[۰-۹]/g,digit=>String(persianDigits.indexOf(digit)))
  .replace(/[٠-٩]/g,digit=>String(arabicIndicDigits.indexOf(digit)))
  .replace(/[\s\-‐‑‒–—―−­​‌‍⁠·•٬،._()]/g,"");
}

export function isValidIranianMobile(value:string){return /^09\d{9}$/.test(normalizeIranianMobile(value))}
