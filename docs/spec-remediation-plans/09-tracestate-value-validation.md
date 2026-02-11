# Finding 09: tracestate value validation is too permissive

## Summary
Current tracestate value regex allows invalid empty values and values with trailing spaces. This violates tracestate member-value syntax and can allow non-compliant headers to pass validation.

## Citation
- W3C Trace Context, Section 3.3.1.3 (List Members): https://www.w3.org/TR/trace-context/#tracestate-header-field-values

## Risk
- Accepts invalid tracestate entries that may be dropped or mishandled by other implementations.
- Creates inconsistent parse/format round-trips and interoperability defects.

## Implementation Steps
1. Replace current value regex with explicit parser logic that enforces non-empty value and disallows trailing space.
2. Enforce character-set constraints from the spec for tracestate values.
3. Validate per-member before merge/serialization to prevent invalid state propagation.
4. Add targeted helper(s) for member-value checks to avoid regex drift.

## Tests
- Add tests rejecting empty value (`k=`).
- Add tests rejecting trailing-space value (`k=v `).
- Add tests for valid boundary values and allowed visible characters.
- Add round-trip tests to ensure formatter does not emit values parser would reject.

## Rollback / Guardrails
- Keep parsing failures localized to invalid member entries with clear failure mode.
- Avoid broad regex-only validation; keep character and boundary checks explicit.
- Protect with RFC-cited tests so future refactors do not reintroduce permissiveness.
