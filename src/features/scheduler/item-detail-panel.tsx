"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ItemDetailResponse = {
  item: {
    assigneeId: string | null;
    cancelled: boolean;
    customer: string | null;
    done: boolean;
    endDate: string | null;
    endTime: string | null;
    fixed: boolean;
    id: string;
    notes: string | null;
    onHold: boolean;
    startDate: string | null;
    startTime: string | null;
    targetWeek: string;
    title: string;
  };
  assignableUsers: Array<{
    colour: string;
    email: string;
    id: string;
    name: string;
  }>;
};

type ItemDetailPanelProps = {
  itemId: string | null;
  onClose: () => void;
  onStatusSync?: (payload: {
    cancelled: boolean;
    done: boolean;
    fixed: boolean;
    itemId: string;
    onHold: boolean;
  }) => void;
  refreshToken?: number;
  scheduleSync?: {
    endDate: string;
    endTime: string;
    itemId: string;
    seq: number;
    startDate: string;
    startTime: string;
  } | null;
};

type ItemDraft = {
  assigneeId: string;
  customer: string;
  endDate: string;
  endTime: string;
  isCancelled: boolean;
  isDone: boolean;
  isFixed: boolean;
  isOnHold: boolean;
  notes: string;
  startDate: string;
  startTime: string;
  title: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

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

function areDraftsEqual(left: ItemDraft, right: ItemDraft): boolean {
  return (
    left.title === right.title &&
    left.customer === right.customer &&
    left.notes === right.notes &&
    left.assigneeId === right.assigneeId &&
    left.isFixed === right.isFixed &&
    left.isOnHold === right.isOnHold &&
    left.isCancelled === right.isCancelled &&
    left.isDone === right.isDone &&
    left.startDate === right.startDate &&
    left.startTime === right.startTime &&
    left.endDate === right.endDate &&
    left.endTime === right.endTime
  );
}

function validateDraft(draft: ItemDraft): string | null {
  const normalizedTitle = draft.title.trim();
  if (!normalizedTitle) {
    return "Title is required.";
  }

  const normalizedStartDate = draft.startDate.trim();
  const normalizedEndDate = draft.endDate.trim();
  const normalizedStartTime = draft.startTime.trim();
  const normalizedEndTime = draft.endTime.trim();

  if (normalizedEndDate && !normalizedStartDate) {
    return "End date requires a start date.";
  }

  if (normalizedEndTime && !normalizedStartTime) {
    return "End time requires a start time.";
  }

  if (normalizedStartTime && normalizedEndDate && !normalizedEndTime) {
    return "Timed items with an end date require an end time.";
  }

  if (normalizedStartDate && normalizedEndDate && normalizedEndDate < normalizedStartDate) {
    return "End date cannot be earlier than start date.";
  }

  return null;
}

export function ItemDetailPanel({
  itemId,
  onClose,
  onStatusSync,
  refreshToken = 0,
  scheduleSync = null,
}: ItemDetailPanelProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [isFixed, setIsFixed] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [assignableUsers, setAssignableUsers] = useState<ItemDetailResponse["assignableUsers"]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedDraft, setLastSavedDraft] = useState<ItemDraft | null>(null);
  const activeItemIdRef = useRef<string | null>(itemId);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSequenceRef = useRef(0);

  const currentDraft: ItemDraft = useMemo(
    () => ({
      title,
      customer,
      notes,
      assigneeId,
      isFixed,
      isOnHold,
      isCancelled,
      isDone,
      startDate,
      startTime,
      endDate,
      endTime,
    }),
    [
      title,
      customer,
      notes,
      assigneeId,
      isFixed,
      isOnHold,
      isCancelled,
      isDone,
      startDate,
      startTime,
      endDate,
      endTime,
    ],
  );

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

  const persistDraft = useCallback(
    async (draft: ItemDraft) => {
      const activeItemId = itemId;
      if (!activeItemId) {
        return;
      }

      const validationError = validateDraft(draft);
      if (validationError) {
        if (activeItemIdRef.current === activeItemId) {
          setErrorMessage(validationError);
          setSaveStatus("error");
        }
        return;
      }

      const sequence = ++saveSequenceRef.current;
      if (activeItemIdRef.current === activeItemId) {
        setIsSaving(true);
        setSaveStatus("saving");
        setErrorMessage(null);
      }

      const normalizedTitle = draft.title.trim();
      const normalizedStartDate = draft.startDate.trim();
      const normalizedEndDate = draft.endDate.trim();
      const normalizedStartTime = draft.startTime.trim();
      const normalizedEndTime = draft.endTime.trim();

      try {
        const placementResponse = await fetch(`/api/items/${activeItemId}/placement`, {
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
          let error = "Unable to autosave item placement right now.";
          try {
            const payload = (await placementResponse.json()) as { error?: string };
            if (payload.error) {
              error = payload.error;
            }
          } catch {
            // Keep generic message.
          }

          if (activeItemIdRef.current === activeItemId && sequence === saveSequenceRef.current) {
            setErrorMessage(error);
            setSaveStatus("error");
          }
          return;
        }

        const response = await fetch(`/api/items/${activeItemId}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            title: normalizedTitle,
            customer: draft.customer.trim(),
            notes: draft.notes.trim(),
            assigneeId: draft.assigneeId || null,
            fixed: draft.isFixed,
            onHold: draft.isOnHold,
            cancelled: draft.isCancelled,
            done: draft.isDone,
          }),
        });

        if (!response.ok) {
          let error = "Unable to autosave item right now.";
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) {
              error = payload.error;
            }
          } catch {
            // Keep generic message.
          }

          if (activeItemIdRef.current === activeItemId && sequence === saveSequenceRef.current) {
            setErrorMessage(error);
            setSaveStatus("error");
          }
          return;
        }

        if (activeItemIdRef.current === activeItemId && sequence === saveSequenceRef.current) {
          onStatusSync?.({
            itemId: activeItemId,
            fixed: draft.isFixed,
            onHold: draft.isOnHold,
            cancelled: draft.isCancelled,
            done: draft.isDone,
          });
          setLastSavedDraft(draft);
          setSaveStatus("saved");
          setErrorMessage(null);
          router.refresh();
        }
      } catch {
        if (activeItemIdRef.current === activeItemId && sequence === saveSequenceRef.current) {
          setErrorMessage("Unable to autosave item right now.");
          setSaveStatus("error");
        }
      } finally {
        if (activeItemIdRef.current === activeItemId && sequence === saveSequenceRef.current) {
          setIsSaving(false);
        }
      }
    },
    [itemId, onStatusSync, router],
  );

  useEffect(() => {
    activeItemIdRef.current = itemId;
  }, [itemId, refreshToken]);

  useEffect(() => {
    if (!itemId || !scheduleSync || scheduleSync.itemId !== itemId) {
      return;
    }

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    setStartDate(scheduleSync.startDate);
    setStartTime(scheduleSync.startTime);
    setEndDate(scheduleSync.endDate);
    setEndTime(scheduleSync.endTime);

    setLastSavedDraft((previous) => {
      const baseline = previous ?? {
        title,
        customer,
        notes,
        assigneeId,
        isFixed,
        isOnHold,
        isCancelled,
        isDone,
        startDate,
        startTime,
        endDate,
        endTime,
      };

      return {
        ...baseline,
        startDate: scheduleSync.startDate,
        startTime: scheduleSync.startTime,
        endDate: scheduleSync.endDate,
        endTime: scheduleSync.endTime,
      };
    });
    setSaveStatus("saved");
    setErrorMessage(null);
  }, [
    itemId,
    scheduleSync,
    title,
    customer,
    notes,
    assigneeId,
    isFixed,
    isOnHold,
    isCancelled,
    isDone,
    startDate,
    startTime,
    endDate,
    endTime,
  ]);

  useEffect(() => {
    if (!itemId) {
      setIsLoading(false);
      setIsSaving(false);
      setSaveStatus("idle");
      setErrorMessage(null);
      setLastSavedDraft(null);
      return;
    }

    let requestCancelled = false;

    async function loadItem() {
      setIsLoading(true);
      setErrorMessage(null);
      setSaveStatus("idle");

      try {
        const response = await fetch(`/api/items/${itemId}?refresh=${refreshToken}`, {
          cache: "no-store",
        });
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

          if (!requestCancelled) {
            setErrorMessage(error);
            setSaveStatus("error");
          }
          return;
        }

        const payload = (await response.json()) as ItemDetailResponse;
        if (!requestCancelled) {
          const loadedDraft: ItemDraft = {
            title: payload.item.title,
            customer: payload.item.customer ?? "",
            notes: payload.item.notes ?? "",
            assigneeId: payload.item.assigneeId ?? "",
            isFixed: payload.item.fixed,
            isOnHold: payload.item.onHold,
            isCancelled: payload.item.cancelled,
            isDone: payload.item.done,
            startDate: payload.item.startDate ?? "",
            startTime: formatTimeInputValue(payload.item.startTime),
            endDate: payload.item.endDate ?? "",
            endTime: formatTimeInputValue(payload.item.endTime),
          };

          setTitle(loadedDraft.title);
          setCustomer(loadedDraft.customer);
          setNotes(loadedDraft.notes);
          setAssigneeId(loadedDraft.assigneeId);
          setIsFixed(loadedDraft.isFixed);
          setIsOnHold(loadedDraft.isOnHold);
          setIsCancelled(loadedDraft.isCancelled);
          setIsDone(loadedDraft.isDone);
          setStartDate(loadedDraft.startDate);
          setStartTime(loadedDraft.startTime);
          setEndDate(loadedDraft.endDate);
          setEndTime(loadedDraft.endTime);
          setLastSavedDraft(loadedDraft);
          setAssignableUsers(payload.assignableUsers);
          setSaveStatus("idle");
        }
      } catch {
        if (!requestCancelled) {
          setErrorMessage("Unable to load item details.");
          setSaveStatus("error");
        }
      } finally {
        if (!requestCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadItem();

    return () => {
      requestCancelled = true;
    };
  }, [itemId, refreshToken]);

  useEffect(() => {
    if (!itemId || isLoading || !lastSavedDraft) {
      return;
    }

    if (areDraftsEqual(currentDraft, lastSavedDraft)) {
      return;
    }

    const validationError = validateDraft(currentDraft);
    if (validationError) {
      setErrorMessage(validationError);
      setSaveStatus("error");
      return;
    }

    setErrorMessage(null);

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      void persistDraft(currentDraft);
    }, 600);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
    };
  }, [
    itemId,
    isLoading,
    lastSavedDraft,
    currentDraft,
    persistDraft,
  ]);

  const hasUnsavedChanges =
    !!lastSavedDraft &&
    !areDraftsEqual(currentDraft, lastSavedDraft);
  const effectiveEndDate = startDate ? endDate || startDate : "";
  const statusLabel = isLoading
    ? "Loading..."
    : isSaving
      ? "Saving..."
      : saveStatus === "error"
        ? "Autosave paused"
        : hasUnsavedChanges
          ? "Unsaved changes"
          : saveStatus === "saved"
            ? "Saved"
            : "All changes saved";

  if (!itemId) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full justify-end"
      role="dialog"
      aria-modal={false}
      aria-label="Item detail panel"
    >
      <aside
        className="pointer-events-auto h-full w-full max-w-md overflow-y-auto border-l bg-background p-4 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Item details</h2>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading item...</p>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="item-title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="item-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                disabled={isLoading}
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
                disabled={isLoading}
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
                disabled={isLoading}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid gap-1.5 rounded-md border p-3">
              <div className="grid gap-2">
                <label htmlFor="item-assignee" className="text-sm font-medium">
                  Assignee
                </label>
                <select
                  id="item-assignee"
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  disabled={isLoading}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
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
                    disabled={isLoading}
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
                    disabled={isLoading || !startDate}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="item-end-date" className="text-sm font-medium">
                    End date
                  </label>
                  <Input
                    id="item-end-date"
                    type="date"
                    value={effectiveEndDate}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (!startDate || !nextValue || nextValue === startDate) {
                        setEndDate("");
                        return;
                      }
                      setEndDate(nextValue);
                    }}
                    disabled={isLoading || !startDate}
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
                    disabled={isLoading || !startDate || !startTime}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-sm font-medium">Status</p>
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isFixed}
                    onChange={(event) => setIsFixed(event.target.checked)}
                    disabled={isLoading}
                  />
                  Fixed
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isOnHold}
                    onChange={(event) => setIsOnHold(event.target.checked)}
                    disabled={isLoading}
                  />
                  On hold
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isCancelled}
                    onChange={(event) => setIsCancelled(event.target.checked)}
                    disabled={isLoading}
                  />
                  Cancelled
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(event) => setIsDone(event.target.checked)}
                    disabled={isLoading}
                  />
                  Complete
                </label>
              </div>
            </div>

            <p className="text-right text-xs text-muted-foreground">{statusLabel}</p>
          </div>
        )}

        {errorMessage ? <p className="mt-3 text-sm text-destructive">{errorMessage}</p> : null}
      </aside>
    </div>
  );
}
