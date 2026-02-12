# W3C Referrer Policy Implementation Plan

- Spec: https://www.w3.org/TR/referrer-policy/
- Scope type: server-side header parse/format/validate helpers
- Repo fit: response policy safety for APIs/workers

## 1) Scope and Explicit Non-Goals

- In scope:
  - Referrer-Policy header token parsing and formatting.
  - Effective policy selection behavior for header-based updates (including redirect update helper semantics).
  - Forward-compatible handling: ignore unknown policy tokens while retaining recognized fallbacks.
- Non-goals:
  - Browser URL referrer computation algorithms.
  - HTML/CSS/meta delivery integrations.
  - Actual `Referer` URL stripping/truncation behavior.

## 2) Proposed Module/Files and Public Exports

- New module: `src/referrer-policy.ts`
- Type additions: `src/types/security.ts`
- Planned exports:
  - `parseReferrerPolicy`
  - `parseReferrerPolicyHeader`
  - `formatReferrerPolicy`
  - `validateReferrerPolicy`
  - `selectEffectiveReferrerPolicy`
  - `ReferrerPolicyToken`
  - `ReferrerPolicy` (`token | ''`)
- Public API wiring:
  - `src/index.ts`
  - `src/security/index.ts`
- Tests: `test/referrer-policy.test.ts`

## 3) Data Model and Behavior

- Token set:
  - `no-referrer`
  - `no-referrer-when-downgrade`
  - `same-origin`
  - `origin`
  - `strict-origin`
  - `origin-when-cross-origin`
  - `strict-origin-when-cross-origin`
  - `unsafe-url`
- Parser behavior (tolerant):
  - Last recognized token wins across comma-separated list.
  - Unknown tokens ignored.
  - Return `''` when syntactically valid but no known token recognized.
  - Return `null` for syntax-invalid header forms.
- Formatter/validator behavior (strict):
  - Throw on invalid tokens or semantically invalid input.
- Effective selection helper:
  - If new parsed policy is non-empty token, replace current.
  - Otherwise keep current.

## 4) Test Matrix (Spec-Mapped)

- Header parse nominal and multi-token behavior.
- Unknown token ignore and fallback handling.
- Last-recognized-wins ordering.
- Redirect-style effective update helper semantics.
- Strict validator/formatter negative tests.
- Round-trip parse/format tests for all known tokens.

## 5) Documentation and API Map Updates

- Update `README.md` with referrer-policy utility imports and coverage note.
- Add entry in `docs/src/lib/rfc-map.ts` for referrer policy module and section anchors.
- Add `.changeset/*.md` (likely minor).

## 6) Execution Sequence and Quality Gates

1. Add token/value types in `src/types/security.ts`.
2. Implement `src/referrer-policy.ts`.
3. Wire exports in `src/index.ts` and `src/security/index.ts`.
4. Add `test/referrer-policy.test.ts` with W3C section citations.
5. Update docs and changeset.
6. Run gates:
   - `pnpm check:structure`
   - `pnpm typecheck:all`
   - `pnpm typecheck:strict`
   - `pnpm typecheck:lib`
   - `pnpm test`
   - `pnpm test:coverage:check`
   - `pnpm api:extract`
   - `pnpm semver:check`
   - `pnpm build`

## 7) Risks and Mitigations

- Strictness mismatch with ecosystem header variations:
  - Keep parser tolerant and formatter strict.
- Multi-header ordering ambiguity:
  - Support `string[]` input and process in wire order.
- Spec/default policy drift across platforms:
  - Avoid hidden defaults in helpers; require explicit current policy where needed.
