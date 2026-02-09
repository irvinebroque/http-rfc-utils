## Summary
Add RFC 7838 header-level support for `Alt-Svc` and `Alt-Used` parsing/formatting, including parameter handling (`ma`, `persist`) and clear semantics.

## RFC Scope (sections + anchors)
- In scope: `Alt-Svc` header syntax and semantics ([RFC 7838 §3](https://www.rfc-editor.org/rfc/rfc7838.html#section-3)).
- In scope: `ma`/`persist` parameter behavior ([RFC 7838 §3.1](https://www.rfc-editor.org/rfc/rfc7838.html#section-3.1)).
- In scope: `Alt-Used` syntax ([RFC 7838 §5](https://www.rfc-editor.org/rfc/rfc7838.html#section-5)).
- Out of scope: HTTP/2 `ALTSVC` frame processing and client cache lifecycle behavior.

## ABNF + Normative Requirements
- Implement `Alt-Svc = clear / 1#alt-value` with case-sensitive `clear`.
- Parse `alternative = protocol-id="alt-authority"` plus parameters.
- Ignore unknown parameters.
- `persist` has meaning only when value is `1`.

## Proposed Module/Exports/Types
- Add `src/alt-svc.ts`:
  - `parseAltSvc`
  - `formatAltSvc`
  - `parseAltUsed`
  - `formatAltUsed`
- Add `AltSvcAlternative`, `AltSvcRecord`, `AltUsed` types to `src/types.ts`.
- Re-export in `src/index.ts`.

## Implementation Notes
- Keep parser tolerant to malformed members by skipping invalid alternatives while preserving valid ones.
- Canonicalize formatting for percent-encoding and quoted authorities.
- Preserve preference order of alternatives.

## Tests
- Add `test/alt-svc.test.ts` with RFC-cited cases:
  - `clear` behavior
  - parsing `h2=":8000"` and host+port variants
  - `ma` default and explicit values
  - `persist` handling
  - `Alt-Used` parse/format

## Docs + Audit Updates
- Update README supported RFC list and RFC map.
- Add examples for `Alt-Svc` and `Alt-Used`.
- Create/update `AUDIT.md` with scope and non-goals.

## Risks/Decisions
- Risk: mixing header syntax support with transport/runtime behavior.
- Decision: header-only scope in this phase.

## Execution Checklist
- [ ] Add `src/alt-svc.ts`.
- [ ] Add and export types/functions.
- [ ] Add RFC-cited tests.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
