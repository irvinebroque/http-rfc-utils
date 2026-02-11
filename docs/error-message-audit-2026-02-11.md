# Error Message Audit (2026-02-11)

## Scope
- Reviewed package source under `src/**/*.ts`.
- Audited explicit throw paths (`throw new Error(...)`, custom `Error` subclasses, and direct `throw error` propagation points).
- Focused on errors surfaced by formatter/validator APIs where callers need actionable remediation.

## Audit Criteria
Each throw message is considered strong when it:
1. Names the failing field/parameter/path.
2. States the expected rule clearly.
3. Includes received context/value where safe.
4. Stays concise (ideally one sentence).
5. Avoids ambiguous duplicates when multiple failure branches exist.

## Progress Log
- 2026-02-11 13:xx: Inventory completed (`335` throw sites across `49` files in `src/`).
- 2026-02-11 13:xx: Deep throw-site quality review completed across package sources; weak sites isolated and prioritized below.

## Coverage Summary
- Total package source files reviewed: `124`.
- Files with throw sites: `49`.
- Throw sites reviewed: `335`.
- Strong as-is: `296`.
- Needs improvement: `39`.

## Findings: Throw Sites Needing Improvement

| Priority | File | Line(s) | Current Message | Issue | Proposed Message Pattern |
|---|---|---:|---|---|---|
| P1 | `src/cache-status.ts` | 33, 36 | `Invalid Cache-Status fwd token` | Ambiguous duplicate; no expected/received context | `Cache-Status param "fwd" must be an RFC 8941 key token string; received ${String(value)}.` |
| P1 | `src/cache-status.ts` | 47, 50 | `Invalid Cache-Status fwd-status value` | Missing integer requirement and received value | `Cache-Status param "fwd-status" must be an RFC 8941 integer; received ${String(value)}.` |
| P1 | `src/cache-status.ts` | 61, 64 | `Invalid Cache-Status ttl value` | Missing integer requirement and received value | `Cache-Status param "ttl" must be an RFC 8941 integer; received ${String(value)}.` |
| P1 | `src/proxy-status.ts` | 69 | `Invalid Proxy-Status next-protocol value` | Does not explain Latin-1 byte-sequence failure | `Proxy-Status param "next-protocol" must contain only Latin-1 bytes when serialized as a Byte Sequence.` |
| P1 | `src/proxy-status.ts` | 123 | `Invalid Proxy-Status next-protocol value` | Same wording reused for non-string type failure | `Proxy-Status param "next-protocol" must be a string; received ${String(value)}.` |
| P1 | `src/proxy-status.ts` | 137 | `Invalid Proxy-Status received-status value` | Missing integer requirement and received value | `Proxy-Status param "received-status" must be an RFC 8941 integer; received ${String(value)}.` |
| P1 | `src/proxy-status.ts` | 148 | `Invalid Proxy-Status details value` | Missing expected type and received value | `Proxy-Status param "details" must be a string; received ${String(value)}.` |
| P1 | `src/proxy-status.ts` | 165 | `Invalid Proxy-Status info-code value` | Missing integer requirement and received value | `Proxy-Status param "info-code" must be an RFC 8941 integer; received ${String(value)}.` |
| P1 | `src/proxy-status.ts` | 176 | `Invalid Proxy-Status alert-id value` | Missing integer requirement and received value | `Proxy-Status param "alert-id" must be an RFC 8941 integer; received ${String(value)}.` |
| P1 | `src/fetch-metadata.ts` | 105 | `Invalid Sec-Fetch-Dest token` | No received token or allowed-value guidance | `Sec-Fetch-Dest must be a valid registered token; received ${String(value)}.` |
| P1 | `src/fetch-metadata.ts` | 124 | `Invalid Sec-Fetch-Mode token` | No received token or allowed-value guidance | `Sec-Fetch-Mode must be one of cors, navigate, no-cors, same-origin, websocket; received ${String(value)}.` |
| P1 | `src/fetch-metadata.ts` | 143 | `Invalid Sec-Fetch-Site token` | No received token or allowed-value guidance | `Sec-Fetch-Site must be one of cross-site, same-origin, same-site, none; received ${String(value)}.` |
| P1 | `src/oauth-authorization-server-metadata.ts` | 410 | `Metadata field "issuer" does not exactly match expected issuer` | Does not include expected vs actual issuer | `Metadata field "issuer" must exactly match expected issuer "${expectedIssuer}"; received "${issuer}".` |
| P2 | `src/header-utils.ts` | 629 | `Invalid media type token` | Shared helper lacks offending value/context | `Media type "${type}/${subtype}" must use valid HTTP token syntax for both type and subtype.` |
| P2 | `src/header-utils.ts` | 635 | `Invalid media type parameter name` | Missing parameter name/value | `Media type parameter name "${parameter.name}" must be a valid HTTP token.` |
| P2 | `src/patch.ts` | 128 | `Invalid media type token in Accept-Patch entry` | Missing failing entry context | `Accept-Patch entry "${type}/${subtype}" must use valid HTTP token syntax.` |
| P2 | `src/patch.ts` | 134 | `Invalid parameter name in Accept-Patch entry` | Missing parameter context | `Accept-Patch parameter name "${name}" must be a valid HTTP token.` |
| P2 | `src/compression-dictionary.ts` | 175 | `Invalid Use-As-Dictionary match value` | Missing expected shape/received value | `Use-As-Dictionary "match" must be a non-empty string; received ${String(value.match)}.` |
| P2 | `src/compression-dictionary.ts` | 183 | `Invalid Use-As-Dictionary type token` | Missing token rule and actual | `Use-As-Dictionary "type" must be an RFC 8941 token; received ${String(value.type)}.` |
| P2 | `src/compression-dictionary.ts` | 194 | `Invalid Use-As-Dictionary match-dest value` | Missing failing item index | `Use-As-Dictionary "match-dest" entry at index ${index} must be a non-empty string.` |
| P2 | `src/alt-svc.ts` | 147 | `Invalid Alt-Used host` | Missing expected syntax and actual value | `Alt-Used host must be a valid host token or bracketed IPv6 literal; received ${String(altUsed.host)}.` |
| P2 | `src/alt-svc.ts` | 160 | `Invalid Alt-Used port` | Missing explicit range and actual value | `Alt-Used port must be an integer in range 0-65535; received ${String(altUsed.port)}.` |
| P2 | `src/alt-svc.ts` | 216 | `Invalid Alt-Svc protocol-id` | Missing expected token rule and actual | `Alt-Svc protocol-id must be a valid HTTP token; received ${String(alternative.protocolId)}.` |
| P2 | `src/client-hints.ts` | 69 | `Invalid client hint token` | Missing failing hint value | `Accept-CH hint must be a valid RFC 8941 key token; received ${String(hint)}.` |
| P2 | `src/security-txt.ts` | 123 | `Contact field is required` | Missing object path and expected cardinality | `security.txt config.contact must include at least one non-empty Contact field value.` |
| P2 | `src/well-known.ts` | 156 | `Invalid origin for well-known URI builder` | Missing received input | `Well-known URI builder origin must be a valid absolute URL string; received ${String(origin)}.` |
| P2 | `src/openapi/security-requirements.ts` | 81, 98, 141 | `OpenAPI security requirements validation failed.` (fallback branch) | Fallback too generic if diagnostics absent | `OpenAPI security requirements validation failed in strict mode with no diagnostic detail; verify schemes and scopes.` |
| P2 | `src/openapi/link-callback.ts` | 351 | `OpenAPI runtime resolution failed.` (fallback branch) | Fallback too generic if issues list empty | `OpenAPI runtime resolution failed in strict mode with no diagnostic detail; verify runtime expressions.` |
| P2 | `src/auth/digest.ts` | 545 | `auth-int is not supported` | Missing field name and alternatives | `Digest qop="auth-int" is not supported; use qop="auth" or omit qop.` |
| P3 | `src/cache-groups.ts` | 43 | `Cache group members must be strings` | No index/value context for batch failures | `Cache group member at index ${index} must be a string; received ${String(member)}.` |
| P3 | `src/jsonpath/lexer.ts` | 475 | `Expected ${type} but got ${this.current().type}` | Missing parse position context | `JSONPath parse error at position ${this.current().pos}: expected ${type}, found ${this.current().type}.` |
| P3 | `src/structured-fields.ts` | 608 | `Invalid numeric structured field value` | No finite-number requirement or received value | `Structured field numeric value must be a finite number; received ${String(value)}.` |
| P3 | `src/json-canonicalization.ts` | 77, 91 | `JSON value contains a cyclic reference at $` | Cycle path loses actual location | `JSON value contains a cyclic reference at path ${path}.` |

