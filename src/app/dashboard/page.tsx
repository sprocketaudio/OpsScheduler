import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { SchedulerCalendar } from "@/features/scheduler/calendar-view";
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
  const weekLabel = formatWeekCommencingLabel(selectedWeekStart);

  const currentUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      email: true,
      organizationId: true,
    },
  });

  if (!currentUser) {
    redirect("/login?callbackUrl=/dashboard");
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
        done: true,
        fixed: true,
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
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
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

    const eventTitle = item.customer ? `${item.title} - ${item.customer}` : item.title;
    const assigneeColour = item.assignee?.colour;

    if (item.startTime) {
      calendarEvents.push({
        id: item.id,
        title: eventTitle,
        allDay: false,
        start: combineDateAndTime(item.startDate, item.startTime),
        end: item.endTime
          ? combineDateAndTime(item.endDate ?? item.startDate, item.endTime)
          : undefined,
        backgroundColor: assigneeColour ?? undefined,
        borderColor: assigneeColour ?? undefined,
      });
      continue;
    }

    calendarEvents.push({
      id: item.id,
      title: eventTitle,
      allDay: true,
      start: formatIsoDateUtc(item.startDate),
      end: item.endDate ? formatIsoDateUtc(addDaysUtc(item.endDate, 1)) : undefined,
      backgroundColor: assigneeColour ?? undefined,
      borderColor: assigneeColour ?? undefined,
    });
  }

  const previousWeekHref = `/dashboard?week=${formatIsoDateUtc(addDaysUtc(selectedWeekStart, -7))}`;
  const currentWeekHref = `/dashboard?week=${formatIsoDateUtc(currentWeekStart)}`;
  const nextWeekHref = `/dashboard?week=${formatIsoDateUtc(addDaysUtc(selectedWeekStart, 7))}`;

  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
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
            <Link href={previousWeekHref} className={buttonVariants({ variant: "outline" })}>
              Previous week
            </Link>
            <Link href={currentWeekHref} className={buttonVariants({ variant: "outline" })}>
              Current week
            </Link>
            <Link href={nextWeekHref} className={buttonVariants({ variant: "outline" })}>
              Next week
            </Link>
            <Button type="button" variant="outline" disabled>
              My Items
            </Button>
            <Button type="button" variant="outline" disabled>
              Fixed Items
            </Button>
            <Button type="button" variant="outline" disabled>
              Profile
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Calendar View</CardTitle>
            <CardDescription>
              Scheduled items for the selected week ({calendarEvents.length}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchedulerCalendar
              events={calendarEvents}
              weekStartIso={formatIsoDateUtc(selectedWeekStart)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Bucket</CardTitle>
            <CardDescription>Unscheduled items for this target week ({bucketItems.length}).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bucketItems.length > 0 ? (
              <div className="space-y-2">
                {bucketItems.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.customer ? (
                      <p className="text-sm text-muted-foreground">Customer: {item.customer}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.fixed ? <span>Fixed</span> : null}
                      {item.done ? <span>Done</span> : null}
                      {!item.fixed && !item.done ? <span>Open</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border p-3">
                <p className="text-sm text-muted-foreground">
                  No unscheduled items in the bucket for this week.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
