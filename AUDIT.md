# RFC Audit Report - http-rfc-utils
Date: 2026-02-08
Scope: README.md, AUDIT.md, src/*.ts, test/*.test.ts

## Scope matrix (claims vs code)
Legacy docs note: `docs/src/content/docs/reference/rfcs.mdx` is referenced by older audits but is not present in this repository snapshot; the "Legacy docs page" column is historical context only.
| RFC | README.md | Legacy docs page | Code modules | Tests | Notes |
| --- | --- | --- | --- | --- | --- |
| RFC 9110 | Yes (sections list) | Yes | etag, conditional, datetime (HTTP-date), encoding, language, headers, range, response | etag, conditional, encoding, language, headers, datetime, range, integration | README top list omits Accept-Encoding/Range/Retry-After/Vary sections implemented in code. |
| RFC 9111 | Yes | Yes | cache, response | cache, integration | - |
| RFC 5861 | Yes | No | cache | cache | Missing from docs list. |
| RFC 8246 | Yes | No | cache | cache | Missing from docs list. |
| RFC 8288 | Yes (3-3.3, 6.2.2) | Yes | link, pagination, response | link, pagination, integration | RFC 8288 uses sections 3.1-3.4 and 6 (internationalization). README section ref should be updated. |
| RFC 9264 | Yes (4.1, 4.2, 5) | Yes | linkset | linkset | Linkset media types and link relation. |
| RFC 9727 | Yes (2, 3, 4, 7) | Yes | linkset | linkset | API Catalog well-known URI, link relation, and profile. |
| RFC 7231 | Yes (5.3.1-5.3.2) | Yes | negotiate | negotiate, integration | Obsoleted by RFC 9110; Accept parsing remains valid. |
| RFC 7240 | Yes (2-3) | Yes | prefer | prefer | - |
| RFC 7239 | Yes (4) | Yes | forwarded | forwarded | - |
| RFC 6265 | Yes | Yes | cookie | cookie | - |
| RFC 6266 | Yes (4-4.3) | Yes | content-disposition, response | content-disposition | - |
| RFC 8187 | Yes (3.2) | Yes | content-disposition | content-disposition | - |
| RFC 6797 | Yes | Yes | hsts | hsts | - |
| RFC 7617 | Yes | Yes | auth | auth | - |
| RFC 6750 | Yes | Yes | auth | auth | - |
| RFC 7616 | Yes (3.3-3.5) | No | auth | auth | Digest authentication; qop=auth-int entity-body handling out-of-scope. |
| RFC 4647 | Yes (3) | Yes | language | language | - |
| RFC 8941 | Yes (3-4) | Yes | structured-fields | structured-fields | RFC 9651 Date type now supported. |
| RFC 9651 | Yes (3.3.7) | No | structured-fields, types | structured-fields | Date bare item (@unix-seconds) parsing and serialization. |
| RFC 9745 | Yes (2-4) | No | deprecation, link | deprecation | Deprecation header parsing/formatting; deprecation link relation. |
| RFC 8942 | Yes | Yes | client-hints | client-hints | - |
| RFC 9211 | Yes | Yes | cache-status | cache-status | - |
| RFC 9209 | Yes (2-2.4) | No | proxy-status | proxy-status | Proxy-Status parsing/formatting; all 32 error types. |
| RFC 9530 | Yes (2-5) | No | digest | digest | Content-Digest, Repr-Digest, Want-* preferences; SHA-256/SHA-512 only. |
| RFC 9457 | Yes (3.1-3.2, 4.1) | Yes | problem | problem, integration | - |
| RFC 6901 | Yes (3-7) | Yes | json-pointer | json-pointer | - |
| RFC 9535 | Yes (2.1-2.7) | No | jsonpath | jsonpath | JSONPath query expressions; built-in functions only; I-Regexp out-of-scope. |
| RFC 3339 | Yes (5.6) | Yes | datetime | datetime, integration | - |
| RFC 850 | Yes (2) | Yes | datetime | datetime | - |
| RFC 8594 | Yes (3, 6) | Yes | headers, link | headers | Sunset header and link relation. |
| RFC 3986 | Yes (2, 3.1, 3.2.2, 5.2.4, 6.2) | No | uri | uri | URI normalization and comparison; full parsing delegated to native URL. |
| RFC 6570 | Yes (1.2, 2-3) | No | uri-template | uri-template | URI Template parsing and expansion; all Level 4 operators and modifiers. |
| RFC 9421 | Yes (2-4) | No | http-signatures | http-signatures | HTTP Message Signatures; signature base creation; cryptographic operations out-of-scope. |
| Fetch/CORS | Yes | Mentioned (alignment note) | cors, response | cors, integration | - |
| RFC 9309 | Yes (2.1-2.4) | No | robots | robots | Robots exclusion protocol: parsing, formatting, path matching with wildcards and $. |
| RFC 9116 | Yes (2.3, 2.5, 3) | No | security-txt | security-txt | security.txt: parsing, formatting (CRLF), validation, expiry checking. |
| RFC 7033 | Yes (4.2-4.4) | No | webfinger | webfinger | WebFinger JRD: parsing, formatting, validation, resource matching, rel filtering. |
| RFC 6415 | Yes (2-3) | No | host-meta | host-meta | Host metadata: XRD XML and JSON parsing/formatting. |

## RFC checklists (normative + ABNF)
Status legend: Compliant / Partial / Out-of-scope

### RFC 9110 (HTTP Semantics)
Relevant sections: 5.6.7, 8.8.3-8.8.3.2, 10.2.3, 12.4.2, 12.5.3, 12.5.5, 13.1.1-13.1.5, 13.2.2, 14.1-14.4, 15.5.17

ABNF (subset):
```abnf
ETag            = entity-tag
entity-tag      = [ weak ] opaque-tag
weak            = %s"W/"
opaque-tag      = DQUOTE *etagc DQUOTE
etagc           = %x21 / %x23-7E / obs-text

If-Match           = "*" / #entity-tag
If-None-Match      = "*" / #entity-tag
If-Modified-Since  = HTTP-date
If-Unmodified-Since = HTTP-date
If-Range           = entity-tag / HTTP-date

Accept-Encoding    = #( codings [ weight ] )
codings            = content-coding / "identity" / "*"
weight             = OWS ";" OWS "q=" qvalue
qvalue             = ( "0" [ "." 0*3DIGIT ] ) / ( "1" [ "." 0*3("0") ] )

Range              = range-unit "=" range-set
range-set          = 1#range-spec
range-spec         = int-range / suffix-range / other-range
int-range          = first-pos "-" [ last-pos ]
suffix-range       = "-" suffix-length

Content-Range      = range-unit SP ( range-resp / unsatisfied-range )
range-resp         = incl-range "/" ( complete-length / "*" )
unsatisfied-range  = "*/" complete-length

Retry-After = HTTP-date / delay-seconds
Vary        = #( "*" / field-name )

