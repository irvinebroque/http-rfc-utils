## Summary
Add RFC 9652 support with a dedicated `Link-Template` module that parses, formats, and expands Link-Template header entries using existing Structured Fields and URI Template utilities.

## RFC Scope (sections + anchors)
- In scope: Link-Template field structure and semantics ([RFC 9652 §2](https://www.rfc-editor.org/rfc/rfc9652.html#section-2)).
- In scope: `var-base` behavior and variable URI resolution ([RFC 9652 §2.1](https://www.rfc-editor.org/rfc/rfc9652.html#section-2.1)).
- In scope: support all URI Template levels for template and `anchor` ([RFC 9652 §2](https://www.rfc-editor.org/rfc/rfc9652.html#section-2), [RFC 6570 §3](https://www.rfc-editor.org/rfc/rfc6570.html#section-3)).
- Out of scope: dereferencing variable-URI metadata and registry operations.

## ABNF + Normative Requirements
- `Link-Template` is an SF List where each member is an SF String with parameters ([RFC 9652 §2](https://www.rfc-editor.org/rfc/rfc9652.html#section-2), [RFC 9651 §3.1](https://www.rfc-editor.org/rfc/rfc9651.html#section-3.1)).
- `rel` and `anchor` parameter values must be Strings; `anchor` may be a URI Template ([RFC 9652 §2](https://www.rfc-editor.org/rfc/rfc9652.html#section-2)).
- Target attributes must be String unless non-ASCII, then Display String ([RFC 9652 §2](https://www.rfc-editor.org/rfc/rfc9652.html#section-2), [RFC 9651 §3.3.8](https://www.rfc-editor.org/rfc/rfc9651.html#section-3.3.8)).

## Proposed Module/Exports/Types
- Add `src/link-template.ts`:
  - `parseLinkTemplateHeader`
  - `formatLinkTemplateHeader`
  - `expandLinkTemplate`
  - `resolveTemplateVariableUri`
- Add types in `src/types.ts`:
  - `LinkTemplate`
  - `ExpandedLinkTemplate`
- Re-export in `src/index.ts`.

## Implementation Notes (edge cases, precedence, permissive vs strict)
- Strict: fail parse on invalid SF syntax.
- Strict: require member bare item to be String.
- Permissive: preserve unknown parameters.
- Decide and document duplicate constrained parameter policy (`rel`, `anchor`, `var-base`): recommended fail-fast.

## Tests (with RFC section citations)
- Add `test/link-template.test.ts`.
- Cover parsing/formatting, templated `anchor`, `var-base` resolution, and template-level compatibility.
- Add Display String coverage in `test/structured-fields.test.ts` to satisfy RFC 9652 non-ASCII attribute requirement.

## Docs + Audit Updates
- Update `README.md` Supported RFCs and RFC map row.
- Add examples for Link-Template parse/format and expansion.
- Create/update `AUDIT.md` with RFC 9652 coverage and out-of-scope notes.

## Risks/Decisions
- Main risk: RFC 9652 depends on RFC 9651 Display String support.
- Decision: keep parser strict and extension parameters forward-compatible.

## Execution Checklist
- [ ] Add `src/link-template.ts` and exports.
- [ ] Add types and index exports.
- [ ] Add RFC-cited tests.
- [ ] Update README and audit docs.
- [ ] Run `pnpm test`.
