# Senda Business

**Project-level expense control for SMEs in Latin America, with the project budget backed by Stellar.**

Built for HackMeridian 2026 · Genesis track · aiming at Stellar Composed.

## Summary

Senda Business is a financial operations platform for SMEs in Latin America. For this hackathon we build one function done well: **expense control by project**.

Each expense belongs to a project, is checked against the project's limit and receipt policy, and appears in real time with its receipt and category. The project budget is held and released through Stellar.

## Problem

SMEs in Latin America run their money by hand, and what they can't see, they can't control.

Most SMEs spend by project, but they track that spending in notebooks, spreadsheets, chats and loose receipts. There is no limit per project, no rule on what can be bought, and no single place where the budget, the expenses and the receipts meet. The owner or finance lead sees the total after the money has already left.

This is a financial education and financial control gap, and it shows up in the data:

- **Manual tools are the norm.** In Brazil, 43% of businesses manage their finances in a notebook or on paper (Sebrae, via Valor Econômico, 2020). In Ecuador, 45% use Excel or basic software and 17% work manually (Primicias).
- **Financial education is low.** In Peru, only 17% of microentrepreneurs have a sufficient level of financial education, and 98% want training in financing, budgeting and planning (SBS, 2021).
- **It costs businesses their survival.** In Brazil, about 40% of companies do not survive five years: 29% of MEIs, 21.6% of microenterprises and 17% of small businesses (Sebrae, 2023). Sebrae lists lack of planning and poor cash-flow management among the causes, and 48% of micro and small business closures are attributed to lack of financial planning and cash-flow control (Sebrae, cited by Terra, 2025). In Colombia, more than 50% of small companies fail within five years and 40% of ventures run by individuals close within their first year (Confecámaras, cited by Portafolio, 2020).
- **The sector is the economy.** SMEs are about 99% of firms in Latin America and the Caribbean and about two thirds of jobs (IDB Invest, 2026).

When the whole region's SMEs depend on notebooks and spreadsheets for their money, the losses are not a detail: they are what decides which businesses survive.

## User

SMEs in Latin America that spend by project, and the person who approves or controls those expenses.

## Features (MVP)

| Feature | What it does | Acceptance criterion |
| --- | --- | --- |
| Spend limits | Sets how much can be spent per project, team or category. | An expense above the project's available balance is blocked and shows the reason. |
| Automatic policies | Sets what can be spent and with which receipt. | An expense without the required receipt stays pending and the person who logged it is notified. |
| Real-time visibility | Each expense appears immediately with its receipt and category. | Project balance and history update when the expense is logged. |
| Receipts in one place | Upload and organize each expense's receipt from web or mobile. | Each expense shows its attached receipt. |

**Out of scope for the MVP:** payment routing, bank reconciliation, multi-source ledger, cards, WhatsApp assistant, treasury and multi-country support.

## Why Stellar

Stellar holds and moves the money. It is not used as a data store.

- **The budget is held in escrow.** Each supplier payment is locked in a Trustless Work v2 multi-release escrow funded with USDC on Stellar testnet. It reaches the supplier only when the company releases the milestone.
- **Verifiable without exposing the business.** Funding and release produce transaction hashes, stored on each payment together with the escrow contract id. The public ledger copy is generic (`Cuenta por pagar` / `Pago`), and the supplier name and country stay off-chain. Only the SHA-256 of the payment details is stored.
- **Wallet-based access.** The company signs in with its Stellar account through SEP-10 and Freighter.
- **Existing ecosystem tools.** Escrow comes from Trustless Work, authentication from SEP-10 and signing from the Stellar SDK.

---

## What is built today

The repository is a working vertical slice of the MVP, running on Stellar testnet. This is the honest status against the MVP table above.

| MVP feature | Status | Where |
| --- | --- | --- |
| Spend limits | **Partial.** A monthly funding cap per company (`monthly_cap_usd`, default 50,000 USD) blocks any payment that would exceed it and returns *"Este pago supera el tope del mes."* Per project, team or category limits are not built yet. | `apps/api/src/escrow/monthly-cap.ts` |
| Automatic policies | **Not yet.** Input validation exists (valid Stellar account, supplier is not the company account, whole USD amount, real due date). Receipt policies are not built yet. | `packages/shared/src/index.ts` |
| Real-time visibility | **Working.** The dashboard (`/empresas/panel`) shows balance, payable, spend, international volume, cash flow, categories, upcoming payments, activity and country volumes. The data it reads comes from the company book in Supabase. | `apps/api/src/dashboard`, `apps/web/src/components/business/dashboard` |
| Receipts in one place | **Not yet.** Each payment stores a SHA-256 of its details, not a receipt file. | `apps/api/src/store/payment-metadata.ts` |
| Budget backed by Stellar | **Working on testnet.** A supplier payment is held in a Trustless Work v2 multi-release escrow funded with USDC, then released by the company. | `apps/api/src/escrow` |

