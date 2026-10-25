# Agent instructions

Monorepo **Senda Business**: apps TypeScript + contratos Soroban.

## Layout

- `apps/web` — Next.js frontend (`@senda/web`)
- `apps/api` — Fastify API (`@senda/api`)
- `packages/shared` — tipos/rutas compartidas (`@senda/shared`)
- `Cargo.toml` — workspace Rust; miembros en `contracts/*`
- `contracts/<name>/src/lib.rs` — contrato (`#![no_std]`)
- `contracts/<name>/src/test.rs` — tests host-side

## JS / API

```sh
npm install
npm run dev:api
npm run dev:web
```

## Build de contratos

Desde la raíz del monorepo:

```sh
stellar contract build
```

Artefactos: `target/wasm32v1-none/release/*.wasm`.

Requiere `wasm32v1-none` (`rustup target add wasm32v1-none`) y Rust ≥ 1.84.

No reemplazar por un `cargo build --target wasm32v1-none` suelto: `stellar contract build` aplica flags/metadata esperados por la red.

## Test de contratos

```sh
cargo test
# o
cargo test -p senda
```

## Deploy / invoke (testnet)

```sh
stellar contract deploy \
  --wasm target/wasm32v1-none/release/senda.wasm \
  --source-account <ALIAS> \
  --network testnet \
  --alias senda
```
