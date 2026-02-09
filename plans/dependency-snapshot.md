# Dependency Snapshot

This snapshot is used as a reference point for structure-regression checks.

## Pre-refactor highlights

- `src/types.ts` was imported by 53 source modules.
- `src/auth.ts` exported shared parsing helpers and all scheme-specific logic from one module.
- `src/jsonpath.ts` exported parser/evaluator APIs while also holding all internal implementation layers.

## Current structure targets

- `src/types.ts` is now a compatibility facade backed by `src/types/shared.ts` and domain slices (`src/types/auth.ts`, `src/types/cache.ts`, `src/types/link.ts`, `src/types/jsonpath.ts`, `src/types/signature.ts`).
- `src/auth.ts` is now a compatibility facade over `src/auth/index.ts` with protocol-specific modules (`basic.ts`, `bearer.ts`, `digest.ts`) and shared helpers (`shared.ts`).
- `src/jsonpath.ts` is now a compatibility facade over `src/jsonpath/index.ts` with separated lexer/parser/evaluator modules.
- Internal contributor barrels were added under `src/headers/`, `src/linking/`, `src/security/`, and `src/negotiation/`.

## Regression guardrail

- Run `pnpm check:structure` to verify expected facades, module directories, and barrel wiring.
