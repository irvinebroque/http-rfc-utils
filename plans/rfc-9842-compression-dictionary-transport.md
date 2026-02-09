## Summary
Add RFC 9842 negotiation/header support for compression dictionary transport (`Use-As-Dictionary`, `Available-Dictionary`, `Dictionary-ID`) and matching/selection helpers, without implementing codec streams.

## RFC Scope (sections + anchors)
- In scope: dictionary negotiation fields and matching logic ([RFC 9842 §2](https://www.rfc-editor.org/rfc/rfc9842.html#section-2)).
- In scope: `Use-As-Dictionary` members (`match`, `match-dest`, `id`, `type`) ([RFC 9842 §2.1](https://www.rfc-editor.org/rfc/rfc9842.html#section-2.1)).
- In scope: available dictionary and ID headers ([RFC 9842 §2.2](https://www.rfc-editor.org/rfc/rfc9842.html#section-2.2), [RFC 9842 §2.3](https://www.rfc-editor.org/rfc/rfc9842.html#section-2.3)).
- In scope: negotiation and `Vary` requirements ([RFC 9842 §6.1](https://www.rfc-editor.org/rfc/rfc9842.html#section-6.1), [RFC 9842 §6.2](https://www.rfc-editor.org/rfc/rfc9842.html#section-6.2)).
- Out of scope: implementing `dcb`/`dcz` binary codecs and window constraints ([RFC 9842 §4](https://www.rfc-editor.org/rfc/rfc9842.html#section-4), [RFC 9842 §5](https://www.rfc-editor.org/rfc/rfc9842.html#section-5)).

## ABNF + Normative Requirements
- Parse `Use-As-Dictionary` as SF Dictionary with required `match` string.
- Parse `Available-Dictionary` as a single SF Byte Sequence (SHA-256 digest bytes).
- Parse `Dictionary-ID` as SF String up to 1024 characters.
- Implement deterministic multiple-match selection precedence rules.

## Proposed Module/Exports/Types
- Add `src/compression-dictionary.ts`:
  - `parseUseAsDictionary`, `formatUseAsDictionary`, `validateUseAsDictionary`
  - `parseAvailableDictionary`, `formatAvailableDictionary`
  - `parseDictionaryId`, `formatDictionaryId`
  - `matchesDictionary`, `selectBestDictionary`
  - `mergeDictionaryVary`
- Add `UseAsDictionary` and `StoredDictionary` types to `src/types.ts`.
- Re-export in `src/index.ts`.

## Implementation Notes
- Keep strict parsing for required fields and shape.
- Keep unknown `type` token parseable but mark unusable by default (caller opt-in).
- Keep freshness and storage policies as caller responsibilities.

## Tests
- Add `test/compression-dictionary.test.ts` with RFC-cited cases:
  - `Use-As-Dictionary` defaults and required members
  - pattern validation and same-origin match behavior
  - `Available-Dictionary` parsing and formatting
  - `Dictionary-ID` length limits
  - multiple-match selection precedence
  - `Vary` helper behavior for `accept-encoding` and `available-dictionary`

## Docs + Audit Updates
- Update README supported RFC list and RFC map.
- Add examples for negotiation helpers.
- Create/update `AUDIT.md` with partial scope and codec non-goals.

## Risks/Decisions
- Risk: URLPattern behavior variance across runtimes.
- Decision: helper-driven matching with explicit fallback behavior.
- Risk: users may expect codec implementation.
- Decision: negotiation-only scope for this library.

## Execution Checklist
- [ ] Add `src/compression-dictionary.ts`.
- [ ] Add and export types/functions.
- [ ] Add RFC-cited tests.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
