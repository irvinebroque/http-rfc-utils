## Summary
Add RFC 9218 `Priority` header support as a structured-field utility module for parsing, formatting, defaults, and client/server merge behavior.

## RFC Scope (sections + anchors)
- In scope: Priority parameters and header field semantics ([RFC 9218 §4](https://www.rfc-editor.org/rfc/rfc9218.html#section-4), [RFC 9218 §5](https://www.rfc-editor.org/rfc/rfc9218.html#section-5)).
- In scope: merge behavior between client and server signals ([RFC 9218 §8](https://www.rfc-editor.org/rfc/rfc9218.html#section-8)).
- Out of scope: HTTP/2 and HTTP/3 `PRIORITY_UPDATE` frame handling ([RFC 9218 §7](https://www.rfc-editor.org/rfc/rfc9218.html#section-7)).

## ABNF + Normative Requirements
- Field value is an SF Dictionary ([RFC 9218 §5](https://www.rfc-editor.org/rfc/rfc9218.html#section-5)).
- `u` is integer 0..7 with default 3 ([RFC 9218 §4.1](https://www.rfc-editor.org/rfc/rfc9218.html#section-4.1)).
- `i` is boolean with default false ([RFC 9218 §4.2](https://www.rfc-editor.org/rfc/rfc9218.html#section-4.2)).
- Unknown parameters, out-of-range values, and unexpected types are ignored (after successful dictionary parse) ([RFC 9218 §4](https://www.rfc-editor.org/rfc/rfc9218.html#section-4)).

## Proposed Module/Exports/Types
- Add `src/priority.ts`:
  - `parsePriority`
  - `formatPriority`
  - `applyPriorityDefaults`
  - `mergePriority`
- Add `PriorityField` and `RequiredPriority` types in `src/types.ts`.
- Re-export in `src/index.ts`.

## Implementation Notes (edge cases, precedence, permissive vs strict)
- Strict SF parse failure returns `null`.
- Permissive RFC-compliant member handling: ignore bad/unknown members.
- Keep request defaulting and response omission semantics separate in helper APIs.

## Tests (with RFC section citations)
- Add `test/priority.test.ts`.
- Cover valid/invalid `u`/`i`, default derivation, and merge semantics.
- Include tests that invalid SF dictionary fails parse.

## Docs + Audit Updates
- Update `README.md` Supported RFCs and RFC map.
- Add a usage snippet for parsing and merging Priority values.
- Create/update `AUDIT.md` with RFC 9218 scope and out-of-scope frame coverage.

## Risks/Decisions
- Risk: conflating request defaults with response override behavior.
- Decision: provide explicit helper functions to avoid ambiguity.

## Execution Checklist
- [ ] Add `src/priority.ts` and exports.
- [ ] Add types in `src/types.ts`.
- [ ] Add RFC-cited tests.
- [ ] Update README and audit docs.
- [ ] Run `pnpm test`.
