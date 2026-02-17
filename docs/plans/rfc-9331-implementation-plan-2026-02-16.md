# RFC 9331 Implementation Plan (2026-02-16)

## Research Summary (Deep Pass)

Primary source reviewed:

- RFC 9331 (ECN Protocol for L4S): https://www.rfc-editor.org/rfc/rfc9331.html

Key normative points relevant to a utility library implementation:

- RFC 9331 Section 4.1: a sender that wants L4S treatment MUST set IP-ECN to `ECT(1)`.
- RFC 9331 Section 5.1: L4S network nodes MUST classify arriving `ECT(1)` packets for L4S treatment.
- RFC 9331 Section 5.1: by default, L4S nodes MUST classify arriving `CE` packets for L4S treatment.
- RFC 9331 Section 5.3: transport-aware exception allows `CE` to be treated as Classic only when all ECT packets in the flow have been `ECT(0)`.
- RFC 9331 Section 5.1: re-marking constraints include `ECT(1)` not being changed to other codepoints except `CE`, and `CE` not being changed to any other codepoint.
- RFC 9331 Section 5.1: when L4S treatment is disabled, `ECT(1)` packets MUST be treated as if they were `Not-ECT`.
- RFC 9331 Section 8 + IANA ECN registry: canonical 2-bit mapping is `00` Not-ECT, `01` ECT(1), `10` ECT(0), `11` CE.

## Scope Decision

RFC 9331 is transport/network behavior, not an HTTP header RFC. In this repository, the implementable and testable subset is codepoint parsing/formatting and L4S classification/transition helpers.

In scope:

- ECN codepoint parser/formatter helpers and bit mapping.
- L4S identifier detection helpers.
- L4S classification helpers for default and transport-aware CE exception behavior.
- L4S transition/disable helper behavior for RFC 9331 Section 5.1.
- Public exports, docs map updates, README references, and RFC-cited tests.

Out of scope (explicitly not implemented):

- Congestion-control algorithm implementation (Prague/DCTCP/etc.).
- AQM queueing algorithm implementation/coupling formulas (Section 5.2 behavior models).
- VPN anti-replay runtime configuration logic (Section 6.2 operations).

## Initial Plan (v1)

1. Add public types for ECN codepoints and L4S classification options.
2. Create `src/l4s.ts` with parse/format and classification helpers for Sections 4.1, 5.1, 5.3, and 8.
3. Add targeted tests in `test/l4s.test.ts` with RFC citations.
4. Wire exports through `src/index.ts` and update docs coverage (`docs/src/lib/rfc-map.ts`, `README.md`).
5. Run repo quality gates and adjust for style/type issues.

## Plan Review (v2 Improvements)

After reviewing v1 for edge-case and contract clarity, make these upgrades before implementation:

- Add explicit helper for "L4S disabled" behavior (`ECT(1)` -> `Not-ECT`) to cover Section 5.1 operational requirement.
- Add transition-validation helper focused on RFC 9331-specific re-marking constraints.
- Ensure parser tolerates both textual and binary/bit-form inputs while remaining strict (`null` on invalid syntax input).
- Add tests for:
  - transport-aware CE exception behavior (Section 5.3),
  - override classifier behavior (Section 5.1 "unless overridden by another classifier"),
  - invalid transitions and invalid parse inputs.
- Include docs/reference updates so imports and RFC map remain discoverable for the new module.

## Verification Plan

Targeted:

```bash
pnpm exec tsx --test test/l4s.test.ts
```

Repository gates:

```bash
pnpm check:structure
pnpm typecheck
pnpm test
pnpm build
```
