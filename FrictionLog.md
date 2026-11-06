# Friction log — Senda Business, HackMeridian 2026

Genesis track. Written from the 25 October 2026 build (issues, commits, and the code on `master`) and from the earlier Raven session that chose the stack. Times are rough, taken from that afternoon's commit gaps, not from a stopwatch.

No secret keys, seeds, or credentials are in this file.

## What we built

Senda Business is a project-expense panel for one SME. The company signs in with its Stellar account, registers a supplier payment, locks the amount in a USDC escrow on Stellar testnet, and later releases that milestone to the supplier.

The public ledger copy is generic (`Cuenta por pagar` / `Pago`). The supplier name and country stay in Supabase. Only a SHA-256 of the payment details is stored for verification.

The vertical slice that actually runs:

1. SEP-10 challenge, signed in the browser, becomes an httpOnly `senda_session` cookie. Only the company account is accepted.
2. The panel reads the company book from the API.
3. A pending supplier payment is checked against a monthly USD cap.
4. The API deploys a Trustless Work v2 multi-release escrow (one milestone), funds it with testnet USDC, and on approval releases milestone `0`.
5. `contracts/senda` is still the Soroban `hello` starter. The escrow is not that contract.

## Stellar tools and how we used them

| Tool | How we used it |
| --- | --- |
| `@stellar/stellar-sdk` 14 (`apps/api` and `apps/web`) | `WebAuth.buildChallengeTx`, `readChallengeTx`, and `verifyChallengeTxSigners` for SEP-10. `TransactionBuilder.fromXDR` plus `sign` for the unsigned escrow XDR. `StrKey.isValidEd25519PublicKey` on supplier accounts. `xdr.ScVal` to read a contract id back out of a Soroban return value. |
| `@stellar/freighter-api` 6 | Login only. Dynamic import, `isConnected`, `requestAccess`, and `signTransaction` with the challenge passphrase (`Test SDF Network ; September 2015`). Freighter does not sign funding or release. |
| Trustless Work v2 beta | Escrow-as-a-service. Host `https://beta.api.trustlesswork.com`, header `x-api-key`. `POST /escrow/multi-release/v2/deploy`, `/fund`, and `/approve-and-release-milestones`. The API signs `unsignedXdr` and submits `{ "signedXdr" }` to `POST /stellar/send-transaction`. |
| Soroban RPC (`https://soroban-testnet.stellar.org`) | `getTransaction` when a submit comes back as indexer-lagging, so we can recover the contract id without sending the deploy again. Horizon is configured and exposed at `GET /stellar/network`; the payment path does not read Horizon. |
| Stellar CLI | `npm run contracts:build` is `stellar contract build`, target `wasm32v1-none`, Rust ≥ 1.84. It builds the starter contract. We did not deploy it. The CLI is also the documented way to turn the classic USDC issuer into a SAC id (`stellar contract id asset --asset USDC:<issuer> --network testnet`). This demo never needed that id. |
| `soroban-sdk` 28 | Workspace dependency of `contracts/senda`. The shipped contract is `hello`. Host-side `cargo test` still runs. |
| Raven MCP (`https://raven.stellar.org/mcp`) | Used while choosing the hackathon stack, in the Senda backend project, not at runtime here. Docs search plus the ecosystem directory (slug `trustless-work`) are why the escrow is Trustless Work v2 instead of a contract we would have had to finish the same night. |

## Friction

### 1. The custom Soroban escrow was specified, then dropped

**What happened.** Issues 3, 6, and 10 described our own contract: employee and manager caps, a USDC SAC escrow, `approve_and_fund`, and an unsigned funding XDR for Freighter. They were closed the same evening without code. `contracts/senda` stayed `hello`, on purpose: the parent issue says not to replace it that night.

The unused spec already recorded two doc traps. Since protocol 23, SAC `transfer` takes a `MuxedAddress`, so an `Address` is the variant without a memo id, and a remembered `transfer` call is wrong. The SAC id comes from `stellar contract id asset` with a colon (`USDC:<issuer>`), which is easy to write as a hyphen or to confuse with the issuer account.

