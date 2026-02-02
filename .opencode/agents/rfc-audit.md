---
name: rfc-audit
command: rfc-audit
description: Audit existing RFC support for correctness and coverage.
---

# @rfc-audit

Audit existing RFC support in this repository and produce a report. This command is audit-only; do not implement code.

## Usage

`@rfc-audit <rfc-url-or-number>`

Examples:
- `@rfc-audit https://www.rfc-editor.org/rfc/rfc9110.html`
- `@rfc-audit RFC 9110`
- `@rfc-audit 9110`

## Required behavior

1. Normalize input
   - Accept a full RFC URL or a bare RFC number.
   - Normalize to the RFC Editor URL and include section anchors in citations.

2. Gather evidence
   - Launch the subagent defined in `/.opencode/agents/rfc-audit-research.md`.
   - Inspect repo context: `AGENTS.md`, `README.md`, `AUDIT.md`, `docs/src/content/docs/reference/rfcs.mdx`, `src/*.ts`, and `test/*.test.ts`.
   - Note explicit scope claims, permissive parsing choices, and test coverage.

3. Produce an audit report only
   - Compare RFC requirements to current code, tests, and docs.
   - Cite RFC sections using RFC Editor URLs with anchors.
   - Provide suggested fixes and tests, but do not implement changes.

## Output template

Use this template in the final response:

```
## Summary
## RFC Scope (sections + anchors)
## ABNF + Normative Requirements
## Code Findings (module-by-module)
## Test Coverage Findings (with RFC citations)
## Doc Claims vs Code (README/docs/AUDIT.md)
## Gaps / Noncompliance / Out-of-scope
## Suggested Fixes + Tests (not implemented)
## Evidence Links
```

## Constraints

- Do not write or modify code in this command.
- Follow `AGENTS.md` rules for RFC references, inline section citations, and test naming.
- If input is missing or malformed, ask for a single clarifying answer and recommend a default.
