import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  convertIsoTimeToInputValue,
  resolveVisibleWindow,
} from "@/features/scheduler/visible-window";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { CalendarPreferencesForm } from "@/features/settings/calendar-preferences-form";
import { getServerAuthSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";

export default async function SettingsPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/settings");
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      email: true,
      calendarVisibleStartTime: true,
      calendarVisibleEndTime: true,
    },
  });

  if (!currentUser) {
    redirect("/login?callbackUrl=/settings");
  }

  const { visibleStartTime, visibleEndTime } = resolveVisibleWindow(
    currentUser.calendarVisibleStartTime,
    currentUser.calendarVisibleEndTime,
  );

  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">OpsScheduler</p>
            <h1 className="text-xl font-semibold">Profile settings</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">Signed in as {currentUser.email}</p>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Back to dashboard
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>Calendar view window</CardTitle>
            <CardDescription>
              Set your personal visible day range in the weekly calendar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarPreferencesForm
              initialVisibleStartTime={convertIsoTimeToInputValue(visibleStartTime)}
              initialVisibleEndTime={convertIsoTimeToInputValue(visibleEndTime)}
            />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
