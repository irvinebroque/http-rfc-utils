---
name: rfc-plan
command: rfc-plan
description: Generate a plan to add support for a specific RFC to http-rfc-utils.
---

# @rfc-plan

Generate a high quality, RFC-cited plan for adding support to this repository. This command is planning only; do not implement code.
Use the output template and checklist in `.opencode/skills/rfc-plan.md`.

## Usage

`@rfc-plan <rfc-url-or-number>`

Examples:
- `@rfc-plan https://www.rfc-editor.org/rfc/rfc9291.html`
- `@rfc-plan RFC 9291`
- `@rfc-plan 9291`

## Required behavior

1. Normalize input
   - Accept a full RFC URL or a bare RFC number.
   - Normalize to the RFC Editor URL and include section anchors in citations.

2. Gather evidence
   - Launch the subagent defined in `.opencode/agents/rfc-plan-research.md`.
   - Fetch the RFC text (use RFC Editor URLs) and capture relevant sections and ABNF.
   - Inspect repo context: `AGENTS.md`, `README.md`, `AUDIT.md`, `PLAN.md`, `plans/`, `docs/src/content/docs/reference/rfcs.mdx`, `src/index.ts`, `src/types.ts`, and relevant modules/tests.

3. Produce a plan only
   - Provide a structured plan that maps RFC requirements to modules, exports, tests, docs, and audit updates.
   - Cite RFC sections using RFC Editor URLs with anchors.
   - Call out explicit out-of-scope behavior and any permissive parsing decisions.

## Constraints

- Do not write or modify code in this command.
- Follow `AGENTS.md` rules for RFC references, inline section citations, and test naming.
- If input is missing or malformed, ask for a single clarifying answer and recommend a default.
