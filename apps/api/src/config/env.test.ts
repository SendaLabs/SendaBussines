import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnv } from "./env.js";

const SESSION_SECRET = "senda-business-session-secret-32";

test("loadEnv requires the Supabase book and the session secret", () => {
  assert.equal(SESSION_SECRET.length, 32);
  assert.throws(() => loadEnv({ NODE_ENV: "test" }), /SUPABASE_URL|SESSION_SECRET/);
  const env = loadEnv({
    NODE_ENV: "test",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SECRET_KEY: "test-only-not-a-real-key",
    SESSION_SECRET,
  });
  assert.equal(env.SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(env.SESSION_SECRET, SESSION_SECRET);
});
