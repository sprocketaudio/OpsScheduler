"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SubmitState = "idle" | "sending" | "sent" | "error";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "This email address is not approved for OpsScheduler access.",
  Verification: "The sign-in link is invalid or expired. Request a new one.",
  default: "Unable to sign in right now. Please try again.",
};

function getAuthErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) {
    return null;
  }
  return AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES.default;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") ?? "/dashboard",
    [searchParams],
  );
  const initialError = useMemo(
    () => getAuthErrorMessage(searchParams.get("error")),
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const canSubmit = email.trim().length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    const response = await signIn("email", {
      email: normalizedEmail,
      callbackUrl,
      redirect: false,
    });

    if (!response || !response.ok || response.error) {
      setState("error");
      setErrorMessage(getAuthErrorMessage(response?.error ?? null));
      return;
    }

    setState("sent");
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
        />
      </div>

      <Button type="submit" disabled={state === "sending" || !canSubmit}>
        {state === "sending" ? "Sending link..." : "Send magic link"}
      </Button>

      {state === "sent" ? (
        <Alert>
          <AlertTitle>Magic link sent</AlertTitle>
          <AlertDescription>Check your inbox. The sign-in link expires in 24 hours.</AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Sign in failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
