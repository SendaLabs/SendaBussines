import { TransactionBuilder } from "@stellar/stellar-sdk";

/** Hash Privy signs. Stellar verifies this exact 32-byte transaction hash. */
export function challengeHashHex(xdr: string, networkPassphrase: string): `0x${string}` {
  const hash = TransactionBuilder.fromXDR(xdr, networkPassphrase).hash();
  const hex = Array.from(Uint8Array.from(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

/** Attach a raw ed25519 signature (hex) and return the signed challenge XDR. */
export function signedChallengeXdr(
  xdr: string,
  networkPassphrase: string,
  publicKey: string,
  signatureHex: string,
): string {
  const hex = signatureHex.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error("No se pudo verificar la firma.");
  }
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  try {
    tx.addSignature(publicKey, hexToBase64(hex));
  } catch {
    throw new Error("No se pudo verificar la firma.");
  }
  return tx.toXDR();
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