## How a supplier payment works

1. **Sign in.** The company signs a SEP-10 challenge with its Stellar wallet (Freighter). The API checks the signature and sets a signed `senda_session` cookie.
2. **Register.** The company enters supplier name, Stellar account, country, amount in USD and due date. The payment is stored as `pending`, together with its activity row, in a single database transaction. A failed activity insert cannot leave an orphan payment.
3. **Fund.** The API checks the monthly cap, claims the payment so two overlapping calls cannot move USDC twice, deploys a Trustless Work escrow (one milestone) and funds it with testnet USDC. The payment becomes `approved` with its escrow contract id and funding transaction hash. If funding fails after the escrow is deployed, a retry reuses the same contract.
4. **Release.** The company approves and releases the milestone. The treasury signs the transaction on the server. The payment becomes `released` and leaves "Por pagar".

Privacy: the public ledger copy is generic (`Cuenta por pagar` / `Pago`). The supplier name and country never go on Stellar. Only the SHA-256 hash of the payment details is stored for verification.

```text
pending ──fund──▶ approved ──release──▶ released
```

## Architecture

```text
┌────────────┐   cookie session    ┌──────────────┐        ┌────────────────┐
│  apps/web  │ ──────────────────▶ │   apps/api   │ ─────▶ │    Supabase    │
│  Next.js   │   (SEP-10 wallet)   │   Fastify    │        │ Postgres + RLS │
└─────┬──────┘                     └──────┬───────┘        └────────────────┘
      │ Freighter                         │
      ▼                                   ▼
  Stellar wallet               Trustless Work v2 (beta) ──▶ Stellar testnet (USDC)
```

- **`apps/web`**: Next.js 16 (App Router) + React 19 + Tailwind 4, with 3D dotted globes (three.js and react-three-fiber) and Framer Motion. The `/` route redirects to `/empresas`.
- **`apps/api`**: Fastify 5 + Zod 4 + Stellar SDK 14, with Helmet and CORS (credentials). Data lives in Supabase through the service role. Tables have RLS on and no policies, so only the API can read them.
- **`packages/shared`**: route constants, dashboard types and the supplier payment parser shared by web and API.
- **`contracts/senda`**: Soroban contract workspace. It is currently a starter (`hello`) with host-side tests. The escrow runs on Trustless Work contracts, not on this one.
- **`supabase/migrations`**: the schema, the demo seed and the payment functions.

### Web routes

| Route | What it is |
| --- | --- |
| `/empresas` | Landing page for Senda Business |
| `/empresas/ingresar` | Login with a Stellar wallet (Freighter) |
| `/empresas/panel` | Company dashboard (requires a session) |

### API routes

| Method | Route | What it does |
| --- | --- | --- |
| `GET` | `/health` | Service status |
| `GET` | `/stellar/network` | Network, Horizon and Soroban RPC URLs |
| `POST` | `/business/sep10/challenge` | Returns a SEP-10 challenge for the company account |
| `POST` | `/business/sep10/token` | Verifies the signed challenge and sets the session cookie |
| `GET` | `/business/session` | Current session account |
| `DELETE` | `/business/session` | Logs out |
| `GET` | `/business/dashboard` | Company book, with `region`, `range` and `categoryPeriod` filters |
| `POST` | `/business/supplier-payments` | Registers a pending supplier payment |
| `POST` | `/business/supplier-payments/:id/fund-escrow` | Deploys and funds the escrow |
| `POST` | `/business/supplier-payments/:id/release-milestone` | Releases the milestone to the supplier |

Every `/business/*` route except the SEP-10 ones needs a valid session for the company account.

### Database

Applied in order from `supabase/migrations`:

| Migration | What it adds |
| --- | --- |
| `…senda_business_book` | Company book: `companies`, `supplier_payments`, `activity_entries`, KPIs, cash flow, categories, cards, country volumes, plus the demo company |
| `…payment_metadata_and_cap` | `monthly_cap_usd`, payment hash, escrow and transaction columns, `sep10_nonces` |
| `…supplier_payment_funded_at` | `funded_at`, used by the monthly cap |
| `…supplier_payment_released_status` | The terminal `released` status |
| `…register_supplier_payment` | One transaction for a payment and its activity row |
| `…supplier_payment_funding_claim` | The atomic claim that prevents double funding |

## Getting started

### Requirements

- Node.js 20+ (the Docker images use Node 22)
- A Supabase project
- A Trustless Work v2 beta API key
- Freighter wallet (the login uses it)
- Rust 1.84+ with the `wasm32v1-none` target and the [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli), only if you work on the contracts
- Docker (optional)

### Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Apply the migrations in `supabase/migrations` to your Supabase project, then fill in the environment files.

### Environment variables

