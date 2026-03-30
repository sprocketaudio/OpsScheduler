"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventInput } from "@fullcalendar/core";
import timeGridPlugin from "@fullcalendar/timegrid";
import dynamic from "next/dynamic";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
});

type SchedulerCalendarProps = {
  events: EventInput[];
  weekStartIso: string;
};

export function SchedulerCalendar({ events, weekStartIso }: SchedulerCalendarProps) {
  return (
    <div className="rounded-md border p-2">
      <FullCalendar
        key={weekStartIso}
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="timeGridWeek"
        initialDate={weekStartIso}
        firstDay={1}
        weekends
        allDaySlot
        editable={false}
        selectable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        headerToolbar={false}
        height="auto"
        events={events}
      />
    </div>
  );
}
