# Codebase Structure Baseline

Captured before the structure refactor in `CODEBASE_STRUCTURE_PLAN.md`.

## Hotspot file sizes

`wc -l src/*.ts` snapshot:

| File | Lines |
| --- | ---: |
| `src/jsonpath.ts` | 1722 |
| `src/auth.ts` | 1167 |
| `src/types.ts` | 1139 |
| `src/http-signatures.ts` | 864 |
| `src/index.ts` | 602 |

## Baseline coupling notes

- `src/types.ts` was a central hub with 53 source-module imports.
- `src/auth.ts` mixed generic auth parsing with Basic, Bearer, and Digest behavior.
- `src/jsonpath.ts` contained token definitions, lexer, parser, evaluator, and built-in functions in one file.
- `src/` was mostly flat; domain-level scanning required opening many unrelated files.

## Baseline commands used

- `wc -l src/*.ts`
- `grep "from './types\\.js'" src/*.ts`
