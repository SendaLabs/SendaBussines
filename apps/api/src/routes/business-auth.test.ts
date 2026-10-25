import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  Account,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { API_ROUTES, type Sep10ChallengeResponse } from "@senda/shared";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadEnv, type Env } from "../config/env.js";

const server = Keypair.random();
const admin = Keypair.random();
const SESSION_SECRET = "test-session-secret-at-least-32-chars";
const TESTNET = "Test SDF Network ; September 2015";

function testEnv(overrides: NodeJS.ProcessEnv = {}): Env {
  return loadEnv({
    NODE_ENV: "test",
    PORT: "4000",
    HOST: "127.0.0.1",
    CORS_ORIGIN: "http://localhost:3000",
    STELLAR_NETWORK: "testnet",
    HORIZON_URL: "https://horizon-testnet.stellar.org",
    SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
    SEP10_SIGNING_SECRET: server.secret(),
    SEP10_HOME_DOMAIN: "localhost",
    STELLAR_ADMIN_PUBLIC: admin.publicKey(),
    SESSION_SECRET,
    ...overrides,
  });
}

function cookieHeader(response: { headers: Record<string, unknown> }): string {
  const header = response.headers["set-cookie"];
  const value = Array.isArray(header) ? header.join("; ") : header;
  assert.equal(typeof value, "string");
  return value as string;
}

function signChallenge(xdr: string, signer: Keypair, passphrase: string = Networks.TESTNET): string {
  const tx = TransactionBuilder.fromXDR(xdr, passphrase);
  tx.sign(signer);
  return tx.toEnvelope().toXDR("base64").toString();
}

function expireChallenge(xdr: string, passphrase: string): string {
  const original = TransactionBuilder.fromXDR(xdr, passphrase);
  assert.ok(original instanceof Transaction);
  const source = new Account(server.publicKey(), "-1");
  let builder = new TransactionBuilder(source, {
    fee: original.fee,
    networkPassphrase: passphrase,
    timebounds: { minTime: 0, maxTime: 1 },
  });
  for (const operation of original.operations) {
    if (operation.type !== "manageData" || operation.value == null) {
      throw new Error(`unexpected operation ${operation.type}`);
    }
    builder = builder.addOperation(
      Operation.manageData({
        name: operation.name,
        value: Buffer.from(operation.value),
        source: operation.source,
      }),
    );
  }
  const expired = builder.build();
  expired.sign(server);
  expired.sign(admin);
  return expired.toEnvelope().toXDR("base64").toString();
}

async function challengeFor(app: FastifyInstance, account = admin.publicKey()) {
  return app.inject({
    method: "POST",
    url: API_ROUTES.sep10Challenge,
    payload: { account },
  });
}

