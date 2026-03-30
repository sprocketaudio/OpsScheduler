import { NextRequest } from "next/server";
import { z } from "zod";
import {
  addDaysUtc,
  formatIsoDateUtc,
  parseWeekParamToMondayUtc,
  startOfWeekMondayUtc,
} from "@/features/scheduler/week";
import { getServerAuthSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { consumeFixedWindowRateLimit } from "@/server/security/rate-limit";

const ITEM_CREATE_RATE_LIMIT_REQUESTS = 30;
const ITEM_CREATE_RATE_LIMIT_WINDOW_MS = 60_000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_PATTERN = /^\d{2}:\d{2}:\d{2}$/;

const isoDateSchema = z.string().regex(ISO_DATE_PATTERN, "Expected date format YYYY-MM-DD");
const isoTimeSchema = z.string().regex(ISO_TIME_PATTERN, "Expected time format HH:MM:SS");

const createItemRequestSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
    customer: z.string().trim().max(200, "Customer must be 200 characters or fewer").optional(),
    notes: z.string().trim().max(4000, "Notes must be 4000 characters or fewer").optional(),
    placement: z
      .discriminatedUnion("kind", [
        z.object({
          kind: z.literal("bucket"),
          targetWeek: isoDateSchema,
        }),
        z.object({
          kind: z.literal("calendar"),
          startDate: isoDateSchema,
          startTime: isoTimeSchema.optional(),
          targetWeek: isoDateSchema.optional(),
        }),
      ])
      .optional(),
  })
  .strict();

type CreateItemRequest = z.infer<typeof createItemRequestSchema>;

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

function resolvePlacement(value: CreateItemRequest["placement"]): {
  endDate: null;
  endTime: null;
  startDate: Date | null;
  startTime: Date | null;
  targetWeek: Date;
} {
  if (!value) {
    const nextWeekStart = addDaysUtc(startOfWeekMondayUtc(new Date()), 7);
    return {
      targetWeek: nextWeekStart,
      startDate: null,
      endDate: null,
      startTime: null,
      endTime: null,
    };
  }

  if (value.kind === "bucket") {
    const targetWeek = parseWeekParamToMondayUtc(value.targetWeek);
    if (!targetWeek) {
      throw new Error("placement.targetWeek must be a valid ISO date");
    }

    return {
      targetWeek,
      startDate: null,
      endDate: null,
      startTime: null,
      endTime: null,
    };
  }

  const startDate = parseIsoDateToUtcDate(value.startDate);
  if (!startDate) {
    throw new Error("placement.startDate must be a valid ISO date");
  }

  const startTime = value.startTime ? parseIsoTimeToUtcDate(value.startTime) : null;
  if (value.startTime && !startTime) {
    throw new Error("placement.startTime must be a valid ISO time");
  }

  const targetWeek = value.targetWeek
    ? parseWeekParamToMondayUtc(value.targetWeek)
    : startOfWeekMondayUtc(startDate);

  if (!targetWeek) {
    throw new Error("placement.targetWeek must be a valid ISO date");
  }

  return {
    targetWeek,
    startDate,
    endDate: null,
    startTime,
    endTime: null,
  };
}

function formatIsoTimeUtc(value: Date): string {
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  const seconds = String(value.getUTCSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export async function POST(request: NextRequest) {
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
    key: `item-create:${session.user.id}:${clientAddress}`,
    limit: ITEM_CREATE_RATE_LIMIT_REQUESTS,
    windowMs: ITEM_CREATE_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitOutcome.allowed) {
    return Response.json(
      {
        error: "Item creation limit reached. Please wait and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitOutcome.retryAfterSeconds),
        },
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

  const parsedRequest = createItemRequestSchema.safeParse(requestBody);
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

  let placement: ReturnType<typeof resolvePlacement>;
  try {
    placement = resolvePlacement(parsedRequest.data.placement);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid placement values.",
      },
      {
        status: 400,
      },
    );
  }

  const createdItem = await prisma.workItem.create({
    data: {
      title: parsedRequest.data.title,
      customer: parsedRequest.data.customer?.trim() || null,
      notes: parsedRequest.data.notes?.trim() || null,
      assigneeId: null,
      organizationId: currentUser.organizationId,
      targetWeek: placement.targetWeek,
      startDate: placement.startDate,
      endDate: placement.endDate,
      startTime: placement.startTime,
      endTime: placement.endTime,
      fixed: false,
      done: false,
      createdById: currentUser.id,
      updatedById: currentUser.id,
    },
    select: {
      id: true,
      title: true,
      targetWeek: true,
      startDate: true,
      startTime: true,
    },
  });

  return Response.json(
    {
      item: {
        id: createdItem.id,
        title: createdItem.title,
        targetWeek: formatIsoDateUtc(createdItem.targetWeek),
        startDate: createdItem.startDate ? formatIsoDateUtc(createdItem.startDate) : null,
        startTime: createdItem.startTime ? formatIsoTimeUtc(createdItem.startTime) : null,
      },
    },
    {
      status: 201,
    },
  );
}
