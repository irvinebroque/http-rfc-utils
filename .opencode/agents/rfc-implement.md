---
name: rfc-implement
command: rfc-implement
description: Implement a new RFC/IETF/W3C standard end-to-end with repo conventions and quality gates.
---

# @rfc-implement

Implement support for a new RFC, IETF draft/RFC-track spec, or W3C standard in this repository from start to finish.
Follow the execution checklist in `.opencode/skills/rfc-implement.md`.
This is the single consolidated RFC workflow command for this repo.

## Usage

`@rfc-implement <spec-url-or-identifier>`

Examples:
- `@rfc-implement https://www.rfc-editor.org/rfc/rfc9291.html`
- `@rfc-implement RFC 9291`
- `@rfc-implement 9291`
- `@rfc-implement https://www.w3.org/TR/fetch-metadata/`

## Required behavior

1. Normalize the input spec
   - Accept RFC Editor URLs, bare RFC numbers, or W3C TR URLs.
   - Resolve a canonical source URL and list the exact sections to implement.
   - Capture title and, for RFCs where relevant, updates/obsoletes/errata context.

2. Define scope before coding
   - State in-scope sections and explicit out-of-scope behavior.
   - Capture ABNF/normative requirements and edge cases to drive implementation/tests.
   - Note strict vs permissive parsing decisions up front.

3. Follow repository API conventions
   - Prefer `parseX`/`formatX`/`validateX` naming and paired APIs.
   - Parser behavior: return `null`/empty results on syntax-invalid input.
   - Formatter/validator behavior: throw `Error` on invalid semantic input.
   - Add `tryParseX` only where non-throwing parsing for untrusted JSON is appropriate.

4. Implement with structure contracts intact
   - Add/update module(s) under `src/` and related domain types under `src/types/*`.
   - Export through `src/index.ts` and update discoverability barrels when applicable.
   - Preserve `src/types.ts`, `src/auth.ts`, and `src/jsonpath.ts` compatibility facades.

5. Add RFC/W3C-cited tests
   - Add `test/<module>.test.ts` (or extend existing tests) with spec-cited cases.
   - Cover nominal examples, MUST/SHOULD edge cases, malformed inputs, and parse/format round trips.

6. Update docs/release metadata
   - Update `README.md` coverage/import maps.
   - Update `docs/src/lib/rfc-map.ts` with module/sections/exports/notes.
   - Add a real `.changeset/*.md` entry describing why the change exists.

7. Run quality gates and fix failures
   - `pnpm check:structure`
   - `pnpm typecheck:all`
   - `pnpm typecheck:strict`
   - `pnpm typecheck:lib`
   - `pnpm test`
   - `pnpm test:coverage:check`
   - `pnpm api:extract`
   - `pnpm semver:check`
   - `pnpm build`

8. Final delivery format
   - Provide a concise summary of changes, implemented sections, out-of-scope items, and command results.
   - List touched files, evidence links, and any follow-up risks/notes.

## Constraints

- Do not skip structure/typecheck/test/semver gates unless the user explicitly requests it.
- Keep behavior deterministic and offline for tests.
- Use RFC Editor URLs for RFC citations and W3C TR URLs for W3C citations.
