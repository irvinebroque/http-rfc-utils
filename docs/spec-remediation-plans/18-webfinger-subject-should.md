# Finding 18 Remediation Plan: WebFinger `subject` is SHOULD, not hard requirement

## Summary
- `parseJrdObject` in `src/webfinger.ts` currently throws unless `subject` is present and a string.
- RFC 7033 defines `subject` as SHOULD in JRD responses, so parser behavior should not reject otherwise valid JRDs solely for missing subject.

## Spec Citation
- RFC 7033 Section 4.4.1: `subject` is a recommended (`SHOULD`) member, not an absolute requirement.
- URL: https://www.rfc-editor.org/rfc/rfc7033.html#section-4.4.1

## Impact
- Improves compatibility with real-world JRD payloads that omit `subject`.
- Changes parse behavior from hard failure to tolerant acceptance for this field.
- May require type/validation updates if current response model assumes mandatory `subject`.

## Implementation Steps
1. Update JRD parser logic to accept missing `subject` instead of throwing.
2. If present, continue enforcing `subject` must be a string.
3. Reconcile type contracts (`WebFingerResponse`) so parser output matches optional `subject` semantics.
4. Keep `validateJrd` responsible for reporting missing `subject` as a compliance warning-level issue (or explicit SHOULD guidance), not parse-time failure.
5. Ensure serializer behavior is documented when `subject` is absent.

## Test Plan
- Add test: JRD without `subject` parses successfully.
- Add test: non-string `subject` remains invalid.
- Add test: `validateJrd` reports missing `subject` with RFC 7033 Section 4.4.1 reference.
- Add compatibility test proving existing valid JRDs with `subject` are unchanged.

## Rollback/Guardrails
- Guardrail: do not weaken validation for fields that are true MUST requirements (`links[].rel`).
- Guardrail: keep throwing parser variant behavior for genuinely invalid types (for example, numeric `subject`).
- Rollback path: if API typing changes are too broad, introduce a parse result type that allows optional `subject` while preserving existing public type aliasing in a controlled minor release.
