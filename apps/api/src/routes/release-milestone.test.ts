import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import type { FastifyInstance } from "fastify";
import {
  API_ROUTES,
  supplierPaymentCanBeReleased,
  supplierPaymentReleaseMilestonePath,
  type BusinessDashboard,
} from "@senda/shared";
import {
  SESSION_COOKIE_NAME,
  SIGN_IN_REQUIRED_ERROR,
  signSession,
} from "../auth/session.js";
import { buildApp } from "../app.js";
import { loadEnv } from "../config/env.js";
import type { EscrowRecord, ReleaseEscrowInput } from "../escrow/client.js";
import { EscrowClientError, RELEASE_FAILED } from "../escrow/errors.js";
import type { EscrowReleaseClient } from "../escrow/release-supplier-payment.js";
import { DEMO_BOOK } from "../store/seed.js";
import { createMemoryBusinessStore, type MemoryBusinessStore } from "../store/memory.js";
import type { StoredSupplierPayment } from "../store/types.js";

const SESSION_SECRET = "senda-business-session-secret-32";
const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 7));
const RELEASE_HASH = "release-tx-test";
const SUPPLIER_NAME = "Taller Norte";
const NO_DEPOSIT = "Este pago no tiene un depósito para liberar.";
const ALREADY_RELEASED = "Este hito ya fue liberado.";

class FakeReleaseEscrow implements EscrowReleaseClient {
  readonly releases: ReleaseEscrowInput[] = [];
  error: Error | null = null;
  released = true;
  releaseTxHash: string | null = RELEASE_HASH;

  async deploy(): Promise<EscrowRecord> {
    throw new Error("release tests do not deploy");
  }

  async fund(): Promise<EscrowRecord> {
    throw new Error("release tests do not fund");
  }

  async approveAndRelease(input: ReleaseEscrowInput): Promise<EscrowRecord> {
    this.releases.push({ ...input });
    if (this.error) throw this.error;
    return {
      engagementId: input.engagementId,
      contractId: input.contractId,
      txHash: this.releaseTxHash,
      fundTxHash: "fund-tx-test",
      releaseTxHash: this.released ? this.releaseTxHash : null,
      amount: 100,
      funded: true,
      released: this.released,
      indexerLagging: !this.released,
    };
  }
}

const SEP10_SIGNING_SECRET = Keypair.random().secret();

function testEnv(adminPublic: string) {
  return loadEnv({
    NODE_ENV: "test",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SECRET_KEY: "test-only-not-a-real-key",
    SESSION_SECRET,
    STELLAR_ADMIN_PUBLIC: adminPublic,
    SEP10_SIGNING_SECRET,
  });
}

function approvedRow(
  id: string,
  account: string,
  amount: number,
  patch: Partial<StoredSupplierPayment> = {},
): StoredSupplierPayment {
  return {
    id,
    supplier: SUPPLIER_NAME,
    country: "ES",
    amount,
    dueDate: "2026-10-09",
    status: "approved",
    stellarAccount: account,
    fundedTxHash: "fund-tx-test",
    metadataSha256: null,
    escrowContractId: CONTRACT_ID,
    fundTxHash: "fund-tx-test",
    releaseTxHash: null,
    fundedAt: "2026-10-25T12:00:00.000Z",
    fundingClaimedAt: null,
    deployTxHash: null,
    pendingFundTxHash: null,
    ...patch,
  };
}

async function withReleaseApi(
  run: (ctx: {
    app: FastifyInstance;
    store: MemoryBusinessStore;
    escrow: FakeReleaseEscrow;
    supplier: string;
    token: string;
  }) => Promise<void>,
  extras: (supplier: string) => StoredSupplierPayment[] = () => [],
) {
  const admin = Keypair.random().publicKey();
  const supplier = Keypair.random().publicKey();
  const book = structuredClone(DEMO_BOOK);
  book.payments.push(...extras(supplier));
  const store = createMemoryBusinessStore(book);
  const escrow = new FakeReleaseEscrow();
  const app = await buildApp(testEnv(admin), store, escrow);
  try {
    await run({
      app,
      store,
      escrow,
      supplier,
      token: signSession("GTEST", SESSION_SECRET),
    });
  } finally {
    await app.close();
  }
}

function cookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function releasePayment(app: FastifyInstance, id: string, token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = cookie(token);
  return app.inject({
    method: "POST",
    url: supplierPaymentReleaseMilestonePath(id),
    headers,
  });
}

async function readDashboard(app: FastifyInstance, token: string): Promise<BusinessDashboard> {
  const response = await app.inject({
    method: "GET",
    url: API_ROUTES.businessDashboard,
    headers: { cookie: cookie(token) },
  });
  assert.equal(response.statusCode, 200);
  return response.json() as BusinessDashboard;
}

test("release-milestone without a cookie is 401 and does not call Trustless", async () => {
  await withReleaseApi(async ({ app, escrow, store }) => {
    const response = await releasePayment(app, "pay-ready", null);
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: SIGN_IN_REQUIRED_ERROR });
    assert.equal(escrow.releases.length, 0);
    assert.equal(store.readSupplierPayment("pay-ready")?.status, "approved");
    assert.equal(store.readSupplierPayment("pay-ready")?.releaseTxHash, null);
  }, (supplier) => [approvedRow("pay-ready", supplier, 100)]);
});

test("a missing payment is 404 and a payment without a deposit is 409", async () => {
  await withReleaseApi(async ({ app, token, escrow, store }) => {
    const missing = await releasePayment(app, "00000000-0000-4000-8000-000000000000", token);
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.json(), { error: "No encontramos ese pago." });

    const pending = await releasePayment(app, "pay-open", token);
    assert.equal(pending.statusCode, 409);
    assert.deepEqual(pending.json(), { error: NO_DEPOSIT });

    const scheduled = await releasePayment(app, "pay-rios", token);
    assert.equal(scheduled.statusCode, 409);
    assert.deepEqual(scheduled.json(), { error: NO_DEPOSIT });

    const approvedWithoutContract = await releasePayment(app, "pay-pacifico", token);
    assert.equal(approvedWithoutContract.statusCode, 409);
    assert.deepEqual(approvedWithoutContract.json(), { error: NO_DEPOSIT });

    assert.equal(escrow.releases.length, 0);
    assert.equal(store.readSupplierPayment("pay-open")?.status, "pending");
    assert.equal(store.readSupplierPayment("pay-open")?.releaseTxHash, null);
    assert.equal(store.readSupplierPayment("pay-pacifico")?.status, "approved");
    assert.equal(store.readSupplierPayment("pay-pacifico")?.escrowContractId, null);
  }, (supplier) => [approvedRow("pay-open", supplier, 100, {
    status: "pending",
    escrowContractId: null,
    fundTxHash: null,
    fundedTxHash: null,
    fundedAt: null,
  })]);
});

