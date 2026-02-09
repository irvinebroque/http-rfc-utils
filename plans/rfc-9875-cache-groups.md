## Summary
Add RFC 9875 support for `Cache-Groups` and `Cache-Group-Invalidation` as parsing/formatting utilities with origin-aware group matching and safe-method invalidation gating helpers.

## RFC Scope (sections + anchors)
- In scope: `Cache-Groups` field structure and semantics ([RFC 9875 §2](https://www.rfc-editor.org/rfc/rfc9875.html#section-2)).
- In scope: grouped-response identity requirements (same string, same origin) ([RFC 9875 §2.1](https://www.rfc-editor.org/rfc/rfc9875.html#section-2.1)).
- In scope: `Cache-Group-Invalidation` field semantics and safe-method ignore rule ([RFC 9875 §3](https://www.rfc-editor.org/rfc/rfc9875.html#section-3)).
- Out of scope: implementing a cache store/invalidation engine.

## ABNF + Normative Requirements
- Both fields are SF Lists of Strings.
- Unrecognized parameters are ignored; member ordering is not significant.
- `Cache-Group-Invalidation` is ignored on safe methods.
- Support at least 32 groups and 32 characters per member.

## Proposed Module/Exports/Types
- Add `src/cache-groups.ts`:
  - `parseCacheGroups`
  - `formatCacheGroups`
  - `parseCacheGroupInvalidation`
  - `formatCacheGroupInvalidation`
  - `sharesCacheGroup`
- Re-export in `src/index.ts`.

## Implementation Notes
- Strict SF syntax parsing.
- Keep parameter handling permissive (ignored for semantics).
- Keep helper boundaries explicit: utilities only, no storage mutation side effects.

## Tests
- Add `test/cache-groups.test.ts` with section-cited cases:
  - valid/invalid list parsing
  - parameter ignore behavior
  - origin + case-sensitive matching behavior
  - safe-method invalidation ignore behavior

## Docs + Audit Updates
- Update README supported RFC list and RFC map.
- Add examples for both headers.
- Create/update `AUDIT.md` documenting scope and non-goals.

## Risks/Decisions
- Risk: confusing utility helpers with full cache invalidation behavior.
- Decision: keep APIs pure and explicit.

## Execution Checklist
- [ ] Add `src/cache-groups.ts`.
- [ ] Add and export functions.
- [ ] Add RFC-cited tests.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
