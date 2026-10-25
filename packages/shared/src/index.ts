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
} as const;
