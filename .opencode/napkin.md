# Repository Learning Memory

Last updated: 2026-02-11

## Hard Rules
- Use `pnpm` for all package scripts.
- Keep TypeScript strict-safe (`strict: true`, no `any`).
- Use single quotes, semicolons, and 4-space indentation.
- Use ESM local imports with `.js` suffix in TS source.
- Parser helpers should be tolerant (`null`/empty on syntax-invalid input); validators/formatters should throw on semantic-invalid input.

## User Preferences
- For grouped RFC plan work, implement each plan via subagent workflows and perform subagent review + critique loops.

## Mistakes and Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|-----------------|--------------------|
| 2026-02-11 | tool | Ran full typecheck chain and `typecheck:strict` failed in pre-existing `src/json-patch.ts` WIP lines unrelated to current RFC 7396 edits. | When workspace is intentionally dirty, still run required checks but report unrelated strict failures explicitly and continue with targeted verification for new module/tests. |
| 2026-02-11 | tool | `pnpm check:structure` failed on pre-existing `src/openapi.ts` not exported via `src/index.ts`, unrelated to PKCE changes. | In dirty multi-spec branches, surface structure failures as pre-existing blockers and continue targeted validation for touched modules while preserving unrelated WIP. |
| 2026-02-11 | tool | `pnpm check:structure` failed because pre-existing `src/clear-site-data.ts` is not exported from `src/index.ts`. | Treat structure failures from unrelated in-flight modules as existing workspace blockers; continue verifying documentation-only edits with `typecheck` and focused audits. |
| 2026-02-11 | tool | `pnpm typecheck` failed in pre-existing `src/cache-status.ts` and `src/proxy-status.ts` generic schema typing, unrelated to Accept-* parser refactor scope. | For scoped migrations in dirty branches, report unrelated typecheck blockers explicitly and rely on focused tests + touched-file review for regression confidence. |
| 2026-02-11 | tool | Used `pnpm bench -- <filter>` with this repo's benchmark runner and got no matches because `--` was included in the filter text. | Run filtered perf cases as `pnpm bench "<filter>"` (or `BENCH_FILTER=... pnpm bench`) without a literal `--` separator. |
| 2026-02-11 | self | Called `websearch` with `type: "deep"`; this environment's Exa-backed endpoint accepted only `auto`/`fast`. | Use `auto` or `fast` for `websearch`; if blocked, pivot to `webfetch`/`opensrc_execute` on canonical sources. |
| 2026-02-11 | tool | Exa web search hit free-tier 429 rate limits during spec research. | Prefer `webfetch` for known URLs and `opensrc_execute` for upstream spec repos when Exa is unavailable. |
| 2026-02-11 | self | Assumed `test/openapi-parameter-serialization.test.ts` was part the tracked baseline and debugged its failures mid-task. | Before diving into failures in noisy worktrees, verify whether the failing file is tracked/scope-relevant; prioritize requested modules first. |
| 2026-02-10 | self | Added a new `src/types/*.ts` file and immediately imported via `./types.js` before wiring the shared facade, causing missing-export diagnostics. | When adding a new type module, first update `src/types/shared.ts` (and structure checks if needed), then import/export through `./types.js`. |
| 2026-02-11 | self | Introduced a non-printable control character while adding RFC section comments in a new module. | After adding new files, quickly re-read them and normalize any accidental non-ASCII/control bytes before running tests. |
| 2026-02-11 | self | Used `Object.hasOwn` in a test file, which is unavailable under this repo's current TS lib target and triggered an LSP/type error. | In tests, prefer `Object.prototype.hasOwnProperty.call(obj, key)` for widest target compatibility unless project lib baseline explicitly includes `Object.hasOwn`. |
| 2026-02-11 | tool | A large `apply_patch` failed because expected context lines no longer matched after earlier edits. | For long files with ongoing edits, re-read nearby ranges and apply smaller focused patch hunks. |
| 2026-02-11 | self | Switched on a cached `const valueType = typeof value` for `unknown`, which did not narrow TS types in strict mode and caused string/object helper errors. | For runtime validators over `unknown`, switch directly on `typeof value` (or use explicit type guards) to keep TypeScript narrowing sound. |
| 2026-02-11 | self | Ran `git diff` on files that were actually untracked and got no patch output, which looked like a tooling miss at first glance. | For noisy branches, check `git status --short <path>` first; if a file is untracked, inspect it directly (or compare after add) instead of relying on `git diff`. |
| 2026-02-11 | tool | `apply_patch` failed when targeting a comment line that did not match the current file's exact context. | Re-read the file slice first and patch against exact current lines before applying updates. |
| 2026-02-11 | tool | Inline `pnpm exec tsx -e "...$[...]..."` command failed in zsh due `$` expansion inside JSONPath literal. | Use single-quoted `-e` scripts (or escape `$`) when embedding JSONPath expressions in shell commands. |
| 2026-02-11 | self | Tightened SF inner-list spacing rules and accidentally made `parseParameters` consume the required inter-item separator SP, causing valid inputs like `("a";p "b")` to fail. | When optional `=` is absent in parameter parsing, restore parser index before speculative OWS consumption so separator handling remains with inner-list logic. |
| 2026-02-11 | self | Large targeted test runs can truncate output and hide final pass/fail summary in this environment. | After long test runs, use `wc -l` and `Read` near EOF on the tool-output file to confirm aggregate test status before reporting. |
| 2026-02-11 | tool | A long `docs` subagent prompt aborted before returning output. | Retry with a more focused/scoped prompt (or split into two subagent steps), then merge results. |
| 2026-02-11 | self | Returned optional object fields as `undefined` properties in new WebAuthn modules and hit `exactOptionalPropertyTypes` errors. | Build objects with required fields first, then conditionally assign optional keys instead of setting `key: maybeUndefined`. |
| 2026-02-11 | tool | `git_status` helper output omitted modified files that were visible via `git status --short`. | When status output looks incomplete, verify with direct `git status --short` before deciding what changed. |
| 2026-02-11 | self | Tried `pnpm typecheck:strict -- --pretty false`; this script forwards a literal `--` to `tsc`, producing `TS5023: Unknown compiler option '--'`. | For strict diagnostic formatting/filters, invoke `pnpm exec tsc --project tsconfig.strict.json --noEmit --pretty false` directly instead of passing flags through the script. |
| 2026-02-11 | self | Tried `git diff -- <path>` to inspect edits, but the PKCE files were untracked so diff returned empty output. | Check `git status --short <path>` first; for untracked files, inspect with `Read`/`Grep` instead of `git diff`. |
| 2026-02-11 | tool | First `pnpm typecheck` run reported a transient parser error in a dirty file, but immediate rerun passed without edits. | Re-run flaky/transient typecheck failures once before making unrelated code edits in a noisy worktree. |
| 2026-02-11 | self | Added JSON fixture text with malformed Unicode escapes that introduced NUL bytes, making `Read` treat the file as binary. | Keep new fixture files ASCII-only and use explicit `\u00XX` escapes for non-ASCII literals; if a file is unreadable, delete and recreate it cleanly. |
| 2026-02-11 | self | Placed `@ts-expect-error` above an outer object assignment; TypeScript reported the actual error on a nested property line, leaving the directive unused. | For negative type tests, place `@ts-expect-error` directly on the expression line that triggers the diagnostic (or use helper-call assertions to localize errors). |
| 2026-02-11 | self | Ran `node -e` inside a double-quoted shell command with template literals, causing zsh `${...}` expansion and `bad substitution`. | Wrap inline JS snippets passed to `node -e` in single quotes (or escape `$`) when piping shell output. |
| 2026-02-11 | self | Updated thrown-error text but initially left old message regexes in focused tests, producing avoidable assertion failures. | After diagnostics refactors, immediately run touched module tests and update assertions to intent-based regexes. |
| 2026-02-11 | user | Pointed out that dual-compatible token-message regexes (`old|new`) felt wrong and were matching two behaviors at once. | Keep token assertions single-intent: standardize on `valid RFC 9110 token` wording and split tests when checking different failure modes (for example CTL vs token syntax). |

