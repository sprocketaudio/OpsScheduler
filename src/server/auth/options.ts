import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { logAuditEvent } from "@/server/audit/log";
import { prisma } from "@/server/db/client";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getPositiveIntegerFromEnv(name: string, defaultValue: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
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
const magicLinkMaxAgeSeconds = getPositiveIntegerFromEnv("AUTH_MAGIC_LINK_MAX_AGE_SECONDS", 900);
const sessionMaxAgeSeconds = getPositiveIntegerFromEnv("AUTH_SESSION_MAX_AGE_SECONDS", 60 * 60 * 24 * 14);
const sessionUpdateAgeSeconds = getPositiveIntegerFromEnv(
  "AUTH_SESSION_UPDATE_AGE_SECONDS",
  60 * 60 * 12,
);

if (approvedEmails.size === 0) {
  throw new Error("AUTH_ALLOWED_EMAILS must contain at least one email address");
}

if (sessionUpdateAgeSeconds > sessionMaxAgeSeconds) {
  throw new Error("AUTH_SESSION_UPDATE_AGE_SECONDS must be less than or equal to AUTH_SESSION_MAX_AGE_SECONDS");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: authSecret,
  session: {
    strategy: "database",
    maxAge: sessionMaxAgeSeconds,
    updateAge: sessionUpdateAgeSeconds,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    EmailProvider({
      from: authEmailFrom,
      maxAge: magicLinkMaxAgeSeconds,
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
            `This link expires in ${Math.max(1, Math.floor(magicLinkMaxAgeSeconds / 60))} minutes.`,
          html:
            `<p>Sign in to <strong>OpsScheduler</strong> (${safeHost}).</p>` +
            `<p><a href="${url}">Click here to sign in</a></p>` +
            `<p>This link expires in ${Math.max(1, Math.floor(magicLinkMaxAgeSeconds / 60))} minutes.</p>`,
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
        logAuditEvent({
          action: "auth.sign_in",
          outcome: "denied",
          metadata: {
            reason: "missing_email",
          },
        });
        return false;
      }

      if (!approvedEmails.has(candidateEmail)) {
        logAuditEvent({
          action: "auth.sign_in",
          outcome: "denied",
          metadata: {
            reason: "email_not_allowlisted",
            email: candidateEmail,
          },
        });
        return false;
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: candidateEmail,
        },
        select: {
          id: true,
          active: true,
        },
      });

      if (!existingUser) {
        logAuditEvent({
          action: "auth.sign_in",
          outcome: "denied",
          metadata: {
            reason: "user_not_provisioned",
            email: candidateEmail,
          },
        });
        return false;
      }

      if (!existingUser.active) {
        logAuditEvent({
          action: "auth.sign_in",
          outcome: "denied",
          actorUserId: existingUser.id,
          metadata: {
            reason: "inactive_user",
            email: candidateEmail,
          },
        });
        return false;
      }

      logAuditEvent({
        action: "auth.sign_in",
        outcome: "success",
        actorUserId: existingUser.id,
        metadata: {
          email: candidateEmail,
        },
      });

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
