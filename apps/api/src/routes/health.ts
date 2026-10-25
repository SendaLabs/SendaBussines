import type { FastifyPluginAsync } from "fastify";
import type { HealthResponse } from "@senda/shared";
import { API_ROUTES } from "@senda/shared";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(API_ROUTES.health, async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      service: "@senda/api",
      timestamp: new Date().toISOString(),
    };
  });
};
