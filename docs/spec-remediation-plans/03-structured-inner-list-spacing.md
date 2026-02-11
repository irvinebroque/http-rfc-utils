# Remediation Plan: Structured Inner List Requires SP Separation

## Finding summary

- Confirmed issue: inner-list parsing accepts separators other than SP (for example HTAB) and may allow zero-space adjacency between items.
- Location: `src/structured-fields.ts:110`.

## Spec citation (section + URL)

- RFC 8941 Section 3.1.1 (ABNF): `inner-list = "(" *SP [ sf-item *( 1*SP sf-item ) *SP ] ")" parameters`.
- RFC 8941 Section 4.2.1.2 (Parsing an Inner List): after each item, next character MUST be SP or `)`.
- URL: https://www.rfc-editor.org/rfc/rfc8941.html#section-3.1.1
- URL: https://www.rfc-editor.org/rfc/rfc8941.html#section-4.2.1.2

## Impact/risk

- Overly permissive parsing accepts non-conformant wire values and can hide producer defects.
- Divergence from strict parsing increases interoperability risk across implementations.

## Step-by-step implementation plan

1. Isolate inner-list whitespace handling from generic OWS handling.
2. Replace broad whitespace skipping in the inner-list loop with SP-only advancement for leading/trailing positions inside `(` and `)`.
3. After each parsed item, enforce that the next character is exactly SP or `)`.
4. Ensure zero-space adjacency between two items fails parsing.
5. Keep top-level list/dictionary OWS behavior unchanged outside inner-list parsing.

## Test plan (specific existing test files to update/add)

- Update `test/structured-fields.test.ts`:
  - Add failing cases for HTAB-separated inner-list members.
  - Add failing cases for adjacent items with no SP separator.
  - Add passing cases that use legal one-or-more SP separators and optional leading/trailing SP inside the inner list.

## Rollback/guardrails

- Guardrail: only tighten inner-list parsing; avoid collateral changes to list/dictionary OWS handling.
- Guardrail: preserve tolerant handling at top-level where RFC allows OWS around commas.
- Rollback: restore previous inner-list whitespace handling and keep regression tests marked for compliance follow-up.
