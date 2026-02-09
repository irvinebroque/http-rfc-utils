# Contributing

Thanks for contributing to `@irvinebroque/http-rfc-utils`.

## Setup

Requires Node.js `>=22` and `pnpm`.

```bash
pnpm install --frozen-lockfile
```

## Quality gates

Run these before opening or updating a PR:

```bash
pnpm check:structure
pnpm typecheck
pnpm test
pnpm build
```

Additional typecheck variants:

```bash
pnpm typecheck:all
pnpm typecheck:strict
pnpm typecheck:lib
```

## Security fuzzing

```bash
pnpm fuzz:quick
pnpm fuzz:full
pnpm security:ci
```

Replay a fuzz artifact:

```bash
pnpm exec node scripts/fuzz/replay-fast-check.mjs --artifact temp/fuzz-artifacts/<artifact>.json
```

## Coverage

```bash
pnpm test:coverage
pnpm test:coverage:check
```

## Docs and benchmarks

```bash
pnpm docs
pnpm bench
```

## API-shape safety checks

If your changes can affect public API shape or semver behavior, run:

```bash
pnpm api:extract
pnpm semver:check
```

## Changesets and release helpers

PRs are expected to include a real changeset file under `.changeset/`.

```bash
pnpm changeset
pnpm version
pnpm release
```
