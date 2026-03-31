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
        findFirst: vi.fn(),
      },
      workItem: {
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
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

import { DELETE, PATCH } from "@/app/api/items/[id]/route";

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

describe("PATCH /api/items/[id]", () => {
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
      role: "user",
    });
  });

  it("enforces organization scope by returning 404 for missing in-org item", async () => {
    mocks.prisma.workItem.findFirst.mockResolvedValueOnce(null);

    const request = asNextRequest(
      new Request("http://localhost:3000/api/items/item-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Updated title",
        }),
      }),
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "item-1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.prisma.workItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "item-1",
          organizationId: "org-1",
        }),
      }),
    );
  });

  it("rejects invalid schedule payloads", async () => {
    mocks.prisma.workItem.findFirst.mockResolvedValueOnce({
      id: "item-1",
      targetWeek: new Date("2026-03-30T00:00:00.000Z"),
      startDate: null,
      endDate: null,
      startTime: null,
      endTime: null,
    });

    const request = asNextRequest(
      new Request("http://localhost:3000/api/items/item-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Updated title",
          endTime: "10:30:00",
        }),
      }),
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "item-1" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("startDate");
    expect(mocks.prisma.workItem.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/items/[id]", () => {
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
      role: "user",
    });
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("denies delete for non-admin users", async () => {
    const request = asNextRequest(
      new Request("http://localhost:3000/api/items/item-1", {
        method: "DELETE",
      }),
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "item-1" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "item.delete",
        outcome: "denied",
      }),
    );
  });
});
