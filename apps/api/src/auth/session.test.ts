import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  readCookie,
  signSession,
  verifySession,
} from "./session.js";

const SECRET = "senda-business-session-secret-32";

test("session cookie round trip keeps the account and the expiry", () => {
  const now = Date.parse("2026-10-25T15:00:00.000Z");
  const token = signSession("GTEST", SECRET, now);
  assert.deepEqual(verifySession(token, SECRET, now + SESSION_TTL_MS - 1), { account: "GTEST" });
  assert.equal(verifySession(token, SECRET, now + SESSION_TTL_MS), null);
  assert.equal(readCookie(`a=1; ${SESSION_COOKIE_NAME}=${token}; b=2`, SESSION_COOKIE_NAME), token);
});

test("tampered tokens and short secrets do not open a session", () => {
  const token = signSession("GTEST", SECRET);
  assert.equal(verifySession(`${token.slice(0, -1)}x`, SECRET), null);
  assert.equal(verifySession(undefined, SECRET), null);
  assert.throws(() => signSession("GTEST", "too-short"));
  assert.throws(() => verifySession(token, "too-short"));
});