describe("SEP-10 business session", { concurrency: false }, () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp(testEnv());
  });

  after(async () => {
    await app.close();
  });

  test("keeps health and network routes", async () => {
    const health = await app.inject({ method: "GET", url: API_ROUTES.health });
    assert.equal(health.statusCode, 200);
    const network = await app.inject({ method: "GET", url: API_ROUTES.network });
    assert.equal(network.statusCode, 200);
    assert.equal(network.json().network, "testnet");
  });

  test("rejects an account that is not a valid G address", async () => {
    const accounts = ["", "not-a-key", "G".repeat(56), admin.secret()];
    for (const account of accounts) {
      const response = await app.inject({
        method: "POST",
        url: API_ROUTES.sep10Challenge,
        payload: { account },
      });
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json(), { error: "Ingresá una cuenta Stellar válida." });
      assert.equal(response.json().transaction, undefined);
    }

    const missing = await app.inject({
      method: "POST",
      url: API_ROUTES.sep10Challenge,
      payload: {},
    });
    assert.equal(missing.statusCode, 400);
  });

  test("rejects a valid account that is not the company", async () => {
    const response = await challengeFor(app, Keypair.random().publicKey());
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "Esa cuenta no pertenece a la empresa." });
    assert.equal(response.json().transaction, undefined);
    assert.equal(response.headers["set-cookie"], undefined);
  });

  test("returns a SEP-10 challenge for the company account", async () => {
    const response = await challengeFor(app);
    assert.equal(response.statusCode, 200);
    const body = response.json() as Sep10ChallengeResponse;
    assert.equal(typeof body.transaction, "string");
    assert.ok(body.transaction.length > 0);
    assert.equal(body.networkPassphrase, TESTNET);
    assert.equal(body.networkPassphrase, Networks.TESTNET);
    const tx = TransactionBuilder.fromXDR(body.transaction, body.networkPassphrase);
    assert.ok(tx instanceof Transaction);
    assert.equal(tx.operations[0]?.type, "manageData");
  });

  test("sets an httpOnly session cookie when the company account signs", async () => {
    const issued = await challengeFor(app);
    const { transaction, networkPassphrase } = issued.json() as Sep10ChallengeResponse;
    const response = await app.inject({
      method: "POST",
      url: API_ROUTES.sep10Token,
      payload: { transaction: signChallenge(transaction, admin, networkPassphrase) },
    });
    assert.equal(response.statusCode, 204);
    assert.equal(response.body, "");

    const cookie = cookieHeader(response);
    assert.match(cookie, /^senda_session=[^;]+/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Max-Age=604800/);
    assert.doesNotMatch(cookie, /Secure/);
    assert.equal(cookie.includes(SESSION_SECRET), false);
    assert.equal(cookie.includes(server.secret()), false);

    const pair = cookie.split(";")[0];
    assert.ok(pair);
    const token = pair.slice("senda_session=".length);
    const payload = token.split(".")[0];
    assert.ok(payload);
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      account: string;
      exp: number;
    };
    assert.equal(decoded.account, admin.publicKey());
    assert.equal(typeof decoded.exp, "number");
    const remaining = decoded.exp - Date.now();
    assert.ok(remaining > 7 * 24 * 60 * 60 * 1000 - 60_000);
    assert.ok(remaining <= 7 * 24 * 60 * 60 * 1000);

    const session = await app.inject({
      method: "GET",
      url: API_ROUTES.businessSession,
      headers: { cookie: cookie.split(";")[0] },
    });
    assert.equal(session.statusCode, 200);
    assert.deepEqual(session.json(), { account: admin.publicKey() });
  });

  test("rejects the same signed challenge on the second redeem", async () => {
    const issued = await challengeFor(app);
    const { transaction, networkPassphrase } = issued.json() as Sep10ChallengeResponse;
    const signed = signChallenge(transaction, admin, networkPassphrase);
    const first = await app.inject({
      method: "POST",
      url: API_ROUTES.sep10Token,
      payload: { transaction: signed },
    });
    assert.equal(first.statusCode, 204);

    const second = await app.inject({
      method: "POST",
      url: API_ROUTES.sep10Token,
      payload: { transaction: signed },
    });
    assert.equal(second.statusCode, 401);
    assert.deepEqual(second.json(), { error: "No se pudo verificar la firma." });
    assert.equal(second.headers["set-cookie"], undefined);
  });

  test("rejects an expired challenge or a signature from another account", async () => {
    const expiredIssue = await challengeFor(app);
    const expiredBody = expiredIssue.json() as Sep10ChallengeResponse;
    const expired = await app.inject({
      method: "POST",
      url: API_ROUTES.sep10Token,
      payload: {
        transaction: expireChallenge(expiredBody.transaction, expiredBody.networkPassphrase),
      },
    });
    assert.equal(expired.statusCode, 401);
    assert.deepEqual(expired.json(), { error: "No se pudo verificar la firma." });
    assert.equal(expired.headers["set-cookie"], undefined);

    const otherIssue = await challengeFor(app);
    const otherBody = otherIssue.json() as Sep10ChallengeResponse;
    const other = await app.inject({
      method: "POST",
      url: API_ROUTES.sep10Token,
      payload: {
        transaction: signChallenge(
          otherBody.transaction,
          Keypair.random(),
          otherBody.networkPassphrase,
        ),
      },
    });
    assert.equal(other.statusCode, 401);
    assert.equal(other.headers["set-cookie"], undefined);

    const recovered = await app.inject({
      method: "POST",
      url: API_ROUTES.sep10Token,
      payload: {
        transaction: signChallenge(
          otherBody.transaction,
          admin,
          otherBody.networkPassphrase,
        ),
      },
    });
    assert.equal(recovered.statusCode, 204);
  });

  test("requires the session cookie and drops it on logout", async () => {
    const anonymous = await app.inject({ method: "GET", url: API_ROUTES.businessSession });
    assert.equal(anonymous.statusCode, 401);
    assert.deepEqual(anonymous.json(), { error: "Tenés que ingresar." });

    const issued = await challengeFor(app);
    const { transaction, networkPassphrase } = issued.json() as Sep10ChallengeResponse;
    const login = await app.inject({
      method: "POST",
      url: API_ROUTES.sep10Token,
      payload: { transaction: signChallenge(transaction, admin, networkPassphrase) },
    });
    const pair = cookieHeader(login).split(";")[0];
    assert.ok(pair);

    const authed = await app.inject({
      method: "GET",
      url: API_ROUTES.businessSession,
      headers: { cookie: pair },
    });
    assert.deepEqual(authed.json(), { account: admin.publicKey() });

    const tampered = await app.inject({
      method: "GET",
      url: API_ROUTES.businessSession,
      headers: { cookie: `${pair}x` },
    });
    assert.equal(tampered.statusCode, 401);

    const deleted = await app.inject({
      method: "DELETE",
      url: API_ROUTES.businessSession,
      headers: { cookie: pair },
    });
    assert.equal(deleted.statusCode, 204);
    const cleared = cookieHeader(deleted);
    assert.match(cleared, /^senda_session=;/);
    assert.match(cleared, /HttpOnly/);
    assert.match(cleared, /Path=\//);
    assert.match(cleared, /SameSite=Lax/);
    assert.match(cleared, /Max-Age=0/);

    const after = await app.inject({ method: "GET", url: API_ROUTES.businessSession });
    assert.equal(after.statusCode, 401);
    assert.deepEqual(after.json(), { error: "Tenés que ingresar." });
  });

  test("marks the session cookie Secure in production", async () => {
    const prod = await buildApp(testEnv({ NODE_ENV: "production" }));
    try {
      const issued = await challengeFor(prod);
      const { transaction, networkPassphrase } = issued.json() as Sep10ChallengeResponse;
      const response = await prod.inject({
        method: "POST",
        url: API_ROUTES.sep10Token,
        payload: { transaction: signChallenge(transaction, admin, networkPassphrase) },
      });
      assert.match(cookieHeader(response), /Secure/);
      const deleted = await prod.inject({ method: "DELETE", url: API_ROUTES.businessSession });
      assert.match(cookieHeader(deleted), /Secure/);
    } finally {
      await prod.close();
    }
  });

  test("accepts the company wallet when it also signs the SEP-10 challenge", async () => {
    const company = Keypair.random();
    const same = await buildApp(
      testEnv({
        SEP10_SIGNING_SECRET: company.secret(),
        STELLAR_ADMIN_PUBLIC: company.publicKey(),
      }),
    );
    try {
      const issued = await challengeFor(same, company.publicKey());
      assert.equal(issued.statusCode, 200);
      const { transaction, networkPassphrase } = issued.json() as Sep10ChallengeResponse;
      const unsigned = await same.inject({
        method: "POST",
        url: API_ROUTES.sep10Token,
        payload: { transaction },
      });
      assert.equal(unsigned.statusCode, 401);

      const signed = await same.inject({
        method: "POST",
        url: API_ROUTES.sep10Token,
        payload: { transaction: signChallenge(transaction, company, networkPassphrase) },
      });
      assert.equal(signed.statusCode, 204);
      assert.match(cookieHeader(signed), /HttpOnly/);
    } finally {
      await same.close();
    }
  });

  test("loadEnv rejects a short session secret and an invalid signing key", () => {
    assert.throws(() => testEnv({ SESSION_SECRET: "too-short" }));
    assert.throws(() => testEnv({ SEP10_SIGNING_SECRET: "not-a-secret" }));
    assert.throws(() => testEnv({ STELLAR_ADMIN_PUBLIC: "not-a-public-key" }));
  });
});
