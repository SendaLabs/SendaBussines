# Senda Business

Monorepo con **frontend** (Next.js), **backend** (Fastify) y **contratos Stellar/Soroban**.

## Estructura

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

## Requisitos

- Node.js 20+
- Rust 1.84+ y target `wasm32v1-none` (`rustup target add wasm32v1-none`)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) (`stellar`)
- Docker (opcional)

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

## Desarrollo

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

## Contratos Soroban

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

## Buenas prácticas incluidas

- Workspaces npm + Cargo workspace separados por responsabilidad
- Validación de entorno con Zod en el API
- Tipos compartidos en `@senda/shared`
- Helmet + CORS en Fastify
- Dockerfile por app y `docker-compose`
- Contrato `#![no_std]` con tests host-side

## Documentación útil

- [Soroban Getting Started](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli)
