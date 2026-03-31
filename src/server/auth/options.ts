import { randomInt } from "node:crypto";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { logAuditEvent } from "@/server/audit/log";
import { prisma } from "@/server/db/client";
import { evaluateSignInAttempt } from "@/server/auth/sign-in-policy";

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

const EMAIL_SIGN_IN_CODE_DIGITS = 6;
const EMAIL_SIGN_IN_CODE_MAX_VALUE = 10 ** EMAIL_SIGN_IN_CODE_DIGITS;

function generateSignInCode(): string {
  return randomInt(0, EMAIL_SIGN_IN_CODE_MAX_VALUE)
    .toString()
    .padStart(EMAIL_SIGN_IN_CODE_DIGITS, "0");
}

function scopeVerificationToken(identifier: string, token: string): string {
  return `${identifier.toLowerCase()}::${token}`;
}

function withScopedVerificationTokens(adapter: Adapter): Adapter {
  const createVerificationToken = adapter.createVerificationToken?.bind(adapter);
  const useVerificationToken = adapter.useVerificationToken?.bind(adapter);

  if (!createVerificationToken || !useVerificationToken) {
    throw new Error("Auth adapter must support verification tokens");
  }

  return {
    ...adapter,
    async createVerificationToken(verificationToken) {
      const identifier = verificationToken.identifier.trim().toLowerCase();
      return createVerificationToken({
        ...verificationToken,
        identifier,
        token: scopeVerificationToken(identifier, verificationToken.token),
      });
    },
    async useVerificationToken(verificationToken) {
      const identifier = verificationToken.identifier?.trim().toLowerCase();
      if (!identifier) {
        return null;
      }

      return useVerificationToken({
        ...verificationToken,
        identifier,
        token: scopeVerificationToken(identifier, verificationToken.token),
      });
    },
  };
}

async function shouldSendSignInCode(identifier: string, approvedEmailSet: Set<string>): Promise<boolean> {
  const candidateEmail = identifier.trim().toLowerCase();
  if (!candidateEmail || !approvedEmailSet.has(candidateEmail)) {
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

  return Boolean(existingUser?.active);
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

let authUrlObject: URL;
try {
  authUrlObject = new URL(authUrl);
} catch {
  throw new Error("AUTH_URL must be a valid absolute URL");
}

const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
const authEmailFrom = getRequiredEnv("AUTH_EMAIL_FROM");
const approvedEmails = parseApprovedEmails(getRequiredEnv("AUTH_ALLOWED_EMAILS"));
const emailCodeMaxAgeSeconds = getPositiveIntegerFromEnv(
  "AUTH_EMAIL_CODE_MAX_AGE_SECONDS",
  getPositiveIntegerFromEnv("AUTH_MAGIC_LINK_MAX_AGE_SECONDS", 900),
);
const sessionMaxAgeSeconds = getPositiveIntegerFromEnv("AUTH_SESSION_MAX_AGE_SECONDS", 60 * 60 * 24 * 14);
const sessionUpdateAgeSeconds = getPositiveIntegerFromEnv(
  "AUTH_SESSION_UPDATE_AGE_SECONDS",
  60 * 60 * 12,
);
const authSignInPageUrl = `${authUrlObject.origin}/login`;
const authHost = authUrlObject.host;

if (approvedEmails.size === 0) {
  throw new Error("AUTH_ALLOWED_EMAILS must contain at least one email address");
}

if (sessionUpdateAgeSeconds > sessionMaxAgeSeconds) {
  throw new Error("AUTH_SESSION_UPDATE_AGE_SECONDS must be less than or equal to AUTH_SESSION_MAX_AGE_SECONDS");
}

export const authOptions: NextAuthOptions = {
  adapter: withScopedVerificationTokens(PrismaAdapter(prisma)),
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
      maxAge: emailCodeMaxAgeSeconds,
      async generateVerificationToken() {
        return generateSignInCode();
      },
      async sendVerificationRequest({ identifier, token, provider }) {
        // Defense-in-depth: only deliver codes for active, provisioned allowlisted users.
        if (!(await shouldSendSignInCode(identifier, approvedEmails))) {
          return;
        }

        const safeHost = escapeHtml(authHost);
        const safeCode = escapeHtml(token);

        const { error } = await resend.emails.send({
          from: provider.from ?? authEmailFrom,
          to: identifier,
          subject: "Your OpsScheduler sign-in code",
          text:
            `Sign in to OpsScheduler (${authHost})\n\n` +
            `Your sign-in code is: ${token}\n\n` +
            `Enter this code at ${authSignInPageUrl}\n\n` +
            `This code expires in ${Math.max(1, Math.floor(emailCodeMaxAgeSeconds / 60))} minutes.`,
          html:
            `<p>Sign in to <strong>OpsScheduler</strong> (${safeHost}).</p>` +
            `<p>Your sign-in code is <strong style="font-size:1.25rem;letter-spacing:0.08em;">${safeCode}</strong>.</p>` +
            `<p>Enter this code on the sign-in page: <a href="${authSignInPageUrl}">${safeHost}</a></p>` +
            `<p>This code expires in ${Math.max(1, Math.floor(emailCodeMaxAgeSeconds / 60))} minutes.</p>`,
        });

        if (error) {
          throw new Error(`Failed to send sign-in code email: ${error.message}`);
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const candidateEmail = (user.email ?? "").trim().toLowerCase();
      const shouldLoadExistingUser = candidateEmail.length > 0 && approvedEmails.has(candidateEmail);
      const existingUser = shouldLoadExistingUser
        ? await prisma.user.findUnique({
            where: {
              email: candidateEmail,
            },
            select: {
              id: true,
              active: true,
            },
          })
        : null;

      const decision = evaluateSignInAttempt({
        candidateEmail,
        approvedEmails,
        existingUser,
      });

      await logAuditEvent(decision.auditEvent);
      return decision.allow;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
