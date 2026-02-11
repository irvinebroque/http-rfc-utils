---
'@irvinebroque/http-rfc-utils': minor
---

Add W3C Referrer-Policy header utilities with tolerant parsing (`parseReferrerPolicy`, `parseReferrerPolicyHeader`) and strict formatting/validation (`formatReferrerPolicy`, `validateReferrerPolicy`), including last-recognized-token selection, unknown-token fallback handling, syntax-invalid null results, and redirect-style effective policy updates via `selectEffectiveReferrerPolicy`.
