import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Account,
  Address,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { TrustlessWorkClient } from "./client.js";
import { USDC_TESTNET_ISSUER } from "./constants.js";
import { EscrowClientError, TRUSTLINE_REJECTED } from "./errors.js";

const SUPPLIER_NAME = "Molinos del Sur";
const COUNTRY = "Paraguay";
const ENGAGEMENT_ID = "6f1c0c3e-9b2a-4e4a-9c1d-0a0b0c0d0e0f";
const PREDICTED_CONTRACT_ID = contractId(1);
const RECOVERED_CONTRACT_ID = contractId(2);

type Call = { url: string; init: RequestInit | undefined };

function contractId(fill: number): string {
  return StrKey.encodeContract(Buffer.alloc(32, fill));
}

function unsignedXdr(source: Keypair): string {
  const account = new Account(source.publicKey(), "100");
  return new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
    timebounds: { minTime: 0, maxTime: 0 },
  })
    .addOperation(Operation.manageData({ name: "senda", value: "pago" }))
    .build()
    .toXDR();
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function header(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

function bodyOf(call: Call): unknown {
  const raw = call.init?.body;
  if (typeof raw !== "string") {
    throw new Error("expected a string request body");
  }
  return JSON.parse(raw);
}

function clientWith(
  treasury: Keypair,
  handler: (call: Call) => Response,
): { client: TrustlessWorkClient; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const call = { url, init };
    calls.push(call);
    return handler(call);
  };
  const client = new TrustlessWorkClient({
    apiKey: "test-key",
    treasurySecret: treasury.secret(),
    adminPublicKey: treasury.publicKey(),
    sorobanRpcUrl: "https://soroban.test/rpc",
    fetchImpl,
  });
  return { client, calls };
}

