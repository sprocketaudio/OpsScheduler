import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

type AuditOutcome = "success" | "denied" | "error";

type AuditMetadataValue = boolean | number | string | null;

type AuditLogEntry = {
  action: string;
  actorUserId?: string;
  metadata?: Record<string, AuditMetadataValue | undefined>;
  organizationId?: string;
  outcome: AuditOutcome;
  targetId?: string;
  targetType?: string;
};

const RETENTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 180;
let lastRetentionSweepAtMs = 0;

function getPositiveIntegerFromEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

const auditRetentionDays = getPositiveIntegerFromEnv("AUDIT_LOG_RETENTION_DAYS", DEFAULT_RETENTION_DAYS);

function shouldMirrorAuditToConsole(): boolean {
  const configured = process.env.AUDIT_LOG_MIRROR_CONSOLE;
  if (configured === "true") {
    return true;
  }
  if (configured === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

function normalizeMetadata(metadata?: Record<string, AuditMetadataValue | undefined>): Record<string, AuditMetadataValue> {
  if (!metadata) {
    return {};
  }

  const normalized: Record<string, AuditMetadataValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) {
      continue;
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      continue;
    }

    normalized[key] = typeof value === "string" ? value.slice(0, 512) : value;
  }

  return normalized;
}

async function cleanupExpiredAuditEvents(nowMs: number): Promise<void> {
  if (nowMs - lastRetentionSweepAtMs < RETENTION_SWEEP_INTERVAL_MS) {
    return;
  }

  lastRetentionSweepAtMs = nowMs;
  const cutoff = new Date(nowMs - auditRetentionDays * 24 * 60 * 60 * 1000);
  await prisma.auditEvent.deleteMany({
    where: {
      occurredAt: {
        lt: cutoff,
      },
    },
  });
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const nowMs = Date.now();
  const occurredAt = new Date(nowMs);
  const metadata = normalizeMetadata(entry.metadata);

  const payload = {
    timestamp: occurredAt.toISOString(),
    action: entry.action,
    outcome: entry.outcome,
    actorUserId: entry.actorUserId ?? null,
    organizationId: entry.organizationId ?? null,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata,
  };

  try {
    await prisma.auditEvent.create({
      data: {
        occurredAt,
        action: entry.action,
        outcome: entry.outcome,
        actorUserId: entry.actorUserId ?? null,
        organizationId: entry.organizationId ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });

    await cleanupExpiredAuditEvents(nowMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error(`[audit] failed_to_persist ${message}`);
  }

  if (shouldMirrorAuditToConsole()) {
    try {
      console.info(`[audit] ${JSON.stringify(payload)}`);
    } catch {
      console.info(
        `[audit] {"timestamp":"${occurredAt.toISOString()}","action":"${entry.action}","outcome":"${entry.outcome}"}`,
      );
    }
  }
}
