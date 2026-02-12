# Plan: Unified Cache-Control Directive Schema

## Scope and non-goals

- Scope:
  - Replace duplicated directive switch logic in RFC 9111 (`cache.ts`) and RFC 9213 (`targeted-cache-control.ts`) with one shared directive descriptor schema.
  - Keep current wire behavior differences (classic header token list vs SF dictionary) isolated to format adapters.
  - Keep `CacheOptions` and `TargetedCacheControl` public shapes stable.
- Non-goals:
  - Merging `CacheOptions` and `TargetedCacheControl` types.
  - Changing directive precedence behavior (for example, private/public resolution).
  - Adding support for new directives in this refactor.

## Affected files/modules

- Add:
  - `src/internal-cache-control-schema.ts` (descriptor table + parse/format helpers).
- Update:
  - `src/cache.ts`
  - `src/targeted-cache-control.ts`
  - `src/types/cache.ts` (only if needed for shared internal mapped keys)
- Tests:
  - `test/cache.test.ts`
  - `test/targeted-cache-control.test.ts`

## Design proposal (helper APIs + migration)

- New descriptor model:
  - `type CacheDirectiveKind = 'boolean' | 'delta-seconds' | 'field-name-list'`
  - `interface CacheDirectiveDescriptor { wireKey: string; property: string; kind: CacheDirectiveKind; allowInClassic: boolean; allowInTargeted: boolean; }`
- New helper APIs:
  - `parseClassicCacheDirectives(header: string): Partial<CacheOptions>`
  - `formatClassicCacheDirectives(options: CacheOptions): string`
  - `parseTargetedCacheDirectives(dict: SfDictionary): Partial<TargetedCacheControl>`
  - `appendTargetedCacheDirectives(dict: SfDictionary, input: TargetedCacheControl): void`
- Migration steps:
  - Convert `cache.ts` switch blocks to descriptor-driven parse/format loops.
  - Convert `targeted-cache-control.ts` boolean/numeric sets and `appendKnownDirective` switch to descriptor-driven logic.
  - Keep extension pass-through behavior in targeted formatter/parser unchanged.

## Step-by-step implementation phases

1. Add descriptor table and shared kind handlers in `src/internal-cache-control-schema.ts`.
2. Migrate `cacheControl` and `parseCacheControl` in `src/cache.ts`.
3. Migrate `parseTargetedCacheControl` and `formatTargetedCacheControl` in `src/targeted-cache-control.ts`.
4. Confirm ordering remains deterministic and matches current tests.
5. Remove obsolete directive constants/switches.

## Test plan

- Extend existing tests:
  - `test/cache.test.ts`
  - `test/targeted-cache-control.test.ts`
- Add new test cases (names):
  - `it('keeps classic and targeted max-age parsing aligned for integer values')`
  - `it('keeps stale-if-error and stale-while-revalidate formatting order aligned across formats')`
  - `it('continues to ignore invalid numeric members consistently in both parsers')`
  - `it('preserves targeted extension members when known directive schema is shared')`
  - `it('keeps private field-list behavior limited to classic Cache-Control')`

## Risk/rollback plan

- Risks:
  - Descriptor misconfiguration could drop directives silently.
  - Divergent classic vs targeted value constraints could be accidentally flattened.
- Mitigations:
  - Encode allowlist flags per format in descriptor entries.
  - Add paired parse/format parity tests between cache and targeted modules.
- Rollback:
  - Keep original switch helpers behind temporary wrappers until parity tests pass.
  - Revert one module migration at a time if regressions appear.

## Definition of done

- Shared descriptor table is the only source of known directive metadata.
- `src/cache.ts` and `src/targeted-cache-control.ts` no longer maintain independent directive switch trees.
- Existing cache and targeted tests pass, plus new alignment tests pass.
- No public export changes and no behavior changes outside covered test expectations.
