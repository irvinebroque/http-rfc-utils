# http-rfc-utils agent notes

## Commands

```bash
pnpm test
```

Preferred: keep `pnpm test` as the single canonical test entrypoint. If it does not run the RFC-aligned test runner yet, wire it to `pnpm exec tsx --test test/*.test.ts` and document only `pnpm test` here.

## Code style

- TypeScript uses 4-space indentation.
- Single quotes, semicolons required.
- Prefer `import type` for type-only imports.

## RFC Sources of Truth

Use these URLs as the source of truth and go to them when verifying behavior or edge cases:

- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) - HTTP Semantics
- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) - HTTP Caching
- [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html) - Cache-Control extensions (stale content)
- [RFC 8246](https://www.rfc-editor.org/rfc/rfc8246.html) - Immutable Cache-Control extension
- [RFC 7240](https://www.rfc-editor.org/rfc/rfc7240.html) - Prefer
- [RFC 7239](https://www.rfc-editor.org/rfc/rfc7239.html) - Forwarded
- [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266.html) - Content-Disposition
- [RFC 8187](https://www.rfc-editor.org/rfc/rfc8187.html) - Header Parameter Encoding
- [RFC 4647](https://www.rfc-editor.org/rfc/rfc4647.html) - Language Tag Matching
- [RFC 8941](https://www.rfc-editor.org/rfc/rfc8941.html) - Structured Field Values
- [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html) - Web Linking
- [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231.html) - HTTP/1.1 Semantics and Content (Accept)
- [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) - Problem Details for HTTP APIs
- [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339.html) - Date and Time on the Internet: Timestamps
- [RFC 850](https://www.rfc-editor.org/rfc/rfc850.html) - Standard for interchange of USENET messages (legacy HTTP-date format)
- [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535.html) - JSONPath: Query Expressions for JSON

## RFC planning command

Use `plans/` and `PLAN.md` to capture RFC planning notes and implementation overlap. When adding a new RFC plan, follow the existing files in `plans/` for structure and scope callouts.

## Adding a New RFC

### Scope + Sources

- List the RFC number, supported sections, and any ABNF snippets you are implementing; call out explicit out-of-scope behaviors.
- Use RFC editor URLs with section anchors as the canonical citations in scope notes and docs (see sources above).
- Align scope language with `AUDIT.md` (supported sections, partials, gaps).

### Implementation pattern

- Decide whether to add a new `src/*.ts` module or extend an existing one; keep exports aligned with the README RFC Map.
- Add a module header that lists RFC sections and a canonical `@see` link to the RFC Editor URL.
- Add inline RFC section comments near non-obvious logic (parsing, precedence, and edge-case rules).

Module header template:

```ts
/**
 * <Topic> per RFC XXXX.
 * RFC XXXX §x.y, §x.y.z.
 * @see https://www.rfc-editor.org/rfc/rfcXXXX.html#section-x.y
 */
```

Inline comment template:

```ts
// RFC XXXX §x.y: <rule being implemented>.
```

### Tests

- Every new test must cite the relevant RFC section in the test name or a preceding comment.
- Prefer examples from the RFC text; include edge-case tests for ABNF limits and MUST/SHOULD requirements.
- Follow the `test/conditional.test.ts` pattern: RFC section comments for describes and targeted RFC comments for edge cases.

Example pattern:

```ts
// RFC XXXX §x.y: <behavior>.
describe('<feature>', () => {
    it('handles <case>', () => {
        // ...
    });
});
```

### Docs + Audit updates

- Update `README.md` Supported RFCs, RFC References, and RFC Map for new exports.
- Update `docs/src/lib/rfc-map.ts` to match supported sections and module coverage (the RFCs page renders from `RFC_MAP`).
- Update `AUDIT.md` with coverage matrix, checklist status, and any known gaps/out-of-scope notes.

### Quality gates

- Run `pnpm exec tsx --test test/*.test.ts` after adding or changing tests.
- Verify README examples match exports and signatures.
- If you choose permissive parsing, document the compliance vs permissiveness decision in the module docblock and in `AUDIT.md`.

## Review checklist

- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): strong vs weak ETag comparisons; conditional precedence order.
- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html): directive order and numeric handling for Cache-Control.
- [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html): Link header formatting and parsing (quoted commas, escapes, boolean params).
- [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231.html): Accept parsing and q-value sorting rules.
- [RFC 7240](https://www.rfc-editor.org/rfc/rfc7240.html): Prefer/Preference-Applied parsing and formatting.
- [RFC 7239](https://www.rfc-editor.org/rfc/rfc7239.html): Forwarded field parsing/quoting rules.
- [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266.html): Content-Disposition parameter rules.
- [RFC 8187](https://www.rfc-editor.org/rfc/rfc8187.html): Extended parameter encoding (UTF-8'lang'value).
- [RFC 4647](https://www.rfc-editor.org/rfc/rfc4647.html): Basic filtering for language negotiation.
- [RFC 8941](https://www.rfc-editor.org/rfc/rfc8941.html): Structured field parsing/serialization.
- [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html): Problem Details fields and content type.
- [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339.html): timestamp parsing and formatting.
- [RFC 850](https://www.rfc-editor.org/rfc/rfc850.html): legacy HTTP-date parsing (obsolete format).
- CORS: single origin in `Access-Control-Allow-Origin`; `Vary: Origin` when echoing.
- Docs: README examples match exports and signatures.

## Test requirements

- Every new test case must cite the relevant RFC and section in the test name or a preceding comment.
- Prefer using examples from the RFC text when practical, and note the section that defines the behavior being asserted.
