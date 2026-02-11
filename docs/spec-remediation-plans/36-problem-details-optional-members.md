# Finding 36 Remediation Plan: Problem Details Optional Members

## Finding summary
- `src/types/problem.ts:8-11` currently makes `type`, `title`, `status`, and `detail` required on `ProblemDetails`.
- RFC 9457 defines these standard members as optional in problem detail objects.
- Result: compliant minimal problem payloads are rejected at the type level.

## Spec citation
- RFC 9457, Section 3.1 (Members of a Problem Details Object): standard members (`type`, `title`, `status`, `detail`, `instance`) are optional.
- RFC 9457 notes default semantics when members are absent (for example, absent `type` implies `about:blank`).
- Reference: https://www.rfc-editor.org/rfc/rfc9457.html#section-3.1

## Impact/risk
- **Standards compliance risk:** valid RFC-conformant payloads cannot be represented without unsafe casts.
- **Integration friction:** upstream/downstream systems that emit sparse problem details conflict with current types.
- **False certainty risk:** required typing can imply stronger guarantees than wire-level protocol actually provides.

## Implementation steps
- Update `ProblemDetails` so RFC-defined base members are optional.
- Reassess `ProblemOptions` constructor/input shape:
  - keep stricter local construction contract if intentional, but clearly separate from wire-format type, or
  - align to optional RFC members and enforce required app-level fields in higher-level helpers.
- Ensure formatter/parser contracts and docs reflect wire-level optionality versus library convenience APIs.
- Audit dependent code for assumptions that `title`/`status`/`detail` always exist.

## Tests/typechecks
- Add type tests showing minimal valid problem details (including extension-only cases) compile.
- Add tests validating absent optional members preserve RFC semantics in parsers/formatters.
- If `ProblemOptions` remains stricter, add explicit tests documenting this intentional divergence.
- Run: `pnpm check:structure`, `pnpm typecheck`, `pnpm typecheck:all`, `pnpm typecheck:strict`, `pnpm typecheck:lib`, `pnpm test`.

## Rollback/guardrails
- Document any intentional distinction between wire type (`ProblemDetails`) and construction helper type (`ProblemOptions`).
- Add regression tests ensuring optional member modeling remains RFC-aligned.
- Include release notes guidance if optionalization changes downstream narrowing expectations.
