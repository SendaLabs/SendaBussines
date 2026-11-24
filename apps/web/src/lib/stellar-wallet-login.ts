import type { ApiErrorBody, Sep10ChallengeResponse } from "@senda/shared";

/**
 * SEP-10 login with any Stellar wallet.
 *
 * This module knows nothing about React or about a specific wallet: the wallet
 * is injected as a {@link StellarWalletPort} (the Stellar Wallets Kit adapter
 * lives in `stellar-wallets-kit.ts`), and `fetch` is injected too, so every
 * outcome (success, cancellation, connection and signing errors) can be tested
 * without a browser.
 *
 * API contract (unchanged): POST the account to the challenge endpoint, sign the
 * returned transaction with the same wallet, then POST the signed transaction to
 * the token endpoint, which answers 204 and sets the session cookie.
 */

export type WalletLoginPhase = "connecting" | "challenge" | "signing" | "verifying";

export type WalletLoginErrorKind = "no-wallets" | "connect" | "challenge" | "sign" | "token";

export type WalletLoginResult =
  | { status: "success" }
  /** The user closed the wallet selector or rejected a wallet request. No session was created. */
  | { status: "cancelled"; phase: "connecting" | "signing" }
  | { status: "error"; kind: WalletLoginErrorKind; message: string };

export interface StellarWalletPort {
  /** Opens the wallet selector and resolves with the account of the wallet the user picked. */
  connect(): Promise<{ address: string }>;
  /** Signs with the wallet that `connect` selected. */
  signTransaction(
    xdr: string,
    options: { networkPassphrase: string; address: string },
  ): Promise<{ signedTxXdr: string; signerAddress?: string }>;
  /** Forget the selected wallet so the next attempt shows the selector again. Best effort. */
  reset?(): Promise<void> | void;
}

export interface WalletLoginDeps {
  wallet: StellarWalletPort;
  fetch: typeof fetch;
  endpoints: { challenge: string; token: string };
  onPhase?: (phase: WalletLoginPhase) => void;
}

/** Thrown by a wallet port when no wallet can be used at all in this browser. */
export class NoWalletsAvailableError extends Error {
  constructor() {
    super("No Stellar wallets are available.");
    this.name = "NoWalletsAvailableError";
  }
}

export const WALLET_LOGIN_MESSAGES = {
  noWallets:
    "No encontramos billeteras Stellar disponibles en este navegador. Instalá una e intentá de nuevo.",
  connect: "No pudimos conectar la billetera. Intentá de nuevo.",
  challenge: "No se pudo preparar el ingreso.",
  sign: "No se pudo firmar con tu billetera. Intentá de nuevo.",
  signerMismatch: "La firma no corresponde a la cuenta conectada. Intentá de nuevo.",
  token: "No se pudo verificar la firma.",
} as const;

export const WALLET_PHASE_STATUS: Record<WalletLoginPhase, string> = {
  connecting: "Elegí y conectá tu billetera…",
  challenge: "Preparando el ingreso…",
  signing: "Revisá tu billetera y firmá el desafío…",
  verifying: "Verificando la firma…",
};

export const WALLET_CANCELLED_MESSAGE = {
  connecting: "Cerraste el selector de billeteras. No se inició ninguna sesión.",
  signing: "Cancelaste la firma en tu billetera. No se inició ninguna sesión.",
} as const;

