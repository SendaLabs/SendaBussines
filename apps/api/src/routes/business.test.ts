import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import type { FastifyInstance } from "fastify";
import {
  API_ROUTES,
  SUPPLIER_PAYMENT_ERRORS,
  type BusinessDashboard,
  type SupplierPaymentCreated,
  type SupplierPaymentInput,
} from "@senda/shared";
import {
  SESSION_COOKIE_NAME,
  SIGN_IN_REQUIRED_ERROR,
  signSession,
} from "../auth/session.js";
import { buildApp } from "../app.js";
import { loadEnv } from "../config/env.js";
import { calendarDateInBuenosAires } from "../dashboard/project.js";
import { createMemoryBusinessStore } from "../store/memory.js";
import { paymentMetadataSha256 } from "../store/payment-metadata.js";

const SESSION_SECRET = "senda-business-session-secret-32";
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

const env = testEnv(Keypair.random().publicKey());

let app: FastifyInstance;
let token: string;

before(async () => {
  app = await buildApp(env, createMemoryBusinessStore());
  token = signSession("GTEST", SESSION_SECRET);
});

after(async () => {
  await app.close();
});

function cookie(value = token): string {
  return `${SESSION_COOKIE_NAME}=${value}`;
}

async function getDashboard(search = "", session: string | null = cookie()) {
  const query = search.length > 0 ? `?${search}` : "";
  return app.inject({
    method: "GET",
    url: `${API_ROUTES.businessDashboard}${query}`,
    headers: session ? { cookie: session } : {},
  });
}

function dashboardOf(response: { statusCode: number; json: () => unknown }): BusinessDashboard {
  assert.equal(response.statusCode, 200);
  return response.json() as BusinessDashboard;
}

test("GET /business/dashboard without a cookie is 401", async () => {
  const response = await getDashboard("", null);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: SIGN_IN_REQUIRED_ERROR });
});

test("a cookie that is not a valid session is 401", async () => {
  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  const otherName = await getDashboard("", `other=${token}`);
  const broken = await getDashboard("", cookie(tampered));
  const expired = signSession("GTEST", SESSION_SECRET, Date.parse("2020-01-01T00:00:00.000Z"));
  const stale = await getDashboard("", cookie(expired));
  assert.equal(otherName.statusCode, 401);
  assert.equal(broken.statusCode, 401);
  assert.equal(stale.statusCode, 401);
});

test("an empty book has no payments and zero snapshots", async () => {
  const body = dashboardOf(await getDashboard("region=global&range=12"));
  assert.equal(body.today, calendarDateInBuenosAires(new Date()));
  assert.equal(body.company.name, "");
  assert.equal(body.company.countries, 0);
  assert.equal(body.user.firstName, "");
  assert.equal(body.kpis.balance.value, 0);
  assert.equal(body.kpis.balance.change, 0);
  assert.deepEqual(body.kpis.payable, { value: 0, invoices: 0 });
  assert.equal(body.upcomingPayments.length, 0);
  assert.equal(body.activity.length, 0);
  assert.equal(body.cashFlow.length, 0);
  assert.equal(body.categories.month, "");
  assert.equal(body.categories.slices.length, 0);
  assert.equal(body.countryVolumes.length, 0);
});

test("region US on an empty book stays empty", async () => {
  const body = dashboardOf(await getDashboard("region=US"));
  assert.deepEqual(body.upcomingPayments, []);
  assert.deepEqual(body.activity, []);
  assert.equal(body.kpis.balance.value, 0);
  assert.deepEqual(body.kpis.payable, { value: 0, invoices: 0 });
  assert.deepEqual(body.countryVolumes, []);
});

test("range 6 on an empty book has no cash flow", async () => {
  const body = dashboardOf(await getDashboard("range=6"));
  assert.deepEqual(body.cashFlow, []);
});

test("categories previous on an empty book sums to zero", async () => {
  const body = dashboardOf(await getDashboard("categories=previous"));
  const total = body.categories.slices.reduce((sum, slice) => sum + slice.amount, 0);
  assert.equal(total, 0);
  assert.equal(body.categories.total, 0);
  assert.equal(body.categories.month, "");
});

