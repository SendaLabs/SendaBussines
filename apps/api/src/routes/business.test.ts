import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { API_ROUTES, type BusinessDashboard } from "@senda/shared";
import {
  SESSION_COOKIE_NAME,
  SIGN_IN_REQUIRED_ERROR,
  signSession,
} from "../auth/session.js";
import { buildApp } from "../app.js";
import { loadEnv } from "../config/env.js";
import { calendarDateInBuenosAires } from "../dashboard/project.js";
import { createMemoryBusinessStore } from "../store/memory.js";

const SESSION_SECRET = "senda-business-session-secret-32";

const env = loadEnv({
  NODE_ENV: "test",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SECRET_KEY: "test-only-not-a-real-key",
  SESSION_SECRET,
});

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

test("global range 12 returns the full seeded book", async () => {
  const body = dashboardOf(await getDashboard("region=global&range=12"));
  assert.equal(body.today, calendarDateInBuenosAires(new Date()));
  assert.equal(body.company.name, "Empresa Demo S.R.L.");
  assert.equal(body.company.countries, 4);
  assert.equal(body.user.firstName, "Delfina");
  assert.equal(body.kpis.balance.value, 248420);
  assert.equal(body.kpis.balance.change, 0.084);
  assert.deepEqual(body.kpis.payable, { value: 10325, invoices: 5 });
  assert.equal(body.upcomingPayments.length, 5);
  assert.deepEqual(
    body.upcomingPayments.map((payment) => payment.supplier),
    [
      "Nube Austral Hosting",
      "Estudio Contable Ríos",
      "Pixel Sur Diseño",
      "Transportes Pacífico",
      "Agencia Norte Media",
    ],
  );
  assert.equal(body.upcomingPayments[0]?.stellarAccount, null);
  assert.equal(body.upcomingPayments[0]?.fundedTxHash, null);
  assert.equal(body.activity.length, 4);
  assert.equal(body.cashFlow.length, 12);
  assert.equal(body.cashFlow[0]?.month, "2025-11");
  assert.equal(body.cashFlow[11]?.month, "2026-10");
  assert.equal(body.categories.month, "2026-10");
  assert.equal(body.countryVolumes.length, 4);
});

test("region US filters payments, activity, and volume, not the balance or payable", async () => {
  const body = dashboardOf(await getDashboard("region=US"));
  assert.deepEqual(
    body.upcomingPayments.map((payment) => payment.supplier),
    ["Nube Austral Hosting"],
  );
  assert.deepEqual(
    body.activity.map((item) => item.counterparty),
    ["Transportes Pacífico", "Cliente Delta Retail", "Nube Austral Hosting"],
  );
  assert.ok(body.activity.every((item) => item.from === "US" || item.to === "US"));
  assert.equal(body.kpis.balance.value, 248420);
  assert.deepEqual(body.kpis.payable, { value: 10325, invoices: 5 });
  assert.deepEqual(body.countryVolumes, [{ country: "US", amount: 51000 }]);
});

test("range 6 returns May through October 2026", async () => {
  const body = dashboardOf(await getDashboard("range=6"));
  assert.deepEqual(
    body.cashFlow.map((point) => point.month),
    ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
  );
  assert.equal(body.cashFlow[0]?.income, 51000);
  assert.equal(body.cashFlow[5]?.expenses, 38000);
});

test("categories previous sums the September slices", async () => {
  const body = dashboardOf(await getDashboard("categories=previous"));
  const total = body.categories.slices.reduce((sum, slice) => sum + slice.amount, 0);
  assert.equal(total, 5050 + 4300 + 3800 + 2900 + 1840 + 1200);
  assert.equal(body.categories.total, total);
  assert.equal(body.categories.month, "2026-09");
});

test("unknown filters fall back to the defaults", async () => {
  const response = await getDashboard("region=ZZ&range=3&categories=later");
  const body = dashboardOf(response);
  assert.equal(response.statusCode, 200);
  assert.equal(body.upcomingPayments.length, 5);
  assert.equal(body.cashFlow.length, 12);
  assert.equal(body.categories.month, "2026-10");
});
