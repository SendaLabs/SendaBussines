import {
  FeeBumpTransaction,
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
  WebAuth,
} from "@stellar/stellar-sdk";
import type { Network } from "@senda/shared";
import type { NonceStore } from "./nonce-store.js";

const CHALLENGE_TIMEOUT_SECONDS = 15 * 60;

export function networkPassphraseFor(network: Network): string {
  if (network === "mainnet") return Networks.PUBLIC;
  if (network === "local") return Networks.STANDALONE;
  return Networks.TESTNET;
}

export function createSep10Challenge(input: {
  serverKeypair: Keypair;
  account: string;
  homeDomain: string;
  networkPassphrase: string;
  nonces: NonceStore;
}): { transaction: string; networkPassphrase: string } {
  const transaction = WebAuth.buildChallengeTx(
    input.serverKeypair,
    input.account,
    input.homeDomain,
    CHALLENGE_TIMEOUT_SECONDS,
    input.networkPassphrase,
    input.homeDomain,
  );
  const tx = readTransaction(transaction, input.networkPassphrase);
  input.nonces.remember(challengeNonce(tx), input.account, challengeDeadline(tx));
  return { transaction, networkPassphrase: input.networkPassphrase };
}

export function redeemSep10Challenge(input: {
  transaction: string;
  serverKeypair: Keypair;
  adminAccount: string;
  homeDomain: string;
  networkPassphrase: string;
  nonces: NonceStore;
}): string | null {
  try {
    const serverAccount = input.serverKeypair.publicKey();
    const details = WebAuth.readChallengeTx(
      input.transaction,
      serverAccount,
      input.networkPassphrase,
      input.homeDomain,
      input.homeDomain,
    );
    const account = details.clientAccountID;
    if (account !== input.adminAccount) return null;
    if (!clientSigned(input.transaction, details.tx, account, serverAccount, input)) return null;
    if (!input.nonces.consume(challengeNonce(details.tx), account)) return null;
    return account;
  } catch {
    return null;
  }
}

function clientSigned(
  transaction: string,
  tx: Transaction,
  account: string,
  serverAccount: string,
  input: {
    networkPassphrase: string;
    homeDomain: string;
  },
): boolean {
  if (account !== serverAccount) {
    const signers = WebAuth.verifyChallengeTxSigners(
      transaction,
      serverAccount,
      input.networkPassphrase,
      [account],
      input.homeDomain,
      input.homeDomain,
    );
    return signers.includes(account);
  }

  // The SDK skips a client signer that is also the server key. Locally those
  // accounts may be the same, so the wallet's extra signature is the proof.
  return WebAuth.verifyTxSignedBy(tx, account) && tx.signatures.length >= 2;
}

function readTransaction(xdr: string, networkPassphrase: string): Transaction {
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  if (tx instanceof FeeBumpTransaction) {
    throw new Error("SEP-10 challenge cannot be a fee bump");
  }
  return tx;
}

function challengeNonce(tx: Transaction): string {
  const operation = tx.operations[0];
  if (!operation || operation.type !== "manageData" || operation.value == null) {
    throw new Error("SEP-10 challenge is missing a nonce");
  }
  return Buffer.from(operation.value).toString("utf8");
}

function challengeDeadline(tx: Transaction): number {
  const maxTime = tx.timeBounds?.maxTime;
  const expiresAt = maxTime ? Number(maxTime) * 1000 : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error("SEP-10 challenge is missing a deadline");
  }
  return expiresAt;
}
