import { Keypair } from "@stellar/stellar-sdk";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  STELLAR_NETWORK: z.enum(["local", "testnet", "mainnet"]).default("testnet"),
  HORIZON_URL: z.string().url().default("https://horizon-testnet.stellar.org"),
  SOROBAN_RPC_URL: z
    .string()
    .url()
    .default("https://soroban-testnet.stellar.org"),
  // Empty in tests and in .env.example. Never sent to the browser and never logged.
  TRUSTLESS_WORK_API_KEY: z.string().default(""),
  TREASURY_SECRET: z.string().default(""),
  STELLAR_ADMIN_PUBLIC: z.string().default(""),
  // Local secrets only. Public keys are derived in loadEnv.
  ESCROW_ADMIN_SECRET: z.string().default(""),
  ESCROW_DISPUTE_RESOLVER_SECRET: z.string().default(""),
});

type EnvInput = z.infer<typeof envSchema>;

export type Env = EnvInput & {
  escrowAdminPublicKey: string;
  escrowDisputeResolverPublicKey: string;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }

  const escrowAdminPublicKey = publicKeyFromSecret(
    parsed.data.ESCROW_ADMIN_SECRET,
    "ESCROW_ADMIN_SECRET",
  );
  const escrowDisputeResolverPublicKey = publicKeyFromSecret(
    parsed.data.ESCROW_DISPUTE_RESOLVER_SECRET,
    "ESCROW_DISPUTE_RESOLVER_SECRET",
  );
  assertDistinctEscrowRoles(
    parsed.data.STELLAR_ADMIN_PUBLIC,
    escrowAdminPublicKey,
    escrowDisputeResolverPublicKey,
  );

  return {
    ...parsed.data,
    escrowAdminPublicKey,
    escrowDisputeResolverPublicKey,
  };
}

/** Empty stays empty. A non-empty value must be a Stellar secret; the secret is not echoed. */
function publicKeyFromSecret(secret: string, name: string): string {
  const trimmed = secret.trim();
  if (trimmed === "") return "";
  try {
    return Keypair.fromSecret(trimmed).publicKey();
  } catch {
    throw new Error(`Invalid environment: ${name} is not a Stellar secret key`);
  }
}

/**
 * v2 rejects an escrow admin or dispute resolver that matches another role.
 * Those two accounts can change a funded escrow or send the remaining funds.
 */
function assertDistinctEscrowRoles(
  treasuryPublic: string,
  escrowAdminPublicKey: string,
  escrowDisputeResolverPublicKey: string,
): void {
  const treasury = treasuryPublic.trim();
  if (escrowAdminPublicKey !== "" && escrowAdminPublicKey === treasury) {
    throw new Error(
      "Invalid environment: ESCROW_ADMIN_SECRET public key equals STELLAR_ADMIN_PUBLIC",
    );
  }
  if (escrowDisputeResolverPublicKey !== "" && escrowDisputeResolverPublicKey === treasury) {
    throw new Error(
      "Invalid environment: ESCROW_DISPUTE_RESOLVER_SECRET public key equals STELLAR_ADMIN_PUBLIC",
    );
  }
  if (
    escrowAdminPublicKey !== "" &&
    escrowDisputeResolverPublicKey !== "" &&
    escrowAdminPublicKey === escrowDisputeResolverPublicKey
  ) {
    throw new Error(
      "Invalid environment: ESCROW_ADMIN_SECRET and ESCROW_DISPUTE_RESOLVER_SECRET derive the same public key",
    );
  }
}
