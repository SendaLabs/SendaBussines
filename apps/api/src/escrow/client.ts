import type { Env } from "../config/env.js";
import {
  ESCROW_DESCRIPTION,
  ESCROW_TITLE,
  INDEXER_LAGGING,
  PATHS,
  PLATFORM_FEE,
  SUBMITTED,
  TRUSTLESS_WORK_HOST,
  USDC_TESTNET_ISSUER,
} from "./constants.js";
import {
  AMOUNT_INVALID,
  DEPLOY_FAILED,
  EscrowClientError,
  FUND_AMOUNT_MISMATCH,
  FUND_FAILED,
  RECEIVER_IS_ADMIN,
  RELEASE_FAILED,
  TRUSTLINE_REJECTED,
} from "./errors.js";
import {
  contractIdFromReturnValue,
  isContractId,
  signUnsignedXdr,
  treasuryKeypair,
} from "./sign.js";

export type DeployEscrowInput = {
  engagementId: string;
  amount: number;
  receiver: string;
  /** Accepted so callers can pass it, and omitted from every Trustless Work body. */
  supplierName?: string;
  /** Accepted so callers can pass it, and omitted from every Trustless Work body. */
  country?: string;
};

export type FundEscrowInput = {
  engagementId: string;
  contractId: string;
  /** Human amount, equal to the sum of the milestone amounts. One milestone. */
  amount: number;
};

export type ReleaseEscrowInput = {
  engagementId: string;
  contractId: string;
};

export type EscrowRecord = {
  engagementId: string;
  contractId: string | null;
  txHash: string | null;
  fundTxHash: string | null;
  releaseTxHash: string | null;
  amount: number | null;
  funded: boolean;
  released: boolean;
  indexerLagging: boolean;
};

type StoredEscrow = EscrowRecord;

export type TrustlessWorkClientOptions = {
  apiKey: string;
  treasurySecret: string;
  adminPublicKey: string;
  sorobanRpcUrl?: string;
  fetchImpl?: typeof fetch;
};

type Prepared = {
  unsignedXdr: string;
  contractId: string | null;
};

type Submitted = {
  txHash: string;
  contractId: string | null;
  code: string | null;
};

const SOROBAN_TESTNET_RPC = "https://soroban-testnet.stellar.org";

/**
 * Server-side Trustless Work v2 client.
 * Each write builds an unsigned XDR, signs it with the treasury, and submits
 * it from here. The browser never sees the API key or the secret.
 */
export class TrustlessWorkClient {
  private readonly apiKey: string;
  private readonly treasurySecret: string;
  private readonly adminPublicKey: string;
  private readonly sorobanRpcUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly records = new Map<string, StoredEscrow>();

