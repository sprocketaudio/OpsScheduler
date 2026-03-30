"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventClickArg, EventContentArg, EventInput, EventMountArg } from "@fullcalendar/core";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import dynamic from "next/dynamic";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemDetailPanel } from "@/features/scheduler/item-detail-panel";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
});

type SchedulerCalendarProps = {
  events: EventInput[];
  visibleEndTime: string;
  visibleStartTime: string;
  weekStartIso: string;
};

type QuickAddDraft = {
  displayLabel: string;
  startDate: string;
  startTime: string | null;
};

type CalendarEventLike = {
  allDay: boolean;
  end: Date | null;
  id: string | number;
  remove: () => void;
  start: Date | null;
};

type CalendarEventReceiveArg = {
  event: CalendarEventLike;
  revert: () => void;
};

type CalendarEventDropArg = {
  event: CalendarEventLike;
  revert: () => void;
};

type CalendarEventResizeArg = {
  event: CalendarEventLike;
  revert: () => void;
};

type CalendarEventDragStopArg = {
  event: CalendarEventLike;
  jsEvent: {
    clientX: number;
    clientY: number;
  };
};

type CalendarPlacementEvent = {
  allDay: boolean;
  end: Date | null;
  id: string;
  start: Date | null;
};

type EventVisualMeta = {
  done: boolean;
  fixed: boolean;
  title: string;
};

function buildEventTitleMap(events: EventInput[]): Map<string, string> {
  const titlesById = new Map<string, string>();

  for (const event of events) {
    if (!event || typeof event !== "object") {
      continue;
    }

    const eventId = "id" in event ? event.id : undefined;
    const eventTitle = "title" in event ? event.title : undefined;

    if ((typeof eventId === "string" || typeof eventId === "number") && typeof eventTitle === "string") {
      titlesById.set(String(eventId), eventTitle);
    }
  }

  return titlesById;
}

function buildEventVisualMetaMap(events: EventInput[]): Map<string, EventVisualMeta> {
  const visualMetaById = new Map<string, EventVisualMeta>();

  for (const event of events) {
    if (!event || typeof event !== "object") {
      continue;
    }

    const eventId = "id" in event ? event.id : undefined;
    const eventTitle = "title" in event ? event.title : undefined;
    const eventExtendedProps = "extendedProps" in event ? event.extendedProps : undefined;

    if ((typeof eventId === "string" || typeof eventId === "number") && typeof eventTitle === "string") {
      const fixed =
        !!eventExtendedProps &&
        typeof eventExtendedProps === "object" &&
        "fixed" in eventExtendedProps &&
        eventExtendedProps.fixed === true;
      const done =
        !!eventExtendedProps &&
        typeof eventExtendedProps === "object" &&
        "done" in eventExtendedProps &&
        eventExtendedProps.done === true;

      visualMetaById.set(String(eventId), {
        title: eventTitle,
        fixed,
        done,
      });
    }
  }

  return visualMetaById;
}

