"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BucketQuickAddProps = {
  targetWeekIso: string;
};

export function BucketQuickAdd({ targetWeekIso }: BucketQuickAddProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setErrorMessage("Title is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: normalizedTitle,
          placement: {
            kind: "bucket",
            targetWeek: targetWeekIso,
          },
        }),
      });

      if (!response.ok) {
        let error = "Unable to create item right now.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            error = payload.error;
          }
        } catch {
          // Keep generic error message.
        }

        setErrorMessage(error);
        return;
      }

      setTitle("");
      setIsEditing(false);
      router.refresh();
      return;
    } catch {
      setErrorMessage("Unable to create item right now.");
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setTitle("");
    setErrorMessage(null);
  }

  if (!isEditing) {
    return (
      <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
        Quick add in bucket
      </Button>
    );
  }

  return (
    <form className="grid gap-2 rounded-md border p-3" onSubmit={handleSubmit}>
      <Input
        autoFocus
        placeholder="New bucket item title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={200}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create"}
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={handleCancel}>
          Cancel
        </Button>
      </div>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </form>
  );
}