test("an approved deposit releases milestone 0 and leaves Por pagar and the balance", async () => {
  await withReleaseApi(async ({ app, token, escrow, store }) => {
    const before = await readDashboard(app, token);
    assert.deepEqual(before.kpis.payable, { value: 10425, invoices: 6 });
    assert.equal(before.kpis.balance.value, 248420);
    assert.equal(before.kpis.balance.change, 0.084);
    const ready = before.upcomingPayments.find((payment) => payment.id === "pay-ready");
    const pacifico = before.upcomingPayments.find((payment) => payment.id === "pay-pacifico");
    assert.ok(ready);
    assert.ok(pacifico);
    assert.equal(supplierPaymentCanBeReleased(ready), true);
    assert.equal(supplierPaymentCanBeReleased(pacifico), false);

    const response = await releasePayment(app, "pay-ready", token);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      id: "pay-ready",
      status: "released",
      releaseTxHash: RELEASE_HASH,
    });

    const release = escrow.releases[0];
    assert.ok(release);
    assert.equal(escrow.releases.length, 1);
    assert.equal(release.engagementId, "pay-ready");
    assert.equal(release.contractId, CONTRACT_ID);
    assert.deepEqual(release.milestoneIndexes, [0]);
    assert.equal(typeof release.milestoneIndexes?.[0], "number");
    const raw = JSON.stringify(release);
    assert.equal(raw.includes(SUPPLIER_NAME), false);
    assert.equal(raw.includes("supplierName"), false);
    assert.equal(raw.includes("Paraguay"), false);

    const stored = store.readSupplierPayment("pay-ready");
    assert.equal(stored?.status, "released");
    assert.equal(stored?.releaseTxHash, RELEASE_HASH);
    assert.equal(stored?.escrowContractId, CONTRACT_ID);
    assert.equal(stored?.fundTxHash, "fund-tx-test");

    const after = await readDashboard(app, token);
    assert.deepEqual(after.kpis.payable, { value: 10325, invoices: 5 });
    assert.equal(after.kpis.balance.value, 248420);
    assert.equal(after.kpis.balance.change, 0.084);
    assert.equal(after.kpis.spend.value, before.kpis.spend.value);
    assert.equal(after.kpis.international.value, before.kpis.international.value);
    assert.equal(after.activity.length, before.activity.length);
    const listed = after.upcomingPayments.find((payment) => payment.id === "pay-ready");
    assert.equal(listed?.status, "released");
    assert.equal(listed?.releaseTxHash, RELEASE_HASH);
    assert.equal(listed ? supplierPaymentCanBeReleased(listed) : true, false);

    const again = await releasePayment(app, "pay-ready", token);
    assert.equal(again.statusCode, 409);
    assert.deepEqual(again.json(), { error: ALREADY_RELEASED });
    assert.equal(escrow.releases.length, 1);
    assert.equal(store.readSupplierPayment("pay-ready")?.status, "released");
    assert.equal(store.readSupplierPayment("pay-ready")?.releaseTxHash, RELEASE_HASH);
    const still = await readDashboard(app, token);
    assert.deepEqual(still.kpis.payable, { value: 10325, invoices: 5 });
    assert.equal(still.kpis.balance.value, 248420);
  }, (supplier) => [approvedRow("pay-ready", supplier, 100)]);
});

test("a release hash already stored is 409 and does not call Trustless", async () => {
  await withReleaseApi(async ({ app, token, escrow, store }) => {
    const response = await releasePayment(app, "pay-done", token);
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: ALREADY_RELEASED });
    assert.equal(escrow.releases.length, 0);
    assert.equal(store.readSupplierPayment("pay-done")?.status, "approved");
    assert.equal(store.readSupplierPayment("pay-done")?.releaseTxHash, "already-out");
  }, (supplier) => [approvedRow("pay-done", supplier, 100, { releaseTxHash: "already-out" })]);
});

test("a network failure leaves the payment approved and out of the release hash", async () => {
  await withReleaseApi(async ({ app, token, escrow, store }) => {
    escrow.error = new EscrowClientError(502, RELEASE_FAILED);
    const before = await readDashboard(app, token);
    const response = await releasePayment(app, "pay-ready", token);
    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.json(), { error: RELEASE_FAILED });
    assert.equal(escrow.releases.length, 1);
    const stored = store.readSupplierPayment("pay-ready");
    assert.equal(stored?.status, "approved");
    assert.equal(stored?.releaseTxHash, null);
    assert.equal(stored?.escrowContractId, CONTRACT_ID);
    const after = await readDashboard(app, token);
    assert.deepEqual(after.kpis.payable, before.kpis.payable);
    assert.equal(after.kpis.balance.value, 248420);
    assert.equal(after.upcomingPayments.find((payment) => payment.id === "pay-ready")?.status, "approved");
  }, (supplier) => [approvedRow("pay-ready", supplier, 100)]);
});

test("an unconfirmed release does not mark the payment released", async () => {
  await withReleaseApi(async ({ app, token, escrow, store }) => {
    escrow.released = false;
    escrow.releaseTxHash = null;
    const response = await releasePayment(app, "pay-ready", token);
    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.json(), { error: RELEASE_FAILED });
    const stored = store.readSupplierPayment("pay-ready");
    assert.equal(stored?.status, "approved");
    assert.equal(stored?.releaseTxHash, null);
  }, (supplier) => [approvedRow("pay-ready", supplier, 100)]);
});
