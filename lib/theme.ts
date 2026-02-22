import { BRAND } from "@/lib/config";

export type ModuleTheme = "safety" | "cleaning" | "social" | "parks" | "neutral";

export const MODULE_THEME_COLORS: Record<ModuleTheme, string> = {
  safety: BRAND.colors.safetyCleaning,
  cleaning: BRAND.colors.safetyCleaning,
  social: BRAND.colors.social,
  parks: BRAND.colors.parks,
  neutral: BRAND.colors.black
};
