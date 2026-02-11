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

- [ ] Chunk 1: `src/additional-status.ts` -> `src/early-hints.ts`
- [ ] Chunk 2: `src/encoding.ts` -> `src/jsonpath/index.ts`
- [ ] Chunk 3: `src/jsonpath/lexer.ts` -> `src/openapi/index.ts`
- [ ] Chunk 4: `src/openapi/link-callback.ts` -> `src/types.ts`
- [ ] Chunk 5: `src/types/auth.ts` -> `src/types/reporting.ts`
- [ ] Chunk 6: `src/types/security.ts` -> `src/well-known.ts`

## Findings

_Pending full line-by-line analysis._