test("unknown filters fall back to the defaults", async () => {
  const response = await getDashboard("region=ZZ&range=3&categories=later");
  const body = dashboardOf(response);
  assert.equal(response.statusCode, 200);
  assert.equal(body.upcomingPayments.length, 0);
  assert.equal(body.cashFlow.length, 0);
  assert.equal(body.categories.month, "");
});

const INVALID_ACCOUNT = `G${"A".repeat(55)}`;

function paymentBody(
  supplier: string,
  patch: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    supplierName: "  Taller Norte  ",
    stellarAccount: supplier,
    country: "ES",
    amountUsd: 100,
    dueOn: "2026-10-09",
    ...patch,
  };
}

function hashedInput(supplier: string): SupplierPaymentInput {
  return {
    supplierName: "Taller Norte",
    stellarAccount: supplier,
    country: "ES",
    amountUsd: 100,
    dueOn: "2026-10-09",
  };
}

async function withSupplierApi(
  run: (ctx: {
    app: FastifyInstance;
    admin: string;
    supplier: string;
    token: string;
  }) => Promise<void>,
) {
  const admin = Keypair.random().publicKey();
  const supplier = Keypair.random().publicKey();
  assert.notEqual(admin, supplier);
  const paymentsApp = await buildApp(testEnv(admin), createMemoryBusinessStore());
  try {
    await run({
      app: paymentsApp,
      admin,
      supplier,
      token: signSession("GTEST", SESSION_SECRET),
    });
  } finally {
    await paymentsApp.close();
  }
}

async function postPayment(
  app: FastifyInstance,
  body: Record<string, unknown>,
  session: string | null,
) {
  return app.inject({
    method: "POST",
    url: API_ROUTES.businessSupplierPayments,
    headers: {
      ...(session ? { cookie: `${SESSION_COOKIE_NAME}=${session}` } : {}),
      "content-type": "application/json",
    },
    payload: body,
  });
}

