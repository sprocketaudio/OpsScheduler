import { beforeEach, describe, expect, it, vi } from "vitest";
import { startOfWeekMondayUtc } from "@/features/scheduler/week";

const mocks = vi.hoisted(() => ({
  prisma: {
    workItem: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/db/client", () => ({
  prisma: mocks.prisma,
}));

import { carryForwardBucketItemsForOrganization } from "@/server/scheduler/carry-forward";

describe("carryForwardBucketItemsForOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves only unscheduled prior-week items for the requested organization", async () => {
    const referenceDate = new Date("2026-04-01T12:00:00.000Z");
    const expectedWeekStart = startOfWeekMondayUtc(referenceDate);

    mocks.prisma.workItem.updateMany.mockResolvedValue({
      count: 4,
    });

    const count = await carryForwardBucketItemsForOrganization({
      organizationId: "org-1",
      referenceDate,
    });

    expect(count).toBe(4);
    expect(mocks.prisma.workItem.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        startDate: null,
        targetWeek: {
          lt: expectedWeekStart,
        },
      },
      data: {
        targetWeek: expectedWeekStart,
      },
    });
  });
});
