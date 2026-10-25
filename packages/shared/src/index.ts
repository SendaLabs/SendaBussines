export type Network = "local" | "testnet" | "mainnet";

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
}

export interface NetworkInfo {
  network: Network;
  horizonUrl: string;
  sorobanRpcUrl: string;
}

export const API_ROUTES = {
  health: "/health",
  network: "/stellar/network",
  sep10Challenge: "/business/sep10/challenge",
  sep10Token: "/business/sep10/token",
  businessSession: "/business/session",
} as const;

export const SESSION_COOKIE = "senda_session";

export interface Sep10ChallengeResponse {
  transaction: string;
  networkPassphrase: string;
}

export interface BusinessSessionResponse {
  account: string;
}

export interface ApiErrorBody {
  error: string;
}
