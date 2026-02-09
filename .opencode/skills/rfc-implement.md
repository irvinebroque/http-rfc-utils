# RFC Implementation Skill

This skill defines the canonical end-to-end workflow for adding a new RFC/IETF/W3C standard to `http-rfc-utils`.
It consolidates planning, research, implementation, and verification into one reusable process.

## Input contract

- Accept a single RFC URL, RFC number, RFC identifier (`RFC 9110`), or W3C TR URL.
- Normalize to a canonical source URL before coding.
- Require explicit in-scope sections. If not provided, choose a minimal coherent section set and declare it.
- If input is malformed or ambiguous in a way that changes behavior, ask exactly one targeted clarifying question with a recommended default.

## Citation and evidence rules

- Use RFC Editor URLs with section anchors for RFC citations.
- Use W3C TR URLs with section anchors for W3C citations.
- Cite normative requirements (MUST/SHOULD/MAY) and ABNF where parser/formatter behavior depends on them.
- Record evidence links used for decisions.

## Start-to-finish workflow

1. Normalize and extract source requirements
   - Confirm spec title/identifier and canonical URL.
   - Capture relevant sections, ABNF fragments, precedence rules, and edge constraints.
   - For RFCs, note updates/obsoletes/errata status when relevant.

2. Declare scope and boundaries before coding
   - List implemented sections and explicit out-of-scope behavior.
   - Document permissive parsing decisions and intentional deviations.

3. Scan repo overlap and choose placement
   - Check existing support in `src/*.ts`, `test/*.test.ts`, `README.md`, `docs/src/lib/rfc-map.ts`, and `AGENTS.md`.
   - Decide whether to extend an existing module or add a new `src/<module>.ts`.
   - Reuse common helpers (`header-utils`, `structured-fields`, `object-map`, internal JSON/percent helpers) where appropriate.

4. Define API and behavior contracts
   - Prefer `parseX`/`formatX`/`validateX` naming with paired APIs.
   - Parser behavior: return `null`/empty for syntax-invalid input.
   - Formatter/validator behavior: throw precise `Error` for semantic-invalid input.
   - Add `tryParseX` for untrusted JSON text when useful.

5. Implement code
   - Add/update `src/*.ts` modules with RFC/W3C header comments and canonical source link.
   - Keep functions focused; avoid broad utility drift.
   - Use `import type` and local `.js` import suffixes.

6. Update types and exports
   - Add/update domain types in `src/types/*`.
   - Keep compatibility facades intact: `src/types.ts`, `src/auth.ts`, `src/jsonpath.ts`.
   - Export public APIs from `src/index.ts`.
   - Update discoverability barrels if relevant: `src/headers/index.ts`, `src/linking/index.ts`, `src/security/index.ts`, `src/negotiation/index.ts`.

7. Add spec-cited tests
   - Add/extend `test/*.test.ts` with section-cited cases.
   - Include normative examples, MUST/SHOULD edge cases, malformed syntax behavior, and parse/format round trips.
   - Keep tests deterministic and offline.

8. Update docs and release metadata
   - Update `README.md` supported standards, import map, and RFC map table as needed.
   - Update `docs/src/lib/rfc-map.ts` with module/sections/exports/notes.
   - Add a real `.changeset/*.md` with rationale and intended semver impact.

9. Run mandatory quality gates and fix failures
   - `pnpm check:structure`
   - `pnpm typecheck:all`
   - `pnpm typecheck:strict`
   - `pnpm typecheck:lib`
   - `pnpm test`
   - `pnpm test:coverage:check`
   - `pnpm api:extract`
   - `pnpm semver:check`
   - `pnpm build`
   - Optional for parser-heavy changes: `pnpm fuzz:quick`

## Output template

```
## Implemented Scope (sections + anchors)
## Out-of-Scope and Deviation Decisions
## Module, Type, and Export Changes
## Test Coverage (with spec citations)
## Docs + Changeset Updates
## Quality Gate Results
## Evidence Links
## Risks / Follow-ups
```

## Done checklist

- [ ] Canonical source URL and section anchors are identified.
- [ ] Scope and out-of-scope behavior are explicit.
- [ ] API naming and parse/format/validate semantics match repository conventions.
- [ ] `src/index.ts` and facades/barrels are updated correctly.
- [ ] Tests cite governing sections and cover normative + malformed + round-trip behavior.
- [ ] `README.md`, `docs/src/lib/rfc-map.ts`, and `.changeset/*.md` are updated.
- [ ] All mandatory quality gates pass.
