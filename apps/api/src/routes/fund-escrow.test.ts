import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import type { FastifyInstance } from "fastify";
import {
  API_ROUTES,
  supplierPaymentCanBeFunded,
  supplierPaymentFundEscrowPath,
  type BusinessDashboard,
  type SupplierPaymentCreated,
} from "@senda/shared";
import {
  SESSION_COOKIE_NAME,
  SIGN_IN_REQUIRED_ERROR,
  signSession,
} from "../auth/session.js";
import { buildApp } from "../app.js";
import { loadEnv } from "../config/env.js";
import type { DeployEscrowInput, EscrowRecord, FundEscrowInput } from "../escrow/client.js";
import {
  DEPLOY_FAILED,
  EscrowClientError,
  FUND_FAILED,
  TRUSTLINE_REJECTED,
} from "../escrow/errors.js";
import type { EscrowFundClient } from "../escrow/fund-supplier-payment.js";
import { paymentMetadataSha256 } from "../store/payment-metadata.js";
import { DEMO_BOOK } from "../store/seed.js";
import { createMemoryBusinessStore, type MemoryBusinessStore } from "../store/memory.js";
import type { StoredSupplierPayment } from "../store/types.js";

const SESSION_SECRET = "senda-business-session-secret-32";
const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 4));
const FUND_HASH = "fund-tx-test";
const SUPPLIER_NAME = "Taller Norte";

class FakeEscrow implements EscrowFundClient {
  readonly deploys: DeployEscrowInput[] = [];
  readonly funds: FundEscrowInput[] = [];
  deployError: Error | null = null;
  fundError: Error | null = null;
  contractId: string | null = CONTRACT_ID;
  funded = true;

  async deploy(input: DeployEscrowInput): Promise<EscrowRecord> {
    this.deploys.push({ ...input });
    if (this.deployError) throw this.deployError;
    return {
      engagementId: input.engagementId,
      contractId: this.contractId,
      txHash: "deploy-tx",
      fundTxHash: null,
      releaseTxHash: null,
      amount: input.amount,
      funded: false,
      released: false,
      indexerLagging: false,
    };
  }

  async approveAndRelease(): Promise<EscrowRecord> {
    throw new Error("fund tests do not release");
  }

  async fund(input: FundEscrowInput): Promise<EscrowRecord> {
    this.funds.push({ ...input });
    if (this.fundError) throw this.fundError;
    return {
      engagementId: input.engagementId,
      contractId: input.contractId,
      txHash: FUND_HASH,
      fundTxHash: this.funded ? FUND_HASH : null,
      releaseTxHash: null,
      amount: input.amount,
      funded: this.funded,
      released: false,
      indexerLagging: false,
    };
  }
}

function testEnv(adminPublic: string) {
  return loadEnv({
    NODE_ENV: "test",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SECRET_KEY: "test-only-not-a-real-key",
    SESSION_SECRET,
    STELLAR_ADMIN_PUBLIC: adminPublic,
  });
}

function utcMonthShift(delta: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + delta, 15, 12, 0, 0)).toISOString();
}

function pendingRow(
  id: string,
  account: string | null,
  amount: number,
  patch: Partial<StoredSupplierPayment> = {},
): StoredSupplierPayment {
  return {
    id,
    supplier: SUPPLIER_NAME,
    country: "ES",
    amount,
    dueDate: "2026-10-09",
    status: "pending",
    stellarAccount: account,
    fundedTxHash: null,
    metadataSha256: null,
    escrowContractId: null,
    fundTxHash: null,
    releaseTxHash: null,
    fundedAt: null,
    ...patch,
  };
}

