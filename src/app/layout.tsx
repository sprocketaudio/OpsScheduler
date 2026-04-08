import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import { MuiCacheProvider } from "@/components/providers/mui-cache-provider";
import { normalizeThemePreference } from "@/features/settings/theme";
import { getServerAuthSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpsScheduler",
  description: "Internal operations scheduling tool",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerAuthSession();
  const userTheme =
    session?.user?.id
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { uiTheme: true },
        })
      : null;
  const resolvedTheme = normalizeThemePreference(userTheme?.uiTheme);

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${geistMono.variable} ${resolvedTheme === "dark" ? "dark" : ""} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MuiCacheProvider>{children}</MuiCacheProvider>
      </body>
    </html>
  );
}
