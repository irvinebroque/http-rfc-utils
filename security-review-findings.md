# Deep Security Review Findings

Date: 2026-02-10
Repository: `http-rfc-utils`
Reviewer: OpenCode (with subagents)

## Scope and methodology

- Scope is limited to shipped package code under `src/**/*.ts`.
- Excluded from review: `test/**`, `*.test.ts`, build artifacts (`dist/**`), coverage outputs, docs-only content not part of runtime package behavior.
- Basis for scope: `package.json` publish surface, `tsconfig.json` compile include/exclude, and `AGENTS.md` package structure guidance.
- Review requirement: line-by-line static review of every in-scope file with focus on security impact and RFC/spec compliance.

## In-scope file inventory

```text
src/additional-status.ts
src/alt-svc.ts
src/auth.ts
src/auth/basic.ts
src/auth/bearer.ts
src/auth/digest.ts
src/auth/index.ts
src/auth/pkce.ts
src/auth/shared.ts
src/auth/webauthn-base64url.ts
src/auth/webauthn-cose.ts
src/auth/webauthn-options.ts
src/cache-groups.ts
src/cache-status.ts
src/cache.ts
src/clear-site-data.ts
src/client-hints.ts
src/compression-dictionary.ts
src/conditional.ts
src/content-disposition.ts
src/cookie.ts
src/cors.ts
src/csp.ts
src/datetime.ts
src/deprecation.ts
src/digest.ts
src/early-data.ts
src/early-hints.ts
src/encoding.ts
src/etag.ts
src/ext-value.ts
src/fetch-metadata.ts
src/forwarded.ts
src/header-utils.ts
src/headers.ts
src/headers/index.ts
src/host-meta.ts
src/hsts.ts
src/http-signatures.ts
src/index.ts
src/internal-cache-control-schema.ts
src/internal-json-shape.ts
src/internal-percent-encoding.ts
src/internal-unicode.ts
src/internal-uri-encoding.ts
src/json-canonicalization.ts
src/json-merge-patch.ts
src/json-patch.ts
src/json-pointer.ts
src/jsonpath.ts
src/jsonpath/builtins.ts
src/jsonpath/evaluator.ts
src/jsonpath/index.ts
src/jsonpath/lexer.ts
src/jsonpath/parser.ts
src/jsonpath/tokens.ts
src/language.ts
src/link-template.ts
src/link.ts
src/linking/index.ts
src/linkset.ts
src/negotiate.ts
src/negotiation/index.ts
src/ni.ts
src/oauth-authorization-server-metadata.ts
src/object-map.ts
src/openapi.ts
src/openapi/index.ts
src/openapi/link-callback.ts
src/openapi/lint.ts
src/openapi/parameter-serialization.ts
src/openapi/path-server-resolver.ts
src/openapi/runtime-expression.ts
src/openapi/security-requirements.ts
src/pagination.ts
src/patch.ts
src/prefer.ts
src/priority.ts
src/problem.ts
src/proxy-status.ts
src/range.ts
src/referrer-policy.ts
src/reporting.ts
src/response.ts
src/robots.ts
src/security/index.ts
src/security-txt.ts
src/sorting.ts
src/structured-field-helpers.ts
src/structured-field-params.ts
src/structured-field-schema.ts
src/structured-fields.ts
src/targeted-cache-control.ts
src/trace-context.ts
src/types.ts
src/types/auth.ts
src/types/cache.ts
src/types/cookie.ts
src/types/digest.ts
src/types/discovery.ts
src/types/header.ts
src/types/json-canonicalization.ts
src/types/json-merge-patch.ts
src/types/json-patch.ts
src/types/jsonpath.ts
src/types/link.ts
src/types/negotiation.ts
src/types/openapi.ts
src/types/pagination.ts
src/types/problem.ts
src/types/reporting.ts
src/types/security.ts
src/types/shared.ts
src/types/signature.ts
src/types/status.ts
src/types/structured-fields.ts
src/types/uri.ts
src/uri-template.ts
src/uri.ts
src/webfinger.ts
src/well-known.ts
```

## Review execution log

- [x] Chunk 1: `src/additional-status.ts` -> `src/early-hints.ts`
- [x] Chunk 2: `src/encoding.ts` -> `src/jsonpath/index.ts`
- [x] Chunk 3: `src/jsonpath/lexer.ts` -> `src/openapi/index.ts`
- [x] Chunk 4: `src/openapi/link-callback.ts` -> `src/types.ts`
- [x] Chunk 5: `src/types/auth.ts` -> `src/types/reporting.ts`
- [x] Chunk 6: `src/types/security.ts` -> `src/well-known.ts`

## Findings

### Chunk 1