  constructor(options: TrustlessWorkClientOptions) {
    this.apiKey = options.apiKey;
    this.treasurySecret = options.treasurySecret;
    this.adminPublicKey = options.adminPublicKey.trim();
    this.sorobanRpcUrl = options.sorobanRpcUrl ?? SOROBAN_TESTNET_RPC;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getRecord(engagementId: string): EscrowRecord | undefined {
    const record = this.records.get(engagementId);
    return record ? { ...record } : undefined;
  }

  async deploy(input: DeployEscrowInput): Promise<EscrowRecord> {
    const receiver = input.receiver.trim();
    const amount = assertAmount(input.amount);
    assertEngagementId(input.engagementId);
    if (receiver === this.adminPublicKey) {
      throw new EscrowClientError(409, RECEIVER_IS_ADMIN);
    }
    this.assertTreasury();

    const prepared = await this.build(PATHS.deploy, deployBody(this.adminPublicKey, {
      engagementId: input.engagementId,
      amount,
      receiver,
    }), DEPLOY_FAILED);

    const submitted = await this.submit(prepared.unsignedXdr, DEPLOY_FAILED);
    return this.finishDeploy(input.engagementId, amount, prepared, submitted);
  }

  async fund(input: FundEscrowInput): Promise<EscrowRecord> {
    const amount = assertAmount(input.amount);
    assertEngagementId(input.engagementId);
    this.assertKnownAmount(input.engagementId, amount);
    this.assertTreasury();

    const prepared = await this.build(PATHS.fund, {
      contractId: input.contractId,
      signer: this.adminPublicKey,
      amount,
    }, FUND_FAILED);

    const submitted = await this.submit(prepared.unsignedXdr, FUND_FAILED);
    return this.finishMark(input.engagementId, input.contractId, submitted, "fund", FUND_FAILED);
  }

  async approveAndRelease(input: ReleaseEscrowInput): Promise<EscrowRecord> {
    assertEngagementId(input.engagementId);
    this.assertTreasury();

    const prepared = await this.build(PATHS.approveAndRelease, {
      contractId: input.contractId,
      signer: this.adminPublicKey,
      milestoneIndexes: [0],
    }, RELEASE_FAILED);

    const submitted = await this.submit(prepared.unsignedXdr, RELEASE_FAILED);
    return this.finishMark(
      input.engagementId,
      input.contractId,
      submitted,
      "release",
      RELEASE_FAILED,
    );
  }

  /**
   * Re-reads a deploy that landed while the indexer was lagging.
   * Does not call deploy again.
   */
  async readDeployByTxHash(txHash: string): Promise<string | null> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.sorobanRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: { hash: txHash },
        }),
      });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const payload = await readJson(response);
    return contractIdFromRpc(payload);
  }

  private assertTreasury(): void {
    treasuryKeypair(this.treasurySecret, this.adminPublicKey);
  }

  private assertKnownAmount(engagementId: string, amount: number): void {
    const known = this.records.get(engagementId)?.amount;
    if (known != null && known !== amount) {
      throw new EscrowClientError(400, FUND_AMOUNT_MISMATCH);
    }
  }

  private async build(
    path: string,
    payload: unknown,
    failureMessage: string,
  ): Promise<Prepared> {
    const result = await this.postTrustless(path, payload, failureMessage);
    const unsignedXdr = readString(result, "unsignedXdr");
    if (!unsignedXdr) {
      throw new EscrowClientError(502, failureMessage);
    }
    return {
      unsignedXdr,
      contractId: readString(result, "contractId"),
    };
  }

  private async submit(unsignedXdr: string, failureMessage: string): Promise<Submitted> {
    const signedXdr = signUnsignedXdr(
      unsignedXdr,
      this.treasurySecret,
      this.adminPublicKey,
    );
    const result = await this.postTrustless(
      PATHS.sendTransaction,
      { signedXdr },
      failureMessage,
      true,
    );
    const txHash = readString(result, "txHash");
    if (!txHash) {
      throw new EscrowClientError(502, failureMessage);
    }
    return {
      txHash,
      contractId: readString(result, "contractId"),
      code: readString(result, "code"),
    };
  }

  private async finishDeploy(
    engagementId: string,
    amount: number,
    prepared: Prepared,
    submitted: Submitted,
  ): Promise<EscrowRecord> {
    if (submitted.contractId || submitted.code === SUBMITTED) {
      const contractId = submitted.contractId ?? prepared.contractId;
      if (!contractId) {
        throw new EscrowClientError(502, DEPLOY_FAILED);
      }
      return this.save(engagementId, {
        contractId,
        amount,
        txHash: submitted.txHash,
        funded: false,
        released: false,
        indexerLagging: false,
      });
    }

    if (submitted.code === INDEXER_LAGGING) {
      const recovered = await this.readDeployByTxHash(submitted.txHash);
      if (!recovered) {
        return unsaved(engagementId, submitted.txHash);
      }
      return this.save(engagementId, {
        contractId: recovered,
        amount,
        txHash: submitted.txHash,
        funded: false,
        released: false,
        indexerLagging: false,
      });
    }

    throw new EscrowClientError(502, DEPLOY_FAILED);
  }

  private async finishMark(
    engagementId: string,
    contractId: string,
    submitted: Submitted,
    kind: "fund" | "release",
    failureMessage: string,
  ): Promise<EscrowRecord> {
    if (submitted.code === INDEXER_LAGGING && !submitted.contractId) {
      const status = await this.readTransactionStatus(submitted.txHash);
      if (status !== "SUCCESS") {
        return this.pending(engagementId, submitted.txHash);
      }
    } else if (!(submitted.contractId || submitted.code === SUBMITTED)) {
      throw new EscrowClientError(502, failureMessage);
    }

    if (kind === "fund") {
      return this.save(engagementId, {
        contractId,
        fundTxHash: submitted.txHash,
        txHash: submitted.txHash,
        funded: true,
        indexerLagging: false,
      });
    }
    return this.save(engagementId, {
      contractId,
      releaseTxHash: submitted.txHash,
      txHash: submitted.txHash,
      released: true,
      indexerLagging: false,
    });
  }

  /** Keeps the stored row unchanged: lagging is not a saved id and not a funded payment. */
  private pending(engagementId: string, txHash: string): EscrowRecord {
    const current = this.getRecord(engagementId);
    return {
      engagementId,
      contractId: current?.contractId ?? null,
      txHash,
      fundTxHash: current?.fundTxHash ?? null,
      releaseTxHash: current?.releaseTxHash ?? null,
      amount: current?.amount ?? null,
      funded: current?.funded ?? false,
      released: current?.released ?? false,
      indexerLagging: true,
    };
  }

  private async readTransactionStatus(txHash: string): Promise<string | null> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.sorobanRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: { hash: txHash },
        }),
      });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const payload = await readJson(response);
    if (!payload || typeof payload !== "object") return null;
    const result = (payload as { result?: unknown }).result;
    if (!result || typeof result !== "object") return null;
    const status = (result as { status?: unknown }).status;
    return typeof status === "string" ? status : null;
  }

  private async postTrustless(
    path: string,
    payload: unknown,
    failureMessage: string,
    isSubmit = false,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${TRUSTLESS_WORK_HOST}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new EscrowClientError(502, failureMessage);
    }

    const body = await readJson(response);
    if (response.ok) return body;

    if (response.status === 422 && isTrustline(body)) {
      throw new EscrowClientError(422, TRUSTLINE_REJECTED);
    }
    if (isSubmit) {
      throw new EscrowClientError(502, failureMessage);
    }
    throw new EscrowClientError(response.status === 422 ? 422 : 502, failureMessage);
  }

  private save(engagementId: string, patch: Partial<StoredEscrow>): EscrowRecord {
    const current = this.records.get(engagementId);
    const next: StoredEscrow = {
      engagementId,
      contractId: patch.contractId ?? current?.contractId ?? null,
      txHash: patch.txHash ?? current?.txHash ?? null,
      fundTxHash: patch.fundTxHash ?? current?.fundTxHash ?? null,
      releaseTxHash: patch.releaseTxHash ?? current?.releaseTxHash ?? null,
      amount: patch.amount ?? current?.amount ?? null,
      funded: patch.funded ?? current?.funded ?? false,
      released: patch.released ?? current?.released ?? false,
      indexerLagging: patch.indexerLagging ?? false,
    };
    this.records.set(engagementId, next);
    return { ...next };
  }
}