async function readDashboard(app: FastifyInstance, session: string, search = "") {
  const query = search.length > 0 ? `?${search}` : "";
  const response = await app.inject({
    method: "GET",
    url: `${API_ROUTES.businessDashboard}${query}`,
    headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` },
  });
  assert.equal(response.statusCode, 200);
  return response.json() as BusinessDashboard;
}

test("POST /business/supplier-payments without a cookie is 401 and does not write", async () => {
  await withSupplierApi(async ({ app, supplier, token }) => {
    const response = await postPayment(app, paymentBody(supplier), null);
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: SIGN_IN_REQUIRED_ERROR });
    const dashboard = await readDashboard(app, token);
    assert.deepEqual(dashboard.kpis.payable, { value: 0, invoices: 0 });
    assert.equal(dashboard.activity.length, 0);
    assert.equal(dashboard.kpis.balance.value, 0);
  });
});

test("a valid supplier payment is pending and raises payable", async () => {
  await withSupplierApi(async ({ app, supplier, token }) => {
    const response = await postPayment(app, paymentBody(supplier), token);
    assert.equal(response.statusCode, 201);
    const created = response.json() as SupplierPaymentCreated;
    const detail = hashedInput(supplier);

    assert.equal(created.status, "pending");
    assert.equal(created.fundedTxHash, null);
    assert.equal(created.supplierName, "Taller Norte");
    assert.equal(created.stellarAccount, supplier);
    assert.equal(created.country, "ES");
    assert.equal(created.amountUsd, 100);
    assert.equal(created.dueOn, "2026-10-09");
    assert.equal(created.metadataSha256, paymentMetadataSha256(detail));
    assert.match(created.metadataSha256, /^[0-9a-f]{64}$/);
    assert.equal(created.activity.kind, "supplierPayment");
    assert.equal(created.activity.counterparty, "Taller Norte");
    assert.equal(created.activity.amount, -100);
    assert.equal(created.activity.from, "AR");
    assert.equal(created.activity.to, "ES");
    assert.equal(JSON.stringify(created).includes("escrow"), false);

    const dashboard = await readDashboard(app, token);
    assert.deepEqual(dashboard.kpis.payable, { value: 100, invoices: 1 });
    assert.equal(dashboard.kpis.balance.value, 0);
    assert.equal(dashboard.kpis.balance.change, 0);
    assert.equal(dashboard.kpis.spend.value, 0);
    assert.equal(dashboard.kpis.spend.change, 0);
    assert.equal(dashboard.kpis.international.value, 0);
    assert.equal(dashboard.kpis.international.payments, 0);
    assert.deepEqual(
      dashboard.upcomingPayments.map((payment) => payment.supplier),
      ["Taller Norte"],
    );
    const listed = dashboard.upcomingPayments.find((payment) => payment.id === created.id);
    assert.equal(listed?.status, "pending");
    assert.equal(listed?.stellarAccount, supplier);
    assert.equal(listed?.fundedTxHash, null);
    assert.equal(listed && "metadataSha256" in listed, false);
    assert.equal(dashboard.activity[0]?.kind, "supplierPayment");
    assert.equal(dashboard.activity[0]?.counterparty, "Taller Norte");
    assert.equal(dashboard.activity[0]?.amount, -100);
    assert.equal(dashboard.activity[0]?.from, "AR");
    assert.equal(dashboard.activity[0]?.to, "ES");
    assert.equal(dashboard.activity.length, 1);
    assert.equal(dashboard.cashFlow.length, 0);
    assert.deepEqual(dashboard.countryVolumes, []);

    const spain = await readDashboard(app, token, "region=ES");
    assert.deepEqual(
      spain.upcomingPayments.map((payment) => payment.supplier),
      ["Taller Norte"],
    );
    assert.equal(spain.activity[0]?.counterparty, "Taller Norte");
    assert.equal(spain.activity[0]?.from, "AR");
    assert.equal(spain.activity[0]?.to, "ES");
    assert.deepEqual(spain.kpis.payable, { value: 100, invoices: 1 });
    assert.equal(spain.kpis.balance.value, 0);

    const unitedStates = await readDashboard(app, token, "region=US");
    assert.deepEqual(
      unitedStates.upcomingPayments.map((payment) => payment.supplier),
      [],
    );
    assert.equal(
      unitedStates.activity.some((item) => item.counterparty === "Taller Norte"),
      false,
    );
  });
});

test("an invalid account, empty name, zero amount, and empty due date do not write", async () => {
  await withSupplierApi(async ({ app, supplier, token }) => {
    const cases = [
      {
        patch: { stellarAccount: INVALID_ACCOUNT },
        error: SUPPLIER_PAYMENT_ERRORS.stellarAccount,
      },
      {
        patch: { supplierName: "" },
        error: SUPPLIER_PAYMENT_ERRORS.supplierName,
      },
      {
        patch: { supplierName: "   " },
        error: SUPPLIER_PAYMENT_ERRORS.supplierName,
      },
      {
        patch: { amountUsd: 0 },
        error: SUPPLIER_PAYMENT_ERRORS.amountUsd,
      },
      {
        patch: { dueOn: "" },
        error: SUPPLIER_PAYMENT_ERRORS.dueOn,
      },
    ];

    for (const item of cases) {
      const response = await postPayment(app, paymentBody(supplier, item.patch), token);
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json(), { error: item.error });
    }

    const dashboard = await readDashboard(app, token);
    assert.deepEqual(dashboard.kpis.payable, { value: 0, invoices: 0 });
    assert.equal(dashboard.upcomingPayments.length, 0);
    assert.equal(dashboard.activity.length, 0);
    assert.equal(dashboard.kpis.balance.value, 0);
  });
});

test("the company account cannot be the supplier and does not write", async () => {
  await withSupplierApi(async ({ app, admin, supplier, token }) => {
    const response = await postPayment(
      app,
      paymentBody(supplier, { stellarAccount: admin }),
      token,
    );
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: SUPPLIER_PAYMENT_ERRORS.treasury });
    const dashboard = await readDashboard(app, token);
    assert.deepEqual(dashboard.kpis.payable, { value: 0, invoices: 0 });
    assert.equal(dashboard.activity.length, 0);
    assert.equal(dashboard.kpis.balance.value, 0);
  });
});