- `C1-F1` (High) `src/conditional.ts:55`/`:62`/`:65`/`:85` - permissive `If-None-Match` parsing can treat malformed mixed wildcard/tag syntax as a permissive no-match state; RFC 9110 Section 13.1.2 parser differential risk.
- `C1-F2` (Medium) `src/conditional.ts:20`/`:21` - conditional helper auto-injects permissive CORS defaults, potentially widening policy unexpectedly.
- `C1-F3` (Medium) `src/auth/basic.ts:32`/`:39` - Basic auth parsing accepts Node-forgiving Base64 without strict canonical checks; RFC 7617/RFC 4648 differential risk.
- `C1-F4` (Medium) `src/auth/digest.ts:224`/`:231`/`:232`/`:417` - duplicate Digest params accepted/ignored (first-wins), enabling ambiguity.
- `C1-F5` (Medium) `src/digest.ts:253`/`:255` - formatter can emit deprecated digest algorithms.
- `C1-F6` (Medium) `src/cookie.ts:299`/`:303`/`:318`/`:319` - `Set-Cookie` formatter allows semicolon in attribute values, enabling attribute injection.
- `C1-F7` (Low) `src/cache.ts:57`/`:68`/`:70` - raw ETag passthrough lacks robust validation guard.

### Chunk 2

- `C2-F1` (High) `src/headers.ts:51`/`:53`/`:64`/`:72`/`:80` - `mergeVary` does not validate field-name tokens, allowing malformed/header-injection content.
- `C2-F2` (High) `src/ext-value.ts:173`/`:189` - `language` in extended parameter encoding not validated before interpolation.
- `C2-F3` (High) `src/etag.ts:175` - `formatETag` does not enforce strict `etagc`/control constraints.
- `C2-F4` (Medium) `src/etag.ts:42`/`:92`/`:95`/`:96` - strong ETag generation uses 32-bit non-cryptographic hash and can collide.
- `C2-F5` (Medium) `src/hsts.ts:112`/`:113`/`:117` - HSTS max-age formatter can emit non-digit values for non-finite input.
- `C2-F6` (Medium) `src/http-signatures.ts:129`/`:501`/`:520`/`:721`/`:791`/`:793` - signature component naming/canonicalization gaps can create parser differentials.
- `C2-F7` (Medium) `src/jsonpath/evaluator.ts:694`/`:788`/`:803` - deep equality recursion has no cycle guard, enabling DoS via stack exhaustion.
- `C2-F8` (Medium) `src/host-meta.ts:30`/`:35`/`:51`/`:75`/`:96` - host-meta XML parsing uses regex, producing non-XML-compliant parsing differentials.

### Chunk 3

- `C3-F1` (Medium) `src/jsonpath/lexer.ts:256`/`:357`/`:358` - unescaped control characters accepted inside JSONPath string literals.
- `C3-F2` (Medium) `src/jsonpath/parser.ts:333`/`:337`/`:350`/`:520`/`:566` - parser recursion depth is unbounded.
- `C3-F3` (High) `src/link.ts:559`/`:560`/`:561`/`:562` - unterminated quoted-string accepted at EOF.
- `C3-F4` (Medium) `src/link.ts:309`/`:310`/`:418`/`:508`/`:509` - link parameter names are not strict token-validated.
- `C3-F5` (Medium) `src/ni.ts:151`/`:153`/`:155`/`:208`/`:215`/`:367`/`:379`/`:383` - object-form NI authority/query are interpolated without strict URI-component validation.

### Chunk 4

- `C4-F1` (High) `src/structured-fields.ts:643`/`:676`/`:744` - serializer emits token/key values without strict key/token validation.
- `C4-F2` (Medium) `src/openapi/security-requirements.ts:246`/`:288`/`:330` - non-oauth schemes accept non-empty scope arrays.
- `C4-F3` (Medium) `src/trace-context.ts:138`/`:286` - future-version `traceparent` suffix validation is too permissive.
- `C4-F4` (Medium) `src/security-txt.ts:67`/`:187` - invalid `Expires` can be treated as not expired.

### Chunk 5

- `C5-F1` (High) `src/types/json-canonicalization.ts:7` - canonical JSON type contract includes generic `number` (includes non-finite values).
- `C5-F2` (Medium) `src/types/openapi.ts:204`/`:205`/`:224` - required OpenAPI security fields modeled as optional.
- `C5-F3` (Low) `src/types/auth.ts:112`/`:125` - PKCE type model includes insecure `plain` flow without explicit policy gate.

### Chunk 6

- `C6-F1` (High) `src/uri.ts:117`-`:171` - context-free percent decoding decodes reserved delimiters and can alter URI semantics.
- `C6-F2` (Medium) `src/webfinger.ts:46`-`:48`/`:75` - non-object JSON is coerced to empty object in JRD parser.
- `C6-F3` (Medium) `src/webfinger.ts:83`-`:94` - WebFinger link relation/href validation too permissive.
- `C6-F4` (Medium) `src/webfinger.ts:191`-`:194` - non-standard trailing-slash equivalence in resource matching.

## Initial aggregate risk picture

- High concentration of parser differentials at HTTP boundary handling (conditional headers, Link, Structured Fields, trace context, WebFinger, host-meta).
- Multiple serializer/formatter trust-boundary gaps where untrusted values can become header output.
- DoS controls are missing in parts of JSONPath parsing/evaluation.
- Several findings are strictness and contract-hardening issues that require careful RFC alignment and compatibility handling.