describe("Trustless Work client", () => {
  it("deploys against the beta host with the api key and a numeric amount", async () => {
    const treasury = Keypair.random();
    const xdr = unsignedXdr(treasury);
    const { client, calls } = clientWith(treasury, (call) => {
      const path = new URL(call.url).pathname;
      if (path === "/escrow/multi-release/v2/deploy") {
        return json(200, {
          unsignedXdr: xdr,
          txHash: "prepared",
          contractId: PREDICTED_CONTRACT_ID,
        });
      }
      if (path === "/stellar/send-transaction") {
        return json(200, {
          txHash: "submitted-hash",
          ledger: 42,
          contractId: PREDICTED_CONTRACT_ID,
        });
      }
      throw new Error(`unexpected ${call.url}`);
    });

    const record = await client.deploy({
      engagementId: ENGAGEMENT_ID,
      amount: 100,
      receiver: Keypair.random().publicKey(),
      supplierName: SUPPLIER_NAME,
      country: COUNTRY,
    });

    assert.equal(calls.length, 2);
    const deploy = calls[0];
    const submit = calls[1];
    assert.ok(deploy);
    assert.ok(submit);
    assert.equal(new URL(deploy.url).origin, "https://beta.api.trustlesswork.com");
    assert.equal(new URL(deploy.url).pathname, "/escrow/multi-release/v2/deploy");
    assert.equal(header(deploy.init, "x-api-key"), "test-key");
    assert.equal(deploy.url.includes("dev.api.trustlesswork.com"), false);
    assert.equal(deploy.url.includes("/helper/"), false);

    const payload = bodyOf(deploy) as {
      platformFee: unknown;
      title: string;
      description: string;
      milestones: Array<{ description: string; amount: unknown; receiver: string }>;
      trustline: { symbol: string; address: string };
    };
    const raw = String(deploy.init?.body);
    assert.equal(raw.includes(SUPPLIER_NAME), false);
    assert.equal(raw.includes(COUNTRY), false);
    assert.equal(raw.includes("supplierName"), false);
    assert.equal(payload.title, "Cuenta por pagar");
    assert.equal(payload.description, "Pago");
    assert.equal(payload.milestones[0]?.description, "Pago");
    assert.equal(typeof payload.milestones[0]?.amount, "number");
    assert.equal(payload.milestones[0]?.amount, 100);
    assert.equal(typeof payload.platformFee, "number");
    assert.equal(payload.platformFee, 0);
    assert.equal(payload.trustline.symbol, "USDC");
    assert.equal(payload.trustline.address, USDC_TESTNET_ISSUER);

    assert.equal(new URL(submit.url).pathname, "/stellar/send-transaction");
    assert.equal(header(submit.init, "x-api-key"), "test-key");
    const signed = bodyOf(submit) as { signedXdr?: string; unsignedTransaction?: string };
    assert.equal(typeof signed.signedXdr, "string");
    assert.equal("unsignedTransaction" in signed, false);
    assertSignedBy(signed.signedXdr ?? "", xdr, treasury);

    assert.equal(record.contractId, PREDICTED_CONTRACT_ID);
    assert.equal(record.funded, false);
    assert.equal(client.getRecord(ENGAGEMENT_ID)?.contractId, PREDICTED_CONTRACT_ID);
  });

  it("does not call the network when the receiver is the admin", async () => {
    const treasury = Keypair.random();
    const { client, calls } = clientWith(treasury, () => {
      throw new Error("fetch should not run");
    });

    await assert.rejects(
      () =>
        client.deploy({
          engagementId: ENGAGEMENT_ID,
          amount: 100,
          receiver: treasury.publicKey(),
          supplierName: SUPPLIER_NAME,
        }),
      (error: unknown) => {
        assert.ok(error instanceof EscrowClientError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.body.error, "El proveedor no puede ser la cuenta de la empresa.");
        return true;
      },
    );
    assert.equal(calls.length, 0);
    assert.equal(client.getRecord(ENGAGEMENT_ID), undefined);
  });

  it("turns a trustline 422 into an API error and does not mark the payment funded", async () => {
    const treasury = Keypair.random();
    const xdr = unsignedXdr(treasury);
    const { client, calls } = clientWith(treasury, (call) => {
      const path = new URL(call.url).pathname;
      if (path === "/escrow/multi-release/v2/deploy") {
        return json(200, {
          unsignedXdr: xdr,
          txHash: "prepared",
          contractId: PREDICTED_CONTRACT_ID,
        });
      }
      if (path === "/stellar/send-transaction") {
        return json(200, {
          txHash: "deploy-hash",
          ledger: 7,
          code: "STELLAR_TX_SUBMITTED",
        });
      }
      if (path === "/escrow/multi-release/v2/fund") {
        return json(422, {
          type: "https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/errors/escrow-receiver-trustline-missing",
          title: "Unprocessable Entity",
          status: 422,
          code: "ESCROW_RECEIVER_TRUSTLINE_MISSING",
          detail: "A role that receives escrow funds has no trustline for the escrow token.",
        });
      }
      throw new Error(`unexpected ${call.url}`);
    });

    await client.deploy({
      engagementId: ENGAGEMENT_ID,
      amount: 100,
      receiver: Keypair.random().publicKey(),
    });

    await assert.rejects(
      () =>
        client.fund({
          engagementId: ENGAGEMENT_ID,
          contractId: PREDICTED_CONTRACT_ID,
          amount: 100,
        }),
      (error: unknown) => {
        assert.ok(error instanceof EscrowClientError);
        assert.equal(error.statusCode, 422);
        assert.equal(error.body.error, TRUSTLINE_REJECTED);
        assert.deepEqual(error.body, { error: TRUSTLINE_REJECTED });
        return true;
      },
    );

    const fundCalls = calls.filter((call) => call.url.endsWith("/fund"));
    const submits = calls.filter((call) => call.url.endsWith("/stellar/send-transaction"));
    assert.equal(fundCalls.length, 1);
    assert.equal(submits.length, 1);
    const fundPayload = bodyOf(fundCalls[0]!) as { amount: unknown };
    assert.equal(typeof fundPayload.amount, "number");
    assert.equal(fundPayload.amount, 100);
    const record = client.getRecord(ENGAGEMENT_ID);
    assert.equal(record?.funded, false);
    assert.equal(record?.fundTxHash, null);
    assert.equal(record?.contractId, PREDICTED_CONTRACT_ID);
  });

  it("saves the deploy contract id when submit returns STELLAR_TX_SUBMITTED", async () => {
    const treasury = Keypair.random();
    const xdr = unsignedXdr(treasury);
    const { client } = clientWith(treasury, (call) => {
      const path = new URL(call.url).pathname;
      if (path.endsWith("/deploy")) {
        return json(200, {
          unsignedXdr: xdr,
          txHash: "prepared",
          contractId: PREDICTED_CONTRACT_ID,
        });
      }
      return json(200, {
        txHash: "submitted-hash",
        ledger: 9,
        code: "STELLAR_TX_SUBMITTED",
      });
    });

    const record = await client.deploy({
      engagementId: ENGAGEMENT_ID,
      amount: 100,
      receiver: Keypair.random().publicKey(),
    });
    assert.equal(record.contractId, PREDICTED_CONTRACT_ID);
    assert.equal(record.funded, false);
  });

  it("does not save a contract id when submit fails", async () => {
    const treasury = Keypair.random();
    const xdr = unsignedXdr(treasury);
    const { client } = clientWith(treasury, (call) => {
      if (new URL(call.url).pathname.endsWith("/deploy")) {
        return json(200, {
          unsignedXdr: xdr,
          txHash: "prepared",
          contractId: PREDICTED_CONTRACT_ID,
        });
      }
      return json(500, {
        status: 500,
        code: "STELLAR_TX_FAILED",
        title: "Error",
        detail: "rejected",
      });
    });

    await assert.rejects(() =>
      client.deploy({
        engagementId: ENGAGEMENT_ID,
        amount: 100,
        receiver: Keypair.random().publicKey(),
      }),
    );
    assert.equal(client.getRecord(ENGAGEMENT_ID), undefined);
  });

  it("re-reads by tx hash when the indexer is lagging and does not deploy again", async () => {
    const treasury = Keypair.random();
    const xdr = unsignedXdr(treasury);
    const returnValue = Address.fromString(RECOVERED_CONTRACT_ID).toScVal().toXDR("base64");
    const { client, calls } = clientWith(treasury, (call) => {
      const path = new URL(call.url).pathname;
      if (path.endsWith("/deploy")) {
        return json(200, {
          unsignedXdr: xdr,
          txHash: "prepared",
          contractId: PREDICTED_CONTRACT_ID,
        });
      }
      if (path === "/stellar/send-transaction") {
        return json(200, {
          txHash: "lagging-hash",
          ledger: 11,
          code: "STELLAR_TX_SUBMITTED_INDEXER_LAGGING",
        });
      }
      if (call.url === "https://soroban.test/rpc") {
        return json(200, {
          jsonrpc: "2.0",
          id: 1,
          result: { status: "SUCCESS", returnValue },
        });
      }
      throw new Error(`unexpected ${call.url}`);
    });

    const record = await client.deploy({
      engagementId: ENGAGEMENT_ID,
      amount: 100,
      receiver: Keypair.random().publicKey(),
    });

    const deploys = calls.filter((call) => call.url.endsWith("/deploy"));
    assert.equal(deploys.length, 1);
    assert.equal(record.contractId, RECOVERED_CONTRACT_ID);
    assert.notEqual(record.contractId, PREDICTED_CONTRACT_ID);
    assert.equal(record.funded, false);
    assert.equal(record.indexerLagging, false);
    assert.equal(header(calls.at(-1)?.init, "x-api-key"), null);
  });

  it("does not save the predicted id when the tx hash re-read is still missing", async () => {
    const treasury = Keypair.random();
    const xdr = unsignedXdr(treasury);
    const { client, calls } = clientWith(treasury, (call) => {
      const path = new URL(call.url).pathname;
      if (path.endsWith("/deploy")) {
        return json(200, {
          unsignedXdr: xdr,
          txHash: "prepared",
          contractId: PREDICTED_CONTRACT_ID,
        });
      }
      if (path === "/stellar/send-transaction") {
        return json(200, {
          txHash: "lagging-hash",
          ledger: 11,
          code: "STELLAR_TX_SUBMITTED_INDEXER_LAGGING",
        });
      }
      return json(200, {
        jsonrpc: "2.0",
        id: 1,
        result: { status: "NOT_FOUND" },
      });
    });

    const record = await client.deploy({
      engagementId: ENGAGEMENT_ID,
      amount: 100,
      receiver: Keypair.random().publicKey(),
    });
    assert.equal(calls.filter((call) => call.url.endsWith("/deploy")).length, 1);
    assert.equal(record.contractId, null);
    assert.equal(record.indexerLagging, true);
    assert.equal(record.funded, false);
    assert.equal(record.txHash, "lagging-hash");
    assert.equal(client.getRecord(ENGAGEMENT_ID), undefined);
  });

  it("approves and releases milestone 0 with numeric indexes", async () => {
    const treasury = Keypair.random();
    const xdr = unsignedXdr(treasury);
    const { client, calls } = clientWith(treasury, (call) => {
      const path = new URL(call.url).pathname;
      if (path.endsWith("/approve-and-release-milestones")) {
        return json(200, { unsignedXdr: xdr, txHash: "prepared" });
      }
      return json(200, {
        txHash: "release-hash",
        ledger: 12,
        code: "STELLAR_TX_SUBMITTED",
      });
    });

    const record = await client.approveAndRelease({
      engagementId: ENGAGEMENT_ID,
      contractId: PREDICTED_CONTRACT_ID,
    });
    const release = calls[0];
    assert.ok(release);
    const payload = bodyOf(release) as { milestoneIndexes: unknown[] };
    assert.deepEqual(payload.milestoneIndexes, [0]);
    assert.equal(typeof payload.milestoneIndexes[0], "number");
    assert.equal(record.released, true);
    assert.equal(record.funded, false);
    assert.equal(record.releaseTxHash, "release-hash");
  });
});

function assertSignedBy(signedXdr: string, unsigned: string, treasury: Keypair): void {
  const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  const original = TransactionBuilder.fromXDR(unsigned, Networks.TESTNET);
  assert.equal(Buffer.compare(signed.hash(), original.hash()), 0);
  const signature = signed.signatures[0];
  assert.ok(signature);
  assert.equal(treasury.verify(signed.hash(), signature.signature()), true);
  assert.notEqual(signedXdr, unsigned);
}
