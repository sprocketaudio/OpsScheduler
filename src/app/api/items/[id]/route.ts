import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { parseWeekParamToMondayUtc, startOfWeekMondayUtc } from "@/features/scheduler/week";
import { getServerAuthSession } from "@/server/auth/session";
import { logAuditEvent } from "@/server/audit/log";
import { prisma } from "@/server/db/client";
import { guardMutationOrigin } from "@/server/security/origin";
import { consumeFixedWindowRateLimit } from "@/server/security/rate-limit";

const ITEM_DETAIL_UPDATE_RATE_LIMIT_REQUESTS = 60;
const ITEM_DETAIL_UPDATE_RATE_LIMIT_WINDOW_MS = 60_000;
const ITEM_DELETE_RATE_LIMIT_REQUESTS = 20;
const ITEM_DELETE_RATE_LIMIT_WINDOW_MS = 60_000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_PATTERN = /^\d{2}:\d{2}:\d{2}$/;

const isoDateSchema = z.string().regex(ISO_DATE_PATTERN, "Expected date format YYYY-MM-DD");
const isoTimeSchema = z.string().regex(ISO_TIME_PATTERN, "Expected time format HH:MM:SS");

const updateItemRequestSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
    customer: z.string().trim().max(200, "Customer must be 200 characters or fewer").nullable().optional(),
    notes: z.string().trim().max(4000, "Notes must be 4000 characters or fewer").nullable().optional(),
    assigneeId: z.string().trim().min(1, "assigneeId cannot be empty").nullable().optional(),
    fixed: z.boolean().optional(),
    onHold: z.boolean().optional(),
    cancelled: z.boolean().optional(),
    done: z.boolean().optional(),
    startDate: isoDateSchema.nullable().optional(),
    startTime: isoTimeSchema.nullable().optional(),
    endDate: isoDateSchema.nullable().optional(),
    endTime: isoTimeSchema.nullable().optional(),
    targetWeek: isoDateSchema.optional(),
  })
  .strict();

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

function resolveScheduleUpdate(params: {
  existingItem: {
    endDate: Date | null;
    endTime: Date | null;
    startDate: Date | null;
    startTime: Date | null;
    targetWeek: Date;
  };
  requestData: Pick<
    z.infer<typeof updateItemRequestSchema>,
    "endDate" | "endTime" | "startDate" | "startTime" | "targetWeek"
  >;
}): {
  endDate: Date | null;
  endTime: Date | null;
  startDate: Date | null;
  startTime: Date | null;
  targetWeek: Date;
} {
  const { existingItem, requestData } = params;
  const hasScheduleUpdate =
    requestData.startDate !== undefined ||
    requestData.startTime !== undefined ||
    requestData.endDate !== undefined ||
    requestData.endTime !== undefined ||
    requestData.targetWeek !== undefined;

  if (!hasScheduleUpdate) {
    return {
      startDate: existingItem.startDate,
      startTime: existingItem.startTime,
      endDate: existingItem.endDate,
      endTime: existingItem.endTime,
      targetWeek: existingItem.targetWeek,
    };
  }

  const startDate =
    requestData.startDate === undefined
      ? existingItem.startDate
      : requestData.startDate
        ? parseIsoDateToUtcDate(requestData.startDate)
        : null;

  if (requestData.startDate !== undefined && requestData.startDate && !startDate) {
    throw new Error("startDate must be a valid ISO date");
  }

  const startTime =
    requestData.startTime === undefined
      ? existingItem.startTime
      : requestData.startTime
        ? parseIsoTimeToUtcDate(requestData.startTime)
        : null;

  if (requestData.startTime !== undefined && requestData.startTime && !startTime) {
    throw new Error("startTime must be a valid ISO time");
  }

  const endDate =
    requestData.endDate === undefined
      ? existingItem.endDate
      : requestData.endDate
        ? parseIsoDateToUtcDate(requestData.endDate)
        : null;

  if (requestData.endDate !== undefined && requestData.endDate && !endDate) {
    throw new Error("endDate must be a valid ISO date");
  }

  const endTime =
    requestData.endTime === undefined
      ? existingItem.endTime
      : requestData.endTime
        ? parseIsoTimeToUtcDate(requestData.endTime)
        : null;

  if (requestData.endTime !== undefined && requestData.endTime && !endTime) {
    throw new Error("endTime must be a valid ISO time");
  }

  if (!startDate) {
    if (startTime || endDate || endTime) {
      throw new Error("startDate is required when startTime, endDate, or endTime are set");
    }

    if (requestData.targetWeek) {
      const parsedTargetWeek = parseWeekParamToMondayUtc(requestData.targetWeek);
      if (!parsedTargetWeek) {
        throw new Error("targetWeek must be a valid ISO date");
      }

      return {
        startDate: null,
        startTime: null,
        endDate: null,
        endTime: null,
        targetWeek: parsedTargetWeek,
      };
    }

    return {
      startDate: null,
      startTime: null,
      endDate: null,
      endTime: null,
      targetWeek: existingItem.targetWeek,
    };
  }

  if (!startTime && endTime) {
    throw new Error("endTime cannot be set without startTime");
  }

  if (startTime && endDate && !endTime) {
    throw new Error("endDate cannot be set without endTime for timed items");
  }

  if (endDate && endDate < startDate) {
    throw new Error("endDate cannot be earlier than startDate");
  }

  let targetWeek: Date;
  if (requestData.targetWeek) {
    const parsedTargetWeek = parseWeekParamToMondayUtc(requestData.targetWeek);
    if (!parsedTargetWeek) {
      throw new Error("targetWeek must be a valid ISO date");
    }
    targetWeek = parsedTargetWeek;
  } else {
    targetWeek = startOfWeekMondayUtc(startDate);
  }

  return {
    startDate,
    startTime,
    endDate,
    endTime,
    targetWeek,
  };
}

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

