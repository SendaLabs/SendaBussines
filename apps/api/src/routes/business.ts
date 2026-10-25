import type { FastifyPluginAsync } from "fastify";
import { API_ROUTES } from "@senda/shared";
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
  };
}
