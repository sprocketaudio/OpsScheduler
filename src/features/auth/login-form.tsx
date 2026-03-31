"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SubmitState = "idle" | "sending_code" | "code_sent" | "verifying_code" | "error";

const GENERIC_SENT_MESSAGE =
  "If this email is approved, a 6-digit sign-in code has been sent. Enter it below.";
const GENERIC_FAILURE_MESSAGE = "Unable to process sign-in right now. Please try again.";
const EXPIRED_CODE_MESSAGE = "That sign-in code is invalid or expired. Request a new one.";
const CODE_LENGTH = 6;
const CODE_PATTERN = /^\d{6}$/;

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") ?? "/dashboard",
    [searchParams],
  );
  const initialError = useMemo(
    () => (searchParams.get("error") === "Verification" ? EXPIRED_CODE_MESSAGE : null),
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [normalizedEmail, setNormalizedEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const isCodeStep = state === "code_sent" || state === "verifying_code";
  const canSendCode = email.trim().length > 0;
  const canVerifyCode = Boolean(normalizedEmail) && CODE_PATTERN.test(code);

  async function handleRequestCode() {
    setState("sending_code");
    setErrorMessage(null);

    const nextEmail = email.trim().toLowerCase();

    try {
      const response = await signIn("email", {
        email: nextEmail,
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
      setNormalizedEmail(nextEmail);
      setCode("");
      setState("code_sent");
      return;
    } catch {
      setState("error");
      setErrorMessage(GENERIC_FAILURE_MESSAGE);
      return;
    }
  }

  function handleVerifyCode() {
    if (!normalizedEmail) {
      setState("error");
      setErrorMessage(GENERIC_FAILURE_MESSAGE);
      return;
    }

    if (!CODE_PATTERN.test(code)) {
      return;
    }

    setState("verifying_code");
    setErrorMessage(null);

    const params = new URLSearchParams({
      callbackUrl,
      token: code,
      email: normalizedEmail,
    });

    // Use replace to avoid leaving the one-time code callback URL in browser history.
    window.location.replace(`/api/auth/callback/email?${params.toString()}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCodeStep) {
      handleVerifyCode();
      return;
    }

    await handleRequestCode();
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
          disabled={isCodeStep}
        />
      </div>

      {isCodeStep ? (
        <div className="grid gap-2">
          <Label htmlFor="verification-code">Sign-in code</Label>
          <Input
            id="verification-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            placeholder="123456"
          />
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={
          state === "sending_code" ||
          state === "verifying_code" ||
          (isCodeStep ? !canVerifyCode : !canSendCode)
        }
      >
        {state === "sending_code"
          ? "Sending code..."
          : state === "verifying_code"
            ? "Verifying code..."
            : isCodeStep
              ? "Sign in"
              : "Send sign-in code"}
      </Button>

      {isCodeStep ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void handleRequestCode();
          }}
          disabled={state === "verifying_code"}
        >
          Send new code
        </Button>
      ) : null}

      {isCodeStep ? (
        <Alert>
          <AlertTitle>Code sent</AlertTitle>
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
