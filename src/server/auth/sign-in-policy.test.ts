import { describe, expect, it } from "vitest";
import { evaluateSignInAttempt } from "@/server/auth/sign-in-policy";

describe("evaluateSignInAttempt", () => {
  const approvedEmails = new Set(["admin@example.com", "user@example.com"]);

  it("denies when email is missing", () => {
    const result = evaluateSignInAttempt({
      approvedEmails,
      candidateEmail: "",
      existingUser: null,
    });

    expect(result.allow).toBe(false);
    expect(result.auditEvent.outcome).toBe("denied");
    expect(result.auditEvent.metadata?.reason).toBe("missing_email");
  });

  it("denies when email is not allowlisted", () => {
    const result = evaluateSignInAttempt({
      approvedEmails,
      candidateEmail: "outside@example.com",
      existingUser: null,
    });

    expect(result.allow).toBe(false);
    expect(result.auditEvent.metadata?.reason).toBe("email_not_allowlisted");
    expect(result.auditEvent.metadata?.emailHash).toBeTypeOf("string");
    expect(result.auditEvent.metadata?.emailHash).not.toBe("outside@example.com");
  });

  it("denies when allowlisted user is not provisioned", () => {
    const result = evaluateSignInAttempt({
      approvedEmails,
      candidateEmail: "admin@example.com",
      existingUser: null,
    });

    expect(result.allow).toBe(false);
    expect(result.auditEvent.metadata?.reason).toBe("user_not_provisioned");
  });

  it("denies when provisioned user is inactive", () => {
    const result = evaluateSignInAttempt({
      approvedEmails,
      candidateEmail: "admin@example.com",
      existingUser: {
        id: "user-1",
        active: false,
      },
    });

    expect(result.allow).toBe(false);
    expect(result.auditEvent.metadata?.reason).toBe("inactive_user");
    expect(result.auditEvent.actorUserId).toBe("user-1");
  });

  it("allows allowlisted active provisioned user", () => {
    const result = evaluateSignInAttempt({
      approvedEmails,
      candidateEmail: "admin@example.com",
      existingUser: {
        id: "user-1",
        active: true,
      },
    });

    expect(result.allow).toBe(true);
    expect(result.auditEvent.outcome).toBe("success");
    expect(result.auditEvent.actorUserId).toBe("user-1");
  });
});
