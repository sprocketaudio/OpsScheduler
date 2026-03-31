import { NextRequest } from "next/server";

type OriginValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_origin_header" | "invalid_referer_header" | "missing_origin" | "origin_mismatch";
    };

const configuredAuthUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
if (!configuredAuthUrl) {
  throw new Error("AUTH_URL is required");
}

let expectedAppOrigin: string;
try {
  expectedAppOrigin = new URL(configuredAuthUrl).origin;
} catch {
  throw new Error("AUTH_URL must be a valid absolute URL");
}

function parseOriginHeader(originHeader: string | null): string | null {
  if (!originHeader || originHeader === "null") {
    return null;
  }

  try {
    return new URL(originHeader).origin;
  } catch {
    return null;
  }
}

function parseRefererOrigin(refererHeader: string | null): string | null {
  if (!refererHeader) {
    return null;
  }

  try {
    return new URL(refererHeader).origin;
  } catch {
    return null;
  }
}

function isLikelyBrowserRequest(request: NextRequest): boolean {
  return (
    request.headers.has("sec-fetch-site") ||
    request.headers.has("sec-fetch-mode") ||
    request.headers.has("sec-fetch-dest")
  );
}

export function validateMutationOrigin(request: NextRequest): OriginValidationResult {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const hasOriginContext = Boolean(originHeader) || Boolean(refererHeader);

  if (!hasOriginContext && !isLikelyBrowserRequest(request)) {
    return { ok: true };
  }

  if (originHeader) {
    const origin = parseOriginHeader(originHeader);
    if (!origin) {
      return { ok: false, reason: "invalid_origin_header" };
    }
    if (origin !== expectedAppOrigin) {
      return { ok: false, reason: "origin_mismatch" };
    }
    return { ok: true };
  }

  if (refererHeader) {
    const refererOrigin = parseRefererOrigin(refererHeader);
    if (!refererOrigin) {
      return { ok: false, reason: "invalid_referer_header" };
    }
    if (refererOrigin !== expectedAppOrigin) {
      return { ok: false, reason: "origin_mismatch" };
    }
    return { ok: true };
  }

  return { ok: false, reason: "missing_origin" };
}

export function guardMutationOrigin(request: NextRequest): Response | null {
  const validation = validateMutationOrigin(request);
  if (validation.ok) {
    return null;
  }

  return Response.json(
    {
      error: "Invalid request origin.",
      code: validation.reason,
    },
    {
      status: 403,
    },
  );
}
