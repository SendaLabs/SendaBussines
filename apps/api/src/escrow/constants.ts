/** Trustless Work protocol v2 beta. v1 hosts are dev.api and api.trustlesswork.com. */
export const TRUSTLESS_WORK_HOST = "https://beta.api.trustlesswork.com";

/**
 * platformFee is 0.
 *
 * The multi-release v2 swagger
 * (https://beta.api.trustlesswork.com/api/multi-release/v2-json, also
 * published at https://beta.api.trustlesswork.com/docs) types `platformFee`
 * as a number and declares no minimum. Its example value of 1 means 1%.
 * The v2 error catalog only rejects a fee that is too high:
 * `ESCROW_PLATFORM_FEE_TOO_HIGH` above 99%, and `PLATFORM_FEE_TOO_HIGH` when
 * the fee plus the Trustless Work fee would exceed 100%. Zero is inside that
 * contract, so this client sends 0 and does not borrow a fee from v1.
 */
export const PLATFORM_FEE = 0;

/** Circle USDC on Stellar testnet. Goes in `trustline.address`, not a SAC id. */
export const USDC_TESTNET_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/** Public ledger copy. Must not include the supplier name or country. */
export const ESCROW_TITLE = "Cuenta por pagar";
export const ESCROW_DESCRIPTION = "Pago";

export const PATHS = {
  deploy: "/escrow/multi-release/v2/deploy",
  fund: "/escrow/multi-release/v2/fund",
  approveAndRelease: "/escrow/multi-release/v2/approve-and-release-milestones",
  sendTransaction: "/stellar/send-transaction",
} as const;

export const SUBMITTED = "STELLAR_TX_SUBMITTED";
export const INDEXER_LAGGING = "STELLAR_TX_SUBMITTED_INDEXER_LAGGING";
