# Security Review 2026 Q1

## Scope

- Repository: `http-rfc-utils`
- Focus: parser/formatter modules and public API compatibility facades
- Review window: 2026 Q1

## Risk rubric

- Critical: immediate compromise of integrity, confidentiality, or authentication boundaries.
- High: significant confidentiality/integrity risk with realistic exploit paths.
- Medium: limited blast radius, requires specific preconditions.
- Low: defense-in-depth or hardening opportunities.

## SLA targets

- Critical: fix or contain within 24 hours.
- High: fix within 7 calendar days.
- Medium: fix within 30 calendar days.
- Low: fix within 90 calendar days.

## Module inventory

- `src/auth/*`
- `src/headers/*`
- `src/jsonpath/*`
- `src/linking/*`
- `src/negotiation/*`
- `src/security/*`
- `src/types/*`

## Baseline snapshot

- Findings source: `docs/security/findings.json`
- Structural checks: `pnpm check:structure`
- Validation checks: `pnpm typecheck && pnpm test && pnpm build`
