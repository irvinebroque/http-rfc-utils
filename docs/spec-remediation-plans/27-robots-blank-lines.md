# Finding 27: robots.txt blank line group handling

## Summary
`src/robots.ts:71` appears to treat a blank line as a hard group terminator. RFC behavior requires tolerant parsing where empty lines do not incorrectly split matching semantics.

## Citation (URL + section)
- RFC 9309, section 2.2 (Parsing) and section 2.2.1 (Groups and matching user-agents): https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2
- RFC 9309, section 2.2.1 (group concept): https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.1

## Impact / risk
- Crawlers may ignore intended `allow`/`disallow` rules after blank lines.
- Effective policy can become less restrictive or more restrictive than author intent.
- Real-world robots files frequently include spacing; strict termination harms compatibility.

## Implementation plan
1. Review parser state machine around group start/end boundaries and empty-line token handling.
2. Adjust parsing so blank lines are treated as ignorable separators, not unconditional group terminators.
3. Keep group termination tied to relevant record transitions (for example, new `user-agent` block), not visual spacing.
4. Preserve existing handling for comments and unknown records to avoid broad behavior changes.
5. Document parser tolerance expectations in module-level notes if behavior was previously ambiguous.

## Tests
- Add fixture where a single matching group contains blank lines between directives and verify directives remain in one effective group.
- Add fixture with comments + blank lines interleaved and verify same result.
- Add regression test ensuring a true new `user-agent` record still starts a new group.

## Rollback / guardrails
- Guardrail: no changes to directive precedence or longest-path evaluation, only grouping boundaries.
- Guardrail: include tests for both compact and whitespace-heavy robots files.
- Rollback: revert blank-line handling branch and keep new test fixtures marked pending if compatibility concerns arise.