**Rough cost.** About 1–2 hours of spec that did not ship.

**Workaround.** Trustless Work v2 on testnet holds the USDC. The monthly cap lives in the API (`monthly-cap.ts`), not on-chain.

### 2. Trustless Work v1 and v2 do not share a host, a field name, or a fee example

**What happened.** v1 is `dev.api.trustlesswork.com` and `api.trustlesswork.com`. v2 beta is `beta.api.trustlesswork.com`. The prepared transaction field is `unsignedXdr`, not `unsignedTransaction`. Submit is `/stellar/send-transaction`, not `/helper/send-transaction`.

The multi-release swagger types `platformFee` as a number and its example is `1`, which means 1%. The error catalog only rejects a fee that is too high (`ESCROW_PLATFORM_FEE_TOO_HIGH` above 99%). Zero is legal. We almost copied a v1 minimum.

`milestoneIndexes` has to be JSON numbers. A string `"0"` is a different value. `trustline.address` is Circle's classic testnet USDC issuer, not the SAC contract id.

**Rough cost.** About an hour, most of it reading the v2 swagger before the client in `16336d2` (25 Oct, 17:44 UTC−3).

**Workaround.** Host, paths, fee `0`, and the issuer constant are fixed in `apps/api/src/escrow/constants.ts`, with a comment that points at the swagger and says not to borrow the fee from v1.

### 3. v2 rejects an escrow whose admin or dispute resolver also holds another role

**What happened.** The first payload put the treasury key in every role: approver, service provider, release signer, dispute resolver, platform, and admin. Deploy is rejected when the admin or a dispute resolver is also another role. Those two roles can change a funded escrow or send the remaining funds.

**Rough cost.** Under an hour. The split landed three minutes after the client (`86b1b97`, 17:47).

**Workaround.** `ESCROW_ADMIN_SECRET` and `ESCROW_DISPUTE_RESOLVER_SECRET` are separate accounts. `loadEnv` refuses to start if either public key matches the treasury or they match each other. The treasury still signs the one contract call.

### 4. A SEP-10 server key that is also the company account cannot be verified

**What happened.** The login issue said the SEP-10 signer and the treasury key could be the same account locally. They cannot. A copied Ed25519 signature is indistinguishable from a second signature of the same key, so `WebAuth.verifyChallengeTxSigners` does not prove a second party signed.

**Rough cost.** About 30–45 minutes. The guard is `bfaed5d`, four minutes after the login commit (18:00).

**Workaround.** The API throws on boot if `SEP10_SIGNING_SECRET` derives `STELLAR_ADMIN_PUBLIC`. Challenges are signed by a different account. Nonces are single-use, in process memory. The `sep10_nonces` table exists and is unused; a restart forgets outstanding challenges. We left that for after the demo.

### 5. A lagging indexer, and an XDR you must not rebuild

**What happened.** Submit can return `STELLAR_TX_SUBMITTED_INDEXER_LAGGING`. Sending the deploy again would create a second escrow and could move USDC twice. Rebuilding the transaction in the SDK before `sign()` changes the hash, so the signature would not match what Trustless prepared.

Two more failure shapes showed up the same evening. If deploy succeeds and fund fails, the payment has to keep that contract id and fund it on retry. Two overlapping fund requests can both pass a status check and both submit.

**Rough cost.** About 1.5–2 hours after the happy-path fund (19:04 fund, 19:08 reuse-on-retry, 20:28 atomic claim).

**Workaround.** We sign the returned XDR as-is, and we refuse fee bumps, extra operations, and any operation other than `invokeHostFunction` from the treasury. On indexer lag we call Soroban RPC `getTransaction` and read the `C…` id from the return value. The payment row is claimed in Postgres before any Trustless call. A retry reuses the deployed contract and re-reads a pending hash instead of submitting again.

### 6. The supplier needs a testnet USDC trustline, and the error is a 422 URL

