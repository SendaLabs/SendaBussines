import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createExclusiveRunner,
  isUserCancellation,
  loginWithStellarWallet,
  NoWalletsAvailableError,
  WALLET_LOGIN_MESSAGES,
  type StellarWalletPort,
  type WalletLoginPhase,
} from "./stellar-wallet-login";

const ACCOUNT = `G${"A".repeat(55)}`;
const OTHER_ACCOUNT = `G${"B".repeat(55)}`;
const PASSPHRASE = "Test SDF Network ; September 2015";
const ENDPOINTS = { challenge: "/senda-api/auth/challenge", token: "/senda-api/auth/token" };
const CHALLENGE = { transaction: "CHALLENGE_XDR", networkPassphrase: PASSPHRASE };

type Call = { url: string; init: RequestInit | undefined };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function fakeFetch(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra request");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { impl, calls };
}

function fakeWallet(overrides: Partial<StellarWalletPort> = {}) {
  const log: string[] = [];
  const signed: Array<{ xdr: string; options: { networkPassphrase: string; address: string } }> = [];
  const wallet: StellarWalletPort = {
    async connect() {
      log.push("connect");
      return { address: ACCOUNT };
    },
    async signTransaction(xdr, options) {
      log.push("sign");
      signed.push({ xdr, options });
      return { signedTxXdr: "SIGNED_XDR", signerAddress: options.address };
    },
    async reset() {
      log.push("reset");
    },
    ...overrides,
  };
  return { wallet, log, signed };
}

function run(wallet: StellarWalletPort, responses: Array<Response | Error>) {
  const { impl, calls } = fakeFetch(responses);
  const phases: WalletLoginPhase[] = [];
  const result = loginWithStellarWallet({
    wallet,
    fetch: impl,
    endpoints: ENDPOINTS,
    onPhase: (phase) => phases.push(phase),
  });
  return { result, calls, phases };
}

describe("loginWithStellarWallet: success", () => {
  it("connects, requests the challenge for that account, signs with the same wallet and posts the signed transaction", async () => {
    const { wallet, log, signed } = fakeWallet();
    const { result, calls, phases } = run(wallet, [json(CHALLENGE), new Response(null, { status: 204 })]);

    assert.deepEqual(await result, { status: "success" });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, ENDPOINTS.challenge);
    assert.equal(calls[0].init?.method, "POST");
    assert.equal(calls[0].init?.credentials, "include");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { account: ACCOUNT });

    assert.deepEqual(signed, [
      { xdr: "CHALLENGE_XDR", options: { networkPassphrase: PASSPHRASE, address: ACCOUNT } },
    ]);

    assert.equal(calls[1].url, ENDPOINTS.token);
    assert.equal(calls[1].init?.credentials, "include");
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { transaction: "SIGNED_XDR" });

    assert.deepEqual(phases, ["connecting", "challenge", "signing", "verifying"]);
    assert.deepEqual(log, ["connect", "sign", "reset"]);
  });

  it("uses the account the user picked in the selector, whichever wallet it came from", async () => {
    const { wallet, signed } = fakeWallet({
      async connect() {
        return { address: OTHER_ACCOUNT };
      },
    });
    const { result, calls } = run(wallet, [json(CHALLENGE), new Response(null, { status: 204 })]);

    assert.deepEqual(await result, { status: "success" });
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { account: OTHER_ACCOUNT });
    assert.equal(signed[0].options.address, OTHER_ACCOUNT);
  });

  it("accepts wallets that do not report a signer address", async () => {
    const { wallet } = fakeWallet({
      async signTransaction() {
        return { signedTxXdr: "SIGNED_XDR" };
      },
    });
    const { result } = run(wallet, [json(CHALLENGE), new Response(null, { status: 204 })]);
    assert.deepEqual(await result, { status: "success" });
  });

  it("can be retried after a failure and then succeeds", async () => {
    const { wallet } = fakeWallet();
    const first = await run(wallet, [json({ error: "boom" }, 500)]).result;
    assert.equal(first.status, "error");

    const second = await run(wallet, [json(CHALLENGE), new Response(null, { status: 204 })]).result;
    assert.deepEqual(second, { status: "success" });
  });
});

