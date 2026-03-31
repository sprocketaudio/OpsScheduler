import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  return {
    getServerAuthSession: vi.fn(),
    consumeFixedWindowRateLimit: vi.fn(),
    guardMutationOrigin: vi.fn(),
    prisma: {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      organization: {
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    },
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
  prisma: mocks.prisma,
}));

import { PATCH } from "@/app/api/admin/colour-settings/route";

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

describe("PATCH /api/admin/colour-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardMutationOrigin.mockReturnValue(null);
    mocks.consumeFixedWindowRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: "actor-1" },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "actor-1",
      active: true,
      role: "user",
      organizationId: "org-1",
    });
  });

  it("denies non-admin user updates", async () => {
    const request = asNextRequest(
      new Request("http://localhost:3000/api/admin/colour-settings", {
        method: "PATCH",
      }),
    );

    const response = await PATCH(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(payload.error).toContain("Only admins");
  });
});
