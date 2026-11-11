import Privy, { LocalStorage, create, rawSign } from "@privy-io/js-sdk-core";
import type { User } from "@privy-io/api-types";

import { challengeHashHex, signedChallengeXdr } from "@/lib/attach-sep10-signature";
import { BUSINESS_API } from "@/lib/business-api";
import { BUSINESS_LOGIN_PATH } from "@/lib/site";

const PREPARE_FAILED = "No se pudo preparar el ingreso.";
const SIGNATURE_FAILED = "No se pudo verificar la firma.";

let client: Privy | null = null;
let ready: Promise<Privy> | null = null;
let signerReady: Promise<void> | null = null;

export function privyAppId(): string | null {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  return appId ? appId : null;
}

export async function startGoogleLogin(): Promise<void> {
  const privy = await loadPrivy();
  const redirect = await privy.auth.oauth.generateURL("google", redirectUri());
  window.location.assign(redirect.url);
}

export async function completeGoogleLogin(code: string, state: string): Promise<void> {
  const privy = await loadPrivy();
  const session = await privy.auth.oauth.loginWithCode(code, state, "google");
  const wallet = await stellarWallet(privy, session.user);
  await connectSigner(privy);
  await exchangeSep10(wallet.address, async (transaction, networkPassphrase) => {
    const signed = await rawSign(
      walletContext(privy),
      (input) => privy.embeddedWallet.signWithUserSigner(input),
      {
        wallet_id: wallet.id,
        params: { hash: challengeHashHex(transaction, networkPassphrase) },
      },
    );
    return signedChallengeXdr(
      transaction,
      networkPassphrase,
      wallet.address,
      signed.data.signature,
    );
  });
}

export function googleLoginMessage(error: unknown): string | null {
  const text = errorText(error);
  if (text.includes("denied") || text.includes("cancel")) return null;
  if (text.includes("not allowed")) {
    return "En el panel de Privy activá Google como método de ingreso.";
  }
  return "No pudimos entrar con Google.";
}

function redirectUri(): string {
  return `${window.location.origin}${BUSINESS_LOGIN_PATH}`;
}

function loadPrivy(): Promise<Privy> {
  const appId = privyAppId();
  if (!appId) throw new Error("Falta el App ID de Privy.");
  if (!client) {
    client = new Privy({ appId, storage: new LocalStorage() });
  }
  const current = client;
  ready ??= current.initialize().then(() => current);
  return ready;
}

function walletContext(privy: Privy) {
  return {
    fetchPrivyRoute: privy.fetchPrivyRoute.bind(privy),
    getCompiledPath: privy.getCompiledPath.bind(privy),
    app: { appId: privy.app.appId },
  };
}

async function stellarWallet(privy: Privy, user: User): Promise<{ id: string; address: string }> {
  const existing = findStellarWallet(user);
  if (existing) return existing;
  const created = await create(walletContext(privy), { request: { chain_type: "stellar" } });
  if (!created.id || !created.address) throw new Error("No pudimos preparar la billetera.");
  return { id: created.id, address: created.address };
}

function findStellarWallet(user: User): { id: string; address: string } | null {
  for (const account of user.linked_accounts) {
    if (account.type !== "wallet" || account.chain_type !== "stellar") continue;
    if (!account.address || !account.id) continue;
    return { id: account.id, address: account.address };
  }
  return null;
}

function connectSigner(privy: Privy): Promise<void> {
  signerReady ??= new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.hidden = true;
    iframe.title = "Privy";
    iframe.src = privy.embeddedWallet.getURL();
    iframe.onload = () => resolve();
    document.body.appendChild(iframe);
    privy.setMessagePoster({
      postMessage: (message, targetOrigin, transfer) => {
        iframe.contentWindow?.postMessage(message, targetOrigin, transfer ? [transfer] : undefined);
      },
      reload: () => {
        iframe.contentWindow?.location.reload();
      },
    });
    window.addEventListener("message", (event) => {
      if (event.source !== iframe.contentWindow) return;
      const data = typeof event.data === "string" ? safeJson(event.data) : event.data;
      if (!data || typeof data !== "object") return;
      privy.embeddedWallet.onMessage(data as Parameters<Privy["embeddedWallet"]["onMessage"]>[0]);
    });
  });
  return signerReady;
}

async function exchangeSep10(
  account: string,
  sign: (transaction: string, networkPassphrase: string) => Promise<string>,
): Promise<void> {
  const challengeResponse = await fetch(BUSINESS_API.sep10Challenge, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account }),
  });
  if (!challengeResponse.ok) {
    throw new Error(await readError(challengeResponse, PREPARE_FAILED));
  }
  const challenge: unknown = await challengeResponse.json();
  if (!isChallenge(challenge)) throw new Error(PREPARE_FAILED);
  const signedXdr = await sign(challenge.transaction, challenge.networkPassphrase);
  const tokenResponse = await fetch(BUSINESS_API.sep10Token, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: signedXdr }),
  });
  if (tokenResponse.status !== 204) {
    throw new Error(await readError(tokenResponse, SIGNATURE_FAILED));
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.error === "string" && body.error.length > 0) return body.error;
  } catch {
    return fallback;
  }
  return fallback;
}

function isChallenge(value: unknown): value is { transaction: string; networkPassphrase: string } {
  if (!isRecord(value)) return false;
  return (
    typeof value.transaction === "string" &&
    value.transaction.length > 0 &&
    typeof value.networkPassphrase === "string" &&
    value.networkPassphrase.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error).toLowerCase();
}
