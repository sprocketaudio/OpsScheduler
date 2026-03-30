import { NextRequest } from "next/server";
import { z } from "zod";
import { parseWeekParamToMondayUtc } from "@/features/scheduler/week";
import { getServerAuthSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { consumeFixedWindowRateLimit } from "@/server/security/rate-limit";

const ITEM_UPDATE_RATE_LIMIT_REQUESTS = 60;
const ITEM_UPDATE_RATE_LIMIT_WINDOW_MS = 60_000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_PATTERN = /^\d{2}:\d{2}:\d{2}$/;

const isoDateSchema = z.string().regex(ISO_DATE_PATTERN, "Expected date format YYYY-MM-DD");
const isoTimeSchema = z.string().regex(ISO_TIME_PATTERN, "Expected time format HH:MM:SS");

const placementUpdateSchema = z
  .object({
    placement: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("bucket"),
        targetWeek: isoDateSchema.optional(),
      }),
      z.object({
        kind: z.literal("calendar"),
        startDate: isoDateSchema,
        startTime: isoTimeSchema.optional(),
        endDate: isoDateSchema.optional(),
        endTime: isoTimeSchema.optional(),
        targetWeek: isoDateSchema.optional(),
      }),
    ]),
  })
  .strict();

type PlacementUpdate = z.infer<typeof placementUpdateSchema>;

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

function parseIsoDateToUtcDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseIsoTimeToUtcDate(value: string): Date | null {
  if (!ISO_TIME_PATTERN.test(value)) {
    return null;
  }

  const [hoursPart, minutesPart, secondsPart] = value.split(":");
  const hours = Number.parseInt(hoursPart ?? "", 10);
  const minutes = Number.parseInt(minutesPart ?? "", 10);
  const seconds = Number.parseInt(secondsPart ?? "", 10);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
}

function resolveBucketPlacement(value: Extract<PlacementUpdate["placement"], { kind: "bucket" }>): {
  endDate: null;
  endTime: null;
  startDate: null;
  startTime: null;
  targetWeek: Date | null;
} {
  const targetWeek = value.targetWeek ? parseWeekParamToMondayUtc(value.targetWeek) : null;
  if (value.targetWeek && !targetWeek) {
    throw new Error("placement.targetWeek must be a valid ISO date");
  }

  return {
    startDate: null,
    endDate: null,
    startTime: null,
    endTime: null,
    targetWeek,
  };
}

function resolveCalendarPlacement(value: Extract<PlacementUpdate["placement"], { kind: "calendar" }>): {
  endDate: Date | null;
  endTime: Date | null;
  startDate: Date;
  startTime: Date | null;
  targetWeek: Date | null;
} {
  const startDate = parseIsoDateToUtcDate(value.startDate);
  if (!startDate) {
    throw new Error("placement.startDate must be a valid ISO date");
  }

  const startTime = value.startTime ? parseIsoTimeToUtcDate(value.startTime) : null;
  if (value.startTime && !startTime) {
    throw new Error("placement.startTime must be a valid ISO time");
  }

  const endDate = value.endDate ? parseIsoDateToUtcDate(value.endDate) : null;
  if (value.endDate && !endDate) {
    throw new Error("placement.endDate must be a valid ISO date");
  }

  const endTime = value.endTime ? parseIsoTimeToUtcDate(value.endTime) : null;
  if (value.endTime && !endTime) {
    throw new Error("placement.endTime must be a valid ISO time");
  }

  if (startTime && !endTime && endDate) {
    throw new Error("placement.endDate cannot be set without placement.endTime for timed items");
  }

  if (!startTime && endTime) {
    throw new Error("placement.endTime cannot be set without placement.startTime");
  }

  if (!startTime && endDate && endDate < startDate) {
    throw new Error("placement.endDate cannot be earlier than placement.startDate");
  }

  const targetWeek = value.targetWeek ? parseWeekParamToMondayUtc(value.targetWeek) : null;
  if (value.targetWeek && !targetWeek) {
    throw new Error("placement.targetWeek must be a valid ISO date");
  }

  return {
    startDate,
    startTime,
    endDate,
    endTime,
    targetWeek,
  };
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return Response.json(
      {
        error: "Authentication is required.",
      },
      {
        status: 401,
      },
    );
  }

  const clientAddress = getClientAddress(request);
  const rateLimitOutcome = consumeFixedWindowRateLimit({
    key: `item-update:${session.user.id}:${clientAddress}`,
    limit: ITEM_UPDATE_RATE_LIMIT_REQUESTS,
    windowMs: ITEM_UPDATE_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitOutcome.allowed) {
    return Response.json(
      {
        error: "Item update limit reached. Please wait and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitOutcome.retryAfterSeconds),
        },
      },
    );
  }

  const { id } = await context.params;
  if (!id || id.trim().length === 0) {
    return Response.json(
      {
        error: "Item id is required.",
      },
      {
        status: 400,
      },
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return Response.json(
      {
        error: "Request body must be valid JSON.",
      },
      {
        status: 400,
      },
    );
  }

  const parsedRequest = placementUpdateSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    return Response.json(
      {
        error: "Invalid request body.",
        details: parsedRequest.error.flatten(),
      },
      {
        status: 400,
      },
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      organizationId: true,
      active: true,
    },
  });

  if (!currentUser?.active) {
    return Response.json(
      {
        error: "Authenticated user is not active.",
      },
      {
        status: 403,
      },
    );
  }

  const existingItem = await prisma.workItem.findFirst({
    where: {
      id,
      organizationId: currentUser.organizationId,
    },
    select: {
      id: true,
      targetWeek: true,
    },
  });

  if (!existingItem) {
    return Response.json(
      {
        error: "Item not found.",
      },
      {
        status: 404,
      },
    );
  }

  const placement = parsedRequest.data.placement;

  try {
    if (placement.kind === "bucket") {
      const resolved = resolveBucketPlacement(placement);

      await prisma.workItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          startDate: resolved.startDate,
          endDate: resolved.endDate,
          startTime: resolved.startTime,
          endTime: resolved.endTime,
          targetWeek: resolved.targetWeek ?? existingItem.targetWeek,
          updatedById: currentUser.id,
        },
      });

      return Response.json(
        {
          item: {
            id: existingItem.id,
          },
        },
        {
          status: 200,
        },
      );
    }

    const resolved = resolveCalendarPlacement(placement);

    await prisma.workItem.update({
      where: {
        id: existingItem.id,
      },
      data: {
        startDate: resolved.startDate,
        startTime: resolved.startTime,
        endDate: resolved.endDate,
        endTime: resolved.endTime,
        targetWeek: resolved.targetWeek ?? existingItem.targetWeek,
        updatedById: currentUser.id,
      },
    });

    return Response.json(
      {
        item: {
          id: existingItem.id,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to update item placement.",
      },
      {
        status: 400,
      },
    );
  }
}
