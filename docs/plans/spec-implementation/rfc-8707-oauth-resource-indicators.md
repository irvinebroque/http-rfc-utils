 # RFC 8707 OAuth Resource Indicators Plan

 ## Research notes
 - RFC 8707 defines a `resource` parameter for OAuth 2.0 authorization and token requests that identifies the target resource server.
 - Section 2 requires the `resource` parameter value to be an absolute URI (RFC 3986) and forbids fragment components.
 - Section 2.1 covers authorization request usage; Section 2.2 covers token request usage.
 - The spec says query components SHOULD NOT be included; allow them by default for interoperability with an opt-in strict validator.
 - Multiple `resource` parameters are allowed and indicate multiple candidate resources.

 ## Initial plan
 1. Add a new `src/auth/resource-indicator.ts` module with parse/format/validate helpers.
 2. Add types under `src/types/auth.ts` and export through public facades.
 3. Implement tolerant parsers returning `null` for invalid syntax; format/validate throw on semantic errors.
 4. Add RFC-cited tests for single/multiple resources, fragments, and strict query rejection.
 5. Update docs and RFC coverage map; add a changeset.

 ## Plan review and improvements
 - Ensure validators enforce absolute URIs and no fragments, with clear error messages.
 - Keep parsers accept `URLSearchParams`, query strings, and plain objects to match PKCE helpers.
 - Preserve ordering for multiple `resource` parameters without dedupe.
 - Wire exports through `src/auth/index.ts`, `src/auth.ts`, and `src/index.ts` type facade.
