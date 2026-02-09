# http-rfc-utils agent guide

Use this file as the primary instructions for coding agents working in this repo.
The package is RFC-focused TypeScript utilities with strict public API expectations.

## Project baseline
- Runtime: Node.js >= 22.
- Package manager: `pnpm`.
- Language/toolchain: TypeScript (`strict: true`, ESM/NodeNext).
- Canonical package entrypoint: `src/index.ts`.

## Build, lint, and test commands
### Install
```bash
pnpm install --frozen-lockfile
```
### Build
```bash
pnpm build
```
- Compiles `src/**/*.ts` to `dist/`.
- Use `pnpm clean` to remove build artifacts.
### Lint-equivalent checks
There is no dedicated ESLint/Prettier script in this repository.
Use this quality gate instead:
```bash
pnpm check:structure
pnpm typecheck:all
pnpm typecheck:strict
pnpm typecheck:lib
```
### Tests
Canonical full-suite entrypoint:
```bash
pnpm test
```
Run one test file:
```bash
pnpm exec tsx --test test/etag.test.ts
```
Run a specific test by name pattern:
```bash
pnpm exec tsx --test --test-name-pattern "strong ETag" test/etag.test.ts
```
Other useful test commands:
```bash
pnpm test:watch
pnpm test:coverage
pnpm test:coverage:check
```
### API/release safety checks
Run these when changes can affect public API shape or semver behavior:
```bash
pnpm api:extract
pnpm semver:check
```
### Changesets and release helpers
```bash
pnpm changeset
pnpm version
pnpm release
```
CI expects PRs to include a real changeset file under `.changeset/`.

### Pre-PR command checklist
Before opening/updating a PR, run:
```bash
pnpm check:structure
pnpm typecheck
pnpm test
pnpm build
```
CI additionally runs stricter typecheck variants and enforces changesets on PRs.

## Code style guidelines
### Formatting and syntax
- Use 4-space indentation.
- Use single quotes and semicolons.
- Keep files ASCII unless a file already requires Unicode.
- Keep functions small and focused on one parsing/formatting concern.
### Imports and exports
- Prefer `import type` for type-only imports.
- Use local ESM imports with `.js` suffix (for example `./cache.js`).
- Prefer named exports; avoid `export default`.
- Keep public exports organized through facades/barrels, not deep consumer imports.
### Types
- Avoid `any`; use `unknown` for untrusted input and narrow explicitly.
- Prefer interfaces for object contracts and type aliases for unions/literals.
- Reuse shared/public types from `src/types.ts` and `src/types/*`.
- Use `as const` and literal unions for protocol tokens/constants.
- Keep strict-mode compatibility (`noImplicitReturns`, `noFallthroughCasesInSwitch`).
### Naming conventions
- Files: kebab-case (`cache-status.ts`, `link-template.ts`).
- Types/interfaces/classes: PascalCase.
- Functions/variables: camelCase.
- Constants: UPPER_SNAKE_CASE.
- Boolean helpers: `isX`, `hasX`, `canX`, `supportsX`.
- Prefer paired API names like `parseX` and `formatX` for headers/fields.
### Error handling and parser behavior
- Default parser behavior: return `null`/empty results for invalid syntax-level input.
- Formatter/constructor/validator behavior: throw `Error` for invalid semantic input.
- Error messages should be precise and include the invalid field/value context.
- Keep non-throwing parser variants (`tryParseX`) for untrusted JSON text when available.
- Do not use exceptions for ordinary branch control in tolerant parsers.
### Comments and RFC annotations
- Add module headers documenting relevant RFC sections and a canonical RFC URL.
- Add inline RFC section comments only for non-obvious precedence/ABNF logic.
- Avoid comments that only restate obvious code.

## Testing conventions
- Framework: `node:test` with `node:assert/strict`.
- Test files live under `test/*.test.ts`.
- Every new test should cite the governing spec section (`RFC ...`, `W3C ...`, `SemVer ...`).
- Prefer normative RFC examples and include MUST/SHOULD edge cases.
- Keep tests deterministic and offline.

## Public API and structure contracts
- Treat `src/index.ts` as the canonical package entrypoint.
- Treat `src/types.ts`, `src/auth.ts`, and `src/jsonpath.ts` as compatibility facades.
- Keep decomposition in `src/types/*`, `src/auth/*`, and `src/jsonpath/*`.
- Keep discoverability barrels in `src/headers/index.ts`, `src/linking/index.ts`, `src/security/index.ts`, and `src/negotiation/index.ts`.
- If exports or module ownership change, also update docs and audit artifacts.

## RFC sources of truth
Use RFC Editor URLs when verifying behavior and edge cases:
- RFC 9110 (HTTP Semantics): https://www.rfc-editor.org/rfc/rfc9110.html
- RFC 9111 (HTTP Caching): https://www.rfc-editor.org/rfc/rfc9111.html
- RFC 5861 (stale-while-revalidate/stale-if-error): https://www.rfc-editor.org/rfc/rfc5861.html
- RFC 8246 (immutable cache directive): https://www.rfc-editor.org/rfc/rfc8246.html
- RFC 7240 (Prefer): https://www.rfc-editor.org/rfc/rfc7240.html
- RFC 7239 (Forwarded): https://www.rfc-editor.org/rfc/rfc7239.html
- RFC 6266 (Content-Disposition): https://www.rfc-editor.org/rfc/rfc6266.html
- RFC 8187 (extended header params): https://www.rfc-editor.org/rfc/rfc8187.html
- RFC 4647 (language tag matching): https://www.rfc-editor.org/rfc/rfc4647.html
- RFC 8941 (Structured Fields): https://www.rfc-editor.org/rfc/rfc8941.html
- RFC 8288 (Web Linking): https://www.rfc-editor.org/rfc/rfc8288.html
- RFC 9457 (Problem Details): https://www.rfc-editor.org/rfc/rfc9457.html
- RFC 3339 (timestamps): https://www.rfc-editor.org/rfc/rfc3339.html
- RFC 850 (obsolete HTTP-date): https://www.rfc-editor.org/rfc/rfc850.html
- RFC 9535 (JSONPath): https://www.rfc-editor.org/rfc/rfc9535.html

## Adding/extending an RFC module
If you are using OpenCode agent commands, prefer `@rfc-implement <spec-url-or-identifier>` for end-to-end execution.
The command definition lives at `.opencode/agents/rfc-implement.md` and uses `.opencode/skills/rfc-implement.md`.
Use this as the single RFC workflow command in this repo (planning/research/audit are consolidated into it).

1. Declare scope (supported sections + explicit out-of-scope behavior).
2. Keep parse/format API consistency and document any intentional deviations.
3. Add RFC-cited tests for nominal and edge-case behavior.
4. Update `README.md` and `docs/src/lib/rfc-map.ts`.
5. Run quality gates before PR.

## Cursor and Copilot rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` files were found.
- This `AGENTS.md` file is the authoritative agent rule set for this repository.
