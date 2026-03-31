import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  convertIsoTimeToInputValue,
  resolveVisibleWindow,
} from "@/features/scheduler/visible-window";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { RouteButton } from "@/features/navigation/route-button";
import { AdminColourSettingsForm } from "@/features/settings/admin-colour-settings-form";
import { normalizeDateLocale } from "@/features/settings/date-locale";
import { CalendarPreferencesForm } from "@/features/settings/calendar-preferences-form";
import { normalizeThemePreference } from "@/features/settings/theme";
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
      role: true,
      organizationId: true,
      dateLocale: true,
      uiTheme: true,
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
    redirect("/login?callbackUrl=/settings");
  }

  const { visibleStartTime, visibleEndTime } = resolveVisibleWindow(
    currentUser.calendarVisibleStartTime,
    currentUser.calendarVisibleEndTime,
  );

  const adminUsers =
    currentUser.role === "admin"
      ? await prisma.user.findMany({
          where: {
            organizationId: currentUser.organizationId,
            active: true,
          },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: {
            id: true,
            name: true,
            email: true,
            colour: true,
          },
        })
      : [];

  return (
    <main className="page-density-laptop min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-3 xl:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">OpsScheduler</p>
            <p className="text-sm text-muted-foreground">Signed in as {currentUser.email}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Settings</h1>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <RouteButton href="/dashboard" label="Back to dashboard" />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl p-3 xl:p-4">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Display and calendar preferences</CardTitle>
            <CardDescription>
              Set your personal date format and visible day range in the weekly calendar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarPreferencesForm
              initialDateLocale={normalizeDateLocale(currentUser.dateLocale)}
              initialTheme={normalizeThemePreference(currentUser.uiTheme)}
              initialVisibleStartTime={convertIsoTimeToInputValue(visibleStartTime)}
              initialVisibleEndTime={convertIsoTimeToInputValue(visibleEndTime)}
            />
          </CardContent>
        </Card>

        {currentUser.role === "admin" ? (
          <Card>
            <CardHeader>
              <CardTitle>Admin colour settings</CardTitle>
              <CardDescription>
                Manage colours for users and the default colour for unassigned items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminColourSettingsForm
                initialDefaultColour={currentUser.organization.defaultColour}
                initialUsers={adminUsers}
              />
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
