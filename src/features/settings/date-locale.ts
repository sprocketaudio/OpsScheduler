export const DATE_LOCALE_VALUES = ["en-GB", "en-US"] as const;

export type DateLocale = (typeof DATE_LOCALE_VALUES)[number];

export const DEFAULT_DATE_LOCALE: DateLocale = "en-GB";

export function normalizeDateLocale(value: string | null | undefined): DateLocale {
  if (value === "en-US") {
    return "en-US";
  }

  return "en-GB";
}

