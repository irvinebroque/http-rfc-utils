## Summary
Add RFC 9213 support with structured parsing/formatting for targeted cache-control fields (especially `CDN-Cache-Control`) and helper logic for target-list selection.

## RFC Scope (sections + anchors)
- In scope: targeted cache-control model and syntax ([RFC 9213 §2](https://www.rfc-editor.org/rfc/rfc9213.html#section-2), [RFC 9213 §2.1](https://www.rfc-editor.org/rfc/rfc9213.html#section-2.1)).
- In scope: target-list cache behavior and fallback semantics ([RFC 9213 §2.2](https://www.rfc-editor.org/rfc/rfc9213.html#section-2.2)).
- In scope: CDN field specialization and examples ([RFC 9213 §3](https://www.rfc-editor.org/rfc/rfc9213.html#section-3), [RFC 9213 §3.1](https://www.rfc-editor.org/rfc/rfc9213.html#section-3.1)).
- Out of scope: full cache engine/runtime behavior and response header mutation strategies.

## ABNF + Normative Requirements
- Targeted fields are SF Dictionaries carrying cache directives ([RFC 9213 §2.1](https://www.rfc-editor.org/rfc/rfc9213.html#section-2.1)).
- Ignore directive parameters unless explicitly specified.
- Empty/invalid targeted field values are ignored.
- Selection rule: first valid non-empty targeted field in target-list order wins; otherwise fallback to standard cache controls.

## Proposed Module/Exports/Types
- Add `src/targeted-cache-control.ts`:
  - `parseTargetedCacheControl`
  - `formatTargetedCacheControl`
  - `parseCdnCacheControl`
  - `formatCdnCacheControl`
  - `selectTargetedCacheControl`
- Add types in `src/types.ts`:
  - `TargetedCacheControl`, `TargetedSelection`
- Re-export in `src/index.ts`.

## Implementation Notes
- Reuse existing structured-field parser utilities.
- Keep known-directive type validation strict; keep unknown extensions preserved but uninterpreted.
- Avoid coercing invalid numeric values (e.g., decimal `max-age`).

## Tests
- Add `test/targeted-cache-control.test.ts` with RFC-cited cases:
  - parse/format round-trips
  - invalid field handling
  - target-list selection precedence
  - RFC example scenarios

## Docs + Audit Updates
- Update README supported RFC list and RFC map.
- Add usage examples for `CDN-Cache-Control` and target-list selection.
- Create/update `AUDIT.md` with strict/permissive notes.

## Risks/Decisions
- Risk: mixing legacy `Cache-Control` parsing logic with SF semantics causes divergence.
- Decision: dedicated module for RFC 9213 behavior.

## Execution Checklist
- [ ] Add `src/targeted-cache-control.ts`.
- [ ] Add and export types/functions.
- [ ] Add RFC-cited tests.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
