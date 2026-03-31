import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { isReservedStatusColour, normalizeColourToken } from "@/features/settings/colour-options";
import { getServerAuthSession } from "@/server/auth/session";
import { logAuditEvent } from "@/server/audit/log";
import { prisma } from "@/server/db/client";

const colourSettingSchema = z.object({
  userId: z.string().trim().min(1),
  colour: z.string().trim().min(1).max(64),
});

const updateAdminColourSettingsSchema = z
  .object({
    defaultColour: z.string().trim().min(1).max(64),
    userColours: z.array(colourSettingSchema),
  })
  .strict();

function hasDuplicateColourValues(values: string[]): boolean {
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeColourToken(value);
    if (seen.has(normalized)) {
      return true;
    }
    seen.add(normalized);
  }

  return false;
}

export async function PATCH(request: NextRequest) {
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

  const currentUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      active: true,
      role: true,
      organizationId: true,
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

  if (currentUser.role !== UserRole.admin) {
    return Response.json(
      {
        error: "Only admins can update colour settings.",
      },
      {
        status: 403,
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

  const parsedRequest = updateAdminColourSettingsSchema.safeParse(requestBody);
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

  const requestedDefaultColour = parsedRequest.data.defaultColour.trim();
  if (isReservedStatusColour(requestedDefaultColour)) {
    return Response.json(
      {
        error: "Default colour cannot use reserved status colours.",
      },
      {
        status: 400,
      },
    );
  }

  const requestedUserColours = parsedRequest.data.userColours.map((entry) => ({
    userId: entry.userId,
    colour: entry.colour.trim(),
  }));

  if (requestedUserColours.length === 0) {
    return Response.json(
      {
        error: "At least one user colour setting is required.",
      },
      {
        status: 400,
      },
    );
  }

  const requestedUserIds = requestedUserColours.map((entry) => entry.userId);
  const uniqueRequestedUserIds = new Set(requestedUserIds);
  if (requestedUserIds.length !== uniqueRequestedUserIds.size) {
    return Response.json(
      {
        error: "userColours contains duplicate user ids.",
      },
      {
        status: 400,
      },
    );
  }

  if (hasDuplicateColourValues(requestedUserColours.map((entry) => entry.colour))) {
    return Response.json(
      {
        error: "Each user must have a unique colour.",
      },
      {
        status: 400,
      },
    );
  }

  const normalizedDefaultColour = normalizeColourToken(requestedDefaultColour);
  if (
    requestedUserColours.some(
      (entry) => normalizeColourToken(entry.colour) === normalizedDefaultColour,
    )
  ) {
    return Response.json(
      {
        error: "Default colour must be different from all user colours.",
      },
      {
        status: 400,
      },
    );
  }

  for (const entry of requestedUserColours) {
    if (isReservedStatusColour(entry.colour)) {
      return Response.json(
        {
          error: `Colour '${entry.colour}' is reserved for status outlines and cannot be assigned.`,
        },
        {
          status: 400,
        },
      );
    }
  }

  const organizationUsers = await prisma.user.findMany({
    where: {
      organizationId: currentUser.organizationId,
      active: true,
    },
    select: {
      id: true,
    },
  });
  const organizationUserIdSet = new Set(organizationUsers.map((user) => user.id));

  for (const userId of uniqueRequestedUserIds) {
    if (!organizationUserIdSet.has(userId)) {
      return Response.json(
        {
          error: "All user colours must reference active users in your organization.",
        },
        {
          status: 400,
        },
      );
    }
  }

  const coloursRequested = requestedUserColours.map((entry) => entry.colour);
  const externalConflicts = await prisma.user.findMany({
    where: {
      colour: {
        in: coloursRequested,
      },
      id: {
        notIn: requestedUserColours.map((entry) => entry.userId),
      },
    },
    select: {
      id: true,
      colour: true,
    },
  });

  if (externalConflicts.length > 0) {
    return Response.json(
      {
        error: "One or more selected colours are already in use by another user.",
      },
      {
        status: 400,
      },
    );
  }

  const temporarySuffix = Date.now().toString(36);

  await prisma.$transaction(async (transaction) => {
    for (let index = 0; index < requestedUserColours.length; index += 1) {
      const entry = requestedUserColours[index];
      await transaction.user.update({
        where: {
          id: entry.userId,
        },
        data: {
          colour: `temp-${temporarySuffix}-${index}`,
        },
      });
    }

    for (const entry of requestedUserColours) {
      await transaction.user.update({
        where: {
          id: entry.userId,
        },
        data: {
          colour: entry.colour,
        },
      });
    }

    await transaction.organization.update({
      where: {
        id: currentUser.organizationId,
      },
      data: {
        defaultColour: requestedDefaultColour,
      },
    });
  });

  logAuditEvent({
    action: "admin.update_colour_settings",
    outcome: "success",
    actorUserId: currentUser.id,
    organizationId: currentUser.organizationId,
    targetType: "organization",
    targetId: currentUser.organizationId,
    metadata: {
      updatedUsers: requestedUserColours.length,
      defaultColour: requestedDefaultColour,
    },
  });

  return Response.json(
    {
      success: true,
    },
    {
      status: 200,
    },
  );
}
