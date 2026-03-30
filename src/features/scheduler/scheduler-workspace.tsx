"use client";

import type { EventInput } from "@fullcalendar/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BucketPanel, type BucketPanelItem } from "@/features/scheduler/bucket-panel";
import { SchedulerCalendar } from "@/features/scheduler/calendar-view";
import { addDaysUtc, formatIsoDateUtc, parseWeekParamToMondayUtc, startOfWeekMondayUtc } from "@/features/scheduler/week";
import type { DateLocale } from "@/features/settings/date-locale";
import { ItemDetailPanel } from "@/features/scheduler/item-detail-panel";

type SchedulerWorkspaceProps = {
  bucketItems: BucketPanelItem[];
  calendarEvents: EventInput[];
  dateLocale: DateLocale;
  visibleEndTime: string;
  visibleStartTime: string;
  weekStartIso: string;
};

type ScheduleSyncPayload = {
  endDate: string;
  endTime: string;
  itemId: string;
  startDate: string;
  startTime: string;
};

type StatusSyncPayload = {
  cancelled: boolean;
  done: boolean;
  fixed: boolean;
  itemId: string;
  onHold: boolean;
};

export function SchedulerWorkspace({
  bucketItems,
  calendarEvents,
  dateLocale,
  visibleEndTime,
  visibleStartTime,
  weekStartIso,
}: SchedulerWorkspaceProps) {
  const router = useRouter();
  const selectedWeekStart = parseWeekParamToMondayUtc(weekStartIso) ?? startOfWeekMondayUtc(new Date());
  const previousWeekIso = formatIsoDateUtc(addDaysUtc(selectedWeekStart, -7));
  const currentWeekIso = formatIsoDateUtc(startOfWeekMondayUtc(new Date()));
  const nextWeekIso = formatIsoDateUtc(addDaysUtc(selectedWeekStart, 7));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [weekJumpDate, setWeekJumpDate] = useState(weekStartIso);
  const [panelRefreshToken, setPanelRefreshToken] = useState(0);
  const [scheduleSync, setScheduleSync] = useState<(ScheduleSyncPayload & { seq: number }) | null>(null);
  const [statusSync, setStatusSync] = useState<(StatusSyncPayload & { seq: number }) | null>(null);
  const selectedItemIdRef = useRef<string | null>(selectedItemId);

  useEffect(() => {
    setWeekJumpDate(weekStartIso);
  }, [weekStartIso]);

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  const handleItemSelect = useCallback((itemId: string) => {
    const previousItemId = selectedItemIdRef.current;
    setSelectedItemId(itemId);
    if (previousItemId !== itemId) {
      setPanelRefreshToken((value) => value + 1);
    }
  }, []);

  const handleScheduleSync = useCallback((payload: ScheduleSyncPayload) => {
    setScheduleSync((previous) => ({
      seq: (previous?.seq ?? 0) + 1,
      ...payload,
    }));
  }, []);

  const handleStatusSync = useCallback((payload: StatusSyncPayload) => {
    setStatusSync((previous) => ({
      seq: (previous?.seq ?? 0) + 1,
      ...payload,
    }));
  }, []);

  function navigateToWeek(weekIso: string) {
    router.push(`/dashboard?week=${weekIso}`);
  }

  function handleWeekJumpChange(value: string) {
    setWeekJumpDate(value);
    const selectedDateWeekStart = parseWeekParamToMondayUtc(value);
    if (!selectedDateWeekStart) {
      return;
    }

    navigateToWeek(formatIsoDateUtc(selectedDateWeekStart));
  }

  return (
    <>
      <section className="mx-auto grid w-full max-w-7xl gap-4 p-4 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Weekly Calendar View</CardTitle>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => navigateToWeek(previousWeekIso)}>
                  Previous week
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => navigateToWeek(currentWeekIso)}>
                  Current week
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => navigateToWeek(nextWeekIso)}>
                  Next week
                </Button>
                <Input
                  type="date"
                  value={weekJumpDate}
                  onChange={(event) => handleWeekJumpChange(event.target.value)}
                  className="h-8 w-[9.5rem]"
                  aria-label="Jump to week by date"
                />
              </div>
            </div>
            <CardDescription>
              Scheduled items for the selected week ({calendarEvents.length}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchedulerCalendar
              events={calendarEvents}
              dateLocale={dateLocale}
              visibleEndTime={visibleEndTime}
              visibleStartTime={visibleStartTime}
              weekStartIso={weekStartIso}
              onItemSelect={handleItemSelect}
              onScheduleSync={handleScheduleSync}
              statusSync={statusSync}
            />
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col">
          <CardHeader>
            <CardTitle>Unscheduled</CardTitle>
            <CardDescription className="space-y-0.5">
              <span className="block text-xs leading-tight">
                Unscheduled items carry over weekly
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <BucketPanel
              items={bucketItems}
              targetWeekIso={weekStartIso}
              onItemSelect={handleItemSelect}
            />
          </CardContent>
        </Card>
      </section>

      <ItemDetailPanel
        itemId={selectedItemId}
        refreshToken={panelRefreshToken}
        scheduleSync={scheduleSync}
        onStatusSync={handleStatusSync}
        onClose={() => setSelectedItemId(null)}
      />
    </>
  );
}
