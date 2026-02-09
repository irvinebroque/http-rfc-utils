# Security Review Template

Use this template for quarterly security reviews.

## Scope

- Modules reviewed:
- Time window:
- Review owner:

## Risk rubric

- Critical: remote code execution, authentication bypass, or key material disclosure.
- High: integrity compromise, privilege escalation, or broad data exposure.
- Medium: constrained data exposure or denial-of-service risk.
- Low: hardening gaps with limited direct exploitability.

## SLA targets

- Critical: 24 hours
- High: 7 days
- Medium: 30 days
- Low: 90 days

## Module inventory

- `src/headers/*`
- `src/security/*`
- `src/negotiation/*`
- `src/linking/*`

## Baseline snapshot

- Commit SHA:
- Lockfile SHA-256:
- Commands run:
  - `pnpm check:structure`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
