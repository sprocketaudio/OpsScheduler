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

function firstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function parseExplicitOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildOriginFromParts(protocol: string, host: string): string | null {
  const normalizedProtocol = protocol.replace(/:$/, "");
  if (!normalizedProtocol || !host) {
    return null;
  }

  return parseExplicitOrigin(`${normalizedProtocol}://${host}`);
}

function getNonProductionRuntimeOrigins(request: NextRequest): Set<string> {
  const runtimeOrigins = new Set<string>();

  runtimeOrigins.add(request.nextUrl.origin);

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const host = firstHeaderValue(request.headers.get("host"));
  const nextUrlProtocol = request.nextUrl.protocol;

  if (forwardedHost) {
    const fromForwarded = buildOriginFromParts(forwardedProto ?? nextUrlProtocol, forwardedHost);
    if (fromForwarded) {
      runtimeOrigins.add(fromForwarded);
    }
  }

  if (host) {
    const fromHost = buildOriginFromParts(forwardedProto ?? nextUrlProtocol, host);
    if (fromHost) {
      runtimeOrigins.add(fromHost);
    }
  }

  return runtimeOrigins;
}

function getAllowedOrigins(request: NextRequest): Set<string> {
  const allowed = new Set<string>([expectedAppOrigin]);

  // In non-production environments (local/Codespaces), accept runtime host
  // origin variants inferred from request URL and forwarded/host headers.
  if (process.env.NODE_ENV !== "production") {
    for (const origin of getNonProductionRuntimeOrigins(request)) {
      allowed.add(origin);
    }
  }

  return allowed;
}

export function validateMutationOrigin(request: NextRequest): OriginValidationResult {
  // Strict origin enforcement is a production control.
  // In local/Codespaces development, proxy/header variations are common and
  // should not block auth or mutation testing flows.
  if (process.env.NODE_ENV !== "production") {
    return { ok: true };
  }

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const hasOriginContext = Boolean(originHeader) || Boolean(refererHeader);
  const allowedOrigins = getAllowedOrigins(request);

  if (!hasOriginContext && !isLikelyBrowserRequest(request)) {
    return { ok: true };
  }

  if (originHeader) {
    const origin = parseOriginHeader(originHeader);
    if (!origin) {
      return { ok: false, reason: "invalid_origin_header" };
    }
    if (!allowedOrigins.has(origin)) {
      return { ok: false, reason: "origin_mismatch" };
    }
    return { ok: true };
  }

  if (refererHeader) {
    const refererOrigin = parseRefererOrigin(refererHeader);
    if (!refererOrigin) {
      return { ok: false, reason: "invalid_referer_header" };
    }
    if (!allowedOrigins.has(refererOrigin)) {
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
