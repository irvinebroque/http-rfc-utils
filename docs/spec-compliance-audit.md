# Specification Compliance Audit

Started: 2026-02-11
Repository: `http-rfc-utils`

## Scope and method

- Goal: identify implementation behavior that is out of compliance with the underlying RFC/W3C specification text.
- Method: line-by-line review of source files, with direct spec lookup for each issue candidate.
- Rule for findings: include code location, concrete behavior, normative spec requirement, and impact.

## Progress log

- [in progress] Source inventory captured (`src/**/*.ts`: 113 files, 27,799 lines).
- [done] First-pass domain audits completed in parallel (HTTP semantics, security/auth, linking/URI/discovery, JSON formats, OpenAPI, facades).
- [done] Coverage gap pass completed for previously unassigned files: `src/internal-cache-control-schema.ts`, `src/openapi/lint.ts`, `src/reporting.ts`, `src/sorting.ts`, `src/types/reporting.ts`.
- [in progress] Manual verification and deduplication of candidate findings with direct spec text checks.

## Findings

### Candidate findings from first pass (pending manual verification)

1. `src/structured-fields.ts:751` - Structured Fields dictionary boolean-true serialization with parameters appears to emit `=?1` when it should emit bare key + params (RFC 8941 Section 4.1.2).
2. `src/structured-fields.ts:89` - Decimal serializer appears to allow `1` rather than `1.0` for decimal values (RFC 8941 Section 4.1.5).
3. `src/structured-fields.ts:110` - Inner-list parser appears to permit HTAB/zero-space separators where RFC requires SP-delimited parsing (RFC 8941 Section 4.2.1.2).
4. `src/cache-status.ts:91` - `detail` parameter may reject token-form values (RFC 9211 Section 2.8).
5. `src/proxy-status.ts:98` - `next-protocol` may reject byte-sequence form (RFC 9209 Section 2.1.3).
6. `src/proxy-status.ts:158` - `details` formatter may permit non-string values (RFC 9209 Section 2.1.5).
7. `src/security-txt.ts:121` - formatter may allow generating output without required `Contact` field (RFC 9116 Section 2.5.3).
8. `src/trace-context.ts:229` - parser validates only version `00`, potentially rejecting higher version handling required by W3C Trace Context versioning rules.
9. `src/trace-context.ts:22` and `src/trace-context.ts:79` - tracestate value regex may allow invalid empty/trailing-space values.
10. `src/content-disposition.ts:52` - parser may accept non-token disposition type (RFC 6266 Section 4.1).
11. `src/content-disposition.ts:78` and `src/content-disposition.ts:106` - duplicate parameters may not invalidate parse (RFC 6266 Section 4.1).
12. `src/auth/digest.ts:301` - parser may accept `qop` without required `cnonce` and `nc` coupling (RFC 7616 Section 3.4 / 3.4.1).
13. `src/auth/basic.ts:95` - duplicate auth params in challenge may not invalidate parse (RFC 7235 Section 2.1).
14. `src/auth/digest.ts:91` - duplicate auth params in digest challenge may not invalidate parse (RFC 7235 Section 2.1).
15. `src/link.ts:155` - formatter may emit Link value without mandatory `rel` parameter (RFC 8288 Section 3.3).
16. `src/linkset.ts:444`, `src/linkset.ts:446`, `src/linkset.ts:563` - linkset JSON may allow top-level members beyond sole `linkset` member (RFC 9264 Section 4.2.1).
17. `src/ext-value.ts:79` and `src/ext-value.ts:88` - extended parameter decoding may accept inputs outside RFC 8187 `ext-value` ABNF.
18. `src/webfinger.ts:49` - `subject` currently required though RFC treats it as SHOULD (RFC 7033 Section 4.4.1).
19. `src/webfinger.ts:80` - WebFinger link parse may allow missing/empty `rel` though `rel` is mandatory (RFC 7033 Section 4.4.4.1).
20. `src/jsonpath/lexer.ts:191` - whitespace skipping may accept invalid shorthand grammar (RFC 9535 Section 2.5.1.1).
21. `src/jsonpath/lexer.ts:364` - numeric literal lexer may reject fractional/exponent JSON numbers in filters (RFC 9535 Section 2.3.5.1 + RFC 8259 Section 6).
22. `src/jsonpath/lexer.ts:257` - string lexer may accept raw control characters disallowed by grammar (RFC 9535 Section 2.3.1.1).
23. `src/jsonpath/parser.ts:467` - parser may allow non-singular queries where `singular-query` is required (RFC 9535 Section 2.3.5.1).
24. `src/jsonpath/parser.ts:508` - parser may skip required well-typedness validation for function expressions (RFC 9535 Section 2.4).
25. `src/jsonpath/evaluator.ts:170` - normalized path escaping may be incomplete for control characters (RFC 9535 Section 2.7).
26. `src/openapi/path-server-resolver.ts:204` - absent/empty root servers may not synthesize required default `/` server (OAS 3.1.1 Section 4.8.1.1).
27. `src/robots.ts:71` - blank line may incorrectly terminate group (RFC 9309 Sections 2.1 and 2.2).
28. `src/robots.ts:207` - multiple matching groups may not be combined (RFC 9309 Section 2.2.1).
29. `src/robots.ts:236` - robots path matching may skip percent-encoding normalization requirements (RFC 9309 Section 2.2.2).
30. `src/language.ts:40` - parser may accept invalid language-range grammar (RFC 9110 Section 12.5.4 + RFC 4647 Section 2.1).
31. `src/encoding.ts:24` - parser may accept invalid content-coding tokens (RFC 9110 Section 12.5.3).
32. `src/types/openapi.ts:142`/`144`/`145` - API key scheme typing allows optional/invalid required fields (OAS 3.1.1 Section 4.8.27.1).
33. `src/types/openapi.ts:156` - OAuth2 security scheme type omits required `flows` field (OAS 3.1.1 Section 4.8.27.1).
34. `src/types/openapi.ts:164` - OpenID Connect scheme makes `openIdConnectUrl` optional (OAS 3.1.1 Section 4.8.27.1).
35. `src/types/openapi.ts:290` - server variable `default` typed optional though required (OAS 3.1.1 Section 4.8.6.1).
36. `src/types/problem.ts:8`-`11` - Problem Details type may require fields that RFC 9457 treats as optional.