function formatIsoDateUtc(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoTimeUtc(value: Date): string {
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  const seconds = String(value.getUTCSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

async function getCurrentUserContext(userId: string): Promise<{
  id: string;
  organizationId: string;
  role: UserRole;
} | null> {
  const currentUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      active: true,
      organizationId: true,
      role: true,
    },
  });

  if (!currentUser?.active) {
    return null;
  }

  return {
    id: currentUser.id,
    organizationId: currentUser.organizationId,
    role: currentUser.role,
  };
}

export async function GET(
  _request: NextRequest,
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

  const currentUser = await getCurrentUserContext(session.user.id);
  if (!currentUser) {
    return Response.json(
      {
        error: "Authenticated user is not active.",
      },
      {
        status: 403,
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

  const item = await prisma.workItem.findFirst({
    where: {
      id,
      organizationId: currentUser.organizationId,
    },
    select: {
      id: true,
      title: true,
      customer: true,
      notes: true,
      targetWeek: true,
      startDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      assigneeId: true,
      fixed: true,
      onHold: true,
      cancelled: true,
      done: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!item) {
    return Response.json(
      {
        error: "Item not found.",
      },
      {
        status: 404,
      },
    );
  }

  const assignableUsers = await prisma.user.findMany({
    where: {
      organizationId: currentUser.organizationId,
      active: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      colour: true,
    },
  });

  return Response.json(
    {
      item: {
        id: item.id,
        title: item.title,
        customer: item.customer,
        notes: item.notes,
        targetWeek: formatIsoDateUtc(item.targetWeek),
        startDate: item.startDate ? formatIsoDateUtc(item.startDate) : null,
        endDate: item.endDate ? formatIsoDateUtc(item.endDate) : null,
        startTime: item.startTime ? formatIsoTimeUtc(item.startTime) : null,
        endTime: item.endTime ? formatIsoTimeUtc(item.endTime) : null,
        assigneeId: item.assigneeId,
        fixed: item.fixed,
        onHold: item.onHold,
        cancelled: item.cancelled,
        done: item.done,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        createdBy: {
          name: item.createdBy.name,
          email: item.createdBy.email,
        },
        updatedBy: {
          name: item.updatedBy.name,
          email: item.updatedBy.email,
        },
      },
      assignableUsers,
      permissions: {
        canDelete: currentUser.role === UserRole.admin,
      },
    },
    {
      status: 200,
    },
  );
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const originGuardResponse = guardMutationOrigin(request);
  if (originGuardResponse) {
    return originGuardResponse;
  }

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
  const rateLimitOutcome = await consumeFixedWindowRateLimit({
    key: `item-detail-update:${session.user.id}:${clientAddress}`,
    limit: ITEM_DETAIL_UPDATE_RATE_LIMIT_REQUESTS,
    windowMs: ITEM_DETAIL_UPDATE_RATE_LIMIT_WINDOW_MS,
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

  const currentUser = await getCurrentUserContext(session.user.id);
  if (!currentUser) {
    return Response.json(
      {
        error: "Authenticated user is not active.",
      },
      {
        status: 403,
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

  const parsedRequest = updateItemRequestSchema.safeParse(requestBody);
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

  const existingItem = await prisma.workItem.findFirst({
    where: {
      id,
      organizationId: currentUser.organizationId,
    },
    select: {
      id: true,
      targetWeek: true,
      startDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
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

  const title = parsedRequest.data.title.trim();
  const customer = parsedRequest.data.customer?.trim() ?? "";
  const notes = parsedRequest.data.notes?.trim() ?? "";
  let assigneeId = parsedRequest.data.assigneeId ?? undefined;

  if (typeof assigneeId === "string") {
    assigneeId = assigneeId.trim();
  }

  if (assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assigneeId,
        organizationId: currentUser.organizationId,
        active: true,
      },
      select: {
        id: true,
      },
    });

    if (!assignee) {
      return Response.json(
        {
          error: "assigneeId must reference an active user in your organization.",
        },
        {
          status: 400,
        },
      );
    }
  }

  const fixed = parsedRequest.data.fixed ?? undefined;
  const onHold = parsedRequest.data.onHold ?? undefined;
  const cancelled = parsedRequest.data.cancelled ?? undefined;
  const done = parsedRequest.data.done ?? undefined;
  let resolvedSchedule: ReturnType<typeof resolveScheduleUpdate>;
  try {
    resolvedSchedule = resolveScheduleUpdate({
      existingItem: {
        targetWeek: existingItem.targetWeek,
        startDate: existingItem.startDate,
        endDate: existingItem.endDate,
        startTime: existingItem.startTime,
        endTime: existingItem.endTime,
      },
      requestData: {
        startDate: parsedRequest.data.startDate,
        startTime: parsedRequest.data.startTime,
        endDate: parsedRequest.data.endDate,
        endTime: parsedRequest.data.endTime,
        targetWeek: parsedRequest.data.targetWeek,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid schedule values.",
      },
      {
        status: 400,
      },
    );
  }

  const updatedItem = await prisma.workItem.update({
    where: {
      id: existingItem.id,
    },
    data: {
      title,
      customer: customer.length > 0 ? customer : null,
      notes: notes.length > 0 ? notes : null,
      assigneeId:
        parsedRequest.data.assigneeId === undefined
          ? undefined
          : assigneeId ?? null,
      fixed,
      onHold,
      cancelled,
      done,
      targetWeek: resolvedSchedule.targetWeek,
      startDate: resolvedSchedule.startDate,
      startTime: resolvedSchedule.startTime,
      endDate: resolvedSchedule.endDate,
      endTime: resolvedSchedule.endTime,
      updatedById: currentUser.id,
    },
    select: {
      id: true,
      title: true,
      customer: true,
      notes: true,
      targetWeek: true,
      startDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      assigneeId: true,
      fixed: true,
      onHold: true,
      cancelled: true,
      done: true,
    },
  });

  await logAuditEvent({
    action: "item.update",
    outcome: "success",
    actorUserId: currentUser.id,
    organizationId: currentUser.organizationId,
    targetType: "work_item",
    targetId: updatedItem.id,
  });

  return Response.json(
    {
      item: {
        id: updatedItem.id,
        title: updatedItem.title,
        customer: updatedItem.customer,
        notes: updatedItem.notes,
        targetWeek: formatIsoDateUtc(updatedItem.targetWeek),
        startDate: updatedItem.startDate ? formatIsoDateUtc(updatedItem.startDate) : null,
        endDate: updatedItem.endDate ? formatIsoDateUtc(updatedItem.endDate) : null,
        startTime: updatedItem.startTime ? formatIsoTimeUtc(updatedItem.startTime) : null,
        endTime: updatedItem.endTime ? formatIsoTimeUtc(updatedItem.endTime) : null,
        assigneeId: updatedItem.assigneeId,
        fixed: updatedItem.fixed,
        onHold: updatedItem.onHold,
        cancelled: updatedItem.cancelled,
        done: updatedItem.done,
      },
    },
    {
      status: 200,
    },
  );
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const originGuardResponse = guardMutationOrigin(request);
  if (originGuardResponse) {
    return originGuardResponse;
  }

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
  const rateLimitOutcome = await consumeFixedWindowRateLimit({
    key: `item-delete:${session.user.id}:${clientAddress}`,
    limit: ITEM_DELETE_RATE_LIMIT_REQUESTS,
    windowMs: ITEM_DELETE_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitOutcome.allowed) {
    return Response.json(
      {
        error: "Item deletion limit reached. Please wait and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitOutcome.retryAfterSeconds),
        },
      },
    );
  }

  const currentUser = await getCurrentUserContext(session.user.id);
  if (!currentUser) {
    return Response.json(
      {
        error: "Authenticated user is not active.",
      },
      {
        status: 403,
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

  if (currentUser.role !== UserRole.admin) {
    await logAuditEvent({
      action: "item.delete",
      outcome: "denied",
      actorUserId: currentUser.id,
      organizationId: currentUser.organizationId,
      targetType: "work_item",
      targetId: id,
      metadata: {
        reason: "requires_admin_role",
      },
    });

    return Response.json(
      {
        error: "Only admins can delete items.",
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

  await prisma.workItem.delete({
    where: {
      id: existingItem.id,
    },
  });

  await logAuditEvent({
    action: "item.delete",
    outcome: "success",
    actorUserId: currentUser.id,
    organizationId: currentUser.organizationId,
    targetType: "work_item",
    targetId: existingItem.id,
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
