export {
  TrustlessWorkClient,
  createTrustlessWorkClient,
  createTrustlessWorkClientFromEnv,
} from "./client.js";
export type {
  DeployEscrowInput,
  EscrowRecord,
  FundEscrowInput,
  ReleaseEscrowInput,
  TrustlessWorkClientOptions,
} from "./client.js";
export {
  ESCROW_DESCRIPTION,
  ESCROW_TITLE,
  PLATFORM_FEE,
  TRUSTLESS_WORK_HOST,
  USDC_TESTNET_ISSUER,
} from "./constants.js";
export { EscrowClientError } from "./errors.js";
