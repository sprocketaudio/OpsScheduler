export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-16">
      <section className="w-full rounded-xl border bg-card p-8 text-card-foreground shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          OpsScheduler
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Phase 1 Project Setup Complete</h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Next.js, TypeScript, Tailwind, shadcn/ui, Prisma, Auth.js, Zod, Resend, and
          PostgreSQL client dependencies are installed and pinned. The Prisma schema and base
          server folder structure are now in place.
        </p>
        <div className="mt-6 rounded-md bg-muted p-4 text-sm text-muted-foreground">
          Next step: implement Phase 2 authentication with magic-link login and protected routing.
        </div>
      </section>
    </main>
  );
}
