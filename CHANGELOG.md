# Changelog

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
