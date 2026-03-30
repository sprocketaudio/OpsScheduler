const ISO_WEEK_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function startOfWeekMondayUtc(referenceDate: Date): Date {
  const normalized = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()),
  );
  const dayOfWeek = normalized.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  normalized.setUTCDate(normalized.getUTCDate() + diffToMonday);
  return normalized;
}

export function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatIsoDateUtc(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWeekCommencingLabel(weekStart: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(weekStart);
}

export function parseWeekParamToMondayUtc(weekParam: string | undefined): Date | null {
  if (!weekParam || !ISO_WEEK_DATE_PATTERN.test(weekParam)) {
    return null;
  }

  const parsed = new Date(`${weekParam}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfWeekMondayUtc(parsed);
}