function renderEventContent(arg: EventContentArg) {
  const eventProps = arg.event.extendedProps as {
    done?: boolean;
    fixed?: boolean;
  };
  const maxLines = arg.event.allDay ? 1 : 3;

  return (
    <div className="flex h-full min-w-0 flex-col leading-tight">
      {arg.timeText ? (
        <div className="truncate text-[11px] font-medium text-foreground/80">{arg.timeText}</div>
      ) : null}
      <div
        className={[
          "break-words text-[11px] font-semibold text-foreground",
          eventProps.done ? "line-through" : "",
        ].join(" ")}
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: maxLines,
          overflow: "hidden",
        }}
      >
        {arg.event.title}
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        {eventProps.fixed ? (
          <span className="rounded border border-red-500/70 px-1 text-[10px] font-medium text-red-700">Fixed</span>
        ) : null}
        {eventProps.done ? (
          <span className="rounded border border-muted-foreground/40 px-1 text-[10px] font-medium text-muted-foreground">
            Done
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatLocalIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalIsoTime(value: Date): string {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function setBucketDropZoneActive(isActive: boolean) {
  const element = document.getElementById("scheduler-bucket-drop-zone");
  if (!element) {
    return;
  }

  if (isActive) {
    element.classList.add("ring-2", "ring-primary/50");
    return;
  }

  element.classList.remove("ring-2", "ring-primary/50");
}

function isPointInsideBucketDropZone(clientX: number, clientY: number): boolean {
  const element = document.getElementById("scheduler-bucket-drop-zone");
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function buildCalendarPlacement(event: CalendarPlacementEvent): {
  kind: "calendar";
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
} | null {
  if (!event.start) {
    return null;
  }

  if (event.allDay) {
    const startDate = formatLocalIsoDate(event.start);
    let endDate: string | undefined;
    if (event.end) {
      const inclusiveEnd = new Date(event.end);
      inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
      const inclusiveEndIso = formatLocalIsoDate(inclusiveEnd);
      if (inclusiveEndIso !== startDate) {
        endDate = inclusiveEndIso;
      }
    }

    return {
      kind: "calendar",
      startDate,
      endDate,
    };
  }

  const startDate = formatLocalIsoDate(event.start);
  const startTime = formatLocalIsoTime(event.start);

  let endDate: string | undefined;
  let endTime: string | undefined;
  if (event.end) {
    endTime = formatLocalIsoTime(event.end);
    const eventEndDate = formatLocalIsoDate(event.end);
    if (eventEndDate !== startDate) {
      endDate = eventEndDate;
    }
  }

  return {
    kind: "calendar",
    startDate,
    startTime,
    endDate,
    endTime,
  };
}

async function patchItemPlacement(
  itemId: string,
  body:
    | {
        placement: {
          kind: "bucket";
          targetWeek?: string;
        };
      }
    | {
        placement: {
          kind: "calendar";
          startDate: string;
          startTime?: string;
          endDate?: string;
          endTime?: string;
          targetWeek?: string;
        };
      },
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const response = await fetch(`/api/items/${itemId}/placement`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let error = "Unable to move item right now.";
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) {
          error = payload.error;
        }
      } catch {
        // Keep generic message.
      }

      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Unable to move item right now." };
  }
}

export function SchedulerCalendar({
  events,
  visibleEndTime,
  visibleStartTime,
  weekStartIso,
}: SchedulerCalendarProps) {
  const router = useRouter();
  const [quickAddDraft, setQuickAddDraft] = useState<QuickAddDraft | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    const titlesById = buildEventTitleMap(events);
    const visualMetaById = buildEventVisualMetaMap(events);
    const renderedEventElements = document.querySelectorAll<HTMLElement>("[data-scheduler-event-id]");

    renderedEventElements.forEach((element) => {
      const eventId = element.dataset.schedulerEventId;
      if (!eventId) {
        return;
      }

      const title = titlesById.get(eventId);
      if (title) {
        element.setAttribute("title", title);
      } else {
        element.removeAttribute("title");
      }

      const visualMeta = visualMetaById.get(eventId);
      element.classList.toggle("opacity-60", !!visualMeta?.done);
      element.classList.toggle("ring-1", !!visualMeta?.fixed);
      element.classList.toggle("ring-red-500/70", !!visualMeta?.fixed);
    });
  }, [events]);

  function handleDateClick(info: DateClickArg) {
    const clickEvent = info.jsEvent as MouseEvent | undefined;
    if (!clickEvent || clickEvent.detail < 2) {
      return;
    }

    const date = info.date;
    const displayDate = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);

    const startTime = info.allDay ? null : formatLocalIsoTime(date);
    const displayLabel = startTime
      ? `${displayDate} ${startTime.slice(0, 5)}`
      : `${displayDate} (all-day)`;

    setQuickAddDraft({
      displayLabel,
      startDate: formatLocalIsoDate(date),
      startTime,
    });
    setQuickAddTitle("");
    setErrorMessage(null);
  }

  async function handleQuickAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quickAddDraft) {
      return;
    }

    const normalizedTitle = quickAddTitle.trim();
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
            kind: "calendar",
            startDate: quickAddDraft.startDate,
            startTime: quickAddDraft.startTime ?? undefined,
            targetWeek: weekStartIso,
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
          // Keep generic message.
        }

        setErrorMessage(error);
        return;
      }

      setQuickAddDraft(null);
      setQuickAddTitle("");
      router.refresh();
      return;
    } catch {
      setErrorMessage("Unable to create item right now.");
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleQuickAddCancel() {
    setQuickAddDraft(null);
    setQuickAddTitle("");
    setErrorMessage(null);
  }

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    setSelectedItemId(String(info.event.id));
  }

  async function handleEventReceive(arg: CalendarEventReceiveArg) {
    const calendarPlacement = buildCalendarPlacement({
      id: String(arg.event.id),
      start: arg.event.start,
      end: arg.event.end,
      allDay: arg.event.allDay,
    });

    if (!calendarPlacement) {
      arg.revert();
      setInteractionError("Unable to schedule item.");
      return;
    }

    const result = await patchItemPlacement(String(arg.event.id), {
      placement: {
        ...calendarPlacement,
        targetWeek: weekStartIso,
      },
    });

    if (!result.ok) {
      arg.revert();
      setInteractionError(result.error);
      return;
    }

    setInteractionError(null);
    router.refresh();
  }

  async function handleEventDrop(arg: CalendarEventDropArg) {
    const calendarPlacement = buildCalendarPlacement({
      id: String(arg.event.id),
      start: arg.event.start,
      end: arg.event.end,
      allDay: arg.event.allDay,
    });

    if (!calendarPlacement) {
      arg.revert();
      setInteractionError("Unable to schedule item.");
      return;
    }

    const result = await patchItemPlacement(String(arg.event.id), {
      placement: {
        ...calendarPlacement,
        targetWeek: weekStartIso,
      },
    });

    if (!result.ok) {
      arg.revert();
      setInteractionError(result.error);
      return;
    }

    setInteractionError(null);
    router.refresh();
  }

  async function handleEventResize(arg: CalendarEventResizeArg) {
    const calendarPlacement = buildCalendarPlacement({
      id: String(arg.event.id),
      start: arg.event.start,
      end: arg.event.end,
      allDay: arg.event.allDay,
    });

    if (!calendarPlacement) {
      arg.revert();
      setInteractionError("Unable to resize item.");
      return;
    }

    const result = await patchItemPlacement(String(arg.event.id), {
      placement: {
        ...calendarPlacement,
        targetWeek: weekStartIso,
      },
    });

    if (!result.ok) {
      arg.revert();
      setInteractionError(result.error);
      return;
    }

    setInteractionError(null);
    router.refresh();
  }

  function handleEventDidMount(arg: EventMountArg) {
    const eventProps = arg.event.extendedProps as {
      done?: boolean;
      fixed?: boolean;
    };
    arg.el.dataset.schedulerEventId = String(arg.event.id);
    arg.el.setAttribute("title", arg.event.title);
    arg.el.classList.toggle("opacity-60", eventProps.done === true);
    arg.el.classList.toggle("ring-1", eventProps.fixed === true);
    arg.el.classList.toggle("ring-red-500/70", eventProps.fixed === true);
  }

  function handleEventDragStart() {
    setBucketDropZoneActive(true);
  }

  async function handleEventDragStop(arg: CalendarEventDragStopArg) {
    setBucketDropZoneActive(false);

    const isDroppedInBucket = isPointInsideBucketDropZone(arg.jsEvent.clientX, arg.jsEvent.clientY);
    if (!isDroppedInBucket) {
      return;
    }

    const eventId = String(arg.event.id);
    arg.event.remove();

    const result = await patchItemPlacement(eventId, {
      placement: {
        kind: "bucket",
      },
    });

    if (!result.ok) {
      setInteractionError(result.error);
      router.refresh();
      return;
    }

    setInteractionError(null);
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-sm text-muted-foreground">
        Double-click an empty day or time slot to quick add an item in that location.
      </p>

      {interactionError ? <p className="text-sm text-destructive">{interactionError}</p> : null}

      <FullCalendar
        key={weekStartIso}
        plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin]}
        initialView="timeGridWeek"
        initialDate={weekStartIso}
        firstDay={1}
        weekends
        allDaySlot
        editable
        droppable
        selectable={false}
        eventStartEditable
        eventDurationEditable
        eventResizableFromStart
        headerToolbar={false}
        eventContent={renderEventContent}
        eventMinHeight={24}
        slotMinTime={visibleStartTime}
        slotMaxTime={visibleEndTime}
        scrollTime={visibleStartTime}
        scrollTimeReset={false}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventReceive={handleEventReceive}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventDidMount={handleEventDidMount}
        eventDragStart={handleEventDragStart}
        eventDragStop={handleEventDragStop}
        dragRevertDuration={0}
        height="auto"
        events={events}
      />

      {quickAddDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quick add item"
          onClick={handleQuickAddCancel}
        >
          <form
            className="grid w-full max-w-sm gap-3 rounded-lg border bg-background p-4 shadow-lg"
            onSubmit={handleQuickAddSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm text-muted-foreground">
              Quick add at <span className="font-medium text-foreground">{quickAddDraft.displayLabel}</span>
            </p>
            <Input
              autoFocus
              placeholder="New calendar item title"
              value={quickAddTitle}
              onChange={(event) => setQuickAddTitle(event.target.value)}
              maxLength={200}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={handleQuickAddCancel}
              >
                Cancel
              </Button>
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </form>
        </div>
      ) : null}

      <ItemDetailPanel itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />
    </div>
  );
}
