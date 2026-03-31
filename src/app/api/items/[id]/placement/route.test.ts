import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  return {
    getServerAuthSession: vi.fn(),
    consumeFixedWindowRateLimit: vi.fn(),
    guardMutationOrigin: vi.fn(),
    logAuditEvent: vi.fn(),
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      workItem: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
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
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/server/db/client", () => ({
  prisma: mocks.prisma,
}));

import { PATCH } from "@/app/api/items/[id]/placement/route";

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

describe("PATCH /api/items/[id]/placement", () => {
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
      organizationId: "org-1",
    });
    mocks.prisma.workItem.findFirst.mockResolvedValue({
      id: "item-1",
      targetWeek: new Date("2026-03-30T00:00:00.000Z"),
    });
  });

  it("rejects invalid placement updates", async () => {
    const request = asNextRequest(
      new Request("http://localhost:3000/api/items/item-1/placement", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placement: {
            kind: "calendar",
            startDate: "2026-04-02",
            endTime: "10:30:00",
          },
        }),
      }),
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "item-1" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("placement.endTime cannot be set without placement.startTime");
    expect(mocks.prisma.workItem.update).not.toHaveBeenCalled();
  });
});
