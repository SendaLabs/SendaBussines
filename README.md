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

---

## Technical documentation

Monorepo con **frontend** (Next.js), **backend** (Fastify) y **contratos Stellar/Soroban**.

### Estructura

```text
.
├── apps/
│   ├── web/          # Next.js (App Router + TypeScript)
│   └── api/          # Fastify + Zod + Stellar SDK
├── packages/
│   └── shared/       # Tipos y rutas compartidas
├── contracts/
│   └── senda/        # Contrato Soroban de ejemplo
├── Cargo.toml        # Workspace Rust (contratos)
├── package.json      # Workspaces npm (apps + packages)
└── docker-compose.yml
```

### Requisitos

- Node.js 20+
- Rust 1.84+ y target `wasm32v1-none` (`rustup target add wasm32v1-none`)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) (`stellar`)
- Docker (opcional)

### Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### Desarrollo

```bash
# API en :4000
npm run dev:api

# Web en :3000
npm run dev:web
```

O con Docker:

```bash
npm run docker:up
```

### Contratos Soroban

```bash
# Compilar WASM
npm run contracts:build

# Tests unitarios del host
npm run contracts:test
```

Artefactos en `target/wasm32v1-none/release/senda.wasm`.

Despliegue en testnet (después del build):

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/senda.wasm \
  --source-account <ALIAS> \
  --network testnet \
  --alias senda
```

### Buenas prácticas incluidas

- Workspaces npm + Cargo workspace separados por responsabilidad
- Validación de entorno con Zod en el API
- Tipos compartidos en `@senda/shared`
- Helmet + CORS en Fastify
- Dockerfile por app y `docker-compose`
- Contrato `#![no_std]` con tests host-side

### Documentación útil

- [Soroban Getting Started](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli)