import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { prisma } from "@/server/db/client";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseApprovedEmails(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!authSecret) {
  throw new Error("AUTH_SECRET is required");
}
process.env.NEXTAUTH_SECRET ??= authSecret;

const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
if (!authUrl) {
  throw new Error("AUTH_URL is required");
}
process.env.NEXTAUTH_URL ??= authUrl;

const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
const authEmailFrom = getRequiredEnv("AUTH_EMAIL_FROM");
const approvedEmails = parseApprovedEmails(getRequiredEnv("AUTH_ALLOWED_EMAILS"));

if (approvedEmails.size === 0) {
  throw new Error("AUTH_ALLOWED_EMAILS must contain at least one email address");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: authSecret,
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    EmailProvider({
      from: authEmailFrom,
      maxAge: 60 * 60 * 24,
      async sendVerificationRequest({ identifier, url, provider }) {
        const host = new URL(url).host;
        const safeHost = escapeHtml(host);

        const { error } = await resend.emails.send({
          from: provider.from ?? authEmailFrom,
          to: identifier,
          subject: "Sign in to OpsScheduler",
          text:
            `Sign in to OpsScheduler (${host})\n` +
            `${url}\n\n` +
            "This link expires in 24 hours.",
          html:
            `<p>Sign in to <strong>OpsScheduler</strong> (${safeHost}).</p>` +
            `<p><a href="${url}">Click here to sign in</a></p>` +
            "<p>This link expires in 24 hours.</p>",
        });

        if (error) {
          throw new Error(`Failed to send magic link email: ${error.message}`);
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const candidateEmail = (user.email ?? "").trim().toLowerCase();
      if (!candidateEmail) {
        return false;
      }

      if (!approvedEmails.has(candidateEmail)) {
        return false;
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: candidateEmail,
        },
        select: {
          active: true,
        },
      });

      if (existingUser && !existingUser.active) {
        return false;
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
