import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { Env } from "./config/env.js";
import { createTrustlessWorkClientFromEnv } from "./escrow/client.js";
import type { EscrowFundClient } from "./escrow/fund-supplier-payment.js";
import { businessRoutes } from "./routes/business.js";
import { healthRoutes } from "./routes/health.js";
import { stellarRoutes } from "./routes/stellar.js";
import type { BusinessStore } from "./store/types.js";

export async function buildApp(
  env: Env,
  store: BusinessStore,
  escrow: EscrowFundClient = createTrustlessWorkClientFromEnv(env),
) {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : { level: env.NODE_ENV === "production" ? "info" : "debug" },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((value) => value.trim()),
  });

  await app.register(healthRoutes);
  await app.register(stellarRoutes(env));
  await app.register(businessRoutes(env, store, escrow));

  return app;
}
