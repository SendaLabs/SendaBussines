import { StrKey } from "@stellar/stellar-sdk";
import type { FastifyPluginAsync } from "fastify";
import { API_ROUTES, parseSupplierPayment, type ApiErrorBody } from "@senda/shared";
import { SIGN_IN_REQUIRED_ERROR, sessionFromCookieHeader } from "../auth/session.js";
import type { Env } from "../config/env.js";
import { parseDashboardFilters } from "../dashboard/filters.js";
import { FUND_FAILED, RELEASE_FAILED } from "../escrow/errors.js";
import { fundSupplierPayment, type EscrowFundClient } from "../escrow/fund-supplier-payment.js";
import {
  releaseSupplierMilestone,
  type EscrowReleaseClient,
} from "../escrow/release-supplier-payment.js";
import type { BusinessStore } from "../store/types.js";

export function businessRoutes(
  env: Env,
  store: BusinessStore,
  escrow: EscrowFundClient & EscrowReleaseClient,
): FastifyPluginAsync {
  return async (app) => {
    app.get(API_ROUTES.businessDashboard, async (request, reply) => {
      const session = sessionFromCookieHeader(request.headers.cookie, env.SESSION_SECRET);
      if (!session) {
        return reply.code(401).send({ error: SIGN_IN_REQUIRED_ERROR });
      }

      const query = request.query;
      const filters = parseDashboardFilters(
        query !== null && typeof query === "object" ? (query as Record<string, unknown>) : {},
      );
      return store.getDashboard(filters);
    });

    app.post(API_ROUTES.businessSupplierPayments, async (request, reply) => {
      const session = sessionFromCookieHeader(request.headers.cookie, env.SESSION_SECRET);
      if (!session) {
        return reply.code(401).send(errorBody(SIGN_IN_REQUIRED_ERROR));
      }

      const parsed = parseSupplierPayment(request.body, {
        treasuryAccount: env.STELLAR_ADMIN_PUBLIC,
        isEd25519PublicKey,
      });
      if (!parsed.ok) {
        return reply.code(400).send(errorBody(parsed.error));
      }

      try {
        const created = await store.createSupplierPayment(parsed.value);
        return reply.code(201).send(created);
      } catch (error) {
        request.log.error({ err: error }, "supplier payment was not stored");
        return reply.code(500).send(errorBody("No se pudo registrar el pago."));
      }
    });

    app.post(`${API_ROUTES.businessSupplierPayments}/:id/fund-escrow`, async (request, reply) => {
      const session = sessionFromCookieHeader(request.headers.cookie, env.SESSION_SECRET);
      if (!session) {
        return reply.code(401).send(errorBody(SIGN_IN_REQUIRED_ERROR));
      }

      try {
        const result = await fundSupplierPayment({
          paymentId: readPaymentId(request.params),
          treasuryAccount: env.STELLAR_ADMIN_PUBLIC,
          store,
          escrow,
        });
        return reply.code(result.statusCode).send(result.body);
      } catch (error) {
        request.log.error({ err: error }, "supplier payment was not funded");
        return reply.code(502).send(errorBody(FUND_FAILED));
      }
    });

    app.post(`${API_ROUTES.businessSupplierPayments}/:id/release-milestone`, async (request, reply) => {
      const session = sessionFromCookieHeader(request.headers.cookie, env.SESSION_SECRET);
      if (!session) {
        return reply.code(401).send(errorBody(SIGN_IN_REQUIRED_ERROR));
      }

      try {
        const result = await releaseSupplierMilestone({
          paymentId: readPaymentId(request.params),
          store,
          escrow,
        });
        return reply.code(result.statusCode).send(result.body);
      } catch (error) {
        request.log.error({ err: error }, "supplier milestone was not released");
        return reply.code(502).send(errorBody(RELEASE_FAILED));
      }
    });
  };
}

function isEd25519PublicKey(account: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(account);
  } catch {
    return false;
  }
}

function readPaymentId(params: unknown): string {
  if (typeof params !== "object" || params === null || !("id" in params)) return "";
  return typeof params.id === "string" ? params.id.trim() : "";
}

function errorBody(error: string): ApiErrorBody {
  return { error };
}
