import { prisma } from "@/server/db/client";

let lastCleanupAtMs = 0;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

async function cleanupExpiredBuckets(now: Date, nowMs: number): Promise<void> {
  if (nowMs - lastCleanupAtMs < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAtMs = nowMs;
  await prisma.$executeRaw`
    DELETE FROM "RateLimitBucket"
    WHERE "expires_at" < ${now}
  `;
}

export async function consumeFixedWindowRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { key, limit, windowMs } = params;
  const nowMs = Date.now();
  const windowStartedAtMs = nowMs - (nowMs % windowMs);
  const windowEndsAtMs = windowStartedAtMs + windowMs;
  const windowStartedAt = new Date(windowStartedAtMs);
  const windowEndsAt = new Date(windowEndsAtMs);
  const now = new Date(nowMs);

  await cleanupExpiredBuckets(now, nowMs);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" (
      "key",
      "window_start",
      "count",
      "expires_at",
      "created_at",
      "updated_at"
    )
    VALUES (
      ${key},
      ${windowStartedAt},
      1,
      ${windowEndsAt},
      ${now},
      ${now}
    )
    ON CONFLICT ("key", "window_start")
    DO UPDATE SET
      "count" = "RateLimitBucket"."count" + 1,
      "updated_at" = EXCLUDED."updated_at"
    RETURNING "count"
  `;

  const count = Number(rows[0]?.count ?? 0);
  if (count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((windowEndsAtMs - nowMs) / 1000)),
  };
}
