# OpenCode PR-Opened Review+Autofix Plan

## Objective

When a pull request is initially opened by `github-actions`, automatically run OpenCode to:

1. Run a review pass (`/review`) with high thinking mode.
2. Focus review quality on standards-compliance for the spec being implemented (RFC/W3C/etc.).
3. Apply review findings by committing fixes back to the same PR branch.
4. Avoid creating a second PR.

## Constraints and assumptions

- Trigger only on initial PR creation (`pull_request` `opened`).
- Scope only to PRs authored by GitHub Actions bot(s), not all PRs.
- Use existing OpenCode auth model already used in this repo (OIDC + `GH_TOKEN`).
- Keep workflow non-interactive and deterministic.

## Implementation plan

1. Add a new workflow file dedicated to this automation (`.github/workflows/opencode-pr-review-autofix.yml`).
2. Trigger only on `pull_request` with `types: [opened]`.
3. Gate job execution to PRs opened by GitHub Actions identity:
   - `github-actions[bot]` (plus compatibility fallback `app/github-actions`).
4. Ensure the job checks out the PR head branch directly so fixes land on the same branch.
5. Reuse the OpenCode CLI cache pattern already used elsewhere:
   - detect latest OpenCode release tag;
   - cache `~/.opencode/bin` by OS/arch/version;
   - install on cache miss.
6. Configure high thinking mode by writing a runner-local OpenCode config that sets:
   - `provider.openai.models.gpt-5.2-codex.options.reasoningEffort = high`.
7. Run OpenCode with a custom prompt that explicitly requires:
   - execute `/review` first;
   - evaluate standards compliance for the standard/spec implemented in the PR;
   - implement findings on the same branch;
   - commit and push to the same PR branch;
   - do not open a new PR.
8. Add a changeset documenting the new PR-open autoreview/autofix automation.
9. Run structural check(s), then commit, push, and open PR.

## Plan critique

- **Risk: `/review` command interpretation**
  - The GitHub workflow prompt can require `/review`, but OpenCode might still execute an equivalent internal review flow rather than literal slash-command syntax.
  - Mitigation: keep both explicit `/review` wording and concrete expected outputs (findings + implemented fixes).

- **Risk: model-option precedence**
  - Runner-local config must override defaults predictably.
  - Mitigation: set reasoning option in home OpenCode config (`~/.opencode/opencode.json`) so it is outside repo and not accidentally committed.

- **Risk: bot identity mismatch**
  - Different GitHub contexts can expose bot identity differently.
  - Mitigation: include both `github-actions[bot]` and `app/github-actions` checks.

- **Risk: unintended loop/retrigger**
  - Pushing fixes could retrigger workflows.
  - Mitigation: trigger only on `pull_request.opened`, not `synchronize`.

- **Risk: PR already clean**
  - No changes may be needed; run should still succeed.
  - Mitigation: rely on OpenCode's no-op behavior when no fixes are required.
