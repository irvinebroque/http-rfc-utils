/**
 * Tests for oauth authorization server metadata behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX,
    buildAuthorizationServerMetadataUrl,
    formatAuthorizationServerMetadata,
    mergeSignedAuthorizationServerMetadata,
    parseAuthorizationServerMetadata,
    parseAuthorizationServerMetadataObject,
    validateAuthorizationServerMetadata,
} from '../src/oauth-authorization-server-metadata.js';
import {
    OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX as OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX_FROM_INDEX,
    parseAuthorizationServerMetadata as parseAuthorizationServerMetadataFromIndex,
} from '../src/index.js';

describe('OAuth 2.0 Authorization Server Metadata (RFC 8414 Sections 2, 3.1-3.3, 4, 7.3.1)', () => {
    // RFC 8414 Section 7.3.1: registered well-known suffix.
    it('exports the default registered well-known suffix', () => {
        assert.equal(
            OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX,
            'oauth-authorization-server',
        );
    });

    it('re-exports RFC 8414 symbols from src/index.ts', () => {
        assert.equal(typeof parseAuthorizationServerMetadataFromIndex, 'function');
        assert.equal(
            OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX_FROM_INDEX,
            OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX,
        );
    });

    // RFC 8414 Section 3.1: insertion algorithm for issuer path handling.
    describe('buildAuthorizationServerMetadataUrl', () => {
        it('builds metadata URLs for issuers with and without path components', () => {
            assert.equal(
                buildAuthorizationServerMetadataUrl('https://example.com'),
                'https://example.com/.well-known/oauth-authorization-server',
            );

            assert.equal(
                buildAuthorizationServerMetadataUrl('https://example.com/issuer1'),
                'https://example.com/.well-known/oauth-authorization-server/issuer1',
            );

            assert.equal(
                buildAuthorizationServerMetadataUrl('https://example.com/issuer1/'),
                'https://example.com/.well-known/oauth-authorization-server/issuer1',
            );
        });

        it('throws for invalid issuer/suffix values', () => {
            assert.throws(() => buildAuthorizationServerMetadataUrl('http://example.com'));
            assert.throws(() => buildAuthorizationServerMetadataUrl('https://example.com?x=1'));
            assert.throws(() => buildAuthorizationServerMetadataUrl('https://example.com', 'bad/suffix'));
        });
    });

    // RFC 8414 Section 2 and Section 3.2: structural parsing and required metadata.
    describe('parseAuthorizationServerMetadata / parseAuthorizationServerMetadataObject', () => {
        const validMetadata = {
            issuer: 'https://server.example.com',
            authorization_endpoint: 'https://server.example.com/authorize',
            token_endpoint: 'https://server.example.com/token',
            response_types_supported: ['code', 'code token'],
            scopes_supported: ['openid', 'profile'],
            extension_claim: {
                nested: true,
            },
        };

        it('parses valid JSON metadata and preserves extension members', () => {
            const parsed = parseAuthorizationServerMetadata(JSON.stringify(validMetadata));
            assert.notEqual(parsed, null);
            assert.equal(parsed?.issuer, 'https://server.example.com');
            assert.deepEqual(parsed?.response_types_supported, ['code', 'code token']);
            assert.deepEqual(parsed?.extension_claim, { nested: true });
        });

        it('parses valid metadata objects', () => {
            const parsed = parseAuthorizationServerMetadataObject(validMetadata);
            assert.notEqual(parsed, null);
            assert.equal(parsed?.token_endpoint, 'https://server.example.com/token');
        });

        // RFC 8414 Section 3.3 and Section 4: expected issuer comparison is exact.
        it('supports exact expected issuer string comparison', () => {
            const parsed = parseAuthorizationServerMetadataObject(validMetadata, {
                expectedIssuer: 'https://server.example.com',
            });
            assert.notEqual(parsed, null);

            const mismatch = parseAuthorizationServerMetadataObject(validMetadata, {
                expectedIssuer: 'https://server.example.com/',
            });
            assert.equal(mismatch, null);
        });

        it('returns null for malformed JSON and invalid structural values', () => {
            assert.equal(parseAuthorizationServerMetadata('{'), null);
            assert.equal(parseAuthorizationServerMetadata('[]'), null);
            assert.equal(parseAuthorizationServerMetadataObject('nope'), null);
            assert.equal(
                parseAuthorizationServerMetadataObject({
                    issuer: 'https://server.example.com',
                    authorization_endpoint: 'https://server.example.com/authorize',
                    token_endpoint: 'https://server.example.com/token',
                    response_types_supported: ['code', 1],
                }),
                null,
            );
            assert.equal(
                parseAuthorizationServerMetadataObject({
                    issuer: 'https://server.example.com',
                    response_types_supported: ['code'],
                    extension: undefined,
                }),
                null,
            );
        });
    });

    // RFC 8414 Section 2: required fields and endpoint/issuer constraints.
    describe('validateAuthorizationServerMetadata', () => {
        it('validates a minimal metadata object when grant type permits omitted token endpoint', () => {
            const metadata = {
                issuer: 'https://as.example.com',
                authorization_endpoint: 'https://as.example.com/authorize',
                response_types_supported: ['token'],
                grant_types_supported: ['implicit'],
            };

            assert.doesNotThrow(() => validateAuthorizationServerMetadata(metadata));
        });

        // Regression: duplicate entries should not alter grant-type semantics.
        it('treats duplicate implicit grant types as implicit-only for token endpoint requirements', () => {
            assert.doesNotThrow(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    response_types_supported: ['token'],
                    grant_types_supported: ['implicit', 'implicit'],
                }),
            );

            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    response_types_supported: ['code'],
                    grant_types_supported: ['implicit', 'implicit', 'authorization_code'],
                }),
            );
        });

        it('enforces required response types and endpoint requirements', () => {
            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: [],
                }),
            );

            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: ['code'],
                    grant_types_supported: ['authorization_code'],
                }),
            );

            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    response_types_supported: ['code'],
                    grant_types_supported: ['authorization_code'],
                }),
            );
        });

        it('enforces issuer and endpoint URL constraints', () => {
            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'http://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: ['code'],
                }),
            );

            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com?bad=1',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: ['code'],
                }),
            );

            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: '/authorize',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: ['code'],
                }),
            );

            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: ['code'],
                    jwks_uri: 'http://as.example.com/jwks.json',
                }),
            );
        });

        // RFC 8414 Section 2: JWT auth methods require corresponding signing alg metadata.
        it('enforces JWT auth method algorithm requirements and disallows "none"', () => {
            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: ['code'],
                    token_endpoint_auth_methods_supported: ['private_key_jwt'],
                }),
            );

            assert.throws(() =>
                validateAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: ['code'],
                    token_endpoint_auth_methods_supported: ['private_key_jwt'],
                    token_endpoint_auth_signing_alg_values_supported: ['none'],
                }),
            );
        });

        // RFC 8414 Section 3.3 and Section 4: issuer equality uses exact string comparison.
        it('enforces exact expected issuer equality in validation', () => {
            const metadata = {
                issuer: 'https://as.example.com',
                authorization_endpoint: 'https://as.example.com/authorize',
                token_endpoint: 'https://as.example.com/token',
                response_types_supported: ['code'],
            };

            assert.doesNotThrow(() =>
                validateAuthorizationServerMetadata(metadata, {
                    expectedIssuer: 'https://as.example.com',
                }),
            );

            assert.throws(() =>
                validateAuthorizationServerMetadata(metadata, {
                    expectedIssuer: 'https://as.example.com/',
                }),
            );
        });
    });

    // RFC 8414 Section 3.2: JSON object response serialization and member constraints.
    describe('formatAuthorizationServerMetadata', () => {
        it('formats valid metadata JSON', () => {
            const metadata = {
                issuer: 'https://as.example.com',
                authorization_endpoint: 'https://as.example.com/authorize',
                token_endpoint: 'https://as.example.com/token',
                response_types_supported: ['code'],
                extension_claim: 'retained',
            };

            const formatted = formatAuthorizationServerMetadata(metadata);
            const parsed = JSON.parse(formatted) as Record<string, unknown>;

            assert.equal(parsed.issuer, 'https://as.example.com');
            assert.equal(parsed.extension_claim, 'retained');
            assert.deepEqual(parsed.response_types_supported, ['code']);
        });

        it('throws when semantic validation fails during formatting', () => {
            assert.throws(() =>
                formatAuthorizationServerMetadata({
                    issuer: 'https://as.example.com',
                    authorization_endpoint: 'https://as.example.com/authorize',
                    token_endpoint: 'https://as.example.com/token',
                    response_types_supported: [],
                }),
            );
        });
    });

    // RFC 8414 Section 2.1: signed metadata values take precedence over plain JSON values.
    describe('mergeSignedAuthorizationServerMetadata', () => {
        it('merges signed claim values with precedence and validates the result', () => {
            const plain = {
                issuer: 'https://as.example.com',
                authorization_endpoint: 'https://as.example.com/authorize',
                token_endpoint: 'https://as.example.com/token',
                response_types_supported: ['code'],
                signed_metadata: 'header.payload.signature',
            };

            const merged = mergeSignedAuthorizationServerMetadata(plain, {
                token_endpoint: 'https://signed.example.com/token',
                scopes_supported: ['openid'],
                signed_metadata: 'ignore.this.value',
                iss: 'https://attester.example.com',
            });

            assert.equal(merged.token_endpoint, 'https://signed.example.com/token');
            assert.deepEqual(merged.scopes_supported, ['openid']);
            assert.equal(merged.signed_metadata, 'header.payload.signature');
            assert.equal(Object.prototype.hasOwnProperty.call(merged, 'iss'), false);
        });

        it('throws when provided signed claims are invalid', () => {
            assert.throws(() =>
                mergeSignedAuthorizationServerMetadata(
                    {
                        issuer: 'https://as.example.com',
                        authorization_endpoint: 'https://as.example.com/authorize',
                        token_endpoint: 'https://as.example.com/token',
                        response_types_supported: ['code'],
                    },
                    {
                        token_endpoint: '/not-absolute',
                    },
                ),
            );

            assert.throws(() =>
                mergeSignedAuthorizationServerMetadata(
                    {
                        issuer: 'https://as.example.com',
                        authorization_endpoint: 'https://as.example.com/authorize',
                        token_endpoint: 'https://as.example.com/token',
                        response_types_supported: ['code'],
                    },
                    [],
                ),
            );
        });
    });
});
