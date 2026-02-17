## Plan

Goal: add RFC 7591 + RFC 7592 dynamic client registration helpers with deterministic parse/format/validate utilities, public exports, tests, docs, and changeset coverage.

1. Review RFC 7591 + RFC 7592 sections for client metadata, registration requests/responses, management read/update/delete, and client information response fields.
2. Define new types for RFC 7592 client information responses and update requests, reusing RFC 7591 metadata types where possible.
3. Implement parse/format/validate helpers for RFC 7592 client information response and update requests, keeping tolerant parse + strict validation patterns consistent with existing modules.
4. Add RFC-cited tests for management read/update response handling, required registration access token/client URI validation, and update request constraints.
5. Wire new exports into `src/index.ts`, update `docs/src/lib/rfc-map.ts`, and extend README task map/coverage list.
6. Update changeset to cover RFC 7592 support and ensure new files adhere to ASCII/format/style conventions.

## Plan Review

Strengths: aligns with repo patterns (tolerant parsers + strict validators), includes tests/docs/changeset, and scopes to deterministic helpers.
Gaps: does not explicitly address RFC 7592 constraints on update requests (client_id required; omit registration_access_token/registration_client_uri/client_secret_expires_at/client_id_issued_at) or how to share validation logic with RFC 7591 helpers.
Risk: over/under-validating fields could break interoperability; need explicit options or clear error messages for stricter checks.

## Revised Plan

1. Re-read RFC 7592 Sections 2 and 3 to extract required fields and update-request exclusions; capture in module header comments.
2. Extend types: add `OAuthClientConfigurationResponse` + `OAuthClientConfigurationUpdateRequest` with required `registration_access_token` + `registration_client_uri`, and optional `client_id`/`client_secret` constraints for updates.
3. Build `src/oauth-client-registration-management.ts` with parse/format/validate helpers for client information response and update requests, sharing RFC 7591 metadata validation while enforcing RFC 7592 exclusions and required members.
4. Add RFC 7592-focused tests for update-request validation, response parsing, and serialization, with citations for Sections 2.2 and 3.
5. Wire exports through `src/index.ts` and update `docs/src/lib/rfc-map.ts`, README task list, and RFC coverage snapshot to include RFC 7592.
6. Update changeset for RFC 7592 support, check ASCII + 4-space indentation, and keep error messages field-specific.
