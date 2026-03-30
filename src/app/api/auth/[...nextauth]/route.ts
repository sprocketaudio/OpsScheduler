import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/server/auth/options";
import { consumeFixedWindowRateLimit } from "@/server/security/rate-limit";

const handler = NextAuth(authOptions);

function getPositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

const AUTH_SIGNIN_EMAIL_LIMIT = getPositiveIntEnv("AUTH_SIGNIN_RATE_LIMIT_REQUESTS", 10);
const AUTH_SIGNIN_EMAIL_WINDOW_MS =
  getPositiveIntEnv("AUTH_SIGNIN_RATE_LIMIT_WINDOW_SECONDS", 60) * 1000;

function getClientAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstAddress = forwardedFor.split(",")[0]?.trim();
    if (firstAddress) {
      return firstAddress;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function shouldRateLimitAuthRequest(request: NextRequest): boolean {
  return request.method === "POST" && request.nextUrl.pathname.endsWith("/api/auth/signin/email");
}

export async function GET(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  return handler(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  if (shouldRateLimitAuthRequest(request)) {
    const clientAddress = getClientAddress(request);
    const outcome = consumeFixedWindowRateLimit({
      key: `auth-signin-email:${clientAddress}`,
      limit: AUTH_SIGNIN_EMAIL_LIMIT,
      windowMs: AUTH_SIGNIN_EMAIL_WINDOW_MS,
    });

    if (!outcome.allowed) {
      return Response.json(
        {
          error: "Sign-in request limit reached. Please wait and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(outcome.retryAfterSeconds),
          },
        },
      );
    }
  }

  return handler(request, context);
}
