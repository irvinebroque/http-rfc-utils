# RFC Planning Skill

This skill defines the exact steps and output structure for planning RFC support in `http-rfc-utils`.

## Input contract

- Accept a single RFC URL or a bare RFC number.
- Normalize to `https://www.rfc-editor.org/rfc/rfcNNNN.html` and cite section anchors.

## Step-by-step process

1. Normalize + verify the RFC
   - Extract RFC number from input.
   - Fetch the RFC Editor page and capture the official title.
   - Record the canonical URL and relevant section anchors.

2. Define scope
   - List the RFC sections to implement.
   - Include ABNF snippets for parsing/serialization.
   - Call out explicit out-of-scope behavior up front.

3. Map to repository structure
   - Decide whether to add a new `src/*.ts` module or extend an existing one.
   - Propose public exports and any new types in `src/types.ts`.
   - Ensure exports align with `src/index.ts` and the README RFC map.

4. Implementation notes
   - Identify precedence rules, parsing edge cases, and validation rules.
   - Specify strict vs permissive parsing decisions.
   - Add inline RFC section comments near non-obvious logic.

5. Tests (RFC-cited)
   - Add tests that cite RFC sections in names or comments.
   - Prefer RFC examples where available; add edge cases for MUST/SHOULD and ABNF limits.
   - Follow the `test/conditional.test.ts` structure.

6. Docs and audit updates
   - Update `README.md` Supported RFCs and RFC Map.
   - Update `docs/src/content/docs/reference/rfcs.mdx` with the RFC and supported sections.
   - Update `AUDIT.md` with coverage status, gaps, and compliance vs permissive notes.

7. Quality gates
   - Run `pnpm test` after changes.
   - Run `pnpm run docs:generate` if new exports or types are added.
   - Verify README examples match exports and signatures.

## Output template

```
## Summary
## RFC Scope (sections + anchors)
## ABNF + Normative Requirements
## Proposed Module/Exports/Types
## Implementation Notes (edge cases, precedence, permissive vs strict)
## Tests (with RFC section citations)
## Docs + Audit Updates
## Risks/Decisions
## Execution Checklist
```

## Checklist (use in plan)

- [ ] Scope lists RFC number, sections, ABNF snippets, out-of-scope items.
- [ ] Plan identifies target module(s) and export updates.
- [ ] Tests include RFC section citations.
- [ ] Docs and `AUDIT.md` updates are included.
- [ ] Quality gates are listed.
