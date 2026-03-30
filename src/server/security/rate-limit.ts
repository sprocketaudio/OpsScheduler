type FixedWindowBucket = {
  count: number;
  windowStartedAt: number;
};

const buckets = new Map<string, FixedWindowBucket>();
const MAX_BUCKETS = 10_000;

function cleanupExpiredBuckets(now: number, windowMs: number) {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt >= windowMs) {
      buckets.delete(key);
    }
  }
}

export function consumeFixedWindowRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds: number } {
  const { key, limit, windowMs } = params;
  const now = Date.now();
  cleanupExpiredBuckets(now, windowMs);

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    const retryAfterMs = windowMs - (now - bucket.windowStartedAt);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}
