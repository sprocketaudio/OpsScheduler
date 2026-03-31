export const THEME_PREFERENCE_VALUES = ["light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCE_VALUES)[number];

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  if (value === "dark") {
    return "dark";
  }
  return "light";
}
