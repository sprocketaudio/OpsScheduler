import { NextRequest } from "next/server";
import { z } from "zod";
import { normalizeIsoTime, toSeconds } from "@/features/scheduler/visible-window";
import { DATE_LOCALE_VALUES } from "@/features/settings/date-locale";
import { THEME_PREFERENCE_VALUES } from "@/features/settings/theme";
import { getServerAuthSession } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { guardMutationOrigin } from "@/server/security/origin";
import { consumeFixedWindowRateLimit } from "@/server/security/rate-limit";

const USER_PREFERENCES_RATE_LIMIT_REQUESTS = 30;
const USER_PREFERENCES_RATE_LIMIT_WINDOW_MS = 60_000;

const userPreferencesUpdateSchema = z
  .object({
    dateLocale: z.enum(DATE_LOCALE_VALUES).optional(),
    uiTheme: z.enum(THEME_PREFERENCE_VALUES).optional(),
    calendarVisibleStartTime: z.string().trim().min(1).max(8),
    calendarVisibleEndTime: z.string().trim().min(1).max(8),
  })
  .strict();

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

export async function PATCH(request: NextRequest) {
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
    key: `user-preferences:${session.user.id}:${clientAddress}`,
    limit: USER_PREFERENCES_RATE_LIMIT_REQUESTS,
    windowMs: USER_PREFERENCES_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitOutcome.allowed) {
    return Response.json(
      {
        error: "Preference update limit reached. Please wait and try again.",
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
      dateLocale: parsedRequest.data.dateLocale ?? undefined,
      uiTheme: parsedRequest.data.uiTheme ?? undefined,
      calendarVisibleStartTime: visibleStartTime,
      calendarVisibleEndTime: visibleEndTime,
    },
    select: {
      dateLocale: true,
      uiTheme: true,
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
