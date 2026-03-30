"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SubmitState = "idle" | "sending" | "sent" | "error";

const GENERIC_SENT_MESSAGE =
  "If this email is approved, a sign-in link has been sent. The link expires automatically.";
const GENERIC_FAILURE_MESSAGE = "Unable to process sign-in right now. Please try again.";
const EXPIRED_LINK_MESSAGE = "That sign-in link is invalid or expired. Request a new one.";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") ?? "/dashboard",
    [searchParams],
  );
  const initialError = useMemo(
    () => (searchParams.get("error") === "Verification" ? EXPIRED_LINK_MESSAGE : null),
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

    try {
      const response = await signIn("email", {
        email: normalizedEmail,
        callbackUrl,
        redirect: false,
      });

      if (!response) {
        setState("error");
        setErrorMessage(GENERIC_FAILURE_MESSAGE);
        return;
      }

      if (!response.ok && response.error && response.error !== "AccessDenied") {
        setState("error");
        setErrorMessage(GENERIC_FAILURE_MESSAGE);
        return;
      }

      // Return a neutral confirmation to avoid account enumeration.
      setState("sent");
      return;
    } catch {
      setState("error");
      setErrorMessage(GENERIC_FAILURE_MESSAGE);
      return;
    }
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
          <AlertTitle>Sign-in request received</AlertTitle>
          <AlertDescription>{GENERIC_SENT_MESSAGE}</AlertDescription>
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
