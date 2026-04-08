"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import type {
  EventClickArg,
  EventContentArg,
  EventHoveringArg,
  EventInput,
  EventMountArg,
} from "@fullcalendar/core";
import enGbLocale from "@fullcalendar/core/locales/en-gb";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DateLocale } from "@/features/settings/date-locale";
import { toSeconds } from "@/features/scheduler/visible-window";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
});

type SchedulerCalendarProps = {
  dateLocale: DateLocale;
  events: EventInput[];
  mineActive?: boolean;
  onItemSelect?: (itemId: string) => void;
  onScheduleSync?: (payload: {
    endDate: string;
    endTime: string;
    itemId: string;
    startDate: string;
    startTime: string;
  }) => void;
  statusSync?: {
    cancelled: boolean;
    done: boolean;
    fixed: boolean;
    itemId: string;
    onHold: boolean;
    seq: number;
  } | null;
  searchActive?: boolean;
  showWeekends?: boolean;
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

type CalendarEventDragStartArg = {
  event: CalendarEventLike;
};

type CalendarPlacementEvent = {
  allDay: boolean;
  end: Date | null;
  id: string;
  start: Date | null;
};

type EventVisualMeta = {
  allDay: boolean;
  cancelled: boolean;
  customer: string | null;
  done: boolean;
  end: Date | null;
  fixed: boolean;
  matchesMine: boolean;
  matchesSearch: boolean;
  notes: string | null;
  onHold: boolean;
  start: Date | null;
  title: string;
};

type EventTooltipContent = {
  customer: string | null;
  notes: string | null;
  status: string | null;
  timeLine: string | null;
  title: string;
};

type EventTooltipState = {
  content: EventTooltipContent;
  itemId: string;
  left: number;
  top: number;
};

const DEFAULT_TIMED_DURATION_MINUTES = 60;
const CALENDAR_SLOT_DURATION_SECONDS = 30 * 60;
const CALENDAR_SLOT_ROW_HEIGHT_PX = 22;
const CALENDAR_CHROME_HEIGHT_PX = 104;
const FULL_DAY_SLOT_MIN_TIME = "00:00:00";
const FULL_DAY_SLOT_MAX_TIME = "24:00:00";

type RgbColor = {
  blue: number;
  green: number;
  red: number;
};

function parseRgbColorFromCss(colorValue: string): RgbColor | null {
  const normalized = colorValue.trim().toLowerCase();
  if (normalized.startsWith("rgb(") || normalized.startsWith("rgba(")) {
    const openParen = normalized.indexOf("(");
    const closeParen = normalized.indexOf(")");
    if (openParen < 0 || closeParen < 0 || closeParen <= openParen + 1) {
      return null;
    }

    const rawParts = normalized
      .slice(openParen + 1, closeParen)
      .split(",")
      .map((part) => part.trim());

    if (rawParts.length < 3) {
      return null;
    }

    const red = Number.parseFloat(rawParts[0] ?? "");
    const green = Number.parseFloat(rawParts[1] ?? "");
    const blue = Number.parseFloat(rawParts[2] ?? "");

    if (![red, green, blue].every((value) => Number.isFinite(value))) {
      return null;
    }

    return {
      red: Math.min(255, Math.max(0, Math.round(red))),
      green: Math.min(255, Math.max(0, Math.round(green))),
      blue: Math.min(255, Math.max(0, Math.round(blue))),
    };
  }

  if (!normalized.startsWith("#")) {
    return null;
  }

  const rawHex = normalized.slice(1);
  if (rawHex.length === 3 || rawHex.length === 4) {
    const red = Number.parseInt(rawHex[0] + rawHex[0], 16);
    const green = Number.parseInt(rawHex[1] + rawHex[1], 16);
    const blue = Number.parseInt(rawHex[2] + rawHex[2], 16);

    if ([red, green, blue].some((value) => Number.isNaN(value))) {
      return null;
    }

    return { red, green, blue };
  }

  if (rawHex.length === 6 || rawHex.length === 8) {
    const red = Number.parseInt(rawHex.slice(0, 2), 16);
    const green = Number.parseInt(rawHex.slice(2, 4), 16);
    const blue = Number.parseInt(rawHex.slice(4, 6), 16);

    if ([red, green, blue].some((value) => Number.isNaN(value))) {
      return null;
    }

    return { red, green, blue };
  }

  return null;
}

function getReadableTextColor(backgroundColor: string): string | null {
  const rgb = parseRgbColorFromCss(backgroundColor);
  if (!rgb) {
    return null;
  }

  // YIQ contrast heuristic: lower luminance needs white text.
  const yiq = (rgb.red * 299 + rgb.green * 587 + rgb.blue * 114) / 1000;
  return yiq >= 145 ? "#111111" : "#ffffff";
}

function resolveVisualStatus(meta: {
  cancelled: boolean;
  done: boolean;
  fixed: boolean;
  onHold: boolean;
}): "cancelled" | "done" | "fixed" | "onHold" | "none" {
  if (meta.done) {
    return "done";
  }

  if (meta.cancelled) {
    return "cancelled";
  }

  if (meta.onHold) {
    return "onHold";
  }

  if (meta.fixed) {
    return "fixed";
  }

  return "none";
}

function resolveVisualStatusColor(status: "cancelled" | "done" | "fixed" | "onHold" | "none"): string | null {
  if (status === "done") {
    return "rgb(22 163 74)";
  }

  if (status === "cancelled") {
    return "rgb(51 65 85)";
  }

  if (status === "onHold") {
    return "rgb(146 64 14)";
  }

  if (status === "fixed") {
    return "rgb(220 38 38)";
  }

  return null;
}

function applyEventVisualStyles(
  element: HTMLElement,
  visualMeta: EventVisualMeta | null,
  options: {
    mineActive: boolean;
    searchActive: boolean;
  },
) {
  const status = visualMeta ? resolveVisualStatus(visualMeta) : "none";
  const statusColor = resolveVisualStatusColor(status);
  const statusOpacity = status === "cancelled" ? 0.68 : status === "onHold" ? 0.82 : 1;
  const isSearchDimmed = options.searchActive && visualMeta?.matchesSearch === false;
  const isMineDimmed = options.mineActive && visualMeta?.matchesMine === false;
  const isFilterDimmed = isSearchDimmed || isMineDimmed;
  const finalOpacity = isFilterDimmed ? Math.min(statusOpacity, 0.22) : statusOpacity;
  const innerEventElements = Array.from(
    element.querySelectorAll<HTMLElement>(".fc-event-main, .fc-event-main-frame"),
  );

  const backgroundColor = window.getComputedStyle(element).backgroundColor;
  const textColor = getReadableTextColor(backgroundColor);
  if (textColor) {
    element.style.setProperty("--scheduler-event-text-color", textColor);
  } else {
    element.style.removeProperty("--scheduler-event-text-color");
  }

  element.style.outline = "";
  element.style.outlineOffset = "";
  element.style.boxShadow = "";
  element.style.setProperty("border-style", "solid", "important");
  element.style.setProperty("border-width", "1px", "important");
  element.style.setProperty("border-color", "rgb(255 255 255 / 0.95)", "important");
  element.style.setProperty("box-shadow", "none", "important");
  element.style.setProperty("outline", "none", "important");
  element.style.setProperty("outline-offset", "0", "important");
  element.style.setProperty("opacity", String(finalOpacity), "important");
  element.style.setProperty("filter", isFilterDimmed ? "saturate(0.35)" : "none", "important");
  element.style.setProperty(
    "z-index",
    options.searchActive || options.mineActive
      ? !isFilterDimmed
        ? "40"
        : "2"
      : "2",
    "important",
  );
  element.style.setProperty("padding", "0", "important");

  innerEventElements.forEach((innerElement) => {
    innerElement.style.setProperty("border-style", "solid", "important");
    innerElement.style.setProperty("border-width", "0", "important");
    innerElement.style.setProperty("border-color", "transparent", "important");
    innerElement.style.setProperty("box-shadow", "none", "important");
    innerElement.style.setProperty("outline", "none", "important");
    innerElement.style.setProperty("outline-offset", "0", "important");
    innerElement.style.setProperty("padding", "0", "important");
    innerElement.style.setProperty("margin", "0", "important");
    innerElement.style.borderRadius = "inherit";
  });

  if (statusColor) {
    const emphasiseMutedStatus = status === "cancelled" || status === "onHold";
    const borderWidth = emphasiseMutedStatus ? "2.5px" : "2px";
    const innerBorderWidth = emphasiseMutedStatus ? "1.25px" : "1px";
    const outlineWidth = emphasiseMutedStatus ? "2px" : "1.5px";
    const outlineOffset = emphasiseMutedStatus ? "-2px" : "-1.5px";
    const haloShadow = `0 0 0 1px ${statusColor}`;

    element.style.setProperty("border-color", statusColor, "important");
    element.style.setProperty("border-width", borderWidth, "important");
    element.style.setProperty(
      "box-shadow",
      haloShadow,
      "important",
    );
    element.style.setProperty("outline", `${outlineWidth} solid ${statusColor}`, "important");
    element.style.setProperty("outline-offset", outlineOffset, "important");
    innerEventElements.forEach((innerElement) => {
      innerElement.style.setProperty("border-color", statusColor, "important");
      innerElement.style.setProperty("border-width", innerBorderWidth, "important");
      innerElement.style.setProperty("box-shadow", "none", "important");
    });
  }
}

function applyEventDensityStyles(element: HTMLElement) {
  const contentElement = element.querySelector<HTMLElement>("[data-scheduler-event-content]");
  const titleElement = element.querySelector<HTMLElement>("[data-scheduler-event-title]");
  const customerElement = element.querySelector<HTMLElement>("[data-scheduler-event-customer]");

  if (!titleElement) {
    return;
  }

  const durationMinutesRaw = contentElement?.dataset.schedulerDurationMinutes;
  const durationMinutes =
    typeof durationMinutesRaw === "string" && /^\d+$/.test(durationMinutesRaw)
      ? Number.parseInt(durationMinutesRaw, 10)
      : null;

  const useCompactFont = durationMinutes !== null && durationMinutes <= 30;
  const fontSize = useCompactFont ? 9 : 10;
  const lineHeight = useCompactFont ? 10 : 12;
  const contentHeight = (contentElement ?? element).getBoundingClientRect().height;
  const maxVisibleLines = Math.max(1, Math.floor(contentHeight / lineHeight));
  const titleLines = customerElement ? Math.max(1, maxVisibleLines - 1) : maxVisibleLines;

  titleElement.style.display = "-webkit-box";
  titleElement.style.setProperty("-webkit-box-orient", "vertical");
  titleElement.style.setProperty("-webkit-line-clamp", String(Math.min(6, titleLines)));
  titleElement.style.setProperty("font-size", `${fontSize}px`);
  titleElement.style.setProperty("line-height", `${lineHeight}px`);
  titleElement.style.overflow = "hidden";

  if (customerElement) {
    customerElement.style.setProperty("font-size", `${fontSize}px`);
    customerElement.style.setProperty("line-height", `${lineHeight}px`);
    customerElement.style.setProperty("margin-top", maxVisibleLines >= 4 ? `${lineHeight}px` : "0px");
    customerElement.style.display = "block";
  }
}

function parseDateInput(value: unknown): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  return null;
}

