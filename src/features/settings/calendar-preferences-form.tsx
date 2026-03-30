"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CalendarPreferencesFormProps = {
  initialVisibleEndTime: string;
  initialVisibleStartTime: string;
};

export function CalendarPreferencesForm({
  initialVisibleEndTime,
  initialVisibleStartTime,
}: CalendarPreferencesFormProps) {
  const router = useRouter();
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

      setSuccessMessage("Calendar view settings saved.");
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