async function withFundApi(
  run: (ctx: {
    app: FastifyInstance;
    store: MemoryBusinessStore;
    escrow: FakeEscrow;
    admin: string;
    supplier: string;
    token: string;
  }) => Promise<void>,
  extras: (admin: string, supplier: string) => StoredSupplierPayment[] = () => [],
) {
  const admin = Keypair.random().publicKey();
  const supplier = Keypair.random().publicKey();
  assert.notEqual(admin, supplier);
  const book = structuredClone(DEMO_BOOK);
  book.payments.push(...extras(admin, supplier));
  const store = createMemoryBusinessStore(book);
  const escrow = new FakeEscrow();
  const app = await buildApp(testEnv(admin), store, escrow);
  try {
    await run({
      app,
      store,
      escrow,
      admin,
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

async function postPayment(
  app: FastifyInstance,
  token: string,
  supplier: string,
  amountUsd: number,
) {
  return app.inject({
    method: "POST",
    url: API_ROUTES.businessSupplierPayments,
    headers: {
      cookie: cookie(token),
      "content-type": "application/json",
    },
    payload: {
      supplierName: `  ${SUPPLIER_NAME}  `,
      stellarAccount: supplier,
      country: "ES",
      amountUsd,
      dueOn: "2026-10-09",
    },
  });
}

async function fundPayment(
  app: FastifyInstance,
  id: string,
  token: string | null,
  body?: Record<string, unknown>,
) {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = cookie(token);
  if (body) headers["content-type"] = "application/json";
  return app.inject({
    method: "POST",
    url: supplierPaymentFundEscrowPath(id),
    headers,
    payload: body,
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

function assertDeployOmitsSupplier(input: DeployEscrowInput, id: string, amount: number) {
  assert.equal(input.engagementId, id);
  assert.equal(input.amount, amount);
  assert.equal(typeof input.amount, "number");
  assert.equal(Object.hasOwn(input, "supplierName"), false);
  assert.equal(Object.hasOwn(input, "country"), false);
  const raw = JSON.stringify(input);
  assert.equal(raw.includes(SUPPLIER_NAME), false);
  assert.equal(raw.includes("supplierName"), false);
  assert.equal(raw.includes("Paraguay"), false);
}

test("fund-escrow without a cookie is 401 and does not call Trustless", async () => {
  await withFundApi(async ({ app, supplier, token, escrow, store }) => {
    const created = await createPending(app, token, supplier, 100);
    const response = await fundPayment(app, created.id, null, { supplierName: SUPPLIER_NAME });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: SIGN_IN_REQUIRED_ERROR });
    assert.equal(escrow.deploys.length, 0);
    assert.equal(escrow.funds.length, 0);
    assert.equal(store.readSupplierPayment(created.id)?.status, "pending");
  });
});

test("seed payments cannot be funded from the panel", async () => {
  await withFundApi(async ({ app, token, escrow }) => {
    const dashboard = await readDashboard(app, token);
    assert.equal(dashboard.upcomingPayments.length, 5);
    assert.equal(
      dashboard.upcomingPayments.every((payment) => supplierPaymentCanBeFunded(payment)),
      false,
    );
    const response = await fundPayment(app, "pay-norte", token);
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "El pago no tiene una cuenta Stellar." });
    assert.equal(escrow.deploys.length, 0);
    const scheduled = await fundPayment(app, "pay-rios", token);
    assert.equal(scheduled.statusCode, 409);
    assert.deepEqual(scheduled.json(), { error: "El pago no está pendiente." });
    const missing = await fundPayment(app, "00000000-0000-4000-8000-000000000000", token);
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.json(), { error: "No encontramos ese pago." });
    assert.equal(escrow.deploys.length, 0);
    assert.equal(escrow.funds.length, 0);
  });
});

test("a 100 payment within the 50000 cap is approved and the balance stays 248420", async () => {
  await withFundApi(async ({ app, supplier, token, escrow, store }) => {
    const created = await createPending(app, token, supplier, 100);
    const before = await readDashboard(app, token);
    assert.deepEqual(before.kpis.payable, { value: 10425, invoices: 6 });

    const response = await fundPayment(app, created.id, token, {
      supplierName: SUPPLIER_NAME,
      country: "Paraguay",
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      id: created.id,
      status: "approved",
      escrowContractId: CONTRACT_ID,
      fundTxHash: FUND_HASH,
    });

    const deploy = escrow.deploys[0];
    const funded = escrow.funds[0];
    assert.ok(deploy);
    assert.ok(funded);
    assert.equal(escrow.deploys.length, 1);
    assert.equal(escrow.funds.length, 1);
    assertDeployOmitsSupplier(deploy, created.id, 100);
    assert.equal(funded.engagementId, created.id);
    assert.equal(funded.contractId, CONTRACT_ID);
    assert.equal(funded.amount, 100);
    assert.equal(typeof funded.amount, "number");

    const stored = store.readSupplierPayment(created.id);
    assert.equal(stored?.status, "approved");
    assert.equal(stored?.escrowContractId, CONTRACT_ID);
    assert.equal(stored?.fundTxHash, FUND_HASH);
    assert.equal(stored?.releaseTxHash, null);
    assert.equal(stored?.fundedAt?.slice(0, 7), new Date().toISOString().slice(0, 7));

    const after = await readDashboard(app, token);
    assert.deepEqual(after.kpis, before.kpis);
    assert.equal(after.kpis.balance.value, 248420);
    assert.equal(after.kpis.balance.change, 0.084);
    assert.equal(after.activity.length, before.activity.length);
    const listed = after.upcomingPayments.find((payment) => payment.id === created.id);
    assert.equal(listed?.status, "approved");
    assert.equal(listed?.fundedTxHash, FUND_HASH);
    assert.equal(listed ? supplierPaymentCanBeFunded(listed) : true, false);

    const again = await fundPayment(app, created.id, token);
    assert.equal(again.statusCode, 409);
    assert.deepEqual(again.json(), { error: "El pago no está pendiente." });
    assert.equal(escrow.deploys.length, 1);
    assert.equal(escrow.funds.length, 1);
    assert.equal(store.readSupplierPayment(created.id)?.status, "approved");
  });
});

test("seeded unpaid amounts do not consume the monthly cap", async () => {
  await withFundApi(async ({ app, supplier, token, escrow, store }) => {
    const created = await createPending(app, token, supplier, 40_000);
    const response = await fundPayment(app, created.id, token);
    assert.equal(response.statusCode, 200);
    assert.equal(escrow.deploys.length, 1);
    assert.equal(escrow.funds.length, 1);
    const dashboard = await readDashboard(app, token);
    assert.deepEqual(dashboard.kpis.payable, { value: 50_325, invoices: 6 });
    assert.equal(dashboard.kpis.balance.value, 248420);
    assert.equal(store.readSupplierPayment("pay-nube-austral")?.fundTxHash, null);
    assert.equal(store.readSupplierPayment(created.id)?.status, "approved");
  });
});

test("a payment over the monthly cap returns 409 and does not call Trustless", async () => {
  await withFundApi(async ({ app, supplier, token, escrow, store }) => {
    const created = await createPending(app, token, supplier, 50_001);
    const response = await fundPayment(app, created.id, token, { supplierName: SUPPLIER_NAME });
    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "Este pago supera el tope del mes." });
    assert.equal(escrow.deploys.length, 0);
    assert.equal(escrow.funds.length, 0);
    const stored = store.readSupplierPayment(created.id);
    assert.equal(stored?.status, "pending");
    assert.equal(stored?.escrowContractId, null);
    assert.equal(stored?.fundTxHash, null);
    const dashboard = await readDashboard(app, token);
    assert.equal(dashboard.kpis.balance.value, 248420);
    assert.equal(dashboard.upcomingPayments.find((payment) => payment.id === created.id)?.status, "pending");
  });
});