function computeCalendarViewportHeight(visibleStartTime: string, visibleEndTime: string): number {
  const visibleSeconds = Math.max(
    CALENDAR_SLOT_DURATION_SECONDS,
    toSeconds(visibleEndTime) - toSeconds(visibleStartTime),
  );
  const visibleSlotRows = Math.ceil(visibleSeconds / CALENDAR_SLOT_DURATION_SECONDS);
  return visibleSlotRows * CALENDAR_SLOT_ROW_HEIGHT_PX + CALENDAR_CHROME_HEIGHT_PX;
}

function formatTooltipTimeLine(
  start: Date | null,
  end: Date | null,
  allDay: boolean,
  dateLocale: DateLocale,
): string | null {
  if (!start) {
    return null;
  }

  const dateFormatter = new Intl.DateTimeFormat(dateLocale, {
    day: "2-digit",
    month: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: dateLocale === "en-US",
  });

  if (allDay) {
    if (!end) {
      return `All-day ${dateFormatter.format(start)}`;
    }

    const inclusiveEnd = new Date(end);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    if (
      start.getFullYear() === inclusiveEnd.getFullYear() &&
      start.getMonth() === inclusiveEnd.getMonth() &&
      start.getDate() === inclusiveEnd.getDate()
    ) {
      return `All-day ${dateFormatter.format(start)}`;
    }

    return `All-day ${dateFormatter.format(start)} to ${dateFormatter.format(inclusiveEnd)}`;
  }

  if (!end) {
    return timeFormatter.format(start);
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return `${timeFormatter.format(start)}-${timeFormatter.format(end)}`;
  }

  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} - ${dateFormatter.format(end)} ${timeFormatter.format(end)}`;
}

function formatTooltipNotes(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }

  const normalizedNotes = notes.replace(/\s+/g, " ").trim();
  if (!normalizedNotes) {
    return null;
  }

  const maxLength = 280;
  if (normalizedNotes.length <= maxLength) {
    return normalizedNotes;
  }

  return `${normalizedNotes.slice(0, maxLength - 3)}...`;
}

function getStatusLabel(meta: {
  cancelled: boolean;
  done: boolean;
  fixed: boolean;
  onHold: boolean;
}): string | null {
  const status = resolveVisualStatus(meta);
  if (status === "done") {
    return "Complete";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "onHold") {
    return "On hold";
  }

  if (status === "fixed") {
    return "Fixed";
  }

  return null;
}

function buildEventTooltipContent(meta: {
  allDay: boolean;
  cancelled: boolean;
  customer?: string | null;
  dateLocale: DateLocale;
  done: boolean;
  end: Date | null;
  fixed: boolean;
  notes?: string | null;
  onHold: boolean;
  start: Date | null;
  title: string;
}): EventTooltipContent {
  return {
    timeLine: formatTooltipTimeLine(meta.start, meta.end, meta.allDay, meta.dateLocale),
    title: meta.title,
    customer: meta.customer?.trim() ? meta.customer.trim() : null,
    notes: formatTooltipNotes(meta.notes),
    status: getStatusLabel(meta),
  };
}

function buildEventTooltip(meta: {
  allDay: boolean;
  cancelled: boolean;
  customer?: string | null;
  dateLocale: DateLocale;
  done: boolean;
  end: Date | null;
  fixed: boolean;
  notes?: string | null;
  onHold: boolean;
  start: Date | null;
  title: string;
}): string {
  const tooltip = buildEventTooltipContent(meta);
  const lines: string[] = [];
  if (tooltip.timeLine) {
    lines.push(tooltip.timeLine);
  }
  lines.push(tooltip.title);
  if (tooltip.customer) {
    lines.push(`Customer: ${tooltip.customer}`);
  }
  if (tooltip.notes) {
    lines.push(`Notes: ${tooltip.notes}`);
  }
  if (tooltip.status) {
    lines.push(`Status: ${tooltip.status}`);
  }

  return lines.join("\n");
}

function buildVisualMetaFromEventInput(event: {
  allDay: boolean;
  end: Date | null;
  extendedProps: Record<string, unknown>;
  start: Date | null;
  title: string;
}): EventVisualMeta {
  const eventProps = event.extendedProps as {
    cancelled?: boolean;
    customer?: string | null;
    done?: boolean;
    fixed?: boolean;
    matchesMine?: boolean;
    matchesSearch?: boolean;
    notes?: string | null;
    onHold?: boolean;
  };

  return {
    title: event.title,
    customer:
      typeof eventProps.customer === "string" && eventProps.customer.trim().length > 0
        ? eventProps.customer.trim()
        : null,
    allDay: event.allDay,
    start: event.start,
    end: event.end,
    notes: typeof eventProps.notes === "string" ? eventProps.notes : null,
    done: eventProps.done === true,
    fixed: eventProps.fixed === true,
    matchesMine: eventProps.matchesMine !== false,
    matchesSearch: eventProps.matchesSearch !== false,
    onHold: eventProps.onHold === true,
    cancelled: eventProps.cancelled === true,
  };
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
      const onHold =
        !!eventExtendedProps &&
        typeof eventExtendedProps === "object" &&
        "onHold" in eventExtendedProps &&
        eventExtendedProps.onHold === true;
      const cancelled =
        !!eventExtendedProps &&
        typeof eventExtendedProps === "object" &&
        "cancelled" in eventExtendedProps &&
        eventExtendedProps.cancelled === true;
      const done =
        !!eventExtendedProps &&
        typeof eventExtendedProps === "object" &&
        "done" in eventExtendedProps &&
        eventExtendedProps.done === true;
      const notes =
        !!eventExtendedProps &&
        typeof eventExtendedProps === "object" &&
        "notes" in eventExtendedProps &&
        typeof eventExtendedProps.notes === "string"
          ? eventExtendedProps.notes
          : null;
      const customer =
        !!eventExtendedProps &&
        typeof eventExtendedProps === "object" &&
        "customer" in eventExtendedProps &&
        typeof eventExtendedProps.customer === "string"
          ? eventExtendedProps.customer
          : null;

      visualMetaById.set(String(eventId), {
        title: eventTitle,
        customer,
        fixed,
        onHold,
        cancelled,
        done,
        matchesMine:
          !eventExtendedProps ||
          typeof eventExtendedProps !== "object" ||
          !("matchesMine" in eventExtendedProps) ||
          eventExtendedProps.matchesMine !== false,
        matchesSearch:
          !eventExtendedProps ||
          typeof eventExtendedProps !== "object" ||
          !("matchesSearch" in eventExtendedProps) ||
          eventExtendedProps.matchesSearch !== false,
        allDay:
          ("allDay" in event && event.allDay === true) ||
          (!!eventExtendedProps && typeof eventExtendedProps === "object" && "allDay" in eventExtendedProps),
        start: "start" in event ? parseDateInput(event.start) : null,
        end: "end" in event ? parseDateInput(event.end) : null,
        notes,
      });
    }
  }

  return visualMetaById;
}

function renderEventContent(arg: EventContentArg) {
  const eventProps = arg.event.extendedProps as {
    customer?: string | null;
  };
  const customer =
    typeof eventProps.customer === "string" && eventProps.customer.trim().length > 0
      ? eventProps.customer.trim()
      : null;
  const start = arg.event.start;
  const end = arg.event.end;
  const durationMinutes =
    !arg.event.allDay && start && end
      ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
      : null;

  return (
    <div
      data-scheduler-event-content="true"
      data-scheduler-duration-minutes={durationMinutes !== null ? String(durationMinutes) : undefined}
      className="relative flex h-full min-w-0 flex-col justify-start overflow-hidden px-[1px] pt-0 pb-0 leading-none"
    >
      <div
        data-scheduler-event-title="true"
        className="min-h-0 min-w-0 font-semibold"
        style={{
          color: "var(--scheduler-event-text-color, #111111)",
          fontSize: "10px",
          lineHeight: "12px",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflowWrap: "anywhere",
          overflow: "hidden",
        }}
      >
        {arg.event.title}
      </div>
      {customer ? (
        <div
          data-scheduler-event-customer="true"
          className="min-h-0 min-w-0 truncate opacity-90"
          style={{
            color: "var(--scheduler-event-text-color, #111111)",
            fontSize: "10px",
            lineHeight: "12px",
            display: "block",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 1,
            overflowWrap: "anywhere",
            overflow: "hidden",
          }}
        >
          {customer}
        </div>
      ) : null}
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

function formatDayHeaderLabel(value: Date, dateLocale: DateLocale): string {
  const weekday = new Intl.DateTimeFormat(dateLocale, {
    weekday: "short",
  }).format(value);
  const dayMonth = new Intl.DateTimeFormat(dateLocale, {
    day: "numeric",
    month: "numeric",
  }).format(value);
  return `${weekday} ${dayMonth}`;
}

function isWeekendDate(value: Date): boolean {
  const day = value.getDay();
  return day === 0 || day === 6;
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

function getTooltipPositionForEvent(element: HTMLElement): { left: number; top: number } {
  const rect = element.getBoundingClientRect();
  const viewportPadding = 8;
  const offset = 10;
  const tooltipWidth = 360;
  const tooltipHeight = 260;

  let left = rect.right + offset;
  let top = rect.top;

  if (left + tooltipWidth > window.innerWidth - viewportPadding) {
    left = rect.left - tooltipWidth - offset;
  }

  if (left < viewportPadding) {
    left = viewportPadding;
  }

  if (top + tooltipHeight > window.innerHeight - viewportPadding) {
    top = window.innerHeight - tooltipHeight - viewportPadding;
  }

  if (top < viewportPadding) {
    top = viewportPadding;
  }

  return {
    left,
    top,
  };
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

  const effectiveEnd = event.end ?? new Date(event.start.getTime() + DEFAULT_TIMED_DURATION_MINUTES * 60_000);

  let endDate: string | undefined;
  const endTime = formatLocalIsoTime(effectiveEnd);
  const eventEndDate = formatLocalIsoDate(effectiveEnd);
  if (eventEndDate !== startDate) {
    endDate = eventEndDate;
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
  dateLocale,
  events,
  mineActive = false,
  onItemSelect,
  onScheduleSync,
  searchActive = false,
  showWeekends = true,
  statusSync = null,
  visibleEndTime,
  visibleStartTime,
  weekStartIso,
}: SchedulerCalendarProps) {
  const router = useRouter();
  const [quickAddDraft, setQuickAddDraft] = useState<QuickAddDraft | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPortalReady, setIsPortalReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<EventTooltipState | null>(null);
  const eventResizeObserversRef = useRef<WeakMap<HTMLElement, ResizeObserver>>(new WeakMap());
  const calendarViewportHeight = useMemo(
    () => computeCalendarViewportHeight(visibleStartTime, visibleEndTime),
    [visibleEndTime, visibleStartTime],
  );

  function openQuickAddAt(date: Date, allDay: boolean) {
    const displayDate = new Intl.DateTimeFormat(dateLocale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);

    const startTime = allDay ? null : formatLocalIsoTime(date);
    const displayLabel = startTime ? `${displayDate} ${startTime.slice(0, 5)}` : displayDate;

    setQuickAddDraft({
      displayLabel,
      startDate: formatLocalIsoDate(date),
      startTime,
    });
    setQuickAddTitle("");
    setErrorMessage(null);
  }

  useEffect(() => {
    setIsPortalReady(true);
  }, []);

  useEffect(() => {
    const visualMetaById = buildEventVisualMetaMap(events);
    const renderedEventElements = document.querySelectorAll<HTMLElement>("[data-scheduler-event-id]");

    renderedEventElements.forEach((element) => {
      const eventId = element.dataset.schedulerEventId;
      if (!eventId) {
        return;
      }

      let visualMeta = visualMetaById.get(eventId) ?? null;
      if (statusSync && statusSync.itemId === eventId && visualMeta) {
        visualMeta = {
          ...visualMeta,
          done: statusSync.done,
          fixed: statusSync.fixed,
          onHold: statusSync.onHold,
          cancelled: statusSync.cancelled,
        };
      }

      if (visualMeta) {
        element.setAttribute("aria-label", buildEventTooltip({ ...visualMeta, dateLocale }));
        element.removeAttribute("title");
      } else {
        element.removeAttribute("aria-label");
        element.removeAttribute("title");
      }

      applyEventVisualStyles(element, visualMeta, {
        mineActive,
        searchActive,
      });
      applyEventDensityStyles(element);
    });
  }, [dateLocale, events, mineActive, searchActive, statusSync]);

  useEffect(() => {
    const hoveredItemId = hoverTooltip?.itemId;
    if (!hoveredItemId) {
      return;
    }

    const visualMetaById = buildEventVisualMetaMap(events);
    let visualMeta = visualMetaById.get(hoveredItemId) ?? null;
    if (!visualMeta) {
      setHoverTooltip(null);
      return;
    }

    if (statusSync && statusSync.itemId === hoveredItemId) {
      visualMeta = {
        ...visualMeta,
        done: statusSync.done,
        fixed: statusSync.fixed,
        onHold: statusSync.onHold,
        cancelled: statusSync.cancelled,
      };
    }

    const nextContent = buildEventTooltipContent({
      ...visualMeta,
      dateLocale,
    });
    setHoverTooltip((previous) => {
      if (!previous || previous.itemId !== hoveredItemId) {
        return previous;
      }

      return {
        ...previous,
        content: nextContent,
      };
    });
  }, [dateLocale, events, hoverTooltip?.itemId, statusSync]);

  function handleDateClick(info: DateClickArg) {
    const clickEvent = info.jsEvent as MouseEvent | undefined;
    if (!clickEvent || clickEvent.detail < 2) {
      return;
    }

    openQuickAddAt(info.date, info.allDay);
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
    setHoverTooltip(null);
    onItemSelect?.(String(info.event.id));
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
    onScheduleSync?.({
      itemId: String(arg.event.id),
      startDate: calendarPlacement.startDate,
      startTime: calendarPlacement.startTime ?? "",
      endDate: calendarPlacement.endDate ?? "",
      endTime: calendarPlacement.endTime ?? "",
    });
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
    onScheduleSync?.({
      itemId: String(arg.event.id),
      startDate: calendarPlacement.startDate,
      startTime: calendarPlacement.startTime ?? "",
      endDate: calendarPlacement.endDate ?? "",
      endTime: calendarPlacement.endTime ?? "",
    });
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
    onScheduleSync?.({
      itemId: String(arg.event.id),
      startDate: calendarPlacement.startDate,
      startTime: calendarPlacement.startTime ?? "",
      endDate: calendarPlacement.endDate ?? "",
      endTime: calendarPlacement.endTime ?? "",
    });
    router.refresh();
  }

  function handleEventDidMount(arg: EventMountArg) {
    const visualMeta = buildVisualMetaFromEventInput({
      title: arg.event.title,
      allDay: arg.event.allDay,
      start: arg.event.start,
      end: arg.event.end,
      extendedProps: arg.event.extendedProps,
    });

    arg.el.dataset.schedulerEventId = String(arg.event.id);
    arg.el.setAttribute("aria-label", buildEventTooltip({ ...visualMeta, dateLocale }));
    arg.el.removeAttribute("title");
    applyEventVisualStyles(arg.el, visualMeta, {
      mineActive,
      searchActive,
    });
    applyEventDensityStyles(arg.el);

    const existingObserver = eventResizeObserversRef.current.get(arg.el);
    if (existingObserver) {
      existingObserver.disconnect();
    }

    const observer = new ResizeObserver(() => {
      applyEventDensityStyles(arg.el);
    });
    observer.observe(arg.el);
    eventResizeObserversRef.current.set(arg.el, observer);
  }

  function handleEventMouseEnter(arg: EventHoveringArg) {
    let visualMeta = buildVisualMetaFromEventInput({
      title: arg.event.title,
      allDay: arg.event.allDay,
      start: arg.event.start,
      end: arg.event.end,
      extendedProps: arg.event.extendedProps,
    });

    const itemId = String(arg.event.id);
    if (statusSync && statusSync.itemId === itemId) {
      visualMeta = {
        ...visualMeta,
        done: statusSync.done,
        fixed: statusSync.fixed,
        onHold: statusSync.onHold,
        cancelled: statusSync.cancelled,
      };
    }

    const tooltipPosition = getTooltipPositionForEvent(arg.el);
    setHoverTooltip({
      itemId,
      content: buildEventTooltipContent({
        ...visualMeta,
        dateLocale,
      }),
      left: tooltipPosition.left,
      top: tooltipPosition.top,
    });
  }

  function handleEventMouseLeave() {
    setHoverTooltip(null);
  }

  function handleEventWillUnmount(arg: EventMountArg) {
    const observer = eventResizeObserversRef.current.get(arg.el);
    if (observer) {
      observer.disconnect();
    }
  }

  function handleEventDragStart(arg: CalendarEventDragStartArg) {
    setHoverTooltip(null);
    setBucketDropZoneActive(true);
  }

  async function handleEventDragStop(arg: CalendarEventDragStopArg) {
    setHoverTooltip(null);
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
    onScheduleSync?.({
      itemId: eventId,
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
    });
    router.refresh();
  }

  return (
    <div className="scheduler-calendar-surface space-y-2 rounded-md border p-2 [--fc-border-color:rgb(148_163_184_/0.5)] dark:[--fc-border-color:rgb(71_85_105_/0.55)] dark:[&_.fc-timegrid-slot]:border-t-slate-600/35 [&_.fc-col-header-cell-cushion]:px-1 [&_.fc-col-header-cell-cushion]:text-[0.92rem] [&_.fc-col-header-cell-cushion]:whitespace-nowrap [&_.scheduler-weekend-cell]:bg-slate-200/75 dark:[&_.scheduler-weekend-cell]:bg-slate-800/50 [&_.scheduler-weekend-header]:bg-slate-300/80 dark:[&_.scheduler-weekend-header]:bg-slate-700/55 [&_.fc-day-sat]:border-l-2 [&_.fc-day-sat]:border-l-slate-400/80 dark:[&_.fc-day-sat]:border-l-slate-500/70 [&_.fc-scrollgrid]:transition-all [&_.fc-scrollgrid]:duration-200 [&_.fc-event]:cursor-grab [&_.fc-event_*]:cursor-grab [&_.fc-event.fc-event-dragging]:cursor-grabbing [&_.fc-event.fc-event-dragging_*]:cursor-grabbing [&_.fc-event.fc-event-resizing]:cursor-grabbing [&_.fc-event.fc-event-resizing_*]:cursor-grabbing [&_.fc-timegrid-event_.fc-event-main]:p-0 [&_.fc-timegrid-event_.fc-event-main-frame]:p-0 [&_.fc-timegrid-event_.fc-event-main-frame]:items-start [&_.fc-timegrid-event_.fc-event-main-frame]:justify-start">
      {interactionError ? <p className="text-sm text-destructive">{interactionError}</p> : null}

      <FullCalendar
        key={weekStartIso}
        plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin]}
        locales={[enGbLocale]}
        locale={dateLocale === "en-GB" ? "en-gb" : "en"}
        initialView="timeGridWeek"
        initialDate={weekStartIso}
        firstDay={1}
        weekends={showWeekends}
        hiddenDays={showWeekends ? [] : [0, 6]}
        allDaySlot
        allDayText="All Day"
        editable
        droppable
        slotEventOverlap={false}
        eventMaxStack={4}
        forceEventDuration
        defaultTimedEventDuration="01:00:00"
        selectable={false}
        eventStartEditable
        eventDurationEditable
        eventResizableFromStart
        headerToolbar={false}
        dayCellClassNames={(arg) => (isWeekendDate(arg.date) ? ["scheduler-weekend-cell"] : [])}
        dayHeaderClassNames={(arg) => (isWeekendDate(arg.date) ? ["scheduler-weekend-header"] : [])}
        dayHeaderContent={(arg) => formatDayHeaderLabel(arg.date, dateLocale)}
        eventContent={renderEventContent}
        eventMinHeight={24}
        slotMinTime={FULL_DAY_SLOT_MIN_TIME}
        slotMaxTime={FULL_DAY_SLOT_MAX_TIME}
        scrollTime={visibleStartTime}
        scrollTimeReset={false}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventReceive={handleEventReceive}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventDidMount={handleEventDidMount}
        eventWillUnmount={handleEventWillUnmount}
        eventMouseEnter={handleEventMouseEnter}
        eventMouseLeave={handleEventMouseLeave}
        eventDragStart={handleEventDragStart}
        eventDragStop={handleEventDragStop}
        dragRevertDuration={0}
        height={calendarViewportHeight}
        events={events}
      />

      {isPortalReady && hoverTooltip
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 w-[min(22rem,calc(100vw-1rem))] rounded-lg border border-slate-300/80 bg-white/98 p-3 text-[12px] shadow-xl ring-1 ring-black/5 backdrop-blur-sm"
              style={{
                left: hoverTooltip.left,
                top: hoverTooltip.top,
              }}
            >
              {hoverTooltip.content.timeLine ? (
                <p className="text-[11px] font-medium text-slate-600">{hoverTooltip.content.timeLine}</p>
              ) : null}
              <p className="mt-1 text-[13px] font-semibold leading-snug text-slate-900">{hoverTooltip.content.title}</p>
              {hoverTooltip.content.customer ? (
                <p className="mt-1 leading-snug text-slate-800">
                  <span className="font-semibold">Customer:</span> {hoverTooltip.content.customer}
                </p>
              ) : null}
              {hoverTooltip.content.status ? (
                <p className="mt-1 leading-snug text-slate-800">
                  <span className="font-semibold">Status:</span> {hoverTooltip.content.status}
                </p>
              ) : null}
              {hoverTooltip.content.notes ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-snug text-slate-600">
                  <span className="font-semibold text-slate-700">Notes:</span> {hoverTooltip.content.notes}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {quickAddDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add item"
          onClick={handleQuickAddCancel}
        >
          <form
            className="grid w-full max-w-sm gap-3 rounded-lg border bg-background p-4 shadow-lg"
            onSubmit={handleQuickAddSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm text-muted-foreground">
              Add at <span className="font-medium text-foreground">{quickAddDraft.displayLabel}</span>
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
    </div>
  );
}
