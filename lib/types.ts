export type BilingualLabel = { nameFa: string; nameEn: string };
export type Theme = { background: string; surface: string; accent: string; purple: string; text: string };
export type TenantConfig = {
  id: string; salonName: string; salonNameEn: string;
  consultant: { name: string; englishName: string; title: string; initials: string; welcomeMessage: string; videoEnabled: boolean; videoUrl: string; posterUrl?: string; avatarUrl?: string };
  theme: Theme; contact: { phone: string; instagram: string; whatsapp: string; telegram: string };
  limits: { anonymous: number; extraAfterLead: number; maximum: number; generationEnabled: boolean };
};
export type StyleOption = BilingualLabel & { id: string; group?: string; active: boolean; sortOrder: number; referenceId: string; promptFragment: string; generationRules: string[] };
export type OptionGroup = BilingualLabel & { id: string; options: StyleOption[] };
export type Decision = BilingualLabel & { id: string; questionFa: string; questionEn: string; groups: OptionGroup[] };
export type Service = BilingualLabel & { id: string; description: string; icon: string; enabled: boolean; sortOrder: number; decisions: Decision[] };
export type RecommendationMode = "natural" | "signature" | "bold";
export type StyleReference = { id: string; tenantId: string; serviceCategoryId: string; serviceOptionId: string; title: string; slug: string; description: string; referenceImages: StyleReferenceImage[]; primaryReferenceImage?: string; visualRules: string[]; generationRules: string[]; promptFragment: string; negativeConstraints: string[]; active: boolean; sortOrder: number; metadata: Record<string, unknown>; createdAt: string; updatedAt: string };
export type StyleReferenceImage = { id: string; styleReferenceId: string; imageUrl: string; altFa: string; altEn: string; isPrimary: boolean; sortOrder: number };
export type PortfolioItem = { id: string; tenantId: string; serviceCategoryId: string; imageUrl: string; title?: string; caption?: string; sortOrder: number; active: boolean };
export type BeautyProfile = { undertone?: string; preferredColorFamily?: string; preferredIntensity?: string; favoriteLooks: string[]; signatureHair?: string; suggestedLash?: string; preferredMakeup?: string; previousLikedSimulations: string[] };