**`apps/api/.env`** (server only, never commit secrets)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT`, `HOST` | Server settings (default port `4000`) |
| `CORS_ORIGIN` | Allowed web origins, comma separated (default `http://localhost:3000`) |
| `STELLAR_NETWORK`, `HORIZON_URL`, `SOROBAN_RPC_URL` | Stellar network (default testnet) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Supabase project and service key |
| `SESSION_SECRET` | Signs the `senda_session` cookie. At least 32 characters |
| `STELLAR_ADMIN_PUBLIC` | The company (treasury) account. It is the only account that can sign in |
| `SEP10_SIGNING_SECRET` | Server key for SEP-10 challenges. Must be a different account from `STELLAR_ADMIN_PUBLIC` |
| `SEP10_HOME_DOMAIN` | SEP-10 home domain (default `localhost`) |
| `TRUSTLESS_WORK_API_KEY` | Trustless Work v2 beta key |
| `TREASURY_SECRET` | Secret key of `STELLAR_ADMIN_PUBLIC`. Signs funding and release |
| `ESCROW_ADMIN_SECRET`, `ESCROW_DISPUTE_RESOLVER_SECRET` | Escrow admin and dispute resolver roles. Their public keys are derived at startup |

The API refuses to start if the SEP-10 signer is the company account, or if the company account, the escrow admin and the dispute resolver are not distinct. `TREASURY_SECRET` must belong to `STELLAR_ADMIN_PUBLIC`, or signing fails.

**`apps/web/.env.local`** (server only, do not prefix with `NEXT_PUBLIC_`)

| Variable | Purpose |
| --- | --- |
| `API_URL` | API origin the panel calls (default `http://127.0.0.1:4000`) |
| `STELLAR_ADMIN_PUBLIC` | Same company account as the API. The form rejects it as a supplier |

### Run

```bash
npm run dev:api   # API on :4000
npm run dev:web   # Web on :3000
```

Open http://localhost:3000, sign in with the company wallet in Freighter, and go to the panel.

With Docker:

```bash
npm run docker:up
npm run docker:down
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs `dev` in every workspace |
| `npm run build` | Builds all workspaces |
| `npm run lint` | Type-checks the API and shared package, lints the web app |
| `npm test` | API tests (`node --test`) and `cargo test` |
| `npm run contracts:build` | `stellar contract build` |
| `npm run contracts:test` | `cargo test` |

## Soroban contract

```bash
npm run contracts:build   # target/wasm32v1-none/release/senda.wasm
npm run contracts:test
```

Use `stellar contract build`, not a bare `cargo build --target wasm32v1-none`, so the network gets the flags and metadata it expects. Deploy to testnet after building:

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/senda.wasm \
  --source-account <ALIAS> \
  --network testnet \
  --alias senda
```

## Repository layout

```text
.
├── apps/
│   ├── web/          # Next.js (App Router + TypeScript)
│   └── api/          # Fastify + Zod + Stellar SDK
│       └── src/
│           ├── auth/       # SEP-10 challenge, nonces, session cookie
│           ├── config/     # Environment validation
│           ├── dashboard/  # Dashboard filters and projection
│           ├── escrow/     # Trustless Work client, fund, release, monthly cap
│           ├── routes/     # HTTP routes
│           └── store/      # Supabase store and in-memory store for tests
├── packages/
│   └── shared/       # Types, routes and the supplier payment parser
├── contracts/
│   └── senda/        # Soroban contract (starter)
├── supabase/
│   └── migrations/   # SQL schema and seed
├── Cargo.toml        # Rust workspace (contracts)
├── package.json      # npm workspaces (apps + packages)
└── docker-compose.yml
```

## Security notes

- Secrets are server only. Nothing sensitive is prefixed with `NEXT_PUBLIC_`.
- The session is a signed cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production) tied to the company account. SEP-10 nonces are single use and expire.
- Supabase tables have RLS enabled with no policies. `anon` and `authenticated` have no access, and only the service role reads and writes.
- The treasury signs one Soroban contract call and nothing else. The signer rejects fee bumps, transactions with more than one operation, any operation other than `invokeHostFunction`, and any source other than the treasury. It signs the XDR returned by Trustless Work without rebuilding it.
- The payment is claimed atomically before calling Trustless Work, so overlapping requests cannot move USDC twice. A retry reuses the deployed escrow and re-reads pending transactions instead of resubmitting.
- The company account, the SEP-10 signer, the escrow admin and the dispute resolver must be different accounts.

### Known limitations

- SEP-10 nonces are kept in the API process memory (`apps/api/src/auth/nonce-store.ts`). The `sep10_nonces` table exists in the schema but the API does not use it.
- `TREASURY_SECRET` is read from the API environment to sign funding and release.
- The monthly cap is per company. Limits per project, team or category are not implemented.
- Receipts and receipt policies are not implemented.

## Useful links

- [Pitch Deck](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
- [Landing Page](https://developers.stellar.org/docs/tools/cli/stellar-cli)
- [Trustless Work v2 beta API docs](https://beta.api.trustlesswork.com/docs)
- [SCF Handbook](https://stellar.gitbook.io/scf-handbook)