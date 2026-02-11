/**
 * Tests for OpenAPI security requirement parsing and evaluation.
 * OpenAPI Specification v3.1.1: Security Requirement Object semantics.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    evaluateOpenApiSecurity,
    normalizeOpenApiSecurityRequirements,
    parseOpenApiSecurityRequirements,
    resolveEffectiveOpenApiSecurity,
    tryParseOpenApiSecurityRequirements,
    validateOpenApiSecurityRequirements,
} from '../src/openapi.js';
import type { OpenApiSecuritySchemeMetadata } from '../src/types.js';

const OAUTH_FLOWS = {
    authorizationCode: {
        authorizationUrl: 'https://idp.example.test/oauth/authorize',
        tokenUrl: 'https://idp.example.test/oauth/token',
        scopes: {
            read: 'Read access',
            write: 'Write access',
        },
    },
} as const;

const OIDC_URL = 'https://idp.example.test/.well-known/openid-configuration';

// OpenAPI 3.1.1 Security Scheme Object typing requirements.
function assertValidScheme(_value: OpenApiSecuritySchemeMetadata): void {
}

assertValidScheme({ type: 'apiKey', in: 'query', name: 'api_key' });
assertValidScheme({ type: 'apiKey', in: 'header', name: 'X-API-Key' });
assertValidScheme({ type: 'apiKey', in: 'cookie', name: 'session_id' });

// @ts-expect-error - OpenAPI apiKey security schemes require a name field.
assertValidScheme({ type: 'apiKey', in: 'header' });
// @ts-expect-error - OpenAPI apiKey security schemes require an in field.
assertValidScheme({ type: 'apiKey', name: 'X-API-Key' });
// @ts-expect-error - OpenAPI apiKey security schemes only allow query/header/cookie locations.
assertValidScheme({ type: 'apiKey', in: 'path', name: 'id' });

// @ts-expect-error - OpenAPI oauth2 security schemes require flows.
assertValidScheme({ type: 'oauth2' });
assertValidScheme({
    type: 'oauth2',
    flows: {
        // @ts-expect-error - OpenAPI oauth2 flow objects require scopes maps.
        clientCredentials: {
            tokenUrl: 'https://idp.example.test/oauth/token',
        },
    },
});

// @ts-expect-error - OpenAPI openIdConnect security schemes require openIdConnectUrl.
assertValidScheme({ type: 'openIdConnect' });

describe('OpenAPI security requirement parser', () => {
    it('parses valid requirement arrays and preserves empty-object alternatives', () => {
        const parsed = parseOpenApiSecurityRequirements([
            { apiKeyAuth: [] },
            {},
            { oauth: ['read:pets', 'write:pets'] },
        ]);

        assert.deepEqual(parsed, [
            { apiKeyAuth: [] },
            {},
            { oauth: ['read:pets', 'write:pets'] },
        ]);
    });

    it('returns null for malformed shapes', () => {
        assert.equal(parseOpenApiSecurityRequirements({ apiKeyAuth: [] }), null);
        assert.equal(parseOpenApiSecurityRequirements([{ apiKeyAuth: 'read' }]), null);
        assert.equal(parseOpenApiSecurityRequirements([{ apiKeyAuth: [1] }]), null);
        assert.equal(parseOpenApiSecurityRequirements([null]), null);
    });

    it('tryParse returns null for invalid JSON and invalid structure', () => {
        assert.equal(tryParseOpenApiSecurityRequirements('{"oops"'), null);
        assert.equal(tryParseOpenApiSecurityRequirements('{"apiKeyAuth":[]}'), null);
        assert.deepEqual(
            tryParseOpenApiSecurityRequirements('[{"apiKeyAuth":[]},{"oauth":["read"]}]'),
            [{ apiKeyAuth: [] }, { oauth: ['read'] }],
        );
    });
});

describe('OpenAPI security requirement evaluator', () => {
    const schemeRegistry = {
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        mtls: { type: 'mutualTLS' },
        oauth: { type: 'oauth2', flows: OAUTH_FLOWS },
        bearer: { type: 'http', scheme: 'bearer' },
        oidc: {
            type: 'openIdConnect',
            openIdConnectUrl: OIDC_URL,
            availableScopes: ['profile', 'email'],
        },
    } as const;

    it('applies AND inside an object and OR across array entries', () => {
        const result = evaluateOpenApiSecurity(
            [
                { apiKeyAuth: [], mtls: [] },
                { oauth: ['read'] },
            ],
            schemeRegistry,
            {
                oauth: { scopes: ['read'] },
            },
        );

        assert.equal(result.allowed, true);
        assert.equal(result.matchedRequirementIndex, 1);
        assert.equal(result.requirements[0]?.satisfied, false);
        assert.equal(result.requirements[1]?.satisfied, true);
    });

    it('treats {} as an anonymous-access alternative', () => {
        const result = evaluateOpenApiSecurity(
            [
                {},
                { apiKeyAuth: [] },
            ],
            schemeRegistry,
            {},
        );

        assert.equal(result.allowed, true);
        assert.equal(result.anonymous, true);
        assert.equal(result.matchedRequirementIndex, 0);
        assert.equal(result.requirements[0]?.anonymous, true);
    });

    it('ignores unknown schemes during tolerant evaluation', () => {
        const tolerant = evaluateOpenApiSecurity(
            [{ unknownAuth: [] }],
            schemeRegistry,
            {},
            { mode: 'tolerant', unknownSchemes: 'ignore' },
        );

        assert.equal(tolerant.allowed, true);
        assert.equal(tolerant.requirements[0]?.satisfied, true);
        assert.deepEqual(tolerant.requirements[0]?.schemes, []);

        const explicitError = evaluateOpenApiSecurity(
            [{ unknownAuth: [] }],
            schemeRegistry,
            {},
            { mode: 'tolerant', unknownSchemes: 'error' },
        );

        assert.equal(explicitError.allowed, false);
        assert.equal(explicitError.requirements[0]?.schemes[0]?.code, 'unknown-scheme');
    });

    it('evaluates OAuth2/OpenID required scopes with AND semantics', () => {
        const missingScope = evaluateOpenApiSecurity(
            [{ oauth: ['read', 'write'] }],
            schemeRegistry,
            {
                oauth: { scopes: ['read'] },
            },
        );

        assert.equal(missingScope.allowed, false);
        assert.deepEqual(missingScope.requirements[0]?.schemes[0]?.missingScopes, ['write']);

        const satisfied = evaluateOpenApiSecurity(
            [{ oidc: ['profile', 'email'] }],
            schemeRegistry,
            {
                oidc: { scopes: ['email', 'profile'] },
            },
        );

        assert.equal(satisfied.allowed, true);
        assert.equal(satisfied.requirements[0]?.schemes[0]?.code, 'satisfied');
    });

    it('normalizes deterministic ordering and de-duplicates scope entries', () => {
        const normalized = normalizeOpenApiSecurityRequirements(
            [{ oauth: ['write', 'read', 'read'], bearer: [] }],
            schemeRegistry,
        );

        assert.deepEqual(normalized, [{ bearer: [], oauth: ['read', 'write'] }]);
    });

    it('ignores scope lists for non-oauth security schemes', () => {
        const result = evaluateOpenApiSecurity(
            [{ apiKeyAuth: ['admin'] }],
            schemeRegistry,
            { apiKeyAuth: true },
            { mode: 'tolerant' },
        );

        assert.equal(result.allowed, true);
        assert.equal(result.requirements[0]?.schemes[0]?.satisfied, true);
        assert.equal(result.requirements[0]?.schemes[0]?.code, 'satisfied');
        assert.deepEqual(result.diagnostics, []);
    });

    it('requires scheme-appropriate credential shapes', () => {
        const apiKeyResult = evaluateOpenApiSecurity(
            [{ apiKeyAuth: [] }],
            schemeRegistry,
            { apiKeyAuth: {} },
        );
        assert.equal(apiKeyResult.allowed, false);
        assert.equal(apiKeyResult.requirements[0]?.schemes[0]?.code, 'missing-credential');

        const apiKeyScopeOnly = evaluateOpenApiSecurity(
            [{ apiKeyAuth: [] }],
            schemeRegistry,
            { apiKeyAuth: { scopes: ['admin'] } },
        );
        assert.equal(apiKeyScopeOnly.allowed, false);
        assert.equal(apiKeyScopeOnly.requirements[0]?.schemes[0]?.code, 'missing-credential');

        const httpResult = evaluateOpenApiSecurity(
            [{ bearer: [] }],
            schemeRegistry,
            { bearer: {} },
        );
        assert.equal(httpResult.allowed, false);
        assert.equal(httpResult.requirements[0]?.schemes[0]?.code, 'missing-credential');

        const httpScopeOnly = evaluateOpenApiSecurity(
            [{ bearer: [] }],
            schemeRegistry,
            { bearer: { scopes: ['read'] } },
        );
        assert.equal(httpScopeOnly.allowed, false);
        assert.equal(httpScopeOnly.requirements[0]?.schemes[0]?.code, 'missing-credential');

        const oauthScopeOnly = evaluateOpenApiSecurity(
            [{ oauth: ['read'] }],
            schemeRegistry,
            { oauth: { scopes: ['read'] } },
        );
        assert.equal(oauthScopeOnly.allowed, true);
        assert.equal(oauthScopeOnly.requirements[0]?.schemes[0]?.code, 'satisfied');
    });
});

describe('OpenAPI security helpers', () => {
    it('operation-level security overrides root-level security, including empty arrays', () => {
        const rootSecurity = [{ apiKeyAuth: [] }];

        const inherited = resolveEffectiveOpenApiSecurity(rootSecurity, undefined);
        assert.deepEqual(inherited, [{ apiKeyAuth: [] }]);

        const overriddenByEmpty = resolveEffectiveOpenApiSecurity(rootSecurity, []);
        assert.deepEqual(overriddenByEmpty, []);

        const overriddenByAnonymous = resolveEffectiveOpenApiSecurity(rootSecurity, [{}]);
        assert.deepEqual(overriddenByAnonymous, [{}]);
    });

    it('handles unknown schemes differently in tolerant and strict validation modes', () => {
        const requirements = [{ unknownAuth: [] }];

        assert.doesNotThrow(() => {
            validateOpenApiSecurityRequirements(requirements, {}, { mode: 'tolerant' });
        });

        assert.throws(() => {
            validateOpenApiSecurityRequirements(requirements, {}, { mode: 'strict' });
        }, /unknownAuth/);
    });

    it('allows role lists for non-oauth schemes in strict validation mode', () => {
        assert.doesNotThrow(() => {
            validateOpenApiSecurityRequirements(
                [{ apiKeyAuth: ['admin'] }],
                { apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
                { mode: 'strict' },
            );
        });
    });
});
