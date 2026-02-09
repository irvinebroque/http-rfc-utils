## Summary
Complete RFC 9651 Structured Fields alignment for `src/structured-fields.ts` by adding Display String support and introducing corpus-based compliance testing alongside existing unit tests.

## RFC Scope (sections + anchors)
- In scope: Structured type system and parser/serializer algorithms ([RFC 9651 §3](https://www.rfc-editor.org/rfc/rfc9651.html#section-3), [RFC 9651 §4](https://www.rfc-editor.org/rfc/rfc9651.html#section-4)).
- In scope: Date and Display String bare items ([RFC 9651 §3.3.7](https://www.rfc-editor.org/rfc/rfc9651.html#section-3.3.7), [RFC 9651 §3.3.8](https://www.rfc-editor.org/rfc/rfc9651.html#section-3.3.8)).
- In scope: Display String parse and serialization algorithms ([RFC 9651 §4.2.10](https://www.rfc-editor.org/rfc/rfc9651.html#section-4.2.10), [RFC 9651 §4.1.11](https://www.rfc-editor.org/rfc/rfc9651.html#section-4.1.11)).
- In scope: strict parser failure model (ignore whole field on parse failure) ([RFC 9651 §1.1](https://www.rfc-editor.org/rfc/rfc9651.html#section-1.1), [RFC 9651 §2.2](https://www.rfc-editor.org/rfc/rfc9651.html#section-2.2), [RFC 9651 §4.2](https://www.rfc-editor.org/rfc/rfc9651.html#section-4.2)).
- Out of scope: field-specific semantic validation beyond generic structured parsing.

## ABNF + Normative Requirements
- Implement `bare-item` support for `sf-displaystring` (Appendix C).
- Implement `sf-displaystring` grammar and algorithm requirements, including lowercase hex percent triplets (`pct-encoded`) and UTF-8 decode behavior (Appendix C, [RFC 9651 §4.2.10](https://www.rfc-editor.org/rfc/rfc9651.html#section-4.2.10), [RFC 9651 §4.1.11](https://www.rfc-editor.org/rfc/rfc9651.html#section-4.1.11)).
- Ensure parser dispatch includes `%`-prefixed Display Strings ([RFC 9651 §4.2.3.1](https://www.rfc-editor.org/rfc/rfc9651.html#section-4.2.3.1)).
- Keep strict fail-whole-field behavior for malformed list/dictionary members ([RFC 9651 §4.2](https://www.rfc-editor.org/rfc/rfc9651.html#section-4.2)).

## Proposed Module/Exports/Types
- Extend `src/structured-fields.ts`:
  - Add Display String parser path in `parseBareItem()` and dedicated parse routine.
  - Add Display String serialization branch.
- Add `SfDisplayString` class/type in `src/types/shared.ts` and include it in `SfBareItem`.
- Re-export `SfDisplayString` through `src/types.ts` and `src/index.ts`.
- Keep existing `parseSfList`/`parseSfDict`/`parseSfItem` signatures unchanged (additive support only).

## Implementation Notes (edge cases, precedence, permissive vs strict)
- Preserve strict parser behavior for invalid `%` triplets, invalid lowercase-hex requirements, invalid UTF-8, and unterminated display strings.
- Preserve type fidelity in round-trips (`string` vs `SfToken` vs `SfDisplayString`).
- Use lowercase hex when serializing Display Strings.
- Keep current byte-sequence/date behavior unchanged unless required by RFC 9651 conformance tests.

## Tests (with RFC section citations)
- Extend `test/structured-fields.test.ts` with RFC-cited Display String cases:
  - Valid parse and serialize round-trips with non-ASCII text.
  - Invalid `%` sequences and invalid UTF-8 decode failure.
  - Strict failure propagation when one malformed member appears in list/dict.
- Add a corpus harness (for example `test/structured-fields.corpus.test.ts`) that runs official structured field vectors in addition to local targeted tests.
- Pin or vendor corpus fixtures to keep CI deterministic and reviewable.

## Docs + Audit Updates
- Update `README.md` Supported RFCs text to reflect Display String coverage (not Date-only RFC 9651 coverage).
- Update README RFC map/API import sections to include `SfDisplayString` and Display String behavior notes.
- Create/update `AUDIT.md` with RFC 9651 completion and any intentional strictness/permissiveness decisions.

## Risks/Decisions
- Risk: introducing a new bare-item wrapper type can affect callers that assumed all textual values were plain strings.
- Risk: corpus fixtures can drift if not pinned.
- Decision: additive type support with no breaking export renames.

## Execution Checklist
- [ ] Add Display String parse/serialize support in `src/structured-fields.ts`.
- [ ] Add `SfDisplayString` in `src/types/shared.ts` and re-export in `src/index.ts`.
- [ ] Add RFC-cited unit tests and corpus-based compliance tests.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