**What happened.** Fund returns HTTP 422 when the receiver has no trustline for the escrow token. The body is a problem document whose `type` ends in `escrow-receiver-trustline-missing`. Nothing in the happy-path example says the supplier account must establish that trustline first, or the payment looks "approved" when no USDC moved.

**Rough cost.** About 30–45 minutes, covered by the fake-fetch test in `client.test.ts`.

**Workaround.** That 422 becomes `"La cuenta del proveedor tiene que poder recibir USDC de testnet."` The payment stays `pending`.

### 7. Raven looked connected before it was

**What happened.** On 23 September we added `.cursor/mcp.json` with `https://raven.stellar.org/mcp`. The remote health check was `ok`, and the skills canary was green, but this chat had no Raven tools until OAuth was completed in Cursor's MCP settings. The first "ask Raven for the ledger" attempt could not see the server.

**Rough cost.** About 20 minutes, then a reload after login.

**Workaround.** We confirmed testnet directly on Horizon and Soroban RPC while OAuth was pending. After login, Raven's directory entry for Trustless Work (v1 on mainnet, v2 beta on testnet, deploy → fund → release) is what we scoped the hackathon to. This repo does not call Raven.

### 8. `stellar contract build` is not a normal Cargo wasm build

**What happened.** A bare `cargo build --target wasm32v1-none` omits the flags and metadata the network expects. The target name itself is `wasm32v1-none` and wants Rust ≥ 1.84. That is easy to "fix" with the older `wasm32-unknown-unknown` target.

**Rough cost.** Negligible on the demo, because we did not deploy `senda.wasm`. We still wrote the warning into `AGENTS.md` and the README so the next build would not drift.

**Workaround.** `npm run contracts:build` calls `stellar contract build`. The Makefile does the same.

## What worked

- `WebAuth` in stellar-sdk 14. We did not hand-write a SEP-10 challenge. The issue even says: if the export name is not the one you remember, read the package types.
- Freighter's `signTransaction`, given the passphrase from our own challenge response, was enough for login. Missing extension fails closed with "Instalá Freighter para entrar."
- Trustless Work v2 let us ship a real testnet USDC lock and release without finishing a Soroban escrow in the same sitting. The browser never sees the API key or the treasury secret.
- Soroban RPC `getTransaction` is a reliable second look when the submit response is ahead of the indexer. Parsing `scvAddress` out of the return value is straightforward with the SDK.
- An empty Trustless API key still lets `npm test` pass. The suite uses a fake `fetch` and an in-memory book, so we could lock the payload shape (numeric amount, no supplier name, distinct roles) before spending testnet USDC.
- The classic USDC issuer is a stable public constant. Once we stopped treating it as a SAC id, the trustline object stopped moving.

## What would have made this easier

- One v2 quickstart that states the beta host, the `x-api-key` header, the `unsignedXdr` field, the `signedXdr` submit body, `platformFee: 0`, numeric `milestoneIndexes`, the "roles must be distinct" rule, and "issuer account, not SAC id" in the trustline. We reconstructed that from the swagger and from a rejected deploy.
- A SEP-10 server example whose signing key is a different account from the user, with one sentence on why the same Ed25519 key cannot prove two signatures.
- A note next to submit errors: on `STELLAR_TX_SUBMITTED_INDEXER_LAGGING`, poll `getTransaction` and do not send the operation again.
- A Freighter plus SEP-10 snippet that ends in a server session, not only a client-side signature. Wallet docs and the "user signs every escrow call" pattern pulled us toward a second Freighter prompt we then had to delete.
- The CLI install page leading with `wasm32v1-none` and why `stellar contract build` is the build, plus a SAC-id example directly beside "do not put that id in a classic trustline."
- SAC `transfer` examples that show `MuxedAddress` for protocol 23, so a contract written from memory does not copy the old signature.
- Raven: a health check of `ok` was not the same as tools loaded in the chat. The missing step was OAuth in the editor, and the first session could not tell those apart.
