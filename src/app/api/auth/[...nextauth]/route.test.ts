import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  return {
    nextAuthHandler: vi.fn(),
    guardMutationOrigin: vi.fn(),
    consumeFixedWindowRateLimit: vi.fn(),
  };
});

vi.mock("next-auth", () => ({
  default: vi.fn(() => mocks.nextAuthHandler),
}));

vi.mock("@/server/auth/options", () => ({
  authOptions: {},
}));

vi.mock("@/server/security/origin", () => ({
  guardMutationOrigin: mocks.guardMutationOrigin,
}));

vi.mock("@/server/security/rate-limit", () => ({
  consumeFixedWindowRateLimit: mocks.consumeFixedWindowRateLimit,
}));

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

function authContext(pathParts: string[]) {
  return {
    params: Promise.resolve({
      nextauth: pathParts,
    }),
  };
}

describe("Auth route hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nextAuthHandler.mockResolvedValue(new Response(null, { status: 200 }));
    mocks.guardMutationOrigin.mockReturnValue(null);
    mocks.consumeFixedWindowRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("rate-limits email callback verification requests on GET", async () => {
    mocks.consumeFixedWindowRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 30,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/auth/callback/email?email=a%40example.com&token=123456",
      {
        method: "GET",
        headers: {
          "x-forwarded-for": "203.0.113.20",
        },
      },
    );

    const response = await GET(request, authContext(["callback", "email"]));

    expect(response.status).toBe(429);
    expect(mocks.nextAuthHandler).not.toHaveBeenCalled();
    expect(mocks.consumeFixedWindowRateLimit).toHaveBeenCalledTimes(1);
  });

  it("passes callback verification to NextAuth handler when GET limiter allows", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/callback/email?email=a%40example.com&token=123456",
      {
        method: "GET",
        headers: {
          "x-forwarded-for": "203.0.113.21",
        },
      },
    );

    const response = await GET(request, authContext(["callback", "email"]));

    expect(response.status).toBe(200);
    expect(mocks.nextAuthHandler).toHaveBeenCalledTimes(1);
    expect(mocks.consumeFixedWindowRateLimit).toHaveBeenCalledTimes(1);
  });

  it("enforces origin guard on signin email POST before rate limiting", async () => {
    mocks.guardMutationOrigin.mockReturnValue(new Response(null, { status: 403 }));

    const request = new NextRequest("http://localhost:3000/api/auth/signin/email", {
      method: "POST",
    });

    const response = await POST(request, authContext(["signin", "email"]));

    expect(response.status).toBe(403);
    expect(mocks.consumeFixedWindowRateLimit).not.toHaveBeenCalled();
    expect(mocks.nextAuthHandler).not.toHaveBeenCalled();
  });

  it("rate-limits signin email POST requests", async () => {
    mocks.consumeFixedWindowRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 45,
    });

    const request = new NextRequest("http://localhost:3000/api/auth/signin/email", {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.22",
        origin: "http://localhost:3000",
      },
    });

    const response = await POST(request, authContext(["signin", "email"]));

    expect(response.status).toBe(429);
    expect(mocks.nextAuthHandler).not.toHaveBeenCalled();
  });
});
