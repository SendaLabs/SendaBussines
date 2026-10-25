import {
  Address,
  FeeBumpTransaction,
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  EscrowClientError,
  SIGN_FAILED,
  TREASURY_MISMATCH,
  TREASURY_MISSING,
} from "./errors.js";

const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

export function isContractId(value: string): boolean {
  return CONTRACT_ID.test(value);
}

/** Loads the treasury key. The secret never leaves this function's stack. */
export function treasuryKeypair(secret: string, adminPublicKey: string): Keypair {
  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(secret);
  } catch {
    throw new EscrowClientError(500, TREASURY_MISSING);
  }
  if (keypair.publicKey() !== adminPublicKey) {
    throw new EscrowClientError(500, TREASURY_MISMATCH);
  }
  return keypair;
}

/**
 * Signs the XDR Trustless Work returned, without rebuilding it.
 * Re-preparing the transaction would change its hash.
 */
export function signUnsignedXdr(
  unsignedXdr: string,
  secret: string,
  adminPublicKey: string,
): string {
  const keypair = treasuryKeypair(secret, adminPublicKey);
  try {
    const transaction = TransactionBuilder.fromXDR(unsignedXdr, Networks.TESTNET);
    assertTreasuryInvocation(transaction, keypair.publicKey());
    transaction.sign(keypair);
    return transaction.toXDR();
  } catch (error) {
    if (error instanceof EscrowClientError) throw error;
    throw new EscrowClientError(502, SIGN_FAILED);
  }
}

/**
 * The treasury signs one contract call and nothing else.
 * setOptions, payments, fee bumps, and any other shape are rejected before sign().
 */
function assertTreasuryInvocation(
  transaction: Transaction | FeeBumpTransaction,
  treasuryPublicKey: string,
): asserts transaction is Transaction {
  if (!(transaction instanceof Transaction)) {
    throw new EscrowClientError(502, SIGN_FAILED);
  }
  if (transaction.source !== treasuryPublicKey) {
    throw new EscrowClientError(502, SIGN_FAILED);
  }
  if (transaction.operations.length !== 1) {
    throw new EscrowClientError(502, SIGN_FAILED);
  }
  const operation = transaction.operations[0];
  if (operation === undefined || operation.type !== "invokeHostFunction") {
    throw new EscrowClientError(502, SIGN_FAILED);
  }
  if (operation.source !== undefined && operation.source !== treasuryPublicKey) {
    throw new EscrowClientError(502, SIGN_FAILED);
  }
}

/** Pulls a C… address out of a Soroban RPC `getTransaction` return value. */
export function contractIdFromReturnValue(returnValue: string): string | null {
  try {
    const scVal = xdr.ScVal.fromXDR(returnValue, "base64");
    return findContractId(scVal);
  } catch {
    return null;
  }
}

function findContractId(scVal: xdr.ScVal): string | null {
  switch (scVal.switch().name) {
    case "scvAddress": {
      const address = Address.fromScVal(scVal).toString();
      return isContractId(address) ? address : null;
    }
    case "scvVec": {
      for (const entry of scVal.vec() ?? []) {
        const found = findContractId(entry);
        if (found) return found;
      }
      return null;
    }
    case "scvMap": {
      for (const entry of scVal.map() ?? []) {
        const found = findContractId(entry.val());
        if (found) return found;
      }
      return null;
    }
    default:
      return null;
  }
}
