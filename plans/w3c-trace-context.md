## Summary
Add W3C Trace Context support for `traceparent` and `tracestate` with robust parse/format/validate/mutate helpers tailored for backend HTTP services.

## Scope (spec sections)
- In scope: `traceparent` format and processing ([W3C Trace Context §3.2](https://www.w3.org/TR/trace-context/#traceparent-header), [§4.3](https://www.w3.org/TR/trace-context/#a-traceparent-is-received)).
- In scope: `tracestate` format, ordering, limits, and mutation ([§3.3](https://www.w3.org/TR/trace-context/#tracestate-header), [§3.5](https://www.w3.org/TR/trace-context/#mutating-the-tracestate-field)).
- In scope: combined processing model and invalid parent behavior ([§4.2](https://www.w3.org/TR/trace-context/#no-traceparent-received), [§4.3](https://www.w3.org/TR/trace-context/#a-traceparent-is-received)).
- Out of scope: non-HTTP transports and tracing backend sampling policy.

## Syntax/Normative Requirements
- Enforce lowercase-hex constraints for trace identifiers and flags.
- Validate non-zero `trace-id` and `parent-id`.
- Parse and preserve tracestate ordering; cap members according to spec limits.
- Drop/ignore `tracestate` when `traceparent` is invalid in combined helpers.

## Proposed Module/Exports/Types
- Add `src/trace-context.ts`:
  - `parseTraceparent`, `formatTraceparent`, `validateTraceparent`
  - `parseTracestate`, `formatTracestate`, `validateTracestate`
  - `updateTraceparentParent`, `restartTraceparent`
  - `addOrUpdateTracestate`, `removeTracestateKey`, `truncateTracestate`
- Add types in `src/types.ts`:
  - `Traceparent`, `TracestateEntry`, `ParsedTraceContext`, `TraceContextValidationResult`
- Re-export from `src/index.ts`.

## Implementation Notes
- Keep parsing strict and non-throwing (`null`/errors object).
- Keep formatting canonical (lowercase hex, fixed delimiters).
- Mutation helpers should enforce sampled-bit and parent-id mutation coupling.

## Tests
- Add `test/trace-context.test.ts` with section-cited cases:
  - valid and invalid `traceparent`
  - tracestate key/value constraints and ordering
  - truncation and mutation behavior
  - combined invalid-parent handling

## Docs + Audit Updates
- Update `README.md` supported standards and RFC/spec map.
- Add examples for incoming parse and outbound mutation.
- Create/update `AUDIT.md` with scope and non-goals.

## Risks/Decisions
- Risk: version handling beyond `00` can be implemented inconsistently.
- Decision: strict `00` path + clearly documented higher-version fallback behavior.

## Execution Checklist
- [ ] Add `src/trace-context.ts`.
- [ ] Add and export types/functions.
- [ ] Add RFC/spec-cited tests.
- [ ] Update README/audit docs.
- [ ] Run `pnpm test`.
