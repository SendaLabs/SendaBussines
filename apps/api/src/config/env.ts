import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

function isStellarSecret(value: string): boolean {
  try {
    Keypair.fromSecret(value);
    return true;
  } catch {
    return false;
  }
}

function isEd25519PublicKey(value: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(value);
  } catch {
    return false;
  }
}

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
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  STELLAR_ADMIN_PUBLIC: z.string().refine(isEd25519PublicKey, {
    message: "must be a Stellar public key",
  }),
  // Empty in tests and in .env.example. Never sent to the browser and never logged.
  TRUSTLESS_WORK_API_KEY: z.string().default(""),
  TREASURY_SECRET: z.string().default(""),
  SEP10_SIGNING_SECRET: z.string().refine(isStellarSecret, {
    message: "must be a Stellar secret key",
  }),
  SEP10_HOME_DOMAIN: z.string().min(1).default("localhost"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  const signingAccount = Keypair.fromSecret(parsed.data.SEP10_SIGNING_SECRET).publicKey();
  if (signingAccount === parsed.data.STELLAR_ADMIN_PUBLIC) {
    throw new Error("The SEP-10 signing account and the company account must be different.");
  }
  return parsed.data;
}