test("funds already booked this UTC month consume the cap", async () => {
  await withFundApi(
    async ({ app, supplier, token, escrow, store }) => {
      const created = await createPending(app, token, supplier, 100);
      const response = await fundPayment(app, created.id, token);
      assert.equal(response.statusCode, 409);
      assert.deepEqual(response.json(), { error: "Este pago supera el tope del mes." });
      assert.equal(escrow.deploys.length, 0);
      assert.equal(escrow.funds.length, 0);
      assert.equal(store.readSupplierPayment(created.id)?.status, "pending");
    },
    () => [pendingRow("pay-funded-now", null, 50_000, {
      status: "approved",
      fundTxHash: "already-this-month",
      fundedAt: utcMonthShift(0),
    })],
  );
});

test("funds from the previous UTC month do not consume this month's cap", async () => {
  await withFundApi(
    async ({ app, supplier, token, escrow }) => {
      const created = await createPending(app, token, supplier, 100);
      const response = await fundPayment(app, created.id, token);
      assert.equal(response.statusCode, 200);
      assert.equal(escrow.deploys.length, 1);
      assert.equal(escrow.funds.length, 1);
      const deploy = escrow.deploys[0];
      assert.ok(deploy);
      assert.equal(deploy.amount, 100);
      assert.equal(typeof deploy.amount, "number");
    },
    () => [pendingRow("pay-funded-last-month", null, 50_000, {
      status: "approved",
      fundTxHash: "already-last-month",
      fundedAt: utcMonthShift(-1),
    })],
  );
});

test("a supplier account equal to the company account does not call Trustless", async () => {
  await withFundApi(
    async ({ app, admin, token, escrow, store }) => {
      const response = await fundPayment(app, "pay-admin-receiver", token, {
        supplierName: SUPPLIER_NAME,
      });
      assert.equal(response.statusCode, 409);
      assert.deepEqual(response.json(), {
        error: "El proveedor no puede ser la cuenta de la empresa.",
      });
      assert.equal(escrow.deploys.length, 0);
      assert.equal(escrow.funds.length, 0);
      const stored = store.readSupplierPayment("pay-admin-receiver");
      assert.equal(stored?.status, "pending");
      assert.equal(stored?.metadataSha256, null);
      assert.equal(stored?.stellarAccount, admin);
    },
    (admin) => [pendingRow("pay-admin-receiver", admin, 100)],
  );
});

