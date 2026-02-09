## Summary
Add RFC 8615 support via a generic well-known URI/path utility module to standardize `/.well-known/` path handling and suffix validation.

## RFC Scope (sections + anchors)
- In scope: well-known URI prefix semantics and top-level-only rule ([RFC 8615 §3](https://www.rfc-editor.org/rfc/rfc8615.html#section-3)).
- In scope: registered suffix constraints using RFC 3986 `segment-nz` ([RFC 8615 §3](https://www.rfc-editor.org/rfc/rfc8615.html#section-3), [RFC 3986 §3.3](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.3)).
- Out of scope: IANA registration workflows and endpoint-specific application semantics.

## ABNF + Normative Requirements
- Enforce top-level prefix `/.well-known/`.
- Enforce suffix as single non-empty path segment (no `/`).
- Helper defaults can focus on HTTP-family schemes, while documenting scheme-specific support rules.

## Proposed Module/Exports/Types
- Add `src/well-known.ts`:
  - `WELL_KNOWN_PREFIX`
  - `isWellKnownPath`
  - `isWellKnownUri`
  - `validateWellKnownSuffix`
  - `buildWellKnownPath`
  - `buildWellKnownUri`
  - `parseWellKnownPath`
- Add optional types in `src/types.ts`.
- Re-export in `src/index.ts`.

## Implementation Notes
- Keep builders strict and parsers non-throwing.
- Reject nested forms like `/foo/.well-known/x`.
- Document security considerations for well-known resource ownership and write access.

## Tests
- Add `test/well-known.test.ts` with RFC-cited cases:
  - valid top-level forms
  - nested invalid forms
  - suffix validation edge cases
  - URI builder/parser round-trips

## Docs + Audit Updates
- Update README supported RFC list and RFC map.
- Add examples for path and URI builder helpers.
- Create/update `AUDIT.md` with scope and non-goals.

## Risks/Decisions
- Risk: over-scoping into per-application behavior.
- Decision: keep module generic and endpoint-agnostic.

## Execution Checklist
- [ ] Add `src/well-known.ts`.
- [ ] Add and export utilities.
- [ ] Add RFC-cited tests.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
