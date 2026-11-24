# Contribution Guide

Thank you for your interest in contributing to **Senda Business**! To keep the code consistent and the money flow safe, we follow these standards.

## Local Setup

### Cloning the Repository

```
git clone https://github.com/SendaLabs/SendaBussines.git
cd SendaBussines
```

### Installation

```
npm install
```

### Configuration

Copy the example files and fill in the variables:

```
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```


### Docker (optional)

```
npm run docker:up
npm run docker:down
```

## Development Commands

The project uses **npm Workspaces**. You can run everything from the root:

Command
What it does

`npm run dev:api`
Starts the API (Fastify) on `:4000`

`npm run dev:web`
Starts the web app (Next.js) on `:3000`

`npm run dev`
Runs `dev` in every workspace

`npm run build`
Builds all workspaces

`npm run lint`
Type-checks the API and shared package, lints the web app

`npm test`
API tests (`node --test`) and `cargo test`

`npm run contracts:build`
`stellar contract build`

`npm run contracts:test`
`cargo test`

Open [http://localhost:3000](http://localhost:3000/)

### Repository layout

```
apps/web            Next.js (App Router + TypeScript)
apps/api            Fastify + Zod + Stellar SDK
packages/shared     Route constants, dashboard types, supplier payment parser
contracts/senda     Soroban contract workspace (Rust)
supabase/migrations SQL schema, demo seed and payment functions
```

This layout will grow with the product. New features should follow the same pattern: business logic in a folder of its own inside `apps/api/src`, shared types and constants in `packages/shared`, schema changes in `supabase/migrations`, and any new app, package or contract as a new workspace. If you add a top-level folder, update this section and the README.

Inside `apps/api/src`: `auth/` (SEP-10, nonces, session), `config/` (env validation), `dashboard/`, `escrow/` (Trustless Work client, fund, release, monthly cap), `routes/` and `store/` (Supabase store and in-memory store for tests).

### Soroban contract

```
npm run contracts:build   # target/wasm32v1-none/release/senda.wasm
npm run contracts:test
```

Always use `stellar contract build`, not a bare `cargo build --target wasm32v1-none`, so the network gets the flags and metadata it expects. Note that the escrow runs on Trustless Work contracts, not on `contracts/senda`.

## Testing

### Running the suite

```
npm test                       # API tests (node --test) + cargo test
npm run contracts:test         # Soroban contract tests only
```

### Conventions

- **Never hit a real service.** Tests must not call Supabase, Trustless Work or the Stellar network. Use the in-memory store in `apps/api/src/store` and mock the Trustless Work client. A test run must work offline and with no credentials.
- **Cover the money paths.** Anything touching funding, release or the monthly cap needs tests for the failure cases too: cap exceeded, overlapping calls (the payment is claimed atomically so USDC can't move twice), a failed funding retry reusing the same escrow contract.
- **Cover the state machine.** A supplier payment only moves `pending → approved → released`. Tests must prove that invalid transitions are rejected.
- **Cover auth.** `/business/*` routes (except the SEP-10 ones) require a valid session. SEP-10 nonces are single use and expire.
- **Validate with the shared parser.** Input rules (valid Stellar account, supplier is not the company account, whole USD amount, real due date) live in `packages/shared`. Test them there, not by duplicating logic in the apps.
- Prefer asserting **behaviour a user or caller can observe** (HTTP responses, returned values, the payload sent to the store) over internal state.

### What is expected of a PR

- `npm run lint` passes with no errors.
- `npm test` passes.
- `npm run build` passes.
- New or changed behaviour comes with tests. For a bug fix, that means a test that fails without your fix.
- Tests deleted or skipped are explained in the PR description.

## Git Standards

### Branch Naming

We use prefixes to identify the type of change:

- `feat/feature-name`: New features.
- `fix/error-description`: Bug fixes.
- `bug/ticket-reference`: Critical reported bugs.
- `refactor/affected-area`: Changes that don't affect functionality.
- `docs/doc-name`: Documentation improvements.
- `chore/task-name`: Tooling, dependencies and maintenance.

### Atomic Commits

Commit messages should be clear and in English. We recommend following [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add per-project spend limit
fix(api): reuse deployed escrow when funding is retried
feat(web): show receipt upload in the expense form
feat(supabase): add receipts table with RLS
docs: update README with new API routes
```

Use the workspace as the scope when it helps: `api`, `web`, `shared`, `contracts`, `supabase`.


## Manual QA Reports

For manual test reports (screenshots + step-by-step verification of an issue), use a local `reports/issue-[number]/` folder at the repo root. Make sure it is covered by `.gitignore` so it is **not** tracked in git. Name reports `Report_[FeatureName]_Issue_[Number].md` and use this template:

```
# Manual Test Report: [Feature Name]

## Issue Information
- **Issue Number**: #[Number]
- **Title**: [Issue Title]
- **Date**: [YYYY-MM-DD]
- **Tester**: [Your Name/Username]

## Test Environment
- **URL**: https://senda-bussines.vercel.app (or http://localhost:3000)
- **Network**: Stellar testnet
- **Browser**: [Browser Name and Version]
- **Wallet**: [wallet name and version]
- **Device**: [Desktop/Mobile/Tablet]

## Test Steps

### Step 1: [Step Description]
- **Action**: [What was done]
- **Expected Result**: [What should happen]
- **Actual Result**: [What actually happened]
- **Status**: ✅ Pass / ❌ Fail
- **Screenshot**: [filename]
- **Tx hash / escrow id** (if applicable): [hash]

## Test Results Summary
- **Total Steps**: [Number]
- **Passed**: [Number]
- **Failed**: [Number]
- **Overall Status**: ✅ Pass / ❌ Fail

## Issues Found
- [Description of any issues found during testing]

## Recommendations
- [Any recommendations for improvements]
```

Attach the report content and screenshots directly to your PR description rather than committing them. Never include secret keys, session cookies or `.env` contents in screenshots.

## Pull Request Process

1. Create a branch from `master`.
2. Make your changes and use atomic commits.
3. Make sure `npm run build`, `npm run lint` and `npm test` all pass locally.
4. Open a PR against `master` and describe: what changed and why, how you tested it, any migration or environment variable added, whether it changes the status of a feature in the README, and the QA report if the change is user-facing.
5. Open a PR using our Pull Request template.
6. Wait for a maintainer's review.



---

Questions? Consult or open an issue.
