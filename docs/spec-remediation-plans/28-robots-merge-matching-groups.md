# Finding 28: robots.txt matching groups must be combined

## Summary
`src/robots.ts:207` does not combine directives from multiple groups that match the same user-agent token. RFC 9309 requires combining all matching groups before rule evaluation.

## Citation (URL + section)
- RFC 9309, section 2.2.1 (If there is more than one group matching the user-agent, the matching groups' rules MUST be combined): https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.1
- RFC 9309, section 2.2.2 (rule evaluation after group selection): https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.2

## Impact / risk
- Partial group selection can drop valid directives and produce incorrect allow/deny outcomes.
- Behavior may diverge from major crawler expectations and published robots test suites.
- Security/compliance posture can weaken when restrictive rules are omitted from evaluation.

## Implementation plan
1. Trace user-agent match selection flow and identify where first-match or single-group behavior is enforced.
2. Replace single-group selection with accumulation of all groups matching the target user-agent.
3. Merge matching-group directives into one effective rule set while preserving directive order needed for deterministic tie behavior.
4. Ensure non-matching groups are excluded and wildcard matching semantics are unchanged.
5. Confirm downstream path matcher consumes the merged rule set without interface breakage.

## Tests
- Add robots fixture with two matching groups for one user-agent and verify both groups' directives apply.
- Add fixture where one matching group allows and another disallows; verify RFC tie-break expectations remain correct.
- Add regression test proving unmatched groups do not leak directives.

## Rollback / guardrails
- Guardrail: isolate changes to group collection/merge logic; keep path-specificity algorithm untouched.
- Guardrail: add explicit tests for deterministic behavior with repeated and conflicting directives.
- Rollback: restore prior selector path if consumers need temporary compatibility, but keep RFC tests to track known deviation.