HTTP-date   = IMF-fixdate / obs-date
```

Checklist (status):
- 8.8.3 entity-tag syntax + etagc validation: Compliant (parseETag enforces etagc). (`src/etag.ts`)
- 8.8.3.2 strong vs weak comparison: Compliant (compareETags). (`src/etag.ts`)
- 13.1.1 If-Match uses strong comparison: Compliant. (`src/conditional.ts`)
- 13.1.2 If-None-Match uses weak comparison: Compliant. (`src/conditional.ts`)
- 13.2.2 precondition evaluation order: Compliant for If-Match/If-Unmodified-Since/If-None-Match/If-Modified-Since. If-Range handled in `src/range.ts` (out-of-scope for `evaluatePreconditions`).
- 13.1.4 invalid If-Unmodified-Since MUST be ignored: Compliant (invalid date is ignored). (`src/conditional.ts`)
- 12.4.2 qvalue grammar enforcement for Accept-Encoding: Compliant (invalid qvalues rejected). (`src/encoding.ts`)
- 12.5.3 identity and wildcard semantics: Compliant. (`src/encoding.ts`)
- 14.2 Range handling: Partial (multipart/byteranges response formatting out-of-scope; method gating implemented). (`src/range.ts`)
- 14.4 Content-Range formatting/parsing: Compliant for bytes. (`src/range.ts`)
- 15.5.17 416 with Content-Range "*/length": Compliant for bytes. (`src/range.ts`)
- 5.6.7 HTTP-date parsing (IMF-fixdate/rfc850/asctime) and formatting: Compliant. (`src/datetime.ts`)
- 10.2.3 Retry-After parse/format: Compliant. (`src/headers.ts`)
- 12.5.5 Vary merge with "*" handling: Compliant. (`src/headers.ts`)

### RFC 9111 (HTTP Caching)
Relevant sections: 1.2.2, 5.2, 5.2.2

ABNF (subset):
```abnf
Cache-Control   = #cache-directive
cache-directive = token [ "=" ( token / quoted-string ) ]
delta-seconds   = 1*DIGIT
```

Checklist (status):
- 1.2.2 delta-seconds parsing and clamping: Compliant. (`src/cache.ts`)
- 5.2 directives token/quoted-string parsing: Compliant (quoted-string supported). (`src/cache.ts`)
- 5.2.2 response directives (max-age, s-maxage, must-revalidate, proxy-revalidate, public/private, no-cache, no-store): Partial (no-transform/must-understand not handled). (`src/cache.ts`)
- Unknown directives ignored: Compliant. (`src/cache.ts`)

### RFC 5861 (stale-* extensions)
Relevant section: 3

ABNF (subset):
```abnf
stale-while-revalidate = "stale-while-revalidate" "=" delta-seconds
stale-if-error         = "stale-if-error" "=" delta-seconds
```

Checklist (status):
- Directive parse/serialize supported: Compliant. (`src/cache.ts`)
- Background revalidation and warning headers: Out-of-scope (library only parses/serializes).

### RFC 8246 (immutable)
Relevant section: 2

Checklist (status):
- immutable directive parse/serialize: Compliant. (`src/cache.ts`)
- Semantics for revalidation avoidance: Out-of-scope (library only parses/serializes).

### RFC 8288 (Web Linking)
Relevant sections: 3-3.5, 6

ABNF (subset):
```abnf
Link       = #link-value
link-value = "<" URI-Reference ">" *( OWS ";" OWS link-param )
link-param = token BWS [ "=" BWS ( token / quoted-string ) ]

relation-type = reg-rel-type / ext-rel-type
reg-rel-type  = LOALPHA *( LOALPHA / DIGIT / "." / "-" )
ext-rel-type  = URI
```

Checklist (status):
- Token vs quoted-string parsing for link-param: Compliant. (`src/link.ts`)
- rel parameter MUST be present and appear once: Compliant (links without rel dropped; duplicates ignored). (`src/link.ts`)
- rel parameter supports multiple relation types (space-separated): Compliant (split into multiple entries). (`src/link.ts`)
- anchor relative URI resolution: Out-of-scope (no base URI provided). (`src/link.ts`)
- title/title* and other attributes duplication rules: Compliant (later duplicates ignored). (`src/link.ts`)
- title* RFC 8187 decoding: Compliant (decodeExtValue used, title* takes precedence). (`src/link.ts`)
- title* language extraction to titleLang: Compliant. (`src/link.ts`)
- hreflang may appear multiple times: Compliant (accumulates into array). (`src/link.ts`)
- rev parameter parsing (deprecated): Compliant. (`src/link.ts`)
- Extension attributes with * suffix: Compliant (decoded and base name populated). (`src/link.ts`)

### RFC 9264 (Linkset)
Relevant sections: 4.1, 4.2, 4.2.1-4.2.4, 5, 6

ABNF (subset):
```abnf
linkset      = #link-value
link-value   = "<" URI-Reference ">" *( OWS ";" OWS link-param )
link-param   = token BWS [ "=" BWS ( token / quoted-string ) ]
```

Note: The `application/linkset` format (§4.1) uses the same syntax as the HTTP Link header field (RFC 8288 §3), but allows the use of newlines (CRLF or LF) before semicolons for readability.

Checklist (status):
- 4.1 application/linkset parsing (Link header format in document): Compliant (newline normalization before parsing). (`src/linkset.ts`)
- 4.1 application/linkset formatting: Compliant (multiline output with indented continuation). (`src/linkset.ts`)
- 4.2 application/linkset+json parsing: Compliant (validates structure, extracts links). (`src/linkset.ts`)
- 4.2 application/linkset+json formatting: Compliant (produces valid JSON structure). (`src/linkset.ts`)
- 4.2.1 Context objects array structure: Compliant. (`src/linkset.ts`)
- 4.2.2 Target attributes as arrays: Compliant. (`src/linkset.ts`)
- 4.2.3 Target attribute values (string vs object for i18n): Compliant (i18n objects with value/language). (`src/linkset.ts`)
- 4.2.4 Extension target attributes support: Compliant (preserved as-is). (`src/linkset.ts`)
- 5 linkset link relation type: Compliant. (`src/link.ts` LinkRelation.LINKSET)
- 6 Security considerations: Out-of-scope (caller responsibility for URI validation and trust).
- Appendix A JSON-LD context: Out-of-scope (JSON-LD processing not implemented).
- Relative URI resolution with anchor: Out-of-scope (no base URI context).

### RFC 9727 (api-catalog)
Relevant sections: 2, 3, 4, 7

Checklist (status):
- 2 Well-known URI (/.well-known/api-catalog): Compliant. (`src/linkset.ts` API_CATALOG_PATH)
- 3.1 API catalog content in linkset format: Compliant. (`src/linkset.ts` createApiCatalog)
- 3.1 item relation for simple API bookmarks: Compliant. (`src/linkset.ts`)
- 4.1 Linkset format requirement: Compliant (uses application/linkset+json). (`src/linkset.ts`)
- 4.2 JSON format with profile key: Compliant. (`src/linkset.ts` API_CATALOG_PROFILE)
- 4.3 Nested catalogs via api-catalog relation: Compliant. (`src/linkset.ts`)
- 7.2 api-catalog link relation: Compliant. (`src/link.ts` LinkRelation.API_CATALOG)
- 7.3 Profile URI registration: Compliant. (`src/linkset.ts` API_CATALOG_PROFILE)
- Service relations (service-desc, service-doc, service-meta, status): Compliant via RFC 8631. (`src/linkset.ts`)
- Appendix A examples (A.1, A.2, A.4): Covered in tests. (`test/linkset.test.ts`)
- Well-known URI registration maintenance: Out-of-scope (IANA responsibility).
- Content negotiation at well-known URI: Out-of-scope (server implementation responsibility).

### RFC 7231 (Accept header) — OBSOLETED by RFC 9110
Relevant sections: 5.3.1-5.3.2

Note: RFC 7231 was obsoleted by RFC 9110 in June 2022. The Accept header ABNF and rules (§5.3.1-5.3.2) remain valid and are referenced here for historical compatibility.

ABNF (subset):
```abnf
Accept        = #( media-range [ accept-params ] )
media-range   = ("*/*" / (type "/" "*") / (type "/" subtype)) *( OWS ";" OWS parameter )
accept-params = weight *( accept-ext )
```

Checklist (status):
- qvalue grammar enforcement: Compliant. (`src/negotiate.ts`)
- Sorting by q then specificity: Compliant (ties not ordered per header order, which is not required). (`src/negotiate.ts`)

### RFC 7240 (Prefer)
Relevant sections: 2-3

ABNF (subset):
```abnf
Prefer     = 1#preference
preference = token [ BWS "=" BWS word ] *( OWS ";" [ OWS parameter ] )
```

Checklist (status):
- Parsing of tokens/params and duplicate preference handling: Compliant (keeps first). (`src/prefer.ts`)
- §2 Token names case-insensitive (normalized to lowercase): Compliant. (`src/prefer.ts`)
- §2 Empty values equivalent to no value: Compliant. (`src/prefer.ts`)
- Vary: Prefer requirement when it impacts caching: Out-of-scope (caller responsibility). (`src/prefer.ts`)

### RFC 7239 (Forwarded)
Relevant section: 4

ABNF (subset):
```abnf
Forwarded        = 1#forwarded-element
forwarded-element = [ forwarded-pair ] *( ";" [ forwarded-pair ] )
forwarded-pair   = token "=" ( token / quoted-string )
```

Checklist (status):
- Token/quoted-string parsing: Compliant. (`src/forwarded.ts`)
- Each param MUST NOT occur more than once per element: Compliant (duplicates ignored). (`src/forwarded.ts`)

### RFC 6265 (Cookies)
Relevant sections: 4.1.1, 4.2.1, 5.1.1, 5.1.3-5.1.4, 5.2-5.4

ABNF (subset):
```abnf
set-cookie-string = cookie-pair *( ";" SP cookie-av )
cookie-pair       = cookie-name "=" cookie-value
cookie-av         = expires-av / max-age-av / domain-av / path-av / secure-av / httponly-av / extension-av