## Notes on Strong Existing Messages
- Most throw sites already include concrete field names, expected constraints, and index/path context.
- `WebAuthn` validators, JSON Patch operation checks, and OpenAPI parameter serializer diagnostics are generally high quality and already agent-actionable.

## Next Implementation Plan
1. Apply low-churn message-only fixes first (`cache-status`, `proxy-status`, `fetch-metadata`, `oauth-authorization-server-metadata`).
2. Improve shared helper/context messages (`header-utils`, `patch`, `compression-dictionary`, `alt-svc`, `client-hints`, `security-txt`, `well-known`).
3. Tighten fallback diagnostics and parse-error context (`openapi/security-requirements`, `openapi/link-callback`, `jsonpath/lexer`, `structured-fields`, `json-canonicalization`, `cache-groups`, `auth/digest`).

## Implementation
- Updated formatter/validator throw messages in the audited modules to include explicit field/parameter names, expected constraints, and safe received context (value, type, index, or protocol where applicable).
- Removed ambiguous duplicate wording in multi-branch validations by splitting type-vs-constraint failures (for example in `cache-status`, `proxy-status`, and media type formatting helpers).
- Improved strict-mode fallback diagnostics in OpenAPI helpers so fallback text is explicit about missing diagnostic detail and likely remediation focus.
- Added token-position context to JSONPath lexer `expect(...)` errors so parser failures include the active token offset.
- Added serialization-path plumbing in JSON canonicalization so cycle errors now report the actual detected path (for example `$[0]["parent"]`) instead of always reporting `$`.
- Verified via focused typecheck/tests that the updated diagnostics are compatible with existing module behavior.

## Verification Log
- `pnpm typecheck` -> pass.
- `pnpm exec tsx --test test/json-canonicalization.test.ts` -> pass.
- `pnpm exec tsx --test test/openapi-security-requirements.test.ts` -> pass.
- `pnpm exec tsx --test test/jsonpath.test.ts` -> pass.
- `pnpm exec tsx --test test/cache-status.test.ts test/proxy-status.test.ts test/fetch-metadata.test.ts test/patch.test.ts test/alt-svc.test.ts test/client-hints.test.ts test/security-txt.test.ts test/well-known.test.ts test/compression-dictionary.test.ts` -> initially failed due expected-message regexes, then passed after updating assertions to match improved diagnostics.