## Triage disposition

### Confirmed actionable now

- `C1-F3` strict Base64 canonicalization in Basic auth parser.
- `C1-F4` reject duplicate Digest parameters.
- `C1-F6` harden Set-Cookie formatter against delimiter injection.
- `C2-F1` validate field-name tokens in `mergeVary`.
- `C2-F2` validate `language` in extended parameter encoding.
- `C2-F3` validate ETag value in formatter.
- `C2-F5` require finite non-negative integer for HSTS max-age.
- `C2-F6` harden HTTP Signatures component identifier/parameter validation.
- `C2-F7` add cycle guard/depth control for JSONPath deep equality.
- `C3-F1` reject unescaped control chars in JSONPath string literals.
- `C3-F2` add recursion/depth guard in JSONPath parser.
- `C3-F3` reject EOF unterminated quoted-string in Link parsing.
- `C3-F5` validate NI authority before formatting/mapping.
- `C4-F1` enforce key/token validation in Structured Fields serializer.
- `C4-F3` tighten future-version `traceparent` suffix validation.
- `C4-F4` treat invalid `security.txt` Expires as invalid/expired.

### Confirmed but lower-priority or policy choices

- `C1-F2`, `C1-F5`, `C1-F7`, `C2-F4`, `C2-F8`, `C6-F2`, `C6-F3`.

### Dropped / no immediate code change

- `C4-F2`, `C5-F1`, `C5-F2` (not security vulnerabilities in current runtime behavior).
- `C1-F1`, `C3-F4`, `C5-F3`, `C6-F1`, `C6-F4` (compatibility-sensitive or intentional behavior; avoid breaking RFC/interoperability without additive strict-mode design).

## Implementation plan (subagent draft)

- Prioritize output hardening and parser ambiguity first (`C1-F6`, `C2-F1`, `C2-F2`, `C2-F3`, `C2-F5`, `C4-F1`, `C1-F4`, `C3-F3`).
- Implement JSONPath DoS protections (`C2-F7`, `C3-F2`) with limits aligned to existing `JsonPathOptions` behavior.
- Implement protocol-specific strictness fixes (`C1-F3`, `C3-F5`, `C4-F3`, `C4-F4`, `C2-F6`) with fail-closed handling for malformed input.
- Add RFC-cited tests for each changed behavior and run targeted suites before full repository gates.

## Plan critique and revision (subagent review)

- `C3-F1` appears already addressed in current `src/jsonpath/lexer.ts` and is deferred from implementation.
- `C4-F3` future-version `traceparent` strictness is revised to avoid over-parsing unknown fields; only enforce W3C-required delimiter/prefix validity.
- Compatibility-sensitive behavior changes are staged to reject malformed inputs while preserving valid RFC-conformant traffic.
- Revised execution order:
  1. Formatter/output safety hardening.
  2. Parser ambiguity/fail-open fixes.
  3. JSONPath resilience controls.
  4. HTTP Signatures strict component validation.

## Implementation status

Implemented in code and tests:

- `C1-F3` Basic auth now rejects non-canonical Base64 credentials.
- `C1-F4` Digest auth now rejects duplicate parameter names.
- `C1-F6` Set-Cookie formatter now rejects `;` delimiter injection in attribute values.
- `C2-F1` `mergeVary` now validates field-name members and rejects invalid/wildcard-mixed lists.
- `C2-F2` `encodeExtValue` now validates RFC 8187 language tags before encoding.
- `C2-F3` `formatETag` now validates entity-tag value grammar before formatting.
- `C2-F5` HSTS formatter now requires finite non-negative integer `max-age`.
- `C2-F6` HTTP Signature component parsing/formatting now enforces strict component and parameter validation.
- `C2-F7` JSONPath deep equality is now cycle-safe and limit-aware.
- `C3-F2` JSONPath parser now has recursion/depth guard.
- `C3-F3` Link parsing now fails closed on EOF unterminated quoted-string for current malformed link-value.
- `C3-F5` NI URI format/mapping now validates authority before interpolation.
- `C4-F1` Structured Field serializer now validates dict/parameter keys and token values.
- `C4-F3` Trace Context higher-version suffix checks now enforce required forward-compatible prefix constraints.
- `C4-F4` Invalid `security.txt` `Expires` now evaluates as expired.

Deferred after critique:

- `C3-F1` (already addressed in current lexer implementation; no additional change applied).

## Verification run

- Targeted security suites passed:
  - `pnpm exec tsx --test test/auth.test.ts test/cookie.test.ts test/headers.test.ts test/ext-value.test.ts test/etag.test.ts test/hsts.test.ts test/structured-fields.test.ts test/ni.test.ts test/link.test.ts test/trace-context.test.ts test/security-txt.test.ts test/jsonpath.test.ts test/http-signatures.test.ts`
- Repository gates passed:
  - `pnpm check:structure`
  - `pnpm typecheck`
  - `pnpm build`
- Full suite passed:
  - `pnpm test` (`2473` passed, `0` failed)
