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

function normalizeMetadata(metadata?: Record<string, AuditMetadataValue | undefined>): Record<string, AuditMetadataValue> {
  if (!metadata) {
    return {};
  }

  const normalized: Record<string, AuditMetadataValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function logAuditEvent(entry: AuditLogEntry): void {
  const payload = {
    timestamp: new Date().toISOString(),
    action: entry.action,
    outcome: entry.outcome,
    actorUserId: entry.actorUserId ?? null,
    organizationId: entry.organizationId ?? null,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: normalizeMetadata(entry.metadata),
  };

  try {
    console.info(`[audit] ${JSON.stringify(payload)}`);
  } catch {
    console.info(
      `[audit] {"timestamp":"${new Date().toISOString()}","action":"${entry.action}","outcome":"${entry.outcome}"}`,
    );
  }
}
