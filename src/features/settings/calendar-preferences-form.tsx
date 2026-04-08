"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DATE_LOCALE_VALUES, type DateLocale } from "@/features/settings/date-locale";
import { THEME_PREFERENCE_VALUES, type ThemePreference } from "@/features/settings/theme";

type CalendarPreferencesFormProps = {
  initialDateLocale: DateLocale;
  initialTheme: ThemePreference;
  initialVisibleEndTime: string;
  initialVisibleStartTime: string;
};

export function CalendarPreferencesForm({
  initialDateLocale,
  initialTheme,
  initialVisibleEndTime,
  initialVisibleStartTime,
}: CalendarPreferencesFormProps) {
  const router = useRouter();
  const [dateLocale, setDateLocale] = useState<DateLocale>(initialDateLocale);
  const [uiTheme, setUiTheme] = useState<ThemePreference>(initialTheme);
  const [visibleStartTime, setVisibleStartTime] = useState(initialVisibleStartTime);
  const [visibleEndTime, setVisibleEndTime] = useState(initialVisibleEndTime);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/users/me/preferences", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dateLocale,
          uiTheme,
          calendarVisibleStartTime: visibleStartTime,
          calendarVisibleEndTime: visibleEndTime,
        }),
      });

      if (!response.ok) {
        let message = "Unable to update settings right now.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          // Keep generic error.
        }

        setErrorMessage(message);
        return;
      }

      document.documentElement.classList.toggle("dark", uiTheme === "dark");
      setSuccessMessage("Settings saved.");
      router.refresh();
      return;
    } catch {
      setErrorMessage("Unable to update settings right now.");
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-1.5 sm:max-w-xs">
        <label htmlFor="date-locale" className="text-sm font-medium">
          Date format
        </label>
        <select
          id="date-locale"
          value={dateLocale}
          onChange={(event) => setDateLocale(event.target.value as DateLocale)}
          disabled={isSubmitting}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:[color-scheme:dark] [&_option]:bg-popover [&_option]:text-popover-foreground"
        >
          {DATE_LOCALE_VALUES.map((locale) => (
            <option key={locale} value={locale}>
              {locale === "en-GB" ? "UK (DD/MM/YYYY)" : "US (MM/DD/YYYY)"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5 sm:max-w-xs">
        <label htmlFor="theme-preference" className="text-sm font-medium">
          Theme
        </label>
        <select
          id="theme-preference"
          value={uiTheme}
          onChange={(event) => setUiTheme(event.target.value as ThemePreference)}
          disabled={isSubmitting}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:[color-scheme:dark] [&_option]:bg-popover [&_option]:text-popover-foreground"
        >
          {THEME_PREFERENCE_VALUES.map((themeValue) => (
            <option key={themeValue} value={themeValue}>
              {themeValue === "dark" ? "Dark" : "Light"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="visible-start-time" className="text-sm font-medium">
            Workday start
          </label>
          <Input
            id="visible-start-time"
            type="time"
            step={900}
            value={visibleStartTime}
            onChange={(event) => setVisibleStartTime(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="visible-end-time" className="text-sm font-medium">
            Workday end
          </label>
          <Input
            id="visible-end-time"
            type="time"
            step={900}
            value={visibleEndTime}
            onChange={(event) => setVisibleEndTime(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save settings"}
        </Button>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
    </form>
  );
}
