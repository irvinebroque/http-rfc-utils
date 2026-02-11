# Finding 08: traceparent validation should be forward-compatible

## Summary
`validateTraceparent` currently accepts only version `00`. Trace Context requires handling versioning rules so future non-`00` versions are not rejected solely for being newer (except invalid reserved values like `ff`).

## Citation
- W3C Trace Context, Section 3.2.4 (Versioning): https://www.w3.org/TR/trace-context/#versioning
- W3C Trace Context, Section 3.2.2.4 (`trace-flags`) and header format context: https://www.w3.org/TR/trace-context/#traceparent-header

## Risk
- Rejects valid future-version trace context headers, harming interoperability.
- Breaks distributed tracing propagation across mixed-version systems.

## Implementation Steps
1. Split validation into: common structural checks, v00-specific checks, and future-version fallback checks.
2. Keep `ff` rejected per spec; accept other lowercase hex versions when structural invariants hold.
3. Preserve strict v00 semantics (all current constraints unchanged for `00`).
4. For unknown versions, validate delimiter placement and base field syntax without over-constraining future extensions.
5. Document behavior explicitly in module docs and type-level comments.

## Tests
- Add tests confirming `00` behavior is unchanged.
- Add tests for valid non-`00` versions (for example `01`) with correct structural format.
- Add tests rejecting `ff` and malformed version values.
- Add negative tests for bad delimiter/length/layout in unknown versions.

## Rollback / Guardrails
- Keep unknown-version handling limited to spec-defined minimum validation to avoid accidental permissiveness.
- Add regression tests that lock down current v00 rejection behavior for malformed IDs/flags.
- If ambiguity arises, prefer returning invalid over guessing semantics for unknown version-specific fields.