cookie-string = cookie-pair *( ";" SP cookie-pair )
```

Checklist (status):
- Set-Cookie parsing with attributes: Compliant (liberal parsing rules). (`src/cookie.ts`)
- Cookie header parsing/formatting: Compliant. (`src/cookie.ts`)
- cookie-date parsing algorithm: Compliant for token-based parsing and range checks. (`src/cookie.ts`)
- Domain and path matching helpers: Compliant. (`src/cookie.ts`)
- Cookie header generation order: Compliant. (`src/cookie.ts`)
- Storage model, public suffix handling, eviction: Out-of-scope.

### RFC 6797 (Strict-Transport-Security)
Relevant sections: 6.1-6.1.2, 8.1

ABNF (subset):
```abnf
Strict-Transport-Security = "Strict-Transport-Security" ":" [ directive ] *( ";" [ directive ] )
directive                 = directive-name [ "=" directive-value ]
```

Checklist (status):
- max-age required and numeric: Compliant. (`src/hsts.ts`)
- includeSubDomains is valueless: Compliant. (`src/hsts.ts`)
- Duplicate directives invalidate header: Compliant. (`src/hsts.ts`)
- Unknown directives ignored when otherwise valid: Compliant. (`src/hsts.ts`)
- First-header-only and HTTPS-only processing: Out-of-scope (caller responsibility).

### RFC 7617 (Basic Authentication)
Relevant sections: 2-2.1

Checklist (status):
- Basic credentials base64 parsing and first-colon split: Compliant. (`src/auth.ts`)
- CTL characters rejected in user/pass: Compliant. (`src/auth.ts`)
- charset=UTF-8 challenge parameter parsing: Compliant. (`src/auth.ts`)
- Protection space reuse rules: Out-of-scope.

### RFC 6750 (Bearer Token Usage)
Relevant sections: 2-3.1

ABNF (subset):
```abnf
b64token    = 1*( ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" ) *"="
credentials = "Bearer" 1*SP b64token
```

Checklist (status):
- Authorization: Bearer parsing/formatting: Compliant. (`src/auth.ts`)
- WWW-Authenticate Bearer params parsing: Partial (character set restrictions not enforced). (`src/auth.ts`)
- Form/query token methods and request constraints: Out-of-scope.

### RFC 7616 (Digest Access Authentication)
Relevant sections: 3.3-3.5

ABNF (subset):
```abnf
challenge        = "Digest" 1*SP ( digest-challenge )
digest-challenge = realm / domain / nonce / opaque / stale / algorithm / qop-options / charset / userhash / auth-param
credentials      = "Digest" 1*SP digest-response
digest-response  = username / realm / nonce / digest-uri / response / algorithm / cnonce / opaque / message-qop / nonce-count / userhash / auth-param
nonce-count      = "nc=" nc-value
nc-value         = 8LHEX
```

Checklist (status):
- §3.3 Challenge parsing with realm, nonce, opaque, stale, algorithm, qop, charset, userhash: Compliant. (`src/auth.ts`)
- §3.3 Challenge formatting with correct quoting (realm/nonce/opaque/qop quoted; stale/algorithm not quoted): Compliant. (`src/auth.ts`)
- §3.4 Authorization credentials parsing with username, realm, uri, response, algorithm, cnonce, opaque, qop, nc: Compliant. (`src/auth.ts`)
- §3.4 Authorization credentials formatting with correct quoting (username/realm/uri/response/cnonce/opaque quoted; algorithm/qop/nc not quoted): Compliant. (`src/auth.ts`)
- §3.4 username* parameter with RFC 8187 encoding: Compliant. (`src/auth.ts`)
- §3.4 Reject credentials with both username and username*: Compliant. (`src/auth.ts`)
- §3.4 nc must be exactly 8 hex digits: Compliant. (`src/auth.ts`)
- §3.4.1 Response computation with qop=auth: Compliant. (`src/auth.ts`)
- §3.4.1 Response computation without qop (legacy): Compliant. (`src/auth.ts`)
- §3.4.2 A1 computation for non-session and session algorithms: Compliant. (`src/auth.ts`)
- §3.4.3 A2 computation for qop=auth: Compliant. (`src/auth.ts`)
- §3.4.3 A2 computation for qop=auth-int: Out-of-scope (entity-body handling not implemented).
- §3.4.4 Username hashing with userhash=true: Compliant. (`src/auth.ts`)
- §3.5 Authentication-Info parsing/formatting: Compliant. (`src/auth.ts`)
- MD5 algorithm support (backward compatibility): Compliant. (`src/auth.ts`)
- SHA-256 algorithm support (MUST support): Compliant. (`src/auth.ts`)
- SHA-512-256 algorithm support: Compliant. (`src/auth.ts`)
- Session algorithms (-sess suffix): Compliant. (`src/auth.ts`)
- Mutual authentication rspauth computation: Out-of-scope (can be computed using existing helpers).
- Nextnonce handling for server-initiated nonce refresh: Out-of-scope (application-level concern).

### RFC 6266 (Content-Disposition)
Relevant sections: 4-4.3

ABNF (subset):
```abnf
content-disposition = disposition-type *( ";" disposition-parm )
disposition-parm    = filename-parm / disp-ext-parm
filename-parm       = "filename" "=" value / "filename*" "=" ext-value
```

Checklist (status):
- Parse/format disposition + params: Compliant. (`src/content-disposition.ts`)
- filename* precedence over filename: Compliant (filename* wins). (`src/content-disposition.ts`)
- Security guidance (path traversal, safe extensions): Out-of-scope (caller responsibility).

### RFC 8187 (Header parameter encoding)
Relevant sections: 3.2, 3.2.1

ABNF (subset):
```abnf
ext-value   = charset "'" [ language ] "'" value-chars
charset     = "UTF-8" / mime-charset
attr-char   = ALPHA / DIGIT / "!" / "#" / "$" / "&" / "+" / "-" / "."
            / "^" / "_" / "`" / "|" / "~"
pct-encoded = "%" HEXDIG HEXDIG
```

Checklist (status):
- ext-value parsing (parseExtValue): Compliant. (`src/content-disposition.ts`)
- ext-value encoding (encodeExtValue): Compliant. (`src/content-disposition.ts`)
- UTF-8 encoding support: Compliant (producers use UTF-8, recipients accept UTF-8). (`src/content-disposition.ts`)
- Language extraction: Compliant (exposed in ExtValue return type). (`src/content-disposition.ts`)
- Charset normalization to lowercase: Compliant. (`src/content-disposition.ts`)
- attr-char preservation during encoding: Compliant. (`src/content-disposition.ts`)
- ISO-8859-1 decoding: Out-of-scope (legacy compatibility, not required).

### RFC 4647 (Language tag matching)
Relevant section: 3 (basic filtering)

Checklist (status):
- Basic filtering prefix match: Compliant. (`src/language.ts`)
- Extended filtering / lookup: Out-of-scope.

### RFC 8941 (Structured Field Values)
Relevant sections: 3-4

ABNF (subset):
```abnf
sf-list       = list-member *( OWS "," OWS list-member )
sf-dictionary = dict-member *( OWS "," OWS dict-member )
sf-item       = bare-item parameters
bare-item     = sf-integer / sf-decimal / sf-string / sf-token / sf-binary / sf-boolean
sf-integer    = ["-"] 1*15DIGIT
sf-decimal    = ["-"] 1*12DIGIT "." 1*3DIGIT
key           = ( lcalpha / "*" ) *( lcalpha / DIGIT / "_" / "-" / "." / "*" )
```

Checklist (status):
- List/dict/item parsing and serialization: Compliant. (`src/structured-fields.ts`)
- Key lower-case restriction: Compliant. (`src/structured-fields.ts`)
- Integer/decimal digit limits: Compliant. (`src/structured-fields.ts`)
- Base64 validation and padding handling: Compliant. (`src/structured-fields.ts`)
- §3.3.3 String escape validation (only \" and \\): Compliant. (`src/structured-fields.ts`)
- §3.3.3 String character range (%x20-21 / %x23-5B / %x5D-7E): Compliant. (`src/structured-fields.ts`)
- §3.3.4 Token character set (ALPHA, tchar, :, /): Compliant. (`src/structured-fields.ts`)
- §4.1.4 Integer serialization range check (±999,999,999,999,999): Compliant. (`src/structured-fields.ts`)

### RFC 8942 (HTTP Client Hints)
Relevant sections: 2.2, 3.1, 3.2, 4.2

Checklist (status):
- Accept-CH parsing as sf-list of tokens: Compliant. (`src/client-hints.ts`)
- Unknown hints ignored via filtering helper: Compliant. (`src/client-hints.ts`)
- Vary helper for negotiated hints: Compliant. (`src/client-hints.ts`)
- UA opt-in persistence and secure-transport processing: Out-of-scope.

### RFC 9211 (Cache-Status)
Relevant sections: 2-2.8

Checklist (status):
- Cache-Status structured list parsing/formatting: Compliant. (`src/cache-status.ts`)
- Semantic validation (hit vs fwd exclusivity, fwd-status defaults): Partial (caller responsibility). (`src/cache-status.ts`)
- Cache behavior guidance for intermediaries: Out-of-scope.

### RFC 9209 (Proxy-Status)
Relevant sections: 2-2.4

ABNF (subset):
```abnf
Proxy-Status = sf-list
; Each list member is sf-token or sf-string (not inner-list)
; Parameters per RFC 8941 §3.1.2
```

Checklist (status):
- §2 Proxy-Status structured list parsing (String or Token members): Compliant. (`src/proxy-status.ts`)
- §2 Inner lists rejected: Compliant. (`src/proxy-status.ts`)
- §2 List order preserved (first = closest to origin): Compliant. (`src/proxy-status.ts`)
- §2.1.1 error parameter (Token): Compliant. (`src/proxy-status.ts`)
- §2.1.2 next-hop parameter (String or Token): Compliant. (`src/proxy-status.ts`)
- §2.1.3 next-protocol parameter (Token or Byte Sequence): Partial (Token only; Byte Sequence TBD). (`src/proxy-status.ts`)
- §2.1.4 received-status parameter (Integer): Compliant. (`src/proxy-status.ts`)
- §2.1.5 details parameter (String): Compliant. (`src/proxy-status.ts`)
- §2.2 Extension parameters preserved: Compliant. (`src/proxy-status.ts`)
- §2.3 All 32 error types defined: Compliant. (`src/proxy-status.ts`)
- §2.3.2 dns_error extra params (rcode, info-code): Compliant. (`src/proxy-status.ts`)
- §2.3.15 tls_alert_received extra params (alert-id, alert-message): Compliant. (`src/proxy-status.ts`)
- §2.4 Unknown error types accepted (extensibility): Compliant. (`src/proxy-status.ts`)
- Trailer field handling: Out-of-scope (library only parses/formats field values).
- Semantic guidance for proxy behavior: Out-of-scope.

### RFC 9530 (Digest Fields)
Relevant sections: 2-5, 7.2

ABNF (subset):
```abnf
Content-Digest  = sf-dictionary
Repr-Digest     = sf-dictionary
Want-Content-Digest = sf-dictionary
Want-Repr-Digest    = sf-dictionary

; Dictionary values
digest-value    = sf-binary    ; for Content-Digest/Repr-Digest
pref-value      = sf-integer   ; 0-10 for Want-* fields
```

Checklist (status):
- §2 Content-Digest parsing as sf-dictionary with byte sequences: Compliant. (`src/digest.ts`)
- §2 Content-Digest formatting: Compliant. (`src/digest.ts`)
- §3 Repr-Digest parsing as sf-dictionary with byte sequences: Compliant. (`src/digest.ts`)
- §3 Repr-Digest formatting: Compliant. (`src/digest.ts`)
- §4 Want-Content-Digest parsing with integer preferences 0-10: Compliant. (`src/digest.ts`)
- §4 Want-Repr-Digest parsing with integer preferences 0-10: Compliant. (`src/digest.ts`)
- §4 Want-* formatting: Compliant. (`src/digest.ts`)
- §5 Active algorithms (sha-256, sha-512) identified: Compliant. (`src/digest.ts`)
- §5 Deprecated algorithms (md5, sha, etc.) identified: Compliant. (`src/digest.ts`)
- §5 Generation uses only active algorithms: Compliant. (`src/digest.ts`)
- §5 Verification of deprecated algorithms: Partial (returns false; caller can choose to proceed). (`src/digest.ts`)
- §7.2 Algorithm registry values: Compliant (sha-256, sha-512 active; deprecated list included). (`src/digest.ts`)
- Trailer field support: Out-of-scope (library only parses/formats field values).
- Content vs representation distinction for request bodies: Out-of-scope (caller responsibility).

### RFC 9457 (Problem Details)
Relevant sections: 3.1-3.2, 4.1

Checklist (status):
- type default to about:blank and Content-Type application/problem+json: Compliant. (`src/problem.ts`)
- status in body equals response status: Compliant. (`src/problem.ts`)
- Type/instance URI validation and consumer-side type checking: Out-of-scope (caller responsibility).

### RFC 6901 (JSON Pointer)
Relevant sections: 3-7

ABNF (subset):
```abnf
json-pointer    = *( "/" reference-token )
reference-token = *( unescaped / escaped )
unescaped       = %x00-2E / %x30-7D / %x7F-10FFFF
escaped         = "~" ( "0" / "1" )
array-index     = %x30 / ( %x31-39 *(%x30-39) )
```

Checklist (status):
- §3 Syntax parsing and validation: Compliant. (`src/json-pointer.ts`)
- §4 Evaluation with escape decoding order (~1 before ~0): Compliant. (`src/json-pointer.ts`)
- §4 Array index leading zero rejection: Compliant. (`src/json-pointer.ts`)
- §4 No Unicode normalization: Compliant. (`src/json-pointer.ts`)
- §4 "-" index returns undefined (nonexistent element): Compliant. (`src/json-pointer.ts`)
- §6 URI fragment encoding/decoding: Compliant. (`src/json-pointer.ts`)
- §7 Error handling returns null/undefined: Compliant. (`src/json-pointer.ts`)
- Document mutation (set/delete values): Out-of-scope.

### RFC 9535 (JSONPath)
Relevant sections: 2.1-2.7

ABNF (subset):
```abnf
jsonpath-query      = root-identifier segments
segments            = *(S segment)
root-identifier     = "$"
selector            = name-selector / wildcard-selector / slice-selector / index-selector / filter-selector
name-selector       = string-literal
wildcard-selector   = "*"
index-selector      = int
slice-selector      = [start S] ":" S [end S] [":" [S step]]
filter-selector     = "?" S logical-expr
int                 = "0" / (["-"] DIGIT1 *DIGIT)
```

Checklist (status):
- §2.1 UTF-8 encoding and I-JSON integer validation: Compliant. (`src/jsonpath.ts`)
- §2.1 Well-formedness and validity errors: Compliant. (`src/jsonpath.ts`)
- §2.2 Root identifier ($): Compliant. (`src/jsonpath.ts`)
- §2.3.1 Name selector with escape sequences: Compliant. (`src/jsonpath.ts`)
- §2.3.2 Wildcard selector: Compliant. (`src/jsonpath.ts`)
- §2.3.3 Index selector with negative indices: Compliant. (`src/jsonpath.ts`)
- §2.3.4 Array slice selector with step=0 handling: Compliant. (`src/jsonpath.ts`)
- §2.3.5 Filter selector with comparison and logical operators: Compliant. (`src/jsonpath.ts`)
- §2.4 Built-in functions (length, count, match, search, value): Compliant. (`src/jsonpath.ts`)
- §2.4 Custom function extensions: Out-of-scope (only built-in functions).
- §2.4.6-2.4.7 I-Regexp (RFC 9485) validation for match/search: Partial (uses JS RegExp; permissive). (`src/jsonpath.ts`)
- §2.5.1 Child segment: Compliant. (`src/jsonpath.ts`)
- §2.5.2 Descendant segment: Compliant. (`src/jsonpath.ts`)
- §2.6 null semantics: Compliant. (`src/jsonpath.ts`)
- §2.7 Normalized path formatting: Compliant. (`src/jsonpath.ts`)
- Streaming/lazy evaluation: Out-of-scope.
- Document mutation: Out-of-scope.

### RFC 3339 (Timestamps)
Relevant section: 5.6

ABNF (subset):
```abnf
date-time = full-date "T" full-time
full-time = partial-time time-offset
```

Checklist (status):
- RFC 3339 parsing and ISO output: Compliant (leap seconds rejected per JS Date limitation; fractional seconds truncated to ms; case-insensitive T/Z and space separator supported per §5.6 NOTE). (`src/datetime.ts`)

### RFC 850 (legacy HTTP-date)
Relevant section: 2 (rfc850-date)

Checklist (status):
- Sliding 50-year window handling: Compliant. (`src/datetime.ts`)

### RFC 9651 (Structured Field Values - Date type)
Relevant section: 3.3.7

ABNF (subset):
```abnf
sf-date    = "@" sf-integer
```

Checklist (status):
- 3.3.7 Date parsing (@ prefix + sf-integer): Compliant. (`src/structured-fields.ts`)
- 3.3.7 Date serialization (@timestamp): Compliant. (`src/structured-fields.ts`)
- 3.3.7 Decimal timestamps rejected: Compliant. (`src/structured-fields.ts`)
- SfDate class wraps timestamp to distinguish from plain numbers: Compliant. (`src/types.ts`)
- Date in dictionary/list contexts: Compliant. (`src/structured-fields.ts`)

### RFC 9745 (Deprecation Header)
Relevant sections: 2, 2.1, 2.2, 3, 4

Checklist (status):
- 2.1 Deprecation = sf-item (Date per RFC 9651 §3.3.7): Compliant. (`src/deprecation.ts`)
- 2.1 Past dates mean already deprecated: Compliant (isDeprecated helper). (`src/deprecation.ts`)
- 2.1 Future dates mean will be deprecated: Compliant. (`src/deprecation.ts`)
- 2.2 Scope applies to response resource: Out-of-scope (application-level concern).
- 3 Link relation (deprecation): Compliant. (`src/link.ts` LinkRelation.DEPRECATION)
- 3 Sunset-after-deprecation ordering validation: Compliant. (`src/deprecation.ts`)
- 4 IANA registration: Out-of-scope (IANA responsibility).
- Header builder for paired Deprecation + Sunset: Compliant. (`src/deprecation.ts`)

### RFC 8594 (Sunset Header)
Relevant sections: 3, 6

ABNF (subset):
```abnf
Sunset = HTTP-date
```

Checklist (status):
- 3 Sunset header parsing (HTTP-date): Compliant. (`src/headers.ts`)
- 3 Sunset header formatting (IMF-fixdate): Compliant. (`src/headers.ts`)
- 3 Past dates valid (mean "now"): Compliant. (`src/headers.ts`)
- 6 sunset link relation type: Compliant. (`src/link.ts` LinkRelation.SUNSET)
- 5 Scope interpretation: Out-of-scope (caller responsibility).
- 8 Hint semantics (no guarantee): Out-of-scope (caller responsibility).

### Fetch/CORS (WHATWG Fetch)
Relevant sections: CORS protocol and CORS check

Checklist (status):
- Access-Control-Allow-Origin must be exact origin when credentials are included: Compliant. (`src/cors.ts`)
- Access-Control-Allow-Credentials must be "true" when credentials are included: Compliant. (`src/cors.ts`)
- Vary: Origin for dynamic origin echo: Compliant. (`src/cors.ts`)
- Preflight and additional CORS extensions (private network, safelist logic): Out-of-scope.

### RFC 3986 (URI Generic Syntax)
Relevant sections: 2, 3.1, 3.2.2, 5.2.4, 6.2

ABNF (subset):
```abnf
pct-encoded   = "%" HEXDIG HEXDIG
unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
reserved      = gen-delims / sub-delims
gen-delims    = ":" / "/" / "?" / "#" / "[" / "]" / "@"
sub-delims    = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
```

Checklist (status):
- §2.1 percent-encoding with uppercase hex: Compliant. (`src/uri.ts`)
- §2.3 unreserved character preservation: Compliant. (`src/uri.ts`)
- §2.4 double-encoding detection: Compliant. (`src/uri.ts`)
- §3.1 scheme case normalization: Compliant. (`src/uri.ts`)
- §3.2.2 host case normalization: Compliant. (`src/uri.ts`)
- §5.2.4 remove_dot_segments algorithm: Compliant. (`src/uri.ts`)
- §6.2.2 syntax-based normalization: Compliant. (`src/uri.ts`)
- §6.2.3 scheme-based normalization (default ports): Compliant. (`src/uri.ts`)
- Full URI parsing: Out-of-scope (use native URL).
- Relative resolution: Out-of-scope (use native URL).
- IPv6 address parsing: Out-of-scope.

### RFC 6570 (URI Template)
Relevant sections: 1.2, 2-3

ABNF (subset):
```abnf
URI-Template  = *( literals / expression )
expression    =  "{" [ operator ] variable-list "}"
operator      =  op-level2 / op-level3 / op-reserve
op-level2     =  "+" / "#"
op-level3     =  "." / "/" / ";" / "?" / "&"
op-reserve    =  "=" / "," / "!" / "@" / "|"
variable-list =  varspec *( "," varspec )
varspec       =  varname [ modifier-level4 ]
varname       =  varchar *( ["."] varchar )
varchar       =  ALPHA / DIGIT / "_" / pct-encoded
modifier-level4 =  prefix / explode
prefix        =  ":" max-length
max-length    =  %x31-39 0*3DIGIT   ; 1-9999
explode       =  "*"
```

Checklist (status):
- §1.2 Level 1 simple string expansion: Compliant. (`src/uri-template.ts`)
- §1.2 Level 2 reserved (+) and fragment (#) expansion: Compliant. (`src/uri-template.ts`)
- §1.2 Level 3 operators (./;/?/&): Compliant. (`src/uri-template.ts`)
- §1.2 Level 4 prefix and explode modifiers: Compliant. (`src/uri-template.ts`)
- §1.6 UTF-8 encoding for non-ASCII: Compliant. (`src/uri-template.ts`)
- §2.2 Operator syntax validation: Compliant. (`src/uri-template.ts`)
- §2.2 Reserved operators (=,!@|) rejection: Compliant. (`src/uri-template.ts`)
- §2.3 Variable name validation (varchar + dot rules): Compliant. (`src/uri-template.ts`)
- §2.3 pct-encoded in variable names: Compliant. (`src/uri-template.ts`)
- §2.4.1 Prefix modifier (1-9999 range): Compliant. (`src/uri-template.ts`)
- §2.4.1 Prefix on composite undefined behavior: Compliant (prefix ignored). (`src/uri-template.ts`)
- §2.4.2 Explode modifier for lists: Compliant. (`src/uri-template.ts`)
- §2.4.2 Explode modifier for associative arrays: Compliant. (`src/uri-template.ts`)
- §3.2.1 Undefined variable handling (no output): Compliant. (`src/uri-template.ts`)
- §3.2.1 Empty list/object treated as undefined: Compliant. (`src/uri-template.ts`)
- §3.2.2 Simple string expansion encoding: Compliant. (`src/uri-template.ts`)
- §3.2.3 Reserved expansion (preserve reserved chars): Compliant. (`src/uri-template.ts`)
- §3.2.4 Fragment expansion (#prefix): Compliant. (`src/uri-template.ts`)
- §3.2.5 Label expansion (.prefix, .separator): Compliant. (`src/uri-template.ts`)
- §3.2.6 Path segment expansion (/prefix, /separator): Compliant. (`src/uri-template.ts`)
- §3.2.7 Path-style parameters (;prefix, named, ifEmpty=""): Compliant. (`src/uri-template.ts`)
- §3.2.8 Form-style query (?prefix, named, ifEmpty="="): Compliant. (`src/uri-template.ts`)
- §3.2.9 Query continuation (&prefix, named, ifEmpty="="): Compliant. (`src/uri-template.ts`)
- Template parsing to URI (reverse matching): Out-of-scope.

### RFC 9421 (HTTP Message Signatures)
Relevant sections: 2-4

ABNF (subset):
```abnf
Signature-Input = sf-dictionary
Signature       = sf-dictionary

component-identifier = sf-string *( OWS ";" OWS component-param )
component-param      = "sf" / "key" "=" sf-string / "bs" / "req" / "tr"

derived-component = "@method" / "@target-uri" / "@authority" / "@scheme"
                  / "@request-target" / "@path" / "@query" / "@query-param"
                  / "@status"

signature-params = "(" *SP [ component-identifier *( SP component-identifier ) *SP ] ")"
                   *( ";" signature-param )
signature-param  = "created" "=" sf-integer
                 / "expires" "=" sf-integer
                 / "nonce"   "=" sf-string
                 / "alg"     "=" sf-string
                 / "keyid"   "=" sf-string
                 / "tag"     "=" sf-string
```

Checklist (status):
- §2.1 HTTP field component: Compliant (canonicalization, multiple values). (`src/http-signatures.ts`)
- §2.1.1 Strict Structured Field (sf param): Compliant (parsed and propagated). (`src/http-signatures.ts`)
- §2.1.2 Dictionary member key param: Compliant. (`src/http-signatures.ts`)
- §2.1.3 Trailers (tr param): Compliant. (`src/http-signatures.ts`)
- §2.1.4 Binary-wrapped (bs param): Compliant. (`src/http-signatures.ts`)
- §2.2 Derived components (@method, @authority, @path, etc.): Compliant. (`src/http-signatures.ts`)
- §2.2.8 @query-param with name parameter: Compliant. (`src/http-signatures.ts`)
- §2.2.9 Request components in response (req param): Compliant. (`src/http-signatures.ts`)
- §2.3 Signature parameters (created, expires, nonce, alg, keyid, tag): Compliant. (`src/http-signatures.ts`)
- §2.5 Signature base creation: Compliant (LF line endings, no trailing LF). (`src/http-signatures.ts`)
- §2.5 @signature-params as last line: Compliant. (`src/http-signatures.ts`)
- §2.5 No duplicate component identifiers: Compliant. (`src/http-signatures.ts`)
- §2.5 No newlines in component values: Compliant. (`src/http-signatures.ts`)
- §3 Signature creation algorithm: Partial (signature base only; cryptographic operations out-of-scope).
- §3 Signature verification algorithm: Partial (signature base only; cryptographic operations out-of-scope).
- §4.1 Signature-Input field parsing/formatting: Compliant. (`src/http-signatures.ts`)
- §4.2 Signature field parsing/formatting: Compliant. (`src/http-signatures.ts`)
- Cryptographic signing/verification: Out-of-scope (this module provides HTTP-layer primitives only).

## Spec-to-code review per module
Status legend: Compliant / Partial / Out-of-scope

| Module | RFC focus | Status | Notes |
| --- | --- | --- | --- |
| src/etag.ts | RFC 9110 8.8.3-8.8.3.2 | Compliant | ETag parsing/formatting + strong/weak comparison align with ABNF and rules. |
| src/conditional.ts | RFC 9110 13.1.1-13.1.4, 13.2.2 | Compliant | Invalid If-Unmodified-Since ignored; If-Range handled elsewhere. |
| src/cache.ts | RFC 9111 1.2.2, 5.2, 5.2.2; RFC 5861; RFC 8246 | Partial | no-transform/must-understand not handled. Stale/immutable directives parsed/serialized. |
| src/link.ts | RFC 8288 3.1-3.4 | Partial | anchor/base resolution out-of-scope; rel parsing and duplicate handling compliant. |
| src/negotiate.ts | RFC 7231 5.3.1-5.3.2 (obsoleted by RFC 9110) | Compliant | qvalue grammar enforced; sorting by q and specificity. |
| src/language.ts | RFC 9110 12.4.2, 12.5.4; RFC 4647 3 | Compliant | qvalue grammar enforced; basic filtering matches spec. |
| src/encoding.ts | RFC 9110 12.4.2, 12.5.3 | Compliant | qvalue grammar enforced; identity vs wildcard semantics covered. |
| src/headers.ts | RFC 9110 10.2.3, 12.5.5 | Compliant | Retry-After parse/format and Vary merge align with ABNF. |
| src/datetime.ts | RFC 3339 5.6; RFC 9110 5.6.7; RFC 850 2 | Compliant | Rejects leap seconds (JS Date limitation); fractional seconds truncated; case-insensitive T/Z and space separator supported per §5.6 NOTE. HTTP-date parsing OK. |
| src/prefer.ts | RFC 7240 2-3 | Compliant | Token names normalized to lowercase; empty values treated as absent; Vary: Prefer responsibility left to callers. |
| src/forwarded.ts | RFC 7239 4 | Compliant | Duplicate params ignored; parsing remains permissive. |
| src/content-disposition.ts | RFC 6266 4-4.3; RFC 8187 3.2-3.2.1 | Compliant | ext-value parse/encode exposed; filename* precedence honored; ISO-8859-1 out-of-scope; continuation params out-of-scope. |
| src/cookie.ts | RFC 6265 4.1.1, 4.2.1, 5.1.1, 5.1.3-5.1.4, 5.2-5.4 | Partial | Parsing/matching implemented; storage model and public suffix handling out-of-scope. |
| src/auth.ts | RFC 7617 2-2.1; RFC 6750 2-3; RFC 7616 3.3-3.5 | Partial | Basic/Bearer/Digest parsing implemented; Digest response computation with MD5/SHA-256/SHA-512-256; qop=auth-int out-of-scope; Bearer param charset constraints not enforced; form/query methods out-of-scope. |
| src/hsts.ts | RFC 6797 6.1-6.1.2, 8.1 | Compliant | Duplicate directives invalidate header; max-age required. |
| src/structured-fields.ts | RFC 8941 3-4; RFC 9651 3.3.7 | Compliant | Key lowercase, numeric limits, base64 validation, string escape/range validation, token charset, integer serialization range enforced, and RFC 9651 Date type support. |
| src/deprecation.ts | RFC 9745 2-4; RFC 9651 3.3.7 | Compliant | Deprecation header parsing/formatting via structured fields Date type; isDeprecated helper; sunset-after-deprecation validation; paired header builder. |
| src/client-hints.ts | RFC 8942 2.2, 3.1-3.2, 4.2 | Partial | Accept-CH parsing implemented; UA opt-in and secure-transport handling out-of-scope. |
| src/cache-status.ts | RFC 9211 2-2.8 | Partial | Structured field parsing implemented; semantic validation left to callers. |
| src/proxy-status.ts | RFC 9209 2-2.4 | Compliant | Structured field parsing/formatting; all 32 error types; extra params for dns_error and tls_alert_received; extensible. |
| src/digest.ts | RFC 9530 2-5 | Compliant | Content-Digest/Repr-Digest parsing/formatting; Want-* preferences; SHA-256/SHA-512 generation/verification; deprecated algorithms identified but not generated. |
| src/problem.ts | RFC 9457 3.1-3.2, 4.1 | Compliant | Creates compliant problem objects and responses; URI validation left to callers. |
| src/json-pointer.ts | RFC 6901 3-7 | Compliant | Escape decoding order correct; array index validation; URI fragment encoding; document mutation out-of-scope. |
| src/jsonpath.ts | RFC 9535 2.1-2.7 | Compliant | Full query parsing, selectors, filters, built-in functions; I-Regexp validation uses JS RegExp (permissive); custom functions out-of-scope. |
| src/uri.ts | RFC 3986 2, 3.1, 3.2.2, 5.2.4, 6.2 | Compliant | Percent-encoding, normalization, and comparison implemented; full URI parsing delegated to native URL. |
| src/uri-template.ts | RFC 6570 1.2, 2-3 | Compliant | All Level 1-4 operators and modifiers; UTF-8 encoding; template parsing and validation; reverse matching out-of-scope. |
| src/range.ts | RFC 9110 13.1.5, 14.1-14.4 | Partial | Multipart/byteranges response formatting out-of-scope; If-Range matches strong ETag/date; method gating implemented. |
| src/cors.ts | Fetch/CORS | Partial | Core origin/credentials rules followed; broader CORS protocol out-of-scope. |
| src/headers.ts | RFC 8594 3 | Compliant | Sunset parsing/formatting reuses HTTP-date; hint semantics documented. |
| src/link.ts | RFC 8594 6 | Compliant | SUNSET relation type added to LinkRelation. |
| src/linkset.ts | RFC 9264 4.1, 4.2, 5; RFC 9727 2-4, 7 | Compliant | Parses/formats both application/linkset and application/linkset+json; linkset relation type added; API Catalog creation/parsing with profile support. |
| src/http-signatures.ts | RFC 9421 2-4 | Partial | Signature-Input/Signature parsing/formatting; signature base creation; derived components; cryptographic operations out-of-scope. |
| src/robots.ts | RFC 9309 2.1-2.4 | Compliant | Robots.txt parsing, formatting, user-agent matching, path matching with wildcards and $, longest-match-wins. |
| src/security-txt.ts | RFC 9116 2.3, 2.5, 3 | Compliant | security.txt parsing, formatting (CRLF), validation, expiry checking. |
| src/webfinger.ts | RFC 7033 4.2-4.4 | Compliant | WebFinger JRD parsing/formatting, validation, resource matching, rel filtering. |
| src/host-meta.ts | RFC 6415 2-3 | Compliant | Host metadata XRD XML and JSON parsing/formatting; entity encoding. |

### RFC 9309 (Robots Exclusion Protocol)
Relevant sections: 2.1-2.4
- [x] §2.1: Group structure parsing (user-agent + rules) — Compliant — `src/robots.ts`
- [x] §2.2: Longest-match-wins for Allow vs Disallow — Compliant — `src/robots.ts`
- [x] §2.2.2: Wildcard `*` and `$` end-of-URL matching — Compliant — `src/robots.ts`
- [x] §2.3: Case-insensitive substring matching for User-agent — Compliant — `src/robots.ts`
- [x] §2.4: Lines over 500 bytes SHOULD be ignored — Compliant — `src/robots.ts`
- [x] Sitemap directive parsing — Compliant — `src/robots.ts`
- [x] BOM stripping and CRLF normalization — Compliant — `src/robots.ts`

### RFC 9116 (security.txt)
Relevant sections: 2.3, 2.5, 3
- [x] §2.3: CRLF line endings in output — Compliant — `src/security-txt.ts`
- [x] §2.5.1: Contact is REQUIRED (validation) — Compliant — `src/security-txt.ts`
- [x] §2.5.2: Canonical is RECOMMENDED (validation warning) — Compliant — `src/security-txt.ts`
- [x] §2.5.3: Expires is REQUIRED, < 1 year (validation) — Compliant — `src/security-txt.ts`
- [x] §3: Comment stripping, case-insensitive field names — Compliant — `src/security-txt.ts`
- [x] Extension field preservation — Compliant — `src/security-txt.ts`

### RFC 7033 (WebFinger)
Relevant sections: 4.2-4.4
- [x] §4.2: JRD Content-Type constant — Compliant — `src/webfinger.ts`
- [x] §4.4: JRD parsing with subject, aliases, links, properties — Compliant — `src/webfinger.ts`
- [x] §4.4: JRD formatting/serialization — Compliant — `src/webfinger.ts`
- [x] §4.4: Validation (required subject, link rel) — Compliant — `src/webfinger.ts`
- [x] §4.3: Resource matching with alias and subject lookup — Compliant — `src/webfinger.ts`
- [x] §4.4: rel parameter filtering — Compliant — `src/webfinger.ts`

### RFC 6415 (Host Metadata)
Relevant sections: 2-3
- [x] §2: XRD XML parsing (Link elements, Property elements) — Compliant — `src/host-meta.ts`
- [x] §2: XRD XML formatting with correct namespace — Compliant — `src/host-meta.ts`
- [x] §3: JSON format parsing and formatting — Compliant — `src/host-meta.ts`
- [x] XML entity encoding/decoding — Compliant — `src/host-meta.ts`
- [x] Round-trip serialization for both formats — Compliant — `src/host-meta.ts`

## Test mapping and coverage gaps
Existing tests map to RFC sections as noted in test filenames and comments.

## Required fixes (for full RFC-aligned claims)
1) src/cache.ts: Consider adding no-transform/must-understand support if full RFC 9111 5.2.2 coverage is claimed.

## Suggested new tests (with explicit RFC citations)
Add tests with names or comments referencing the RFC section:
- conditional.test.ts: invalid If-Unmodified-Since ignored (RFC 9110 Section 13.1.4).
- encoding.test.ts: reject qvalue > 1 or 4 decimals; identity vs wildcard selection (RFC 9110 Sections 12.4.2, 12.5.3).
- language.test.ts: reject invalid qvalue and ignore it (RFC 9110 Section 12.4.2).
- datetime.test.ts: parse IMF-fixdate and asctime (RFC 9110 Section 5.6.7).
- link.test.ts: multiple rel values in one rel param and anchor param handling (RFC 8288 Section 3.3, 3.2).
- cache.test.ts: parse no-cache="field" and private="field"; quoted-string parsing (RFC 9111 Sections 5.2, 5.2.2.4, 5.2.2.7).
- content-disposition.test.ts: filename* takes precedence over filename (RFC 6266 Section 4.3).
- structured-fields.test.ts: reject keys with uppercase; reject integers > 15 digits and decimals > 12 digits before dot (RFC 8941 Section 3).
- forwarded.test.ts: duplicate params ignored after first (RFC 7239 Section 4).
- range.test.ts: If-Range with HTTP-date; ignore Range on non-GET (RFC 9110 Sections 13.1.5, 14.2).

## Documentation updates
- Added RFC 6265, RFC 6797, RFC 7617, RFC 6750, RFC 8942, and RFC 9211 coverage entries in README, RFC map, and per-RFC docs pages.

## Test execution
No code changes were applied as part of this audit, so tests were not run.
