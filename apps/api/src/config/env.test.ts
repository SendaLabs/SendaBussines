import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import { loadEnv } from "./env.js";

const SESSION_SECRET = "senda-business-session-secret-32";
const ADMIN_ACCOUNT = Keypair.random().publicKey();

test("loadEnv requires the Supabase book, the session secret, and the company account", () => {
  assert.equal(SESSION_SECRET.length, 32);
  assert.throws(
    () => loadEnv({ NODE_ENV: "test" }),
    /SUPABASE_URL|SESSION_SECRET|STELLAR_ADMIN_PUBLIC/,
  );
  const env = loadEnv({
    NODE_ENV: "test",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SECRET_KEY: "test-only-not-a-real-key",
    SESSION_SECRET,
    STELLAR_ADMIN_PUBLIC: ADMIN_ACCOUNT,
  });
  assert.equal(env.SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(env.SESSION_SECRET, SESSION_SECRET);
  assert.equal(env.STELLAR_ADMIN_PUBLIC, ADMIN_ACCOUNT);
});

test("loadEnv rejects a company account that is not a Stellar public key", () => {
  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: "test",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SECRET_KEY: "test-only-not-a-real-key",
        SESSION_SECRET,
        STELLAR_ADMIN_PUBLIC: `G${"A".repeat(55)}`,
      }),
    /STELLAR_ADMIN_PUBLIC/,
  );
});
