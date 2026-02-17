## Research notes

- RFC 9396 introduces the `authorization_details` parameter as a JSON array of objects, each with a required `type` string (Sections 2, 2.1).
- Common data fields are optional but typed: `locations`, `actions`, `datatypes`, `privileges` arrays of strings, and `identifier` string (Section 2.2).
- The AS MUST reject unknown types or invalid/missing fields when validating against known type definitions (Section 5).
- RFC 9396 does not define a cross-type comparison algorithm; validation focuses on structure and type-specific rules.

## Plan v1 (initial)

1. Add RFC 9396 types for authorization details in `src/types/auth.ts`.
2. Implement parse/format/validate helpers in a new `src/auth/authorization-details.ts` module.
3. Wire public exports through `src/auth/index.ts`, `src/auth.ts`, and `src/index.ts`.
4. Add RFC-cited tests covering examples and validation behavior.
5. Update README and docs RFC map; add a changeset.

## Plan review

- Missing deterministic formatting rules (ordering of keys, extension fields) that match repo conventions.
- No explicit handling for tolerant parsing of already-decoded objects.
- Needs clear scope for type-specific validation via optional registries to align with Section 5.

## Plan v2 (improved)

1. Extend auth types with JSON value shapes, authorization details entries, and validation registry options.
2. Implement helpers:
   - `parseAuthorizationDetails(json: string)` for JSON string inputs.
   - `parseAuthorizationDetailsObject(value: unknown)` for already-decoded inputs.
   - `formatAuthorizationDetails(details, options?)` with deterministic key ordering and JSON cloning.
   - `validateAuthorizationDetails(details, options?)` enforcing JSON value shapes, required `type`, common field types, and optional type registry rules.
3. Keep deterministic formatting by emitting `type` then common fields in RFC order, then extension fields sorted lexicographically.
4. Wire exports through auth facades and root index; update docs and README task table.
5. Add RFC 9396 tests for examples (Section 2) and validation errors (Section 5).
6. Add a changeset for a minor release.
