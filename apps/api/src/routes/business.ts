import { StrKey } from "@stellar/stellar-sdk";
import type { FastifyPluginAsync } from "fastify";
import { API_ROUTES, parseSupplierPayment, type ApiErrorBody } from "@senda/shared";
import { SIGN_IN_REQUIRED_ERROR, sessionFromCookieHeader } from "../auth/session.js";
import type { Env } from "../config/env.js";
import { parseDashboardFilters } from "../dashboard/filters.js";
import type { BusinessStore } from "../store/types.js";

export function businessRoutes(env: Env, store: BusinessStore): FastifyPluginAsync {
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
  };
}

function isEd25519PublicKey(account: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(account);
  } catch {
    return false;
  }
}

function errorBody(error: string): ApiErrorBody {
  return { error };
}
