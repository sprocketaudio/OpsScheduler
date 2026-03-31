"use client";

import type { EventInput } from "@fullcalendar/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { BucketPanel, type BucketPanelItem } from "@/features/scheduler/bucket-panel";
import { SchedulerCalendar } from "@/features/scheduler/calendar-view";
import { addDaysUtc, formatIsoDateUtc, parseWeekParamToMondayUtc, startOfWeekMondayUtc } from "@/features/scheduler/week";
import type { DateLocale } from "@/features/settings/date-locale";
import { ItemDetailPanel } from "@/features/scheduler/item-detail-panel";
import { cn } from "@/lib/utils";

type SchedulerWorkspaceProps = {
  bucketItems: BucketPanelItem[];
  calendarEvents: EventInput[];
  dateLocale: DateLocale;
  matchDateIsos: string[];
  matchWeekIsos: string[];
  mineActive: boolean;
  searchActive: boolean;
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
  matchDateIsos,
  matchWeekIsos,
  mineActive,
  searchActive,
  visibleEndTime,
  visibleStartTime,
  weekStartIso,
}: SchedulerWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedWeekStart = parseWeekParamToMondayUtc(weekStartIso) ?? startOfWeekMondayUtc(new Date());
  const previousWeekIso = formatIsoDateUtc(addDaysUtc(selectedWeekStart, -7));
  const currentWeekIso = formatIsoDateUtc(startOfWeekMondayUtc(new Date()));
  const nextWeekIso = formatIsoDateUtc(addDaysUtc(selectedWeekStart, 7));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [weekJumpDate, setWeekJumpDate] = useState(weekStartIso);
  const [panelRefreshToken, setPanelRefreshToken] = useState(0);
  const [scheduleSync, setScheduleSync] = useState<(ScheduleSyncPayload & { seq: number }) | null>(null);
  const [statusSync, setStatusSync] = useState<(StatusSyncPayload & { seq: number }) | null>(null);
  const [showWeekends, setShowWeekends] = useState(true);
  const selectedItemIdRef = useRef<string | null>(selectedItemId);
  const matchWeekSet = useMemo(() => new Set(matchWeekIsos), [matchWeekIsos]);
  const previousWeekHasSearchMatch = searchActive && matchWeekSet.has(previousWeekIso);
  const currentWeekHasSearchMatch = searchActive && matchWeekSet.has(currentWeekIso);
  const nextWeekHasSearchMatch = searchActive && matchWeekSet.has(nextWeekIso);
  const anyWeekHasSearchMatch = searchActive && matchWeekIsos.length > 0;
  useEffect(() => {
    setWeekJumpDate(weekStartIso);
  }, [weekStartIso]);

  useEffect(() => {
    const saved = window.localStorage.getItem("scheduler.showWeekends");
    if (saved === "false") {
      setShowWeekends(false);
      return;
    }

    if (saved === "true") {
      setShowWeekends(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("scheduler.showWeekends", showWeekends ? "true" : "false");
  }, [showWeekends]);

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
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("week", weekIso);
    router.push(`/dashboard?${nextParams.toString()}`);
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
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="leading-8">Weekly Calendar View</CardTitle>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigateToWeek(previousWeekIso)}
                  className={cn(
                    searchActive && previousWeekHasSearchMatch
                      ? "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200"
                      : "",
                  )}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigateToWeek(currentWeekIso)}
                  className={cn(
                    searchActive && currentWeekHasSearchMatch
                      ? "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200"
                      : "",
                  )}
                >
                  Current
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigateToWeek(nextWeekIso)}
                  className={cn(
                    searchActive && nextWeekHasSearchMatch
                      ? "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200"
                      : "",
                  )}
                >
                  Next
                </Button>
                <DatePicker
                  ariaLabel="Jump to week by date"
                  valueIso={weekJumpDate}
                  onChangeIso={handleWeekJumpChange}
                  dateLocale={dateLocale}
                  highlightedDateIsos={searchActive ? matchDateIsos : []}
                  highlightControl={searchActive && anyWeekHasSearchMatch}
                  showClearAction={false}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardDescription className="m-0">
                Scheduled items for the selected week ({calendarEvents.length}).
              </CardDescription>
              <Button
                type="button"
                variant="link"
                className="h-6 px-0 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowWeekends((value) => !value)}
              >
                {showWeekends ? "Hide weekend <" : "Show weekend >"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <SchedulerCalendar
              events={calendarEvents}
              dateLocale={dateLocale}
              mineActive={mineActive}
              searchActive={searchActive}
              visibleEndTime={visibleEndTime}
              visibleStartTime={visibleStartTime}
              showWeekends={showWeekends}
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
              mineActive={mineActive}
              searchActive={searchActive}
              targetWeekIso={weekStartIso}
              onItemSelect={handleItemSelect}
            />
          </CardContent>
        </Card>
      </section>

      <ItemDetailPanel
        dateLocale={dateLocale}
        itemId={selectedItemId}
        refreshToken={panelRefreshToken}
        scheduleSync={scheduleSync}
        onStatusSync={handleStatusSync}
        onClose={() => setSelectedItemId(null)}
      />
    </>
  );
}
