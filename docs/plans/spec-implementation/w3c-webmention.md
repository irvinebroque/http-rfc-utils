# W3C Webmention Research, Critique, and Implementation Plan

- Candidate spec: W3C Webmention Recommendation (12 January 2017)
  - https://www.w3.org/TR/webmention/
- Research question: Should `http-rfc-utils` implement Webmention utilities?
- Date: 2026-02-16

## Final Decision

Implement Webmention in this repository, but only as a strict, deterministic utility subset.

- Yes to: endpoint discovery helpers, request parse/format/validation helpers, and small policy helpers.
- No to: full sender/receiver orchestration (network fetch loops, queueing, persistence, moderation, rendering).

This aligns with how this repository handles standards: composable parse/format/validate primitives with explicit non-goals.

## Iteration 1: Initial Findings

Initial assessment before deeper critique:

- Strong fit with existing repo shape:
  - `src/link.ts` already provides robust `Link` parsing/formatting.
  - `src/uri.ts` already provides URI normalization/comparison helpers.
  - `src/webfinger.ts` and `src/host-meta.ts` show prior discovery-focused modules.
- Webmention has clear utility-sized pieces that match this repo:
  - endpoint discovery from `Link` headers / HTML rel links
  - `application/x-www-form-urlencoded` source/target request handling
  - sender/receiver validation helpers
- Main concern:
  - full Webmention implementation includes operational concerns (DoS controls, async processing, moderation) that are not this repo's style.

Initial recommendation: implement, but scope narrowly.

## Self-Critique of Iteration 1

Gaps in the initial pass:

- Too qualitative; lacked ecosystem and adoption evidence.
- Did not quantify test complexity or interop edge cases.
- Did not explicitly map security sections to utility boundaries.
- Did not provide a concrete API/file plan or phased execution path.

## Iteration 2: Deeper Research

### 1) Standards Maturity and Stability

- Webmention is a W3C Recommendation (2017), not a draft.
- The `webmention` link relation is registered with IANA Link Relations.
  - https://www.iana.org/assignments/link-relations/link-relations-1.csv
- Normative sender/receiver behavior is explicit and testable:
  - discovery precedence and fallback order
  - form-encoded request format
  - success/error status handling
  - request and mention verification rules

Important normative points from the spec:

- Sender MUST check `Link` rel=`webmention` first, then HTML `<link>` / `<a>` rel in order.
- Sender MUST POST `source` and `target` as x-www-form-urlencoded.
- Any `2xx` is success for senders.
- Receiver MUST validate `source` and `target` URLs and reject `source == target`.
- Receiver SHOULD process asynchronously and SHOULD enforce redirect/time/size limits.

### 2) Interop and Ecosystem Evidence

- Conformance ecosystem still exists:
  - Webmention test/validator remains live (`webmention.rocks`) with dedicated discovery/update/delete tests.
  - https://webmention.rocks/
- Historical implementation report summary indicates broad sender/receiver interoperability work:
  - 17 sender implementations, 16 receiver implementations listed.
  - Discovery tests show high pass counts (typically 15-17 in the summary output).
  - Update/delete/loopback tests have lower pass counts, indicating harder operational areas.
  - https://webmention.net/implementation-reports/summary/
- Active deployment evidence (WordPress ecosystem):
  - WordPress Webmention plugin shows active installs (`900+`) and recent updates (2026 metadata page snapshot).
  - https://wordpress.org/plugins/webmention/
- Node ecosystem evidence (niche but alive):
  - `@remy/webmention`: about 4,595 downloads in the last month, no deprecation, latest release in 2023.
  - https://api.npmjs.org/downloads/point/last-month/@remy/webmention
  - Package metadata: https://registry.npmjs.org/@remy/webmention

Conclusion from ecosystem data: Webmention is niche, but not dead; utility support is still useful.

### 3) Repository Fit (Deep Mapping)

What already exists and can be reused:

- `src/link.ts` + `parseLinkHeader`:
  - already handles multiple `Link` values, quoted/unquoted rel values, multi-rel token splitting, and malformed edge handling.
  - this directly covers many Webmention discovery cases.
- `src/uri.ts`:
  - URI normalization/comparison can support `source != target` checks and redirect-normalized comparisons.
- Existing module pattern:
  - parse functions are tolerant (`null`/empty for syntax-invalid input).
  - format/validate functions throw for semantic-invalid input.
  - this maps well to Webmention request/body helper design.

What is missing:

- A dedicated Webmention module with discovery precedence logic and endpoint selection.
- HTML rel discovery helpers (`<link>`/`<a>` in document order) for sender behavior.
- Form body helpers for `source`/`target` with duplicate and required-field handling.
- Receiver-side request validation helper with Webmention-specific rules.

What should remain out-of-scope for this repo:

- Network orchestration (`fetch`, retries, queue workers, storage).
- Content extraction/microformats pipeline for publishing comments/likes.
- Moderation, anti-spam workflows, and UI/display behavior.

### 4) Security and Risk Findings

The most failure-prone areas are the operational parts, not the pure parsing parts.

- Sender risk: SSRF/loopback abuse when endpoint discovery is trusted blindly.
- Receiver risk: DoS and parser abuse during source-fetch verification.
- Interop risk: discovery edge cases (multiple headers, rel token parsing, empty href, relative endpoint resolution).

For this repo specifically, risk is manageable if scope is utility-only:

- Provide policy helpers for validation and endpoint safety checks.
- Do not own network behavior.
- Keep operational security guidance in docs and tests.

## Recommendation: Implement a Scoped Webmention Utility Layer

Recommendation detail:

- Implement now: yes, scoped utility subset.
- Defer: full sender/receiver runtime behavior.