describe("loginWithStellarWallet: cancellation", () => {
  it("treats closing the wallet selector as a cancellation and creates no session", async () => {
    const { wallet, log } = fakeWallet({
      async connect() {
        throw { code: -1, message: "The user closed the modal." };
      },
    });
    const { result, calls, phases } = run(wallet, []);

    assert.deepEqual(await result, { status: "cancelled", phase: "connecting" });
    assert.equal(calls.length, 0, "no request may be sent");
    assert.deepEqual(phases, ["connecting"]);
    assert.deepEqual(log, ["reset"], "the kit is reset so the selector shows again next time");
  });

  it("treats a rejected connection request as a cancellation", async () => {
    const { wallet } = fakeWallet({
      async connect() {
        throw { code: -4, message: "User declined access" };
      },
    });
    const { result, calls } = run(wallet, []);
    assert.deepEqual(await result, { status: "cancelled", phase: "connecting" });
    assert.equal(calls.length, 0);
  });

  it("treats a rejected signature as a cancellation and never calls the token endpoint", async () => {
    const { wallet } = fakeWallet({
      async signTransaction() {
        throw { code: -4, message: "The user rejected this request." };
      },
    });
    const { result, calls } = run(wallet, [json(CHALLENGE)]);

    assert.deepEqual(await result, { status: "cancelled", phase: "signing" });
    assert.equal(calls.length, 1, "only the challenge request was made");
    assert.equal(calls[0].url, ENDPOINTS.challenge);
  });

  it("recognises wallet-specific rejection wording", async () => {
    const { wallet } = fakeWallet({
      async signTransaction() {
        throw new Error("Request rejected by user");
      },
    });
    const { result } = run(wallet, [json(CHALLENGE)]);
    assert.deepEqual(await result, { status: "cancelled", phase: "signing" });
  });
});

describe("loginWithStellarWallet: connection errors", () => {
  it("reports a failed connection and sends no request", async () => {
    const { wallet } = fakeWallet({
      async connect() {
        throw { code: -2, message: "Wallet is locked" };
      },
    });
    const { result, calls } = run(wallet, []);

    assert.deepEqual(await result, {
      status: "error",
      kind: "connect",
      message: WALLET_LOGIN_MESSAGES.connect,
    });
    assert.equal(calls.length, 0);
  });

  it("reports when no wallets are available", async () => {
    const { wallet } = fakeWallet({
      async connect() {
        throw new NoWalletsAvailableError();
      },
    });
    const { result, calls } = run(wallet, []);

    assert.deepEqual(await result, {
      status: "error",
      kind: "no-wallets",
      message: WALLET_LOGIN_MESSAGES.noWallets,
    });
    assert.equal(calls.length, 0);
  });

  it("does not mention a specific wallet in any user-facing message", () => {
    for (const message of Object.values(WALLET_LOGIN_MESSAGES)) {
      assert.doesNotMatch(message, /freighter/i);
    }
  });

  it("rejects an account that is not a Stellar public key", async () => {
    const { wallet, signed } = fakeWallet({
      async connect() {
        return { address: "not-an-account" };
      },
    });
    const { result, calls } = run(wallet, []);

    assert.equal((await result).status, "error");
    assert.equal(calls.length, 0);
    assert.equal(signed.length, 0);
  });

  it("reports a failing challenge request with the API's message", async () => {
    const { wallet } = fakeWallet();
    const { result } = run(wallet, [json({ error: "Cuenta no permitida." }, 400)]);

    assert.deepEqual(await result, { status: "error", kind: "challenge", message: "Cuenta no permitida." });
  });

  it("falls back to a generic message when the challenge error has no readable body", async () => {
    const { wallet } = fakeWallet();
    const { result } = run(wallet, [new Response("<html>bad gateway</html>", { status: 502 })]);

    assert.deepEqual(await result, {
      status: "error",
      kind: "challenge",
      message: WALLET_LOGIN_MESSAGES.challenge,
    });
  });

  it("rejects a malformed challenge before asking the wallet to sign", async () => {
    const { wallet, signed } = fakeWallet();
    const { result } = run(wallet, [json({ transaction: "XDR" })]);

    assert.equal((await result).status, "error");
    assert.equal(signed.length, 0);
  });

  it("reports a network failure while fetching the challenge", async () => {
    const { wallet } = fakeWallet();
    const { result } = run(wallet, [new TypeError("Failed to fetch")]);

    assert.deepEqual(await result, {
      status: "error",
      kind: "challenge",
      message: WALLET_LOGIN_MESSAGES.challenge,
    });
  });
});

