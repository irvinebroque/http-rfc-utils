## Summary
Add RFC 8470 support for `Early-Data` and `425 Too Early` decision helpers as header-level utilities, without implementing TLS anti-replay infrastructure.

## RFC Scope (sections + anchors)
- In scope: `Early-Data` header syntax and handling ([RFC 8470 §5.1](https://www.rfc-editor.org/rfc/rfc8470.html#section-5.1)).
- In scope: `425 Too Early` signaling conditions and retry semantics guidance ([RFC 8470 §5.2](https://www.rfc-editor.org/rfc/rfc8470.html#section-5.2)).
- Out of scope: TLS early-data acceptance/rejection strategy and replay defenses ([RFC 8470 §3](https://www.rfc-editor.org/rfc/rfc8470.html#section-3), [RFC 8470 §6](https://www.rfc-editor.org/rfc/rfc8470.html#section-6)).

## ABNF + Normative Requirements
- `Early-Data = "1"` ([RFC 8470 §5.1](https://www.rfc-editor.org/rfc/rfc8470.html#section-5.1)).
- Multiple or invalid instances are treated equivalent to `1` by servers ([RFC 8470 §5.1](https://www.rfc-editor.org/rfc/rfc8470.html#section-5.1)).
- `425` should not be emitted unless request was in early data or had `Early-Data: 1` ([RFC 8470 §5.2](https://www.rfc-editor.org/rfc/rfc8470.html#section-5.2)).

## Proposed Module/Exports/Types
- Add `src/early-data.ts`:
  - `parseEarlyData`
  - `formatEarlyData`
  - `hasEarlyDataSignal`
  - `canSend425`
- Optional type aliases in `src/types.ts` (`EarlyDataValue`).
- Re-export in `src/index.ts`.

## Implementation Notes (edge cases, precedence, permissive vs strict)
- Keep parser signal-oriented and non-throwing.
- Keep runtime retry behavior out of module scope.
- Document request-only semantics and no `Connection` option usage for this header.

## Tests (with RFC section citations)
- Add `test/early-data.test.ts`.
- Cover ABNF parse/format, multiple/invalid instance treatment, and 425 eligibility helper behavior.

## Docs + Audit Updates
- Update `README.md` Supported RFCs and API map.
- Add recipe: when to return 425 and when to forward/retry.
- Create/update `AUDIT.md` documenting partial scope and non-goals.

## Risks/Decisions
- Risk: users may assume this provides full replay protection.
- Decision: emphasize these are header/decision helpers only.

## Execution Checklist
- [ ] Add `src/early-data.ts` and exports.
- [ ] Add tests with RFC citations.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