Reasoning:

- High standards fit and high code reuse from existing modules.
- Useful to consumers implementing Webmention in apps/frameworks.
- Avoids this repo becoming an HTTP crawler/queue engine.

## Proposed Implementation Plan

## 1) Scope and Non-Goals

In scope (MVP):

- Endpoint discovery helpers from already-fetched inputs.
- Webmention request parse/format/validate helpers.
- Response-status helper(s) for sender semantics.
- Optional policy helper for unsafe endpoint detection (loopback/local).

Explicit non-goals (MVP):

- No network I/O or redirect following implementation.
- No queueing/status-resource management (`201` location polling orchestration).
- No source-document content extraction/publishing pipeline.
- No moderation/workflow/storage.

## 2) Proposed Public API (MVP)

Proposed module: `src/webmention.ts`

Proposed exports (naming aligned with repo conventions):

- `WEBMENTION_REL`
- `WEBMENTION_CONTENT_TYPE`
- `discoverWebmentionEndpoint`
- `parseWebmentionRequest`
- `formatWebmentionRequest`
- `validateWebmentionRequest`
- `isWebmentionSuccessStatus`

Potential types in `src/types/discovery.ts`:

- `WebmentionRequest`
- `WebmentionEndpointDiscoveryInput`
- `WebmentionEndpointDiscoveryResult`
- `WebmentionValidationOptions`

Behavior notes:

- `discoverWebmentionEndpoint` should:
  - prefer HTTP `Link` discovery first
  - fallback to HTML rel discovery (`<link>`, then `<a>` in document order)
  - resolve relative endpoints against target URL
  - preserve endpoint query string as part of endpoint URL
- `parseWebmentionRequest` should be tolerant and return `null` on malformed/invalid required shape.
- `formatWebmentionRequest` and `validateWebmentionRequest` should throw on semantic invalids.
- `isWebmentionSuccessStatus` should return true for any `2xx`.

## 3) File and Export Wiring Plan

Planned files:

- `src/webmention.ts` (new)
- `src/types/discovery.ts` (type additions)
- `test/webmention.test.ts` (new)

Planned wiring updates:

- `src/types/shared.ts` (re-export new types)
- `src/index.ts` (public exports)
- `src/linking/index.ts` (optional contributor barrel export)

Optional compatibility update:

- Add `WEBMENTION` to `LinkRelation` in `src/link.ts`.

## 4) Test Plan (Spec-Mapped + Interop-Mapped)

Normative tests (W3C spec references in test comments):

- Discovery precedence:
  - `Link` header beats HTML endpoint hints.
- Discovery parsing:
  - single/multi `Link` headers
  - quoted and unquoted `rel`
  - rel token matching in space-separated lists
  - ignore malformed/empty endpoint candidates
- HTML fallback:
  - `<link rel~="webmention">`
  - `<a rel~="webmention">`
  - first valid in document order
- Endpoint normalization:
  - relative URL resolution
  - query string preservation
- Request handling:
  - parse/format for `source` and `target`
  - duplicate/missing params invalid handling
  - supported scheme checks
  - reject `source == target`
- Status handling:
  - any `2xx` success; non-2xx failure.

Interop-hardening tests (inspired by live test ecosystems):

- Cases mirrored from `webmention.rocks` discovery patterns where practical.
- Optional compatibility mode for legacy rel URI forms only if explicitly enabled.

## 5) Documentation and Traceability Updates

If implemented, update:

- `README.md`:
  - add Webmention import row and coverage bullet.
- `docs/reference/imports-by-task.md`:
  - add Webmention task row.
- `docs/reference/rfc-map.md` and `docs/src/lib/rfc-map.ts`:
  - add `src/webmention.ts` coverage entry.

## 6) Quality Gates

Run before merging implementation:

- `pnpm check:structure`
- `pnpm typecheck`
- `pnpm typecheck:all`
- `pnpm typecheck:strict`
- `pnpm typecheck:lib`
- `pnpm test`
- `pnpm build`

If public API shape changes are non-trivial:

- `pnpm api:extract`
- `pnpm semver:check`

## 7) Risk Register and Mitigations

- Scope creep into runtime orchestration:
  - Mitigation: enforce utility-only boundary in module docs and API names.
- HTML parsing fragility:
  - Mitigation: keep parser minimal and test against known discovery edge cases.
- Security expectations confusion:
  - Mitigation: include explicit docs that validation helpers do not replace full network safety policy.
- Legacy compatibility pressure:
  - Mitigation: make non-standard compatibility behavior opt-in.

## 8) Go/No-Go Criteria

Go now if all are true:

- We keep scope to deterministic utilities.
- We can cover discovery/request behaviors with high-confidence tests.
- We avoid adding network/runtime side effects.

No-go (defer) if any are required immediately:

- full sender/receiver service orchestration
- microformats extraction/display pipeline
- anti-spam moderation workflow ownership

## References

- W3C Webmention Recommendation: https://www.w3.org/TR/webmention/
- IANA Link Relations registry (includes `webmention`): https://www.iana.org/assignments/link-relations/link-relations-1.csv
- Webmention test validator: https://webmention.rocks/
- Webmention implementation reports summary: https://webmention.net/implementation-reports/summary/
- Webmention implementations list: https://webmention.net/implementations/
- IndieWeb implementation guide: https://indieweb.org/webmention-implementation-guide
- WordPress Webmention plugin: https://wordpress.org/plugins/webmention/
- npm download endpoint (`@remy/webmention`): https://api.npmjs.org/downloads/point/last-month/@remy/webmention
- npm package metadata (`@remy/webmention`): https://registry.npmjs.org/@remy/webmention
