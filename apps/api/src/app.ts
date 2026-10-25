import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { Env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { stellarRoutes } from "./routes/stellar.js";

export async function buildApp(env: Env) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((value) => value.trim()),
  });

  await app.register(healthRoutes);
  await app.register(stellarRoutes(env));

  return app;
}
