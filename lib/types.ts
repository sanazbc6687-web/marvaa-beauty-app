export type Theme = { background: string; surface: string; accent: string; rose: string; text: string };
export type TenantConfig = { id: string; salonName: string; consultant: { name: string; englishName: string; title: string; initials: string; welcomeMessage: string; videoEnabled: boolean; videoUrl?: string }; theme: Theme; contact: { phone: string; instagram: string; whatsapp: string; telegram: string }; limits: { anonymous: number; withContact: number } };
export type Service = { id: string; title: string; description: string; icon: string; enabled: boolean };
export type WizardQuestion = { id: string; question: string; hint?: string; options: string[] };
