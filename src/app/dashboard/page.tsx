import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/features/auth/sign-out-button";
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

type DashboardPageProps = {
  searchParams?: Promise<{
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
    onHold: boolean;
    notes?: string | null;
  };
  id: string;
  start: string;
  title: string;
};

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
    },
  });

  if (!currentUser) {
    redirect("/login?callbackUrl=/dashboard");
  }
  const dateLocale = normalizeDateLocale(currentUser.dateLocale);
  const weekLabel = formatWeekCommencingLabel(selectedWeekStart, dateLocale);

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
        done: true,
        fixed: true,
        onHold: true,
        cancelled: true,
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
        startDate: {
          not: null,
          lte: selectedWeekEnd,
        },
        OR: [
          {
            endDate: null,
          },
          {
            endDate: {
              gte: selectedWeekStart,
            },
          },
        ],
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

  const calendarEvents: CalendarEvent[] = [];
  for (const item of scheduledItems) {
    if (!item.startDate) {
      continue;
    }

    const assigneeColour = item.assignee?.colour;

    if (item.startTime) {
      calendarEvents.push({
        id: item.id,
        title: item.title,
        allDay: false,
        start: combineDateAndTime(item.startDate, item.startTime),
        end: item.endTime
          ? combineDateAndTime(item.endDate ?? item.startDate, item.endTime)
          : undefined,
        backgroundColor: assigneeColour ?? undefined,
        borderColor: assigneeColour ?? undefined,
        extendedProps: {
          fixed: item.fixed,
          onHold: item.onHold,
          cancelled: item.cancelled,
          done: item.done,
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
      backgroundColor: assigneeColour ?? undefined,
      borderColor: assigneeColour ?? undefined,
      extendedProps: {
        fixed: item.fixed,
        onHold: item.onHold,
        cancelled: item.cancelled,
        done: item.done,
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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">OpsScheduler</p>
              <h1 className="text-xl font-semibold">Week commencing {weekLabel}</h1>
            </div>
            <p className="text-sm text-muted-foreground">Signed in as {currentUser.email}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              placeholder="Search title, customer, notes"
              disabled
              className="min-w-[260px] flex-1"
            />
            <Button type="button" variant="outline" disabled>
              My Items
            </Button>
            <Button type="button" variant="outline" disabled>
              Fixed Items
            </Button>
            <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
              Profile
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <SchedulerWorkspace
        bucketItems={bucketItems}
        calendarEvents={calendarEvents}
        dateLocale={dateLocale}
        visibleEndTime={visibleEndTime}
        visibleStartTime={visibleStartTime}
        weekStartIso={formatIsoDateUtc(selectedWeekStart)}
      />
    </main>
  );
}
