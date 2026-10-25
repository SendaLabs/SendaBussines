import { createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE } from "@senda/shared";

/** Cookie set once SEP-10 accepts the company wallet. Payload is account and exp, HMAC-SHA256. */
export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export const SIGN_IN_REQUIRED_ERROR = "Tenés que ingresar.";

/** Seven days. The signed expiry and the cookie lifetime use the same span. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

const MIN_SECRET_LENGTH = 32;

type SessionPayload = {
  account: string;
  exp: number;
};

function assertSecret(secret: string): void {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
}

function signature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.account === "string" &&
    record.account.length > 0 &&
    typeof record.exp === "number" &&
    Number.isFinite(record.exp)
  );
}

/** HMAC-SHA256 token. The payload is the treasury account and an absolute expiry, never a secret. */
export function signSession(account: string, secret: string, now = Date.now()): string {
  assertSecret(secret);
  if (account.length === 0) {
    throw new Error("La sesión necesita una cuenta.");
  }
  const body = Buffer.from(
    JSON.stringify({ account, exp: now + SESSION_TTL_MS }),
    "utf8",
  ).toString("base64url");
  return `${body}.${signature(body, secret)}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): { account: string } | null {
  assertSecret(secret);
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || token.indexOf(".", dot + 1) !== -1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, signature(body, secret))) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!isSessionPayload(parsed) || parsed.exp <= now) return null;
    return { account: parsed.account };
  } catch {
    return null;
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value.length > 0 ? value : undefined;
  }
  return undefined;
}

export function readRequestCookie(
  header: string | string[] | undefined,
  name: string,
): string | undefined {
  const raw = Array.isArray(header) ? header.join(";") : header;
  return readCookie(raw, name);
}

export function sessionFromCookieHeader(
  header: string | string[] | undefined,
  secret: string,
  now = Date.now(),
): { account: string } | null {
  return verifySession(readRequestCookie(header, SESSION_COOKIE_NAME), secret, now);
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  return serialize(SESSION_COOKIE_NAME, token, SESSION_TTL_SECONDS, secure);
}

export function clearSessionCookieHeader(secure: boolean): string {
  return serialize(SESSION_COOKIE_NAME, "", 0, secure);
}

function serialize(name: string, value: string, maxAge: number, secure: boolean): string {
  const parts = [
    `${name}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
