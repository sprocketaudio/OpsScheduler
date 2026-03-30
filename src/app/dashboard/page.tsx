import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { getServerAuthSession } from "@/server/auth/session";

function getWeekCommencingLabel(referenceDate: Date): string {
  const monday = new Date(referenceDate);
  const day = monday.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(monday);
}

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const weekLabel = getWeekCommencingLabel(new Date());

  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">OpsScheduler</p>
              <h1 className="text-xl font-semibold">Week commencing {weekLabel}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" disabled>
                Previous week
              </Button>
              <Button type="button" variant="outline" disabled>
                Current week
              </Button>
              <Button type="button" variant="outline" disabled>
                Next week
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
            <Input type="search" placeholder="Search title, customer, notes" disabled />
            <Button type="button" variant="outline" disabled>
              My Items
            </Button>
            <Button type="button" variant="outline" disabled>
              Fixed Items
            </Button>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" disabled>
                Profile
              </Button>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Calendar View</CardTitle>
            <CardDescription>Monday to Sunday calendar area with all-day and timed sections.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Scheduling interactions are implemented in later phases.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Bucket</CardTitle>
            <CardDescription>Unscheduled items for the selected target week.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bucket item rendering and carry-forward behaviour are implemented in later phases.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">Signed in as {session.user.email}</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
