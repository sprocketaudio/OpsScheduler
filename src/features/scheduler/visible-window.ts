const ISO_TIME_WITH_OPTIONAL_SECONDS_PATTERN = /^\d{2}:\d{2}(?::\d{2})?$/;

export const DEFAULT_VISIBLE_START_TIME = "08:00:00";
export const DEFAULT_VISIBLE_END_TIME = "20:00:00";

function isWithinTimeRange(hours: number, minutes: number, seconds: number): boolean {
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    Number.isInteger(seconds) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59 &&
    seconds >= 0 &&
    seconds <= 59
  );
}

export function normalizeIsoTime(value: string): string | null {
  const trimmed = value.trim();
  if (!ISO_TIME_WITH_OPTIONAL_SECONDS_PATTERN.test(trimmed)) {
    return null;
  }

  const normalized = trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  const [hoursPart, minutesPart, secondsPart] = normalized.split(":");
  const hours = Number.parseInt(hoursPart ?? "", 10);
  const minutes = Number.parseInt(minutesPart ?? "", 10);
  const seconds = Number.parseInt(secondsPart ?? "", 10);

  if (!isWithinTimeRange(hours, minutes, seconds)) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function convertIsoTimeToInputValue(value: string): string {
  return value.slice(0, 5);
}

export function toSeconds(value: string): number {
  const [hoursPart, minutesPart, secondsPart] = value.split(":");
  const hours = Number.parseInt(hoursPart ?? "", 10);
  const minutes = Number.parseInt(minutesPart ?? "", 10);
  const seconds = Number.parseInt(secondsPart ?? "", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export function resolveVisibleWindow(startRaw: string | undefined, endRaw: string | undefined): {
  visibleEndTime: string;
  visibleStartTime: string;
} {
  const parsedStart = startRaw ? normalizeIsoTime(startRaw) : null;
  const parsedEnd = endRaw ? normalizeIsoTime(endRaw) : null;
  const visibleStartTime = parsedStart ?? DEFAULT_VISIBLE_START_TIME;
  const visibleEndTime = parsedEnd ?? DEFAULT_VISIBLE_END_TIME;

  if (toSeconds(visibleStartTime) >= toSeconds(visibleEndTime)) {
    return {
      visibleStartTime: DEFAULT_VISIBLE_START_TIME,
      visibleEndTime: DEFAULT_VISIBLE_END_TIME,
    };
  }

  return {
    visibleStartTime,
    visibleEndTime,
  };
}