export async function loginWithStellarWallet(deps: WalletLoginDeps): Promise<WalletLoginResult> {
  const { wallet, endpoints } = deps;
  const phase = (next: WalletLoginPhase) => deps.onPhase?.(next);

  try {
    phase("connecting");
    let address: string;
    try {
      ({ address } = await wallet.connect());
    } catch (caught) {
      if (caught instanceof NoWalletsAvailableError) {
        return { status: "error", kind: "no-wallets", message: WALLET_LOGIN_MESSAGES.noWallets };
      }
      if (isUserCancellation(caught)) return { status: "cancelled", phase: "connecting" };
      return { status: "error", kind: "connect", message: WALLET_LOGIN_MESSAGES.connect };
    }
    if (!isStellarAccount(address)) {
      return { status: "error", kind: "connect", message: WALLET_LOGIN_MESSAGES.connect };
    }

    phase("challenge");
    let challengeResponse: Response;
    try {
      challengeResponse = await deps.fetch(endpoints.challenge, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: address }),
      });
    } catch {
      return { status: "error", kind: "challenge", message: WALLET_LOGIN_MESSAGES.challenge };
    }
    if (!challengeResponse.ok) {
      return {
        status: "error",
        kind: "challenge",
        message: await readApiError(challengeResponse, WALLET_LOGIN_MESSAGES.challenge),
      };
    }
    const challenge = await readJson(challengeResponse);
    if (!isChallenge(challenge)) {
      return { status: "error", kind: "challenge", message: WALLET_LOGIN_MESSAGES.challenge };
    }

    phase("signing");
    let signed: { signedTxXdr: string; signerAddress?: string };
    try {
      signed = await wallet.signTransaction(challenge.transaction, {
        networkPassphrase: challenge.networkPassphrase,
        address,
      });
    } catch (caught) {
      if (isUserCancellation(caught)) return { status: "cancelled", phase: "signing" };
      return { status: "error", kind: "sign", message: WALLET_LOGIN_MESSAGES.sign };
    }
    if (typeof signed?.signedTxXdr !== "string" || signed.signedTxXdr.length === 0) {
      return { status: "error", kind: "sign", message: WALLET_LOGIN_MESSAGES.sign };
    }
    if (signed.signerAddress && signed.signerAddress !== address) {
      return { status: "error", kind: "sign", message: WALLET_LOGIN_MESSAGES.signerMismatch };
    }

    phase("verifying");
    let tokenResponse: Response;
    try {
      tokenResponse = await deps.fetch(endpoints.token, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transaction: signed.signedTxXdr }),
      });
    } catch {
      return { status: "error", kind: "token", message: WALLET_LOGIN_MESSAGES.token };
    }
    if (tokenResponse.status !== 204) {
      return {
        status: "error",
        kind: "token",
        message: await readApiError(tokenResponse, WALLET_LOGIN_MESSAGES.token),
      };
    }

    return { status: "success" };
  } finally {
    try {
      await wallet.reset?.();
    } catch {
      // Resetting the kit is best effort; it must never mask the login outcome.
    }
  }
}

/**
 * True when a wallet error means the user backed out (closed the selector or
 * rejected a request) rather than something failing.
 *
 * Wallets report errors as `{ code, message }`. By the SEP-43 convention the
 * code `-4` means "rejected by the user". The Wallets Kit reports a closed
 * selector as `{ code: -1, message: "The user closed the modal." }`, and `-1` is
 * also its generic error code, so that case is matched by message. Wallets word
 * their rejection messages differently, hence the pattern.
 */
export function isUserCancellation(error: unknown): boolean {
  const { code, message } = readWalletError(error);
  if (code === -4) return true;
  return CANCELLATION_MESSAGE.test(message);
}

const CANCELLATION_MESSAGE =
  /closed the modal|popup (was )?closed|user (closed|cancel+ed|rejected|declined|denied|refused)|(rejected|declined|denied|cancel+ed|refused) by (the )?user|request (was )?(rejected|declined|cancel+ed|denied)/i;

function readWalletError(error: unknown): { code: number | undefined; message: string } {
  if (typeof error === "string") return { code: undefined, message: error };
  if (typeof error !== "object" || error === null) return { code: undefined, message: "" };
  const record = error as Record<string, unknown>;
  const nested =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : undefined;
  const code = [record.code, nested?.code].find((value) => typeof value === "number");
  const message = [record.message, nested?.message].find((value) => typeof value === "string");
  return {
    code: typeof code === "number" ? code : undefined,
    message: typeof message === "string" ? message : "",
  };
}

/**
 * Lets only one login attempt run at a time. React state updates are
 * asynchronous, so checking `busy` state alone still lets a double click start
 * two attempts in the same tick; this guard closes that gap.
 */
export function createExclusiveRunner() {
  let running = false;
  return {
    get running(): boolean {
      return running;
    },
    async run<T>(task: () => Promise<T>): Promise<{ started: false } | { started: true; value: T }> {
      if (running) return { started: false };
      running = true;
      try {
        return { started: true, value: await task() };
      } finally {
        running = false;
      }
    },
  };
}

function isStellarAccount(value: unknown): value is string {
  return typeof value === "string" && /^G[A-Z2-7]{55}$/.test(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = await readJson(response);
  return isApiError(body) ? body.error : fallback;
}

function isApiError(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  return typeof value.error === "string" && value.error.length > 0;
}

function isChallenge(value: unknown): value is Sep10ChallengeResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.transaction === "string" &&
    record.transaction.length > 0 &&
    typeof record.networkPassphrase === "string" &&
    record.networkPassphrase.length > 0
  );
}
