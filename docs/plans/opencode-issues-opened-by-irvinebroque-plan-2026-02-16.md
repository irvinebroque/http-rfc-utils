# OpenCode issue-trigger plan (owner-only)

## Goal

Automatically run OpenCode when a GitHub issue is opened by `irvinebroque`, pass the issue context as the task prompt, and force a fixed execution sequence that ends with commit + push + PR.

## Recommended approach

Create a dedicated workflow file for issue-opened automation, separate from the existing comment-triggered `.github/workflows/opencode.yml` workflow. This avoids mixing event-specific logic and reduces the risk of breaking existing `/oc` and `/opencode` comment behavior.

## Workflow changes

1. Add a new workflow file (recommended name: `.github/workflows/opencode-issues.yml`).
2. Trigger only on issue creation:
   - `on: issues: types: [opened]`
3. Restrict execution to issues opened by `irvinebroque`:
   - job-level `if: github.event.issue.user.login == 'irvinebroque'`
4. Run OpenCode with a custom `prompt` that includes issue title/body/URL and the required instruction block.
5. Keep existing `.github/workflows/opencode.yml` unchanged for comment-driven workflows.

## Prompt design

Use the issue as prompt context, then append the exact required instructions.

```yaml
with:
  model: openai/gpt-5.3-codex
  prompt: |
    You are working on GitHub issue #${{ github.event.issue.number }} in ${{ github.repository }}.
    Issue URL: ${{ github.event.issue.html_url }}
    Issue title: ${{ github.event.issue.title }}
    Issue body:
    ${{ github.event.issue.body || '(no issue body provided)' }}

    research deeply
    then write plan to markdown
    then review your plan and improve it
    then implement your plan
    then review your implementation and improve it
    when you are done commit and push and make a pull request
```

## Permissions and repo settings

To allow branch creation, commits, and PR creation from Actions:

- Workflow/job permissions should include:
  - `id-token: write`
  - `contents: write`
  - `pull-requests: write`
  - `issues: write`
- Repository Actions settings should allow:
  - `GITHUB_TOKEN` with read and write permissions
  - "Allow GitHub Actions to create and approve pull requests" enabled

Token strategy:

- If using the OpenCode GitHub App installation token, keep default token handling.
- If using `GITHUB_TOKEN`, pass it explicitly to the action input/env based on the installed action version and docs at implementation time.

## Hardening and reliability

- Add `concurrency` keyed by issue number to prevent duplicate parallel runs.
- Pin the OpenCode action version (avoid `@latest`) after validation for reproducibility.
- Optionally guard against account rename by checking numeric user ID in addition to username.

## Implementation checklist

1. Add `.github/workflows/opencode-issues.yml` with `issues.opened` trigger.
2. Add author filter for `irvinebroque`.
3. Add write permissions and checkout step.
4. Add OpenCode action step with issue-aware custom prompt + required instruction block.
5. Add concurrency guard.
6. Validate with a real issue opened by `irvinebroque`.
7. Confirm OpenCode creates a branch, commits, pushes, and opens a PR.

## Validation plan

- Positive test: open a new issue as `irvinebroque`, verify workflow runs and OpenCode produces a PR.
- Negative test: open an issue from another account, verify workflow is skipped by job `if`.
- Permission test: confirm no `Resource not accessible by integration` errors for commit/PR operations.

## Rollback plan

If behavior is incorrect or too permissive, disable only the new `.github/workflows/opencode-issues.yml` workflow and keep existing comment-based automation intact.