## Manual Approval Log
| Date | Source | Pattern | Intent | Outcome | Recommendation |
|------|--------|---------|--------|---------|----------------|
| 2026-02-11 | tool | `BENCH_TIME_MS=* BENCH_WARMUP_MS=* pnpm bench*` | Run targeted benchmark commands via subagents during optimization loops | denied | allow - repeatedly needed safe local perf command |
| 2026-02-11 | tool | `BENCH_TIME_MS=* BENCH_WARMUP_MS=* pnpm bench *` | Re-run targeted benchmark loops after updating local OpenCode permissions | approved | keep allow - benchmark loop now runs without prompts |

## Winning Patterns
- For multi-spec implementation requests, first detect implemented vs unimplemented status, then parallelize independent spec work in subagents.
- For large standards docs, fetch authoritative source via `opensrc_execute` and extract targeted line ranges instead of reading full rendered pages.

## Repo Facts
- Canonical package entrypoint is `src/index.ts`.
- Compatibility facades include `src/types.ts`, `src/auth.ts`, and `src/jsonpath.ts`.
- CI expects a changeset file for PRs.
- `scripts/check-structure.mjs` expects new type modules to be listed under `assertDirectoryLayout('src/types', ...)` when adding new shared type domains.

## Open Questions
- None currently.