describe("loginWithStellarWallet: signing errors", () => {
  it("reports a wallet that fails to sign and never calls the token endpoint", async () => {
    const { wallet } = fakeWallet({
      async signTransaction() {
        throw { code: -3, message: "Invalid transaction" };
      },
    });
    const { result, calls } = run(wallet, [json(CHALLENGE)]);

    assert.deepEqual(await result, { status: "error", kind: "sign", message: WALLET_LOGIN_MESSAGES.sign });
    assert.equal(calls.length, 1);
  });

  it("reports an empty signature", async () => {
    const { wallet } = fakeWallet({
      async signTransaction() {
        return { signedTxXdr: "" };
      },
    });
    const { result, calls } = run(wallet, [json(CHALLENGE)]);

    assert.deepEqual(await result, { status: "error", kind: "sign", message: WALLET_LOGIN_MESSAGES.sign });
    assert.equal(calls.length, 1);
  });

  it("rejects a signature made by a different account than the one connected", async () => {
    const { wallet } = fakeWallet({
      async signTransaction() {
        return { signedTxXdr: "SIGNED_XDR", signerAddress: OTHER_ACCOUNT };
      },
    });
    const { result, calls } = run(wallet, [json(CHALLENGE)]);

    assert.deepEqual(await result, {
      status: "error",
      kind: "sign",
      message: WALLET_LOGIN_MESSAGES.signerMismatch,
    });
    assert.equal(calls.length, 1);
  });

  it("reports the API's message when the token endpoint rejects the signature", async () => {
    const { wallet } = fakeWallet();
    const { result } = run(wallet, [json(CHALLENGE), json({ error: "Firma inválida." }, 401)]);

    assert.deepEqual(await result, { status: "error", kind: "token", message: "Firma inválida." });
  });

  it("only accepts 204 from the token endpoint", async () => {
    const { wallet } = fakeWallet();
    const { result } = run(wallet, [json(CHALLENGE), json({}, 200)]);

    assert.deepEqual(await result, { status: "error", kind: "token", message: WALLET_LOGIN_MESSAGES.token });
  });

  it("reports a network failure while posting the signature", async () => {
    const { wallet } = fakeWallet();
    const { result } = run(wallet, [json(CHALLENGE), new TypeError("Failed to fetch")]);

    assert.deepEqual(await result, { status: "error", kind: "token", message: WALLET_LOGIN_MESSAGES.token });
  });
});

describe("loginWithStellarWallet: cleanup", () => {
  it("resets the wallet after every outcome", async () => {
    const outcomes: Array<Partial<StellarWalletPort>> = [
      {},
      {
        async connect() {
          throw { code: -4, message: "no" };
        },
      },
      {
        async signTransaction() {
          throw new Error("broken");
        },
      },
    ];
    for (const overrides of outcomes) {
      const { wallet, log } = fakeWallet(overrides);
      await run(wallet, [json(CHALLENGE), new Response(null, { status: 204 })]).result;
      assert.equal(log.at(-1), "reset");
    }
  });

  it("does not let a failing reset change the outcome", async () => {
    const { wallet } = fakeWallet({
      async reset() {
        throw new Error("disconnect failed");
      },
    });
    const { result } = run(wallet, [json(CHALLENGE), new Response(null, { status: 204 })]);
    assert.deepEqual(await result, { status: "success" });
  });
});

describe("isUserCancellation", () => {
  it("recognises SEP-43 user rejections and a closed selector", () => {
    assert.equal(isUserCancellation({ code: -4, message: "whatever" }), true);
    assert.equal(isUserCancellation({ code: -1, message: "The user closed the modal." }), true);
    assert.equal(isUserCancellation({ error: { code: -4, message: "x" } }), true);
    assert.equal(isUserCancellation("User declined the request"), true);
    assert.equal(isUserCancellation(new Error("Rejected by user")), true);
    assert.equal(isUserCancellation(new Error("The popup was closed")), true);
  });

  it("does not treat real failures as cancellations", () => {
    assert.equal(isUserCancellation({ code: -1, message: "No wallet has been connected." }), false);
    assert.equal(isUserCancellation({ code: -2, message: "Network unreachable" }), false);
    assert.equal(isUserCancellation({ code: -3, message: "Invalid transaction" }), false);
    assert.equal(isUserCancellation(new Error("Unexpected token")), false);
    assert.equal(isUserCancellation(undefined), false);
    assert.equal(isUserCancellation(null), false);
    assert.equal(isUserCancellation(42), false);
  });
});

describe("createExclusiveRunner", () => {
  it("refuses a second attempt while one is in progress", async () => {
    const runner = createExclusiveRunner();
    let release!: () => void;
    const first = runner.run(() => new Promise<string>((resolve) => (release = () => resolve("done"))));
    assert.equal(runner.running, true);

    assert.deepEqual(await runner.run(async () => "second"), { started: false });

    release();
    assert.deepEqual(await first, { started: true, value: "done" });
  });

  it("allows a new attempt once the previous one finished, even if it threw", async () => {
    const runner = createExclusiveRunner();
    await assert.rejects(runner.run(async () => Promise.reject(new Error("boom"))), /boom/);
    assert.equal(runner.running, false);
    assert.deepEqual(await runner.run(async () => "again"), { started: true, value: "again" });
  });

  it("only starts one login when the button is clicked twice in the same tick", async () => {
    const runner = createExclusiveRunner();
    const { wallet, log } = fakeWallet();
    const attempt = () =>
      runner.run(async () => run(wallet, [json(CHALLENGE), new Response(null, { status: 204 })]).result);

    const [a, b] = await Promise.all([attempt(), attempt()]);

    assert.equal(a.started, true);
    assert.equal(b.started, false);
    assert.equal(log.filter((entry) => entry === "connect").length, 1);
  });
});