test("a missing metadata hash is stored before deploy and a failed deploy stays pending", async () => {
  await withFundApi(
    async ({ app, supplier, token, escrow, store }) => {
      escrow.deployError = new EscrowClientError(502, DEPLOY_FAILED);
      const response = await fundPayment(app, "pay-no-hash", token, {
        supplierName: SUPPLIER_NAME,
        country: "Paraguay",
      });
      assert.equal(response.statusCode, 502);
      assert.deepEqual(response.json(), { error: DEPLOY_FAILED });
      assert.equal(escrow.deploys.length, 1);
      assert.equal(escrow.funds.length, 0);
      const deploy = escrow.deploys[0];
      assert.ok(deploy);
      assertDeployOmitsSupplier(deploy, "pay-no-hash", 100);
      const stored = store.readSupplierPayment("pay-no-hash");
      assert.equal(stored?.status, "pending");
      assert.equal(stored?.escrowContractId, null);
      assert.equal(stored?.fundTxHash, null);
      assert.equal(
        stored?.metadataSha256,
        paymentMetadataSha256({
          supplierName: SUPPLIER_NAME,
          stellarAccount: supplier,
          country: "ES",
          amountUsd: 100,
          dueOn: "2026-10-09",
        }),
      );
    },
    (_admin, supplier) => [pendingRow("pay-no-hash", supplier, 100)],
  );
});

test("a failed fund leaves the payment pending", async () => {
  await withFundApi(async ({ app, supplier, token, escrow, store }) => {
    escrow.fundError = new EscrowClientError(502, FUND_FAILED);
    const created = await createPending(app, token, supplier, 100);
    const response = await fundPayment(app, created.id, token);
    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.json(), {
      error: "No se pudo fondear el depósito. El pago sigue pendiente.",
    });
    assert.equal(escrow.deploys.length, 1);
    assert.equal(escrow.funds.length, 1);
    const stored = store.readSupplierPayment(created.id);
    assert.equal(stored?.status, "pending");
    assert.equal(stored?.escrowContractId, CONTRACT_ID);
    assert.equal(stored?.fundTxHash, null);
    assert.notEqual(stored?.status, "approved");
    const dashboard = await readDashboard(app, token);
    assert.equal(dashboard.kpis.balance.value, 248420);
    assert.deepEqual(dashboard.kpis.payable, { value: 10425, invoices: 6 });
  });
});

test("a trustline rejection leaves the payment pending", async () => {
  await withFundApi(async ({ app, supplier, token, escrow, store }) => {
    escrow.fundError = new EscrowClientError(422, TRUSTLINE_REJECTED);
    const created = await createPending(app, token, supplier, 100);
    const response = await fundPayment(app, created.id, token);
    assert.equal(response.statusCode, 422);
    assert.deepEqual(response.json(), {
      error: "La cuenta del proveedor tiene que poder recibir USDC de testnet.",
    });
    const stored = store.readSupplierPayment(created.id);
    assert.equal(stored?.status, "pending");
    assert.equal(stored?.escrowContractId, CONTRACT_ID);
    assert.equal(stored?.fundTxHash, null);
  });
});

test("a later call funds the saved contract and does not deploy again", async () => {
  await withFundApi(async ({ app, supplier, token, escrow, store }) => {
    escrow.fundError = new EscrowClientError(502, FUND_FAILED);
    const created = await createPending(app, token, supplier, 100);
    const failed = await fundPayment(app, created.id, token);
    assert.equal(failed.statusCode, 502);
    assert.equal(escrow.deploys.length, 1);
    assert.equal(escrow.funds.length, 1);
    assert.equal(store.readSupplierPayment(created.id)?.status, "pending");
    assert.equal(store.readSupplierPayment(created.id)?.escrowContractId, CONTRACT_ID);
    assert.equal(store.readSupplierPayment(created.id)?.fundTxHash, null);

    escrow.fundError = null;
    const response = await fundPayment(app, created.id, token, {
      supplierName: SUPPLIER_NAME,
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      id: created.id,
      status: "approved",
      escrowContractId: CONTRACT_ID,
      fundTxHash: FUND_HASH,
    });
    assert.equal(escrow.deploys.length, 1);
    assert.equal(escrow.funds.length, 2);
    assert.equal(escrow.funds[1]?.contractId, CONTRACT_ID);
    assert.equal(escrow.funds[1]?.engagementId, created.id);

    const stored = store.readSupplierPayment(created.id);
    assert.equal(stored?.status, "approved");
    assert.equal(stored?.escrowContractId, CONTRACT_ID);
    assert.equal(stored?.fundTxHash, FUND_HASH);
    const dashboard = await readDashboard(app, token);
    const listed = dashboard.upcomingPayments.find((payment) => payment.id === created.id);
    assert.equal(listed?.fundedTxHash, FUND_HASH);
    assert.equal(dashboard.kpis.balance.value, 248420);
    assert.deepEqual(dashboard.kpis.payable, { value: 10425, invoices: 6 });
  });
});

async function createPending(
  app: FastifyInstance,
  token: string,
  supplier: string,
  amountUsd: number,
): Promise<SupplierPaymentCreated> {
  const response = await postPayment(app, token, supplier, amountUsd);
  assert.equal(response.statusCode, 201);
  return response.json() as SupplierPaymentCreated;
}
