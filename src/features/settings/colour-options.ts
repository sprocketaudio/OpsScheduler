export const STATUS_OUTLINE_COLOURS = {
  cancelled: "#334155",
  complete: "#16a34a",
  fixed: "#dc2626",
  onHold: "#92400e",
} as const;

export const USER_COLOUR_PRESET_VALUES = [
  "#2563eb",
  "#0ea5e9",
  "#0891b2",
  "#7c3aed",
  "#c026d3",
  "#db2777",
  "#f59e0b",
  "#6366f1",
] as const;

export function normalizeColourToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

const RESERVED_STATUS_COLOUR_TOKENS = new Set(
  [
    STATUS_OUTLINE_COLOURS.fixed,
    STATUS_OUTLINE_COLOURS.onHold,
    STATUS_OUTLINE_COLOURS.cancelled,
    STATUS_OUTLINE_COLOURS.complete,
    "rgb(220 38 38)",
    "rgb(146 64 14)",
    "rgb(51 65 85)",
    "rgb(22 163 74)",
    "rgb(220,38,38)",
    "rgb(146,64,14)",
    "rgb(51,65,85)",
    "rgb(22,163,74)",
  ].map((value) => normalizeColourToken(value)),
);

export function isReservedStatusColour(value: string): boolean {
  return RESERVED_STATUS_COLOUR_TOKENS.has(normalizeColourToken(value));
}
