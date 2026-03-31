"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  isReservedStatusColour,
  normalizeColourToken,
  USER_COLOUR_PRESET_VALUES,
} from "@/features/settings/colour-options";

type AdminColourSettingsFormProps = {
  initialDefaultColour: string;
  initialUsers: Array<{
    colour: string;
    email: string;
    id: string;
    name: string;
  }>;
};

type ColourSwatchPickerProps = {
  disabled: boolean;
  onChange: (value: string) => void;
};

function normalizeColour(value: string): string {
  return value.trim();
}

function ColourSwatchPicker({ disabled, onChange }: ColourSwatchPickerProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-md border bg-muted/20 p-2">
      {USER_COLOUR_PRESET_VALUES.map((colourValue) => {
        return (
          <button
            key={colourValue}
            type="button"
            aria-label={`Select colour ${colourValue}`}
            title={colourValue}
            onClick={() => onChange(colourValue)}
            disabled={disabled}
            className={[
              "size-7 rounded-[2px] border border-slate-300 transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
            style={{ backgroundColor: colourValue }}
          />
        );
      })}
    </div>
  );
}

export function AdminColourSettingsForm({
  initialDefaultColour,
  initialUsers,
}: AdminColourSettingsFormProps) {
  const router = useRouter();
  const [defaultColour, setDefaultColour] = useState(initialDefaultColour);
  const [userColours, setUserColours] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialUsers.map((user) => [user.id, user.colour])),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openPickerKey, setOpenPickerKey] = useState<string | null>(null);

  const duplicateColourValues = useMemo(() => {
    const occurrenceCounts = new Map<string, number>();

    for (const colour of Object.values(userColours)) {
      const normalized = normalizeColourToken(colour);
      occurrenceCounts.set(normalized, (occurrenceCounts.get(normalized) ?? 0) + 1);
    }

    return new Set(
      Array.from(occurrenceCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([value]) => value),
    );
  }, [userColours]);

  const defaultMatchesUserColour = useMemo(() => {
    const normalizedDefault = normalizeColourToken(defaultColour);
    return Object.values(userColours).some(
      (value) => normalizeColourToken(value) === normalizedDefault,
    );
  }, [defaultColour, userColours]);

  function handleUserColourChange(userId: string, colour: string) {
    setUserColours((previous) => ({
      ...previous,
      [userId]: colour,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const hasDuplicateUserColour = Object.values(userColours).some((value) =>
      duplicateColourValues.has(normalizeColourToken(value)),
    );

    if (hasDuplicateUserColour) {
      setErrorMessage("Each user must have a unique colour.");
      setIsSubmitting(false);
      return;
    }

    if (isReservedStatusColour(defaultColour)) {
      setErrorMessage("Default colour cannot use reserved status colours.");
      setIsSubmitting(false);
      return;
    }

    if (defaultMatchesUserColour) {
      setErrorMessage("Default colour must be different from all user colours.");
      setIsSubmitting(false);
      return;
    }

    if (Object.values(userColours).some((colour) => isReservedStatusColour(colour))) {
      setErrorMessage("Reserved status colours cannot be assigned to users.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/colour-settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          defaultColour: normalizeColour(defaultColour),
          userColours: initialUsers.map((user) => ({
            userId: user.id,
            colour: normalizeColour(userColours[user.id] ?? user.colour),
          })),
        }),
      });

      if (!response.ok) {
        let message = "Unable to update colour settings right now.";
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

      setSuccessMessage("Admin colour settings saved.");
      router.refresh();
    } catch {
      setErrorMessage("Unable to update colour settings right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2 rounded-md border p-3">
        <label className="text-sm font-medium">Default item colour</label>
        <div>
          <button
            type="button"
            onClick={() => setOpenPickerKey((previous) => (previous === "default" ? null : "default"))}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="size-4 rounded-[2px] border border-slate-300" style={{ backgroundColor: defaultColour }} aria-hidden="true" />
            Change
          </button>
        </div>
        {openPickerKey === "default" ? (
          <ColourSwatchPicker
            onChange={(nextColour) => {
              setDefaultColour(nextColour);
              setOpenPickerKey(null);
            }}
            disabled={isSubmitting}
          />
        ) : null}
        {defaultMatchesUserColour ? (
          <p className="text-xs text-destructive">Default colour must be different from all user colours.</p>
        ) : null}
      </div>

      <div className="grid gap-2 rounded-md border p-3">
        {initialUsers.map((user) => {
          const selectedColour = userColours[user.id] ?? user.colour;
          const isDuplicate = duplicateColourValues.has(normalizeColourToken(selectedColour));
          const pickerKey = `user:${user.id}`;

          return (
            <div key={user.id} className="grid gap-2 border-b pb-3 last:border-b-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setOpenPickerKey((previous) => (previous === pickerKey ? null : pickerKey))}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className="size-4 rounded-[2px] border border-slate-300"
                    style={{ backgroundColor: selectedColour }}
                    aria-hidden="true"
                  />
                  Change
                </button>
              </div>
              {openPickerKey === pickerKey ? (
                <ColourSwatchPicker
                  onChange={(nextColour) => {
                    handleUserColourChange(user.id, nextColour);
                    setOpenPickerKey(null);
                  }}
                  disabled={isSubmitting}
                />
              ) : null}
              {isDuplicate ? <p className="text-xs text-destructive">Duplicate colour selected.</p> : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save admin colours"}
        </Button>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
    </form>
  );
}
