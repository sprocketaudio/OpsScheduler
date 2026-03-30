import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";

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
  })
  .strict();

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
} | null> {
  const currentUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      active: true,
      organizationId: true,
    },
  });

  if (!currentUser?.active) {
    return null;
  }

  return {
    id: currentUser.id,
    organizationId: currentUser.organizationId,
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
      },
      assignableUsers,
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
