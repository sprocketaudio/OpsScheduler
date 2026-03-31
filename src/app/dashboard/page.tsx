import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { RouteButton } from "@/features/navigation/route-button";
import { DashboardFilters, MyItemsFilterButton } from "@/features/scheduler/dashboard-filters";
import { SchedulerWorkspace } from "@/features/scheduler/scheduler-workspace";
import { resolveVisibleWindow } from "@/features/scheduler/visible-window";
import { normalizeDateLocale } from "@/features/settings/date-locale";
import {
  addDaysUtc,
  formatIsoDateUtc,
  formatWeekCommencingLabel,
  parseWeekParamToMondayUtc,
  startOfWeekMondayUtc,
} from "@/features/scheduler/week";
import { getServerAuthSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { carryForwardBucketItemsForOrganization } from "@/server/scheduler/carry-forward";

type DashboardPageProps = {
  searchParams?: Promise<{
    mine?: string;
    q?: string;
    week?: string;
  }>;
};

type CalendarEvent = {
  allDay: boolean;
  backgroundColor?: string;
  borderColor?: string;
  end?: string;
  extendedProps?: {
    cancelled: boolean;
    customer?: string | null;
    done: boolean;
    fixed: boolean;
    matchesMine?: boolean;
    matchesSearch?: boolean;
    onHold: boolean;
    notes?: string | null;
  };
  id: string;
  start: string;
  title: string;
};

function buildWeekVisibleItemsWhere(weekStart: Date, weekEnd: Date): Prisma.WorkItemWhereInput {
  return {
    OR: [
      {
        startDate: null,
        targetWeek: weekStart,
      },
      {
        startDate: {
          not: null,
          lte: weekEnd,
        },
        OR: [
          {
            endDate: {
              gte: weekStart,
            },
          },
          {
            endDate: null,
            startDate: {
              gte: weekStart,
            },
          },
        ],
      },
    ],
  };
}

function collectMatchingWeekIsos(items: Array<{ endDate: Date | null; startDate: Date | null; targetWeek: Date }>): string[] {
  const weekIsos = new Set<string>();

  for (const item of items) {
    if (!item.startDate) {
      weekIsos.add(formatIsoDateUtc(item.targetWeek));
      continue;
    }

    const effectiveEndDate = item.endDate ?? item.startDate;
    let cursor = startOfWeekMondayUtc(item.startDate);
    const finalWeek = startOfWeekMondayUtc(effectiveEndDate);

    while (cursor.getTime() <= finalWeek.getTime()) {
      weekIsos.add(formatIsoDateUtc(cursor));
      cursor = addDaysUtc(cursor, 7);
    }
  }

  return Array.from(weekIsos).sort();
}

function collectMatchingDateIsos(items: Array<{ endDate: Date | null; startDate: Date | null; targetWeek: Date }>): string[] {
  const dateIsos = new Set<string>();

  for (const item of items) {
    if (!item.startDate) {
      for (let offset = 0; offset < 7; offset += 1) {
        dateIsos.add(formatIsoDateUtc(addDaysUtc(item.targetWeek, offset)));
      }
      continue;
    }

    const effectiveEndDate = item.endDate ?? item.startDate;
    let cursor = item.startDate;

    while (cursor.getTime() <= effectiveEndDate.getTime()) {
      dateIsos.add(formatIsoDateUtc(cursor));
      cursor = addDaysUtc(cursor, 1);
    }
  }

  return Array.from(dateIsos).sort();
}

function combineDateAndTime(dateValue: Date, timeValue: Date): string {
  const dateIso = formatIsoDateUtc(dateValue);
  const hours = String(timeValue.getUTCHours()).padStart(2, "0");
  const minutes = String(timeValue.getUTCMinutes()).padStart(2, "0");
  const seconds = String(timeValue.getUTCSeconds()).padStart(2, "0");
  return `${dateIso}T${hours}:${minutes}:${seconds}`;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const params = (await searchParams) ?? {};
  const searchQuery = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const normalizedSearch = searchQuery.toLowerCase();
  const myItemsOnly = params.mine === "1";
  const currentWeekStart = startOfWeekMondayUtc(new Date());
  const selectedWeekStart = parseWeekParamToMondayUtc(params.week) ?? currentWeekStart;
  const selectedWeekEnd = addDaysUtc(selectedWeekStart, 6);

  const currentUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      email: true,
      organizationId: true,
      dateLocale: true,
      calendarVisibleStartTime: true,
      calendarVisibleEndTime: true,
      organization: {
        select: {
          defaultColour: true,
        },
      },
    },
  });

  if (!currentUser) {
    redirect("/login?callbackUrl=/dashboard");
  }

  await carryForwardBucketItemsForOrganization({
    organizationId: currentUser.organizationId,
    referenceDate: currentWeekStart,
  });

  const defaultAssigneeColour = currentUser.organization.defaultColour;
  const dateLocale = normalizeDateLocale(currentUser.dateLocale);
  const weekLabel = formatWeekCommencingLabel(selectedWeekStart, dateLocale);
  const searchFilters: Prisma.WorkItemWhereInput[] = [];
  const mineSearchFilters: Prisma.WorkItemWhereInput[] = myItemsOnly
    ? [
        {
          assigneeId: session.user.id,
        },
      ]
    : [];

  if (normalizedSearch) {
    searchFilters.push({
      OR: [
        {
          title: {
            contains: normalizedSearch,
            mode: "insensitive",
          },
        },
        {
          customer: {
            contains: normalizedSearch,
            mode: "insensitive",
          },
        },
        {
          notes: {
            contains: normalizedSearch,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  const [bucketItems, scheduledItems] = await Promise.all([
    prisma.workItem.findMany({
      where: {
        organizationId: currentUser.organizationId,
        startDate: null,
        targetWeek: selectedWeekStart,
      },
      orderBy: [{ done: "asc" }, { fixed: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        customer: true,
        notes: true,
        done: true,
        fixed: true,
        onHold: true,
        cancelled: true,
        assigneeId: true,
        assignee: {
          select: {
            colour: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.workItem.findMany({
      where: {
        organizationId: currentUser.organizationId,
        ...buildWeekVisibleItemsWhere(selectedWeekStart, selectedWeekEnd),
        startDate: {
          not: null,
        },
      },
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        customer: true,
        notes: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        assigneeId: true,
        fixed: true,
        onHold: true,
        cancelled: true,
        done: true,
        assignee: {
          select: {
            colour: true,
          },
        },
      },
    }),
  ]);

  let matchWeekIsos: string[] = [];
  let matchDateIsos: string[] = [];

  if (searchFilters.length > 0) {
    const sharedSearchScope: Prisma.WorkItemWhereInput[] = [
      {
        organizationId: currentUser.organizationId,
      },
      ...mineSearchFilters,
      ...searchFilters,
    ];

    const matchingItems = await prisma.workItem.findMany({
      where: {
        AND: sharedSearchScope,
      },
      select: {
        startDate: true,
        endDate: true,
        targetWeek: true,
      },
    });

    matchWeekIsos = collectMatchingWeekIsos(matchingItems);
    matchDateIsos = collectMatchingDateIsos(matchingItems);
  }

  const calendarEvents: CalendarEvent[] = [];
  for (const item of scheduledItems) {
    if (!item.startDate) {
      continue;
    }
    const matchesSearch =
      !normalizedSearch ||
      item.title.toLowerCase().includes(normalizedSearch) ||
      (item.customer ?? "").toLowerCase().includes(normalizedSearch) ||
      (item.notes ?? "").toLowerCase().includes(normalizedSearch);
    const matchesMine = !myItemsOnly || item.assigneeId === session.user.id;

    const assigneeColour = item.assignee?.colour;
    const displayColour = assigneeColour ?? defaultAssigneeColour;

    if (item.startTime) {
      calendarEvents.push({
        id: item.id,
        title: item.title,
        allDay: false,
        start: combineDateAndTime(item.startDate, item.startTime),
        end: item.endTime
          ? combineDateAndTime(item.endDate ?? item.startDate, item.endTime)
          : undefined,
        backgroundColor: displayColour,
        borderColor: displayColour,
        extendedProps: {
          fixed: item.fixed,
          onHold: item.onHold,
          cancelled: item.cancelled,
          done: item.done,
          matchesMine,
          matchesSearch,
          customer: item.customer,
          notes: item.notes,
        },
      });
      continue;
    }

    calendarEvents.push({
      id: item.id,
      title: item.title,
      allDay: true,
      start: formatIsoDateUtc(item.startDate),
      end: item.endDate ? formatIsoDateUtc(addDaysUtc(item.endDate, 1)) : undefined,
      backgroundColor: displayColour,
      borderColor: displayColour,
      extendedProps: {
        fixed: item.fixed,
        onHold: item.onHold,
        cancelled: item.cancelled,
        done: item.done,
        matchesMine,
        matchesSearch,
        customer: item.customer,
        notes: item.notes,
      },
    });
  }

  const { visibleStartTime, visibleEndTime } = resolveVisibleWindow(
    currentUser.calendarVisibleStartTime,
    currentUser.calendarVisibleEndTime,
  );

  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">OpsScheduler</p>
            <p className="text-sm text-muted-foreground">Signed in as {currentUser.email}</p>
          </div>

          <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:items-center 2xl:gap-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">Week commencing {weekLabel}</h1>
              <div className="ml-auto flex min-w-0 items-center justify-end">
                <DashboardFilters initialSearch={searchQuery} myItemsOnly={myItemsOnly} showMyItemsButton={false} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <MyItemsFilterButton myItemsOnly={myItemsOnly} />
              <RouteButton href="/settings" label="Settings" />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <SchedulerWorkspace
        bucketItems={bucketItems.map((item) => ({
          ...item,
          defaultColour: defaultAssigneeColour,
          matchesMine: !myItemsOnly || item.assigneeId === session.user.id,
          matchesSearch:
            !normalizedSearch ||
            item.title.toLowerCase().includes(normalizedSearch) ||
            (item.customer ?? "").toLowerCase().includes(normalizedSearch) ||
            (item.notes ?? "").toLowerCase().includes(normalizedSearch),
        }))}
        calendarEvents={calendarEvents}
        dateLocale={dateLocale}
        matchDateIsos={matchDateIsos}
        matchWeekIsos={matchWeekIsos}
        mineActive={myItemsOnly}
        searchActive={searchQuery.length > 0}
        visibleEndTime={visibleEndTime}
        visibleStartTime={visibleStartTime}
        weekStartIso={formatIsoDateUtc(selectedWeekStart)}
      />
    </main>
  );
}