export function createTrustlessWorkClient(
  options: TrustlessWorkClientOptions,
): TrustlessWorkClient {
  return new TrustlessWorkClient(options);
}

export function createTrustlessWorkClientFromEnv(
  env: Env,
  fetchImpl?: typeof fetch,
): TrustlessWorkClient {
  return createTrustlessWorkClient({
    apiKey: env.TRUSTLESS_WORK_API_KEY,
    treasurySecret: env.TREASURY_SECRET,
    adminPublicKey: env.STELLAR_ADMIN_PUBLIC,
    sorobanRpcUrl: env.SOROBAN_RPC_URL,
    fetchImpl,
  });
}

function deployBody(
  adminPublicKey: string,
  input: { engagementId: string; amount: number; receiver: string },
): unknown {
  return {
    signer: adminPublicKey,
    engagementId: input.engagementId,
    title: ESCROW_TITLE,
    description: ESCROW_DESCRIPTION,
    platformFee: PLATFORM_FEE,
    roles: {
      approvers: [adminPublicKey],
      serviceProviders: [adminPublicKey],
      releaseSigners: [adminPublicKey],
      disputeResolvers: [adminPublicKey],
      platform: adminPublicKey,
      admin: adminPublicKey,
    },
    trustline: {
      symbol: "USDC",
      address: USDC_TESTNET_ISSUER,
    },
    milestones: [
      {
        description: ESCROW_DESCRIPTION,
        amount: input.amount,
        receiver: input.receiver,
        approvalsTarget: 1,
      },
    ],
  };
}

function assertAmount(amount: number): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new EscrowClientError(400, AMOUNT_INVALID);
  }
  return amount;
}

function assertEngagementId(engagementId: string): void {
  if (typeof engagementId !== "string" || engagementId.trim() === "") {
    throw new EscrowClientError(400, "El pago no tiene un identificador.");
  }
}

function unsaved(engagementId: string, txHash: string): EscrowRecord {
  return {
    engagementId,
    contractId: null,
    txHash,
    fundTxHash: null,
    releaseTxHash: null,
    amount: null,
    funded: false,
    released: false,
    indexerLagging: true,
  };
}

function isTrustline(body: unknown): boolean {
  const code = readString(body, "code");
  return code != null && code.includes("TRUSTLINE");
}

function readString(body: unknown, key: string): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function contractIdFromRpc(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") return null;
  const record = result as { status?: unknown; contractId?: unknown; returnValue?: unknown };
  if (record.status !== "SUCCESS") return null;
  if (typeof record.contractId === "string" && isContractId(record.contractId)) {
    return record.contractId;
  }
  if (typeof record.returnValue === "string") {
    return contractIdFromReturnValue(record.returnValue);
  }
  return null;
}
