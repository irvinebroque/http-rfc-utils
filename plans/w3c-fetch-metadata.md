## Summary
Add W3C Fetch Metadata header utilities for `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site`, and `Sec-Fetch-User`, plus policy helpers for server-side request filtering.

## Scope (spec sections)
- In scope: header syntax and semantics for all four headers ([W3C Fetch Metadata §2](https://www.w3.org/TR/fetch-metadata/#framework)).
- In scope: server deployment and `Vary` guidance ([§5.1](https://www.w3.org/TR/fetch-metadata/#vary)).
- Out of scope: user-agent generation algorithms and browser heuristics ([§3](https://www.w3.org/TR/fetch-metadata/#fetch-integration), [§4.3](https://www.w3.org/TR/fetch-metadata/#directly-user-initiated)).

## Syntax/Normative Requirements
- `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site` are SF tokens.
- `Sec-Fetch-User` is SF boolean and only present for true user-activated navigation.
- Unknown token values should be treated as ignorable for forward compatibility.

## Proposed Module/Exports/Types
- Add `src/fetch-metadata.ts`:
  - `parseSecFetchDest`, `formatSecFetchDest`
  - `parseSecFetchMode`, `formatSecFetchMode`
  - `parseSecFetchSite`, `formatSecFetchSite`
  - `parseSecFetchUser`, `formatSecFetchUser`
  - `parseFetchMetadata`
  - `evaluateFetchMetadataPolicy`
  - `fetchMetadataVary`
- Add types in `src/types.ts`:
  - `FetchMetadata`, `FetchMetadataPolicy`, `FetchMetadataPolicyDecision`
- Re-export in `src/index.ts`.

## Implementation Notes
- Use structured field parser utilities instead of ad-hoc token parsing.
- Keep permissive policy defaults (do not auto-deny missing metadata unless strict mode enabled).
- Include helper to merge relevant `Vary` values when policy depends on fetch metadata headers.

## Tests
- Add `test/fetch-metadata.test.ts` with section-cited cases:
  - parse/format for all four headers
  - invalid and unknown token handling
  - strict vs permissive policy decisions
  - `Vary` helper behavior

## Docs + Audit Updates
- Update `README.md` supported standards and API map.
- Add recipe for CSRF-related filtering using `Sec-Fetch-Site`.
- Create/update `AUDIT.md` with compliance notes.

## Risks/Decisions
- Risk: too-strict defaults may block legitimate traffic when intermediaries strip headers.
- Decision: permissive default, strict mode opt-in.

## Execution Checklist
- [ ] Add `src/fetch-metadata.ts`.
- [ ] Add and export types/functions.
- [ ] Add section-cited tests.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
