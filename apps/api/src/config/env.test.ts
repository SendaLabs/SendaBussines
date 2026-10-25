import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("accepts an empty TRUSTLESS_WORK_API_KEY", () => {
    const env = loadEnv({ TRUSTLESS_WORK_API_KEY: "" });
    assert.equal(env.TRUSTLESS_WORK_API_KEY, "");
    assert.equal(env.TREASURY_SECRET, "");
    assert.equal(env.STELLAR_ADMIN_PUBLIC, "");
  });

  it("does not require TRUSTLESS_WORK_API_KEY to be set", () => {
    const env = loadEnv({});
    assert.equal(env.TRUSTLESS_WORK_API_KEY, "");
  });
});
