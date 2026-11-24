# Senda Business

Tu negocio ya cruza fronteras ,tus finanzas deberian funcionar en una sola plataforma 


## Summary

Senda Business is a testnet pilot for small and medium businesses that need one place to see their spending and pay a supplier.

The company signs in, registers a supplier payment, and funds it with testnet USDC. The USDC sits in a Trustless Work v2 multi-release escrow until the company releases the milestone. The supplier name and country stay off the public ledger.

This repository does not yet do per-project spend limits, receipt rules, or scheduled settlement. Those are described below as targets, not as features that run today.

## Problem

In Latin America, many small and medium-sized enterprises (SMEs) still manage a large portion of their finances manually. Often, the business owner only learns the final amount after the money has already left the account. I’ve seen this same scenario a thousand times: a company invoicing clients abroad, working with suppliers in three different countries, and losing both time and money every time it moves funds across borders—slow wire transfers, exchange rates that no one understands, and hidden fees that only surface later.

The public data behind that gap:

- **Manual tools are the norm.** In Brazil, 43% of businesses manage their finances in a notebook or on paper (Sebrae, via Valor Econômico, 2020). In Ecuador, 45% use Excel or basic software and 17% work manually (Primicias).
- **Financial education is low.** In Peru, only 17% of microentrepreneurs have a sufficient level of financial education, and 98% want training in financing, budgeting and planning (SBS, 2021).
- **It costs businesses their survival.** In Brazil, about 40% of companies do not survive five years: 29% of MEIs, 21.6% of microenterprises and 17% of small businesses (Sebrae, 2023). Sebrae lists lack of planning and poor cash-flow management among the causes, and 48% of micro and small business closures are attributed to lack of financial planning and cash-flow control (Sebrae, cited by Terra, 2025). In Colombia, more than 50% of small companies fail within five years and 40% of ventures run by individuals close within their first year (Confecámaras, cited by Portafolio, 2020).
- **The sector is the economy.** SMEs are about 99% of firms in Latin America and the Caribbean and about two thirds of jobs (IDB Invest, 2026).

What this pilot does about it, on Stellar testnet: it records a supplier payment and holds the USDC in escrow until the company releases it. It does not claim a fee reduction, a locked exchange rate, or settlement on a schedule.

## User

SMEs in Latin America, and the person who registers or releases a supplier payment.

## Target features

These are the product targets. The next table says what the code actually does.

| Feature | What it would do | Acceptance criterion |
| --- | --- | --- |
| Spend limits | Set how much can be spent per project, team or category. | An expense above the project's available balance is blocked and shows the reason. |
| Automatic policies | Set what can be spent and with which receipt. | An expense without the required receipt stays pending and the person who logged it is notified. |
| Real-time visibility | Each expense appears with its receipt and category. | Project balance and history update when the expense is logged. |
| Receipts in one place | Upload and organize each expense's receipt. | Each expense shows its attached receipt. |

**Not built:** per-project, team or category limits, receipt files, cards, bank reconciliation, a WhatsApp assistant, and more than one company book.

## Why Stellar

Stellar holds and moves the testnet USDC. It is not used as the business database.

