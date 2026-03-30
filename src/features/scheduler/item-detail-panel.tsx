"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ItemDetailResponse = {
  item: {
    customer: string | null;
    endDate: string | null;
    endTime: string | null;
    id: string;
    notes: string | null;
    startDate: string | null;
    startTime: string | null;
    targetWeek: string;
    title: string;
  };
};

type ItemDetailPanelProps = {
  itemId: string | null;
  onClose: () => void;
};

export function ItemDetailPanel({ itemId, onClose }: ItemDetailPanelProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (!value) {
      setStartTime("");
      setEndDate("");
      setEndTime("");
    }
  }

  function handleStartTimeChange(value: string) {
    setStartTime(value);
    if (!value) {
      setEndTime("");
    }
  }

  function formatTimeInputValue(value: string | null): string {
    if (!value) {
      return "";
    }
    return value.slice(0, 5);
  }

  function formatTimeApiValue(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.length === 5) {
      return `${trimmed}:00`;
    }

    return trimmed;
  }

  function deriveWeekMondayIso(dateIso: string): string {
    const [yearPart, monthPart, dayPart] = dateIso.split("-");
    const year = Number.parseInt(yearPart ?? "", 10);
    const month = Number.parseInt(monthPart ?? "", 10);
    const day = Number.parseInt(dayPart ?? "", 10);

    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const weekday = utcDate.getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);

    const mondayYear = utcDate.getUTCFullYear();
    const mondayMonth = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
    const mondayDay = String(utcDate.getUTCDate()).padStart(2, "0");
    return `${mondayYear}-${mondayMonth}-${mondayDay}`;
  }

  useEffect(() => {
    if (!itemId) {
      return;
    }

    let isCancelled = false;

    async function loadItem() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/items/${itemId}`);
        if (!response.ok) {
          let error = "Unable to load item details.";
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) {
              error = payload.error;
            }
          } catch {
            // Keep generic message.
          }

          if (!isCancelled) {
            setErrorMessage(error);
          }
          return;
        }

        const payload = (await response.json()) as ItemDetailResponse;
        if (!isCancelled) {
          setTitle(payload.item.title);
          setCustomer(payload.item.customer ?? "");
          setNotes(payload.item.notes ?? "");
          setStartDate(payload.item.startDate ?? "");
          setStartTime(formatTimeInputValue(payload.item.startTime));
          setEndDate(payload.item.endDate ?? "");
          setEndTime(formatTimeInputValue(payload.item.endTime));
        }
      } catch {
        if (!isCancelled) {
          setErrorMessage("Unable to load item details.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadItem();

    return () => {
      isCancelled = true;
    };
  }, [itemId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemId) {
      return;
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setErrorMessage("Title is required.");
      return;
    }

    const normalizedStartDate = startDate.trim();
    const normalizedEndDate = endDate.trim();
    const normalizedStartTime = startTime.trim();
    const normalizedEndTime = endTime.trim();

    if (normalizedEndDate && !normalizedStartDate) {
      setErrorMessage("End date requires a start date.");
      return;
    }

    if (normalizedEndTime && !normalizedStartTime) {
      setErrorMessage("End time requires a start time.");
      return;
    }

    if (normalizedStartTime && normalizedEndDate && !normalizedEndTime) {
      setErrorMessage("Timed items with an end date require an end time.");
      return;
    }

    if (normalizedStartDate && normalizedEndDate && normalizedEndDate < normalizedStartDate) {
      setErrorMessage("End date cannot be earlier than start date.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const placementResponse = await fetch(`/api/items/${itemId}/placement`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(
          normalizedStartDate
            ? {
                placement: {
                  kind: "calendar",
                  startDate: normalizedStartDate,
                  startTime: formatTimeApiValue(normalizedStartTime),
                  endDate: normalizedEndDate || undefined,
                  endTime: formatTimeApiValue(normalizedEndTime),
                  targetWeek: deriveWeekMondayIso(normalizedStartDate),
                },
              }
            : {
                placement: {
                  kind: "bucket",
                },
              },
        ),
      });

      if (!placementResponse.ok) {
        let error = "Unable to save item placement right now.";
        try {
          const payload = (await placementResponse.json()) as { error?: string };
          if (payload.error) {
            error = payload.error;
          }
        } catch {
          // Keep generic message.
        }

        setErrorMessage(error);
        return;
      }

      const response = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: normalizedTitle,
          customer: customer.trim(),
          notes: notes.trim(),
        }),
      });

      if (!response.ok) {
        let error = "Unable to save item right now.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            error = payload.error;
          }
        } catch {
          // Keep generic message.
        }

        setErrorMessage(error);
        return;
      }

      onClose();
      router.refresh();
      return;
    } catch {
      setErrorMessage("Unable to save item right now.");
      return;
    } finally {
      setIsSaving(false);
    }
  }

  if (!itemId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label="Item detail panel"
      onClick={onClose}
    >
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l bg-background p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Item details</h2>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading item...</p>
        ) : (
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <label htmlFor="item-title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="item-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                disabled={isSaving}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="item-customer" className="text-sm font-medium">
                Customer
              </label>
              <Input
                id="item-customer"
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
                maxLength={200}
                disabled={isSaving}
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="item-notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="item-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={4000}
                rows={8}
                disabled={isSaving}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid gap-1.5 rounded-md border p-3">
              <p className="text-sm font-medium">Schedule range</p>
              <p className="text-xs text-muted-foreground">
                Leave start date empty to keep this item in the weekly bucket.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label htmlFor="item-start-date" className="text-sm font-medium">
                    Start date
                  </label>
                  <Input
                    id="item-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => handleStartDateChange(event.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="item-start-time" className="text-sm font-medium">
                    Start time
                  </label>
                  <Input
                    id="item-start-time"
                    type="time"
                    step={900}
                    value={startTime}
                    onChange={(event) => handleStartTimeChange(event.target.value)}
                    disabled={isSaving || !startDate}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="item-end-date" className="text-sm font-medium">
                    End date
                  </label>
                  <Input
                    id="item-end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    disabled={isSaving || !startDate}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="item-end-time" className="text-sm font-medium">
                    End time
                  </label>
                  <Input
                    id="item-end-time"
                    type="time"
                    step={900}
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    disabled={isSaving || !startDate || !startTime}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
              <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {errorMessage ? <p className="mt-3 text-sm text-destructive">{errorMessage}</p> : null}
      </aside>
    </div>
  );
}
