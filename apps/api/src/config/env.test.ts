import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("accepts an empty TRUSTLESS_WORK_API_KEY", () => {
    const env = loadEnv({ TRUSTLESS_WORK_API_KEY: "" });
    assert.equal(env.TRUSTLESS_WORK_API_KEY, "");
    assert.equal(env.TREASURY_SECRET, "");
    assert.equal(env.STELLAR_ADMIN_PUBLIC, "");
    assert.equal(env.ESCROW_ADMIN_SECRET, "");
    assert.equal(env.ESCROW_DISPUTE_RESOLVER_SECRET, "");
    assert.equal(env.escrowAdminPublicKey, "");
    assert.equal(env.escrowDisputeResolverPublicKey, "");
  });

  it("does not require TRUSTLESS_WORK_API_KEY to be set", () => {
    const env = loadEnv({});
    assert.equal(env.TRUSTLESS_WORK_API_KEY, "");
  });

  it("derives escrow role public keys and still allows an empty API key", () => {
    const treasury = Keypair.random();
    const escrowAdmin = Keypair.random();
    const disputeResolver = Keypair.random();
    const env = loadEnv({
      TRUSTLESS_WORK_API_KEY: "",
      STELLAR_ADMIN_PUBLIC: treasury.publicKey(),
      ESCROW_ADMIN_SECRET: escrowAdmin.secret(),
      ESCROW_DISPUTE_RESOLVER_SECRET: disputeResolver.secret(),
    });
    assert.equal(env.TRUSTLESS_WORK_API_KEY, "");
    assert.equal(env.escrowAdminPublicKey, escrowAdmin.publicKey());
    assert.equal(env.escrowDisputeResolverPublicKey, disputeResolver.publicKey());
  });

  it("rejects an escrow admin that is the treasury", () => {
    const treasury = Keypair.random();
    assert.throws(
      () =>
        loadEnv({
          STELLAR_ADMIN_PUBLIC: treasury.publicKey(),
          ESCROW_ADMIN_SECRET: treasury.secret(),
          ESCROW_DISPUTE_RESOLVER_SECRET: Keypair.random().secret(),
        }),
      /ESCROW_ADMIN_SECRET public key equals STELLAR_ADMIN_PUBLIC/,
    );
  });

  it("rejects a dispute resolver that is the treasury", () => {
    const treasury = Keypair.random();
    assert.throws(
      () =>
        loadEnv({
          STELLAR_ADMIN_PUBLIC: ` ${treasury.publicKey()} `,
          ESCROW_ADMIN_SECRET: Keypair.random().secret(),
          ESCROW_DISPUTE_RESOLVER_SECRET: treasury.secret(),
        }),
      /ESCROW_DISPUTE_RESOLVER_SECRET public key equals STELLAR_ADMIN_PUBLIC/,
    );
  });

  it("rejects role secrets that derive the same public key", () => {
    const shared = Keypair.random();
    assert.throws(
      () =>
        loadEnv({
          STELLAR_ADMIN_PUBLIC: Keypair.random().publicKey(),
          ESCROW_ADMIN_SECRET: shared.secret(),
          ESCROW_DISPUTE_RESOLVER_SECRET: shared.secret(),
        }),
      /derive the same public key/,
    );
  });

  it("rejects a role secret that is not a Stellar secret without echoing it", () => {
    const secret = "not-a-secret";
    assert.throws(
      () => loadEnv({ ESCROW_ADMIN_SECRET: secret }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message.includes(secret), false);
        assert.match(error.message, /ESCROW_ADMIN_SECRET is not a Stellar secret key/);
        return true;
      },
    );
  });
});
