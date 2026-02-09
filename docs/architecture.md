# Architecture Overview

This project keeps a stable public API while organizing implementation by RFC/topic area.

## Stable public facades

- `src/index.ts` is the canonical package entrypoint.
- `src/types.ts` remains the compatibility type facade.
- `src/auth.ts` remains the compatibility auth facade.
- `src/jsonpath.ts` remains the compatibility JSONPath facade.

## Internal decomposition

- `src/types/`
  - `shared.ts` keeps historical type declarations.
  - domain slices (`auth.ts`, `cache.ts`, `link.ts`, `jsonpath.ts`, `signature.ts`) support targeted imports.
- `src/auth/`
  - `shared.ts` for RFC 7235 parsing primitives and shared formatting helpers.
  - `basic.ts`, `bearer.ts`, `digest.ts` for scheme-specific behavior.
  - `index.ts` as the internal auth barrel.
- `src/jsonpath/`
  - `tokens.ts`, `lexer.ts`, `parser.ts`, `evaluator.ts`, `builtins.ts`.
  - `index.ts` as the internal JSONPath barrel.

## Discoverability barrels

- `src/headers/index.ts`
- `src/linking/index.ts`
- `src/security/index.ts`
- `src/negotiation/index.ts`

These barrels are for contributor navigation and internal organization. Public consumers should continue importing from `@irvinebroque/http-rfc-utils`.

## Verification workflow

- `pnpm check:structure`
- `pnpm test`
- `pnpm build`
