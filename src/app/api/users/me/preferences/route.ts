import { NextRequest } from "next/server";
import { z } from "zod";
import { normalizeIsoTime, toSeconds } from "@/features/scheduler/visible-window";
import { getServerAuthSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";

const userPreferencesUpdateSchema = z
  .object({
    calendarVisibleStartTime: z.string().trim().min(1).max(8),
    calendarVisibleEndTime: z.string().trim().min(1).max(8),
  })
  .strict();

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

  const parsedRequest = userPreferencesUpdateSchema.safeParse(requestBody);
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

  const visibleStartTime = normalizeIsoTime(parsedRequest.data.calendarVisibleStartTime);
  if (!visibleStartTime) {
    return Response.json(
      {
        error: "calendarVisibleStartTime must be a valid time (HH:MM or HH:MM:SS).",
      },
      {
        status: 400,
      },
    );
  }

  const visibleEndTime = normalizeIsoTime(parsedRequest.data.calendarVisibleEndTime);
  if (!visibleEndTime) {
    return Response.json(
      {
        error: "calendarVisibleEndTime must be a valid time (HH:MM or HH:MM:SS).",
      },
      {
        status: 400,
      },
    );
  }

  if (toSeconds(visibleStartTime) >= toSeconds(visibleEndTime)) {
    return Response.json(
      {
        error: "calendarVisibleEndTime must be later than calendarVisibleStartTime.",
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

  const updatedUser = await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data: {
      calendarVisibleStartTime: visibleStartTime,
      calendarVisibleEndTime: visibleEndTime,
    },
    select: {
      calendarVisibleStartTime: true,
      calendarVisibleEndTime: true,
    },
  });

  return Response.json(
    {
      preferences: updatedUser,
    },
    {
      status: 200,
    },
  );
}
