import { createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE } from "@senda/shared";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type SessionPayload = {
  account: string;
  exp: number;
};

export function createSessionToken(account: string, secret: string, now = Date.now()): string {
  const payload: SessionPayload = {
    account,
    exp: now + SESSION_TTL_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function readSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): SessionPayload | null {
  const separator = token.indexOf(".");
  if (separator <= 0 || separator !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!body || !signature || !signaturesMatch(signature, sign(body, secret))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isSessionPayload(parsed) || parsed.exp <= now) return null;
  return parsed;
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  return serialize(SESSION_COOKIE, token, SESSION_TTL_SECONDS, secure);
}

export function clearSessionCookieHeader(secure: boolean): string {
  return serialize(SESSION_COOKIE, "", 0, secure);
}

export function readRequestCookie(
  header: string | string[] | undefined,
  name: string,
): string | undefined {
  const raw = Array.isArray(header) ? header.join(";") : header;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
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

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
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
