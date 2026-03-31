import { createHash } from "node:crypto";

type ExistingUser = {
  active: boolean;
  id: string;
} | null;

type AuditMetadataValue = boolean | number | string | null;

type SignInAuditEvent = {
  action: "auth.sign_in";
  actorUserId?: string;
  metadata?: Record<string, AuditMetadataValue | undefined>;
  outcome: "success" | "denied";
};

type EvaluateSignInAttemptInput = {
  approvedEmails: Set<string>;
  candidateEmail: string;
  existingUser: ExistingUser;
};

type EvaluateSignInAttemptResult = {
  allow: boolean;
  auditEvent: SignInAuditEvent;
};

function hashEmailForAudit(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function evaluateSignInAttempt(input: EvaluateSignInAttemptInput): EvaluateSignInAttemptResult {
  const candidateEmail = input.candidateEmail.trim().toLowerCase();
  if (!candidateEmail) {
    return {
      allow: false,
      auditEvent: {
        action: "auth.sign_in",
        outcome: "denied",
        metadata: {
          reason: "missing_email",
        },
      },
    };
  }

  if (!input.approvedEmails.has(candidateEmail)) {
    return {
      allow: false,
      auditEvent: {
        action: "auth.sign_in",
        outcome: "denied",
        metadata: {
          reason: "email_not_allowlisted",
          emailHash: hashEmailForAudit(candidateEmail),
        },
      },
    };
  }

  if (!input.existingUser) {
    return {
      allow: false,
      auditEvent: {
        action: "auth.sign_in",
        outcome: "denied",
        metadata: {
          reason: "user_not_provisioned",
          emailHash: hashEmailForAudit(candidateEmail),
        },
      },
    };
  }

  if (!input.existingUser.active) {
    return {
      allow: false,
      auditEvent: {
        action: "auth.sign_in",
        outcome: "denied",
        actorUserId: input.existingUser.id,
        metadata: {
          reason: "inactive_user",
        },
      },
    };
  }

  return {
    allow: true,
    auditEvent: {
      action: "auth.sign_in",
      outcome: "success",
      actorUserId: input.existingUser.id,
    },
  };
}
