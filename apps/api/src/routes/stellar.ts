import type { FastifyPluginAsync } from "fastify";
import type { NetworkInfo } from "@senda/shared";
import { API_ROUTES } from "@senda/shared";
import type { Env } from "../config/env.js";

export function stellarRoutes(env: Env): FastifyPluginAsync {
  return async (app) => {
    app.get(API_ROUTES.network, async (): Promise<NetworkInfo> => {
      return {
        network: env.STELLAR_NETWORK,
        horizonUrl: env.HORIZON_URL,
        sorobanRpcUrl: env.SOROBAN_RPC_URL,
      };
    });
  };
}