- **The payment is held in escrow.** Each funded supplier payment is locked in a Trustless Work v2 multi-release escrow. It reaches the supplier when the company releases the milestone.
- **The business details stay off the ledger.** Funding and release produce transaction hashes. The public copy is generic (`Cuenta por pagar` / `Pago`). The supplier name and country are not written to Stellar. The API stores a SHA-256 of the payment details.
- **Wallet or Google sign-in.** The user picks any wallet supported by the [Stellar Wallets Kit](https://stellarwalletskit.dev) and signs a SEP-10 challenge with it. Google sign-in is available when `NEXT_PUBLIC_PRIVY_APP_ID` is set. Any verified account can open the panel.
- **Existing tools.** Escrow is Trustless Work v2 (beta). Authentication is SEP-10. Signing uses the Stellar SDK.

---

## What is built today

Checked against the code in this repository. Status names match what a reader can open.

| Area | Status | Where |
| --- | --- | --- |
| Monthly funding cap | **Partial.** One cap per company (`monthly_cap_usd`, default 50,000 USD) blocks a payment that would exceed it and returns *"Este pago supera el tope del mes."* Limits per project, team or category are not built. | `apps/api/src/escrow/monthly-cap.ts` |
| Input checks | **Partial.** The parser requires a valid Stellar account, a supplier that is not the company account, a whole USD amount and a real due date. Receipt policies are not built. | `packages/shared/src/index.ts` |
| Company panel | **Partial.** `/empresas/panel` renders the company book: balance, payable, spend, cash flow, categories, payments, activity and country volumes. The layout still shows a demo label. An empty book shows zeros. | `apps/api/src/dashboard`, `apps/web/src/components/business/dashboard` |
| Receipts | **Not built.** A payment stores a SHA-256 of its details, not a receipt file. | `apps/api/src/store/payment-metadata.ts` |
| Escrow on testnet | **Built, and one run is recorded below.** A supplier payment can be held in a Trustless Work v2 multi-release escrow funded with testnet USDC, then released. Funding needs `TRUSTLESS_WORK_API_KEY`. | `apps/api/src/escrow` |
| SEP-24 deposit, event log, metrics dashboard | **Not built.** They are the next sprint. They are not in this tree. | — |

## How a supplier payment works

1. **Sign in.** Google, or any Stellar wallet (chosen in the Stellar Wallets Kit selector) through SEP-10. The API checks the signature and sets a signed `senda_session` cookie.
2. **Register.** The company enters supplier name, Stellar account, country, amount in USD and due date. The payment is stored as `pending`, together with its activity row, in one database transaction.
3. **Fund.** The API checks the monthly cap, claims the payment so two overlapping calls cannot move USDC twice, deploys a Trustless Work escrow (one milestone) and funds it with testnet USDC. The payment becomes `approved` with its escrow contract id and funding transaction hash. If funding fails after the escrow is deployed, a retry reuses the same contract. The server signs with `TREASURY_SECRET`.
4. **Release.** The company releases the milestone. The server signs that transaction too. The payment becomes `released`.

Privacy: the public ledger copy is generic (`Cuenta por pagar` / `Pago`). The supplier name and country never go on Stellar. Only the SHA-256 of the payment details is stored.

```text
pending ──fund──▶ approved ──release──▶ released
```

### Testnet escrow

One completed Trustless Work v2 multi-release escrow on Stellar testnet, funded with testnet USDC (issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`). The three transactions succeeded on 26 October 2026 and were signed by `GCNHPH5ADYHT2CNED26D7CTDALQOB3CD32J4AOZXFSGQ7LPT5QBAH5P5`. The release sent 9.97 USDC to `GBT6M2N6VW5ZU6F765MCZDZG5GB5BOTUNFAGSVUV6E2N4IPHSDQVO2TO` and 0.03 USDC to `GDDL743M3SOW6GN4HOAKU5ACA7QN36ERFBXNHY5BS7HOR2DPOSGMRCYF`.

| Step | Hash / ID | Stellar Expert |
| --- | --- | --- |
| Escrow contract (multi-release v2) | `CDTGDYYYL2FGQODPMEB3RLADJGIY7C77BESFA5MQN6YVWLV27LLL2P2T` | [Contract](https://stellar.expert/explorer/testnet/contract/CDTGDYYYL2FGQODPMEB3RLADJGIY7C77BESFA5MQN6YVWLV27LLL2P2T) |
| Deploy | `8105eff34750577ac5fac4ddc9145d3223b7bc4a2967a41a70f876001f37dfbe` | [Transaction](https://stellar.expert/explorer/testnet/tx/8105eff34750577ac5fac4ddc9145d3223b7bc4a2967a41a70f876001f37dfbe) |
| Funding (10 USDC) | `85f1ab768c9813e8cc38d290a8153487e0eea5136acd5d5d435fc7faab30d8c6` | [Transaction](https://stellar.expert/explorer/testnet/tx/85f1ab768c9813e8cc38d290a8153487e0eea5136acd5d5d435fc7faab30d8c6) |
| Release to the supplier | `367115d1d0e51896c8acb47dc0a113df0e8ae1a58fe26538ccc7b9bc2050cc83` | [Transaction](https://stellar.expert/explorer/testnet/tx/367115d1d0e51896c8acb47dc0a113df0e8ae1a58fe26538ccc7b9bc2050cc83) |

Checked on 14 November 2026 against Horizon testnet (`/transactions/<hash>`). All three transactions exist, `successful` is true, and the source account is `GCNHPH5ADYHT2CNED26D7CTDALQOB3CD32J4AOZXFSGQ7LPT5QBAH5P5`. Funding debited 10 USDC from that account and credited contract `CDTGDYYYL2FGQODPMEB3RLADJGIY7C77BESFA5MQN6YVWLV27LLL2P2T`. Release credited 9.97 USDC to `GBT6M2N6VW5ZU6F765MCZDZG5GB5BOTUNFAGSVUV6E2N4IPHSDQVO2TO` and 0.03 USDC to `GDDL743M3SOW6GN4HOAKU5ACA7QN36ERFBXNHY5BS7HOR2DPOSGMRCYF`. The asset issuer on both effects is `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`.

## Architecture

```text
┌────────────┐   cookie session    ┌──────────────┐        ┌────────────────┐
│  apps/web  │ ──────────────────▶ │   apps/api   │ ─────▶ │    Supabase    │
│  Next.js   │   (SEP-10 / Google) │   Fastify    │        │ Postgres + RLS │
└─────┬──────┘                     └──────┬───────┘        └────────────────┘
      │ Wallets Kit                       │
      ▼                                   ▼
  Stellar wallet               Trustless Work v2 (beta) ──▶ Stellar testnet (USDC)
```

- **`apps/web`**: Next.js 16 (App Router) + React 19 + Tailwind 4. The `/` route redirects to `/empresas`.
- **`apps/api`**: Fastify 5 + Zod 4 + Stellar SDK 14, with Helmet and CORS (credentials). Data lives in Supabase through the service role. Tables have RLS on and no policies, so the anon and authenticated roles cannot read them.
- **`packages/shared`**: route constants, dashboard types and the supplier payment parser shared by web and API.
- **`contracts/senda`**: Soroban workspace. It is a starter (`hello`) with host-side tests. The escrow runs on Trustless Work contracts, not on this one.
- **`supabase/migrations`**: the schema. A later migration removes the demo company book.

### Web routes

| Route | What it is |
| --- | --- |
| `/empresas` | Landing page |
| `/empresas/ingresar` | Sign in with Google or a Stellar wallet (Stellar Wallets Kit) |
| `/empresas/panel` | Company panel (requires a session cookie) |

### API routes

| Method | Route | What it does |
| --- | --- | --- |
| `GET` | `/health` | Service status |
| `GET` | `/stellar/network` | Network, Horizon and Soroban RPC URLs |
| `POST` | `/business/sep10/challenge` | Returns a SEP-10 challenge for an account |
| `POST` | `/business/sep10/token` | Verifies the signed challenge and sets the session cookie |
| `GET` | `/business/session` | Current session |
| `DELETE` | `/business/session` | Logs out |
| `GET` | `/business/dashboard` | Company book, with `region`, `range` and `categoryPeriod` filters |
| `POST` | `/business/supplier-payments` | Registers a pending supplier payment |
| `POST` | `/business/supplier-payments/:id/fund-escrow` | Deploys and funds the escrow |
| `POST` | `/business/supplier-payments/:id/release-milestone` | Releases the milestone to the supplier |

Every `/business/*` route except the SEP-10 challenge and token needs a valid session. The committed API does not restrict those routes to the treasury account.

### Database

Applied in order from `supabase/migrations`:

| Migration | What it adds |
| --- | --- |
| `…senda_business_book` | Company book: `companies`, `supplier_payments`, `activity_entries`, KPIs, cash flow, categories, cards, country volumes |
| `…payment_metadata_and_cap` | `monthly_cap_usd`, payment hash, escrow and transaction columns, `sep10_nonces` |
| `…supplier_payment_funded_at` | `funded_at`, used by the monthly cap |
| `…supplier_payment_released_status` | The terminal `released` status |
| `…register_supplier_payment` | One transaction for a payment and its activity row |
| `…supplier_payment_funding_claim` | The atomic claim that prevents double funding |
| `…supplier_payment_release_claim` | The atomic claim that prevents a double release |
| `…remove_demo_book` | Removes the seeded demo company |

## Getting started

### Requirements

- Node.js 20+ (the Docker images use Node 22)
- A Supabase project
- A Trustless Work v2 beta API key, only if you fund or release an escrow
- A Stellar wallet supported by the Stellar Wallets Kit (for example Freighter or xBull), or a Privy app id if you use Google sign-in
- Rust 1.84+ with the `wasm32v1-none` target and the [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli), only if you work on the contracts
- Docker (optional; see the note under Run)

### Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Apply the migrations in `supabase/migrations` to your Supabase project, then fill in the environment files. Do not commit them.

### Environment variables

**`apps/api/.env`** (server only)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT`, `HOST` | Server settings (default port `4000`) |
| `CORS_ORIGIN` | Allowed web origins, comma separated (default `http://localhost:3000`) |
| `STELLAR_NETWORK`, `HORIZON_URL`, `SOROBAN_RPC_URL` | Stellar network (default testnet) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Supabase project and service key |
| `SESSION_SECRET` | Signs the `senda_session` cookie. At least 32 characters |
| `STELLAR_ADMIN_PUBLIC` | Treasury account. Its secret signs funding and release |
| `SEP10_SIGNING_SECRET` | Server key for SEP-10 challenges. Must be a different account from `STELLAR_ADMIN_PUBLIC` |
| `SEP10_HOME_DOMAIN` | SEP-10 home domain (default `localhost`) |
| `TRUSTLESS_WORK_API_KEY` | Trustless Work v2 beta key. Empty skips live funding |
| `TREASURY_SECRET` | Secret key of `STELLAR_ADMIN_PUBLIC`. The server uses it to sign funding and release |
| `ESCROW_ADMIN_SECRET`, `ESCROW_DISPUTE_RESOLVER_SECRET` | Escrow admin and dispute resolver roles. Their public keys are derived at startup |

The API refuses to start if the SEP-10 signer is the company account, or if the company account, the escrow admin and the dispute resolver are not distinct.

**`apps/web/.env.local`**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app id. Google sign-in stays off when this is empty |
| `API_URL` | API origin the panel calls (default `http://127.0.0.1:4000`) |
| `STELLAR_ADMIN_PUBLIC` | Same company account as the API. The form rejects it as a supplier |

### Run

```bash
npm run dev:api   # API on :4000
npm run dev:web   # Web on :3000
```

Open http://localhost:3000 and sign in. The panel is `/empresas/panel`.

```bash
npm run docker:up
npm run docker:down
```

Compose starts the dev servers. It does not pass `ESCROW_ADMIN_SECRET` or `ESCROW_DISPUTE_RESOLVER_SECRET`, and the web service sets `NEXT_PUBLIC_API_URL` while the panel reads `API_URL`. The API will not boot, and the panel will not reach it, until those are set for the containers. The image build ignores `.env` files (`.dockerignore`).

### Test

```bash
npm test          # API tests, then cargo test
npm run lint      # API and shared type-check, web eslint
npm run build
```

API tests use `node --test` and an in-memory store. They do not call Horizon or Trustless Work. `npm test` also runs `cargo test` for `contracts/senda`. On Windows, Application Control can block the host `cargo` binary; the API suite can still be run with `npm test -w @senda/api`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs `dev` in every workspace |
| `npm run build` | Builds all workspaces |
| `npm run lint` | Type-checks the API and shared package, lints the web app |
| `npm test` | API tests (`node --test`) and `cargo test` |
| `npm run contracts:build` | `stellar contract build` |
| `npm run contracts:test` | `cargo test` |
| `npm run docker:up` | `docker compose up -d` |
| `npm run docker:down` | `docker compose down` |

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

The deployed `hello` contract is not the payment path.

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
├── docs/             # Risks, decisions, and the evidence skeleton
├── supabase/
│   └── migrations/   # SQL schema
├── Cargo.toml        # Rust workspace (contracts)
├── package.json      # npm workspaces (apps + packages)
└── docker-compose.yml
```

## 🤝 Contributing
Contributions are welcome! Please check [CONTRIBUTING](./CONTRIBUTING.md) for detailed guidelines.

Quick contribution guide
1. Fork the repository
2. Create your feature branch: git checkout -b feature/amazing-feature
3. Commit your changes: git commit -m 'feat: add amazing feature'
4. Push to the branch: git push origin feature/amazing-feature
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
