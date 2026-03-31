import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  return {
    getServerAuthSession: vi.fn(),
    consumeFixedWindowRateLimit: vi.fn(),
    guardMutationOrigin: vi.fn(),
  };
});

vi.mock("@/server/auth/session", () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock("@/server/security/rate-limit", () => ({
  consumeFixedWindowRateLimit: mocks.consumeFixedWindowRateLimit,
}));

vi.mock("@/server/security/origin", () => ({
  guardMutationOrigin: mocks.guardMutationOrigin,
}));

vi.mock("@/server/audit/log", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    workItem: {
      create: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/items/route";

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

describe("POST /api/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardMutationOrigin.mockReturnValue(null);
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: "actor-1" },
    });
    mocks.consumeFixedWindowRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("rejects invalid create payloads", async () => {
    const request = asNextRequest(
      new Request("http://localhost:3000/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid request body");
  });
});
