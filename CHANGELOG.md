# Changelog

## 0.4.0

### Minor Changes

- [#16](https://github.com/irvinebroque/http-rfc-utils/pull/16) [`7173ebe`](https://github.com/irvinebroque/http-rfc-utils/commit/7173ebe35e038474ad502511100da803e8a480d4) Contributor: [@irvinebroque](https://github.com/irvinebroque) - Add new standards-focused utilities across HTTP, OAuth, JSON, and WebAuthn: RFC 6585 additional status codes, RFC 6902 JSON Patch, RFC 7396 JSON Merge Patch, RFC 7636 PKCE, RFC 8297 Early Hints Link handling, RFC 8414 OAuth authorization server metadata, RFC 8785 JSON Canonicalization Scheme, W3C Clear-Site-Data, W3C CSP3 server-side subset, W3C Referrer-Policy, W3C Reporting API helpers, and WebAuthn v1 auth parsing/verification primitives.

## 0.3.1

### Patch Changes

- [#12](https://github.com/irvinebroque/http-rfc-utils/pull/12) [`7e22c15`](https://github.com/irvinebroque/http-rfc-utils/commit/7e22c15653ec1a4507eceda03692ce2a7d8fe031) Contributor: [@irvinebroque](https://github.com/irvinebroque) - Reorganize package documentation for npm and coding-agent discoverability by introducing a concise, npm-focused README with clearer RFC coverage snapshots.
  Move exhaustive API import and RFC mapping references into dedicated docs pages and add a contributor workflow guide.

- [#11](https://github.com/irvinebroque/http-rfc-utils/pull/11) [`3799d76`](https://github.com/irvinebroque/http-rfc-utils/commit/3799d7698a07e495015819f955460b7d722abb4a) Contributor: [@irvinebroque](https://github.com/irvinebroque) - Improve CI reliability and clarity by splitting quality gates into parallel jobs with explicit names, plus a stable required-checks aggregator for branch protection.
  Separate coverage generation from coverage threshold enforcement so CI logs and scripts reflect exactly what each step does.

- [#15](https://github.com/irvinebroque/http-rfc-utils/pull/15) [`6b63c05`](https://github.com/irvinebroque/http-rfc-utils/commit/6b63c05bac9784e80ad7fe368d3f7c627e9253c8) Contributor: [@irvinebroque](https://github.com/irvinebroque) - Rename the CI coverage job label to improve check readability.

- [#13](https://github.com/irvinebroque/http-rfc-utils/pull/13) [`c2fb499`](https://github.com/irvinebroque/http-rfc-utils/commit/c2fb499f3464e9de8f79eeee20fdb4739c5ac1bf) Contributor: [@irvinebroque](https://github.com/irvinebroque) - Fix Changesets changelog loading in CI by importing `@changesets/changelog-github` from its default export so release PR/version steps can resolve changelog functions.

- [#10](https://github.com/irvinebroque/http-rfc-utils/pull/10) [`67647d8`](https://github.com/irvinebroque/http-rfc-utils/commit/67647d8e73da54c96527e394f061e44e606a0395) Contributor: [@irvinebroque](https://github.com/irvinebroque) - Refactor internal module structure and tighten type-safety guardrails while preserving the public API exported from `src/index.ts`.
  Split large `types`, `auth`, and `jsonpath` modules into focused submodules with compatibility facades, add structure/typecheck workflows (`pnpm check:structure`, strict/lib type checks), improve JSONPath and key-guard typing, and align tooling/docs metadata for consistent CI and API extraction.

## 0.3.0

### Minor Changes

- [#7](https://github.com/irvinebroque/http-rfc-utils/pull/7) [`69fddca`](https://github.com/irvinebroque/http-rfc-utils/commit/69fddca9f9d11595b9e1287b460f76ef497ba420) Thanks [@irvinebroque](https://github.com/irvinebroque)! - Add support for RFC 9309 (robots), RFC 9116 (security.txt), RFC 7033 (WebFinger), and RFC 6415 (host-meta) utilities.
  Also remove the standalone `AUDIT.md` report and keep coverage guidance in README.

### Patch Changes

- [#9](https://github.com/irvinebroque/http-rfc-utils/pull/9) [`84c7f32`](https://github.com/irvinebroque/http-rfc-utils/commit/84c7f32e9eb2dd5e9f4824a50dbf217152cacfaf) Thanks [@irvinebroque](https://github.com/irvinebroque)! - Improve performance across core RFC utilities and add a benchmark suite (`pnpm bench`) to track hot-path regressions.
  Expand RFC-focused test coverage around optimized paths to keep behavior stable while improving throughput.

## 0.2.0

### Minor Changes

- [`4cbddd8`](https://github.com/irvinebroque/http-rfc-utils/commit/4cbddd87c39459b7d66860feddb9fe057ffd2c00) Thanks [@irvinebroque](https://github.com/irvinebroque)! - Add RFC 9651 Structured Fields Date type (SfDate class with @timestamp syntax) and RFC 9745 Deprecation header support (parseDeprecation, formatDeprecation, isDeprecated, buildDeprecationHeaders). Add DEPRECATION link relation.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-02-02

### Added

- Initial release
- RFC 9110: HTTP Semantics (ETags, conditional requests, range requests, content negotiation)
- RFC 9111: HTTP Caching (Cache-Control parsing and formatting)
- RFC 5861: Cache-Control extensions (stale-while-revalidate, stale-if-error)
- RFC 8246: Immutable Cache-Control extension
- RFC 8288: Web Linking (Link header parsing and formatting)
- RFC 9264: Linkset media types
- RFC 9727: API Catalog
- RFC 7231: Accept header parsing
- RFC 7240: Prefer header
- RFC 7239: Forwarded header
- RFC 6265: Cookies
- RFC 6266: Content-Disposition
- RFC 8187: Extended parameter encoding
- RFC 6797: HSTS
- RFC 7617: Basic authentication
- RFC 6750: Bearer tokens
- RFC 7616: Digest authentication
- RFC 4647: Language tag matching
- RFC 8941: Structured Field Values
- RFC 8942: Client Hints
- RFC 9211: Cache-Status
- RFC 9209: Proxy-Status
- RFC 9530: Digest Fields
- RFC 9457: Problem Details
- RFC 6901: JSON Pointer
- RFC 9535: JSONPath
- RFC 3339: Timestamps
- RFC 850: Legacy HTTP-date format
- RFC 8594: Sunset header
- RFC 3986: URI handling
- RFC 6570: URI Templates
- RFC 9421: HTTP Message Signatures
- CORS utilities
