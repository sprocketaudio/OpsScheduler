import type { Session } from "next-auth";
import { prisma } from "@/server/db/client";

type DevBypassMode = "off" | "admin" | "user";

function parseDevBypassMode(rawValue: string | undefined): DevBypassMode {
  const normalizedValue = rawValue?.trim().toLowerCase();
  if (!normalizedValue || normalizedValue === "off") {
    return "off";
  }

  if (normalizedValue === "admin" || normalizedValue === "user") {
    return normalizedValue;
  }

  throw new Error("AUTH_DEV_BYPASS_MODE must be one of: off, admin, user");
}

function getDevBypassEmail(mode: Exclude<DevBypassMode, "off">): string | null {
  const envName =
    mode === "admin" ? "AUTH_DEV_BYPASS_ADMIN_EMAIL" : "AUTH_DEV_BYPASS_USER_EMAIL";
  const rawValue = process.env[envName]?.trim().toLowerCase();
  return rawValue && rawValue.length > 0 ? rawValue : null;
}

export async function getDevBypassSession(): Promise<Session | null> {
  const mode = parseDevBypassMode(process.env.AUTH_DEV_BYPASS_MODE);
  if (mode === "off") {
    return null;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_DEV_BYPASS_MODE cannot be enabled in production");
  }

  const emailOverride = getDevBypassEmail(mode);

  const bypassUser = await prisma.user.findFirst({
    where: emailOverride
      ? {
          email: emailOverride,
          role: mode,
          active: true,
        }
      : {
          role: mode,
          active: true,
        },
    orderBy: {
      email: "asc",
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
    },
  });

  if (!bypassUser) {
    if (emailOverride) {
      throw new Error(
        `AUTH_DEV_BYPASS_${mode.toUpperCase()}_EMAIL must reference an active ${mode} user`,
      );
    }

    throw new Error(`AUTH_DEV_BYPASS_MODE=${mode} requires at least one active ${mode} user`);
  }

  return {
    user: {
      id: bypassUser.id,
      email: bypassUser.email,
      name: bypassUser.name,
      image: bypassUser.image,
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  };
}
