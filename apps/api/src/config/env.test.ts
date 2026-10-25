import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import { loadEnv } from "./env.js";

const SESSION_SECRET = "senda-business-session-secret-32";
const signing = Keypair.random();
const ADMIN_ACCOUNT = Keypair.random().publicKey();

const bookEnv = {
  NODE_ENV: "test" as const,
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SECRET_KEY: "test-only-not-a-real-key",
  SESSION_SECRET,
  STELLAR_ADMIN_PUBLIC: ADMIN_ACCOUNT,
  SEP10_SIGNING_SECRET: signing.secret(),
};

test("loadEnv requires the Supabase book, the session secret, and the company account", () => {
  assert.equal(SESSION_SECRET.length, 32);
  assert.throws(
    () => loadEnv({ NODE_ENV: "test" }),
    /SUPABASE_URL|SESSION_SECRET|STELLAR_ADMIN_PUBLIC/,
  );
  const env = loadEnv(bookEnv);
  assert.equal(env.SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(env.SESSION_SECRET, SESSION_SECRET);
  assert.equal(env.STELLAR_ADMIN_PUBLIC, ADMIN_ACCOUNT);
});

test("loadEnv rejects a company account that is not a Stellar public key", () => {
  assert.throws(
    () =>
      loadEnv({
        ...bookEnv,
        STELLAR_ADMIN_PUBLIC: `G${"A".repeat(55)}`,
      }),
    /STELLAR_ADMIN_PUBLIC/,
  );
});

test("loadEnv accepts an empty Trustless Work key and treasury secret", () => {
  const env = loadEnv({ ...bookEnv, TRUSTLESS_WORK_API_KEY: "", TREASURY_SECRET: "" });
  assert.equal(env.TRUSTLESS_WORK_API_KEY, "");
  assert.equal(env.TREASURY_SECRET, "");
  assert.equal(env.STELLAR_ADMIN_PUBLIC, ADMIN_ACCOUNT);
  assert.equal(env.SOROBAN_RPC_URL, "https://soroban-testnet.stellar.org");
});

test("loadEnv does not require TRUSTLESS_WORK_API_KEY to be set", () => {
  const env = loadEnv(bookEnv);
  assert.equal(env.TRUSTLESS_WORK_API_KEY, "");
  assert.equal(env.TREASURY_SECRET, "");
});
