import { startOfWeekMondayUtc } from "@/features/scheduler/week";
import { prisma } from "@/server/db/client";

export async function carryForwardBucketItemsForOrganization(input: {
  organizationId: string;
  referenceDate?: Date;
}): Promise<number> {
  const currentWeekStart = startOfWeekMondayUtc(input.referenceDate ?? new Date());

  const result = await prisma.workItem.updateMany({
    where: {
      organizationId: input.organizationId,
      startDate: null,
      targetWeek: {
        lt: currentWeekStart,
      },
    },
    data: {
      targetWeek: currentWeekStart,
    },
  });

  return result.count;
}
