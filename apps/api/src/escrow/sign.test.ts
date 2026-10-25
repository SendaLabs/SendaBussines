import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { EscrowClientError, SIGN_FAILED } from "./errors.js";
import { signUnsignedXdr } from "./sign.js";

function contractId(fill: number): string {
  return StrKey.encodeContract(Buffer.alloc(32, fill));
}

function build(source: Keypair, operations: xdr.Operation[]): string {
  const account = new Account(source.publicKey(), "100");
  const builder = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
    timebounds: { minTime: 0, maxTime: 0 },
  });
  for (const operation of operations) {
    builder.addOperation(operation);
  }
  return builder.build().toXDR();
}

function invoke(source?: string) {
  return Operation.invokeContractFunction({
    contract: contractId(9),
    function: "deploy",
    args: [],
    source,
  });
}

describe("signUnsignedXdr", () => {
  it("signs one invokeHostFunction whose source is the treasury", () => {
    const treasury = Keypair.random();
    const unsigned = build(treasury, [invoke()]);
    const signedXdr = signUnsignedXdr(unsigned, treasury.secret(), treasury.publicKey());
    const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    assert.ok(signed instanceof Transaction);
    assert.equal(signed.operations.length, 1);
    assert.equal(signed.operations[0]?.type, "invokeHostFunction");
    const signature = signed.signatures[0];
    assert.ok(signature);
    assert.equal(treasury.verify(signed.hash(), signature.signature()), true);
  });

  it("signs when the operation source is the treasury", () => {
    const treasury = Keypair.random();
    const unsigned = build(treasury, [invoke(treasury.publicKey())]);
    const signedXdr = signUnsignedXdr(unsigned, treasury.secret(), treasury.publicKey());
    assert.notEqual(signedXdr, unsigned);
  });

  it("does not sign a payment", () => {
    const treasury = Keypair.random();
    const unsigned = build(treasury, [
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: "1",
      }),
    ]);
    assertRejected(treasury, unsigned);
  });

  it("does not sign setOptions", () => {
    const treasury = Keypair.random();
    const unsigned = build(treasury, [
      Operation.setOptions({
        signer: { ed25519PublicKey: Keypair.random().publicKey(), weight: 1 },
      }),
    ]);
    assertRejected(treasury, unsigned);
  });

  it("does not sign two operations", () => {
    const treasury = Keypair.random();
    const unsigned = build(treasury, [
      invoke(),
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: "1",
      }),
    ]);
    assertRejected(treasury, unsigned);
  });

  it("does not sign a transaction sourced by another account", () => {
    const treasury = Keypair.random();
    const other = Keypair.random();
    const unsigned = build(other, [invoke()]);
    assertRejected(treasury, unsigned);
  });

  it("does not sign an invokeHostFunction sourced by another account", () => {
    const treasury = Keypair.random();
    const unsigned = build(treasury, [invoke(Keypair.random().publicKey())]);
    assertRejected(treasury, unsigned);
  });

  it("does not sign a fee bump", () => {
    const treasury = Keypair.random();
    const inner = TransactionBuilder.fromXDR(build(treasury, [invoke()]), Networks.TESTNET);
    assert.ok(inner instanceof Transaction);
    const unsigned = TransactionBuilder.buildFeeBumpTransaction(
      treasury,
      "200",
      inner,
      Networks.TESTNET,
    ).toXDR();
    assertRejected(treasury, unsigned);
  });
});

function assertRejected(treasury: Keypair, unsigned: string): void {
  assert.throws(
    () => signUnsignedXdr(unsigned, treasury.secret(), treasury.publicKey()),
    (error: unknown) => {
      assert.ok(error instanceof EscrowClientError);
      assert.equal(error.statusCode, 502);
      assert.equal(error.body.error, SIGN_FAILED);
      return true;
    },
  );
}
