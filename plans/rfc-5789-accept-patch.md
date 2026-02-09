## Summary
Add RFC 5789 support for PATCH capability advertisement via `Accept-Patch`, including parsing/formatting utilities and optional OPTIONS response integration.

## RFC Scope (sections + anchors)
- In scope: PATCH semantics guidance relevant to utilities ([RFC 5789 §2](https://www.rfc-editor.org/rfc/rfc5789.html#section-2)).
- In scope: `Accept-Patch` definition and OPTIONS advertisement ([RFC 5789 §3.1](https://www.rfc-editor.org/rfc/rfc5789.html#section-3.1), [RFC 5789 §3.2](https://www.rfc-editor.org/rfc/rfc5789.html#section-3.2)).
- In scope: error-handling guidance for unsupported media type responses with `Accept-Patch` ([RFC 5789 §2.2](https://www.rfc-editor.org/rfc/rfc5789.html#section-2.2)).
- Out of scope: patch document execution engines and storage-layer atomicity enforcement.

## ABNF + Normative Requirements
- `Accept-Patch = "Accept-Patch" ":" 1#media-type` ([RFC 5789 §3.1](https://www.rfc-editor.org/rfc/rfc5789.html#section-3.1)).
- Presence of `Accept-Patch` implies PATCH is allowed on the resource ([RFC 5789 §3.1](https://www.rfc-editor.org/rfc/rfc5789.html#section-3.1)).
- PATCH is neither safe nor idempotent by default ([RFC 5789 §2](https://www.rfc-editor.org/rfc/rfc5789.html#section-2)).

## Proposed Module/Exports/Types
- Add `src/patch.ts`:
  - `parseAcceptPatch`
  - `formatAcceptPatch`
  - `supportsPatch`
- Optional response helper extension in `src/response.ts` for OPTIONS (`Accept-Patch`).
- Add type aliases in `src/types.ts` as needed.

## Implementation Notes (edge cases, precedence, permissive vs strict)
- Strict parsing for malformed media-type members.
- Preserve parameters and order; normalize for stable formatting.
- Keep conditional PATCH collision handling as documentation and composition with existing conditional utilities.

## Tests (with RFC section citations)
- Add `test/patch.test.ts` for ABNF parsing/formatting and implied PATCH support semantics.
- Add response helper tests if OPTIONS integration is included.

## Docs + Audit Updates
- Update `README.md` Supported RFCs and RFC map.
- Add recipe for OPTIONS + `Accept-Patch`, and 415 behavior guidance.
- Create/update `AUDIT.md` coverage notes with explicit non-goals.

## Risks/Decisions
- Risk: overextending into media-type-specific patch semantics.
- Decision: keep this module to header-level interoperability support.

## Execution Checklist
- [ ] Add `src/patch.ts` and exports.
- [ ] Add tests with RFC citations.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
