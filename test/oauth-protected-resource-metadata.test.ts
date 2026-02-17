/**
 * Tests for OAuth protected resource metadata behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    OAUTH_PROTECTED_RESOURCE_WELL_KNOWN_SUFFIX,
    buildProtectedResourceMetadataUrl,
    formatProtectedResourceMetadata,
    mergeSignedProtectedResourceMetadata,
    parseProtectedResourceMetadata,
    parseProtectedResourceMetadataObject,
    validateProtectedResourceMetadata,
} from '../src/oauth-protected-resource-metadata.js';
import {
    OAUTH_PROTECTED_RESOURCE_WELL_KNOWN_SUFFIX as OAUTH_PROTECTED_RESOURCE_WELL_KNOWN_SUFFIX_FROM_INDEX,
    parseProtectedResourceMetadata as parseProtectedResourceMetadataFromIndex,
} from '../src/index.js';

describe('OAuth 2.0 Protected Resource Metadata (RFC 9728 Sections 2, 2.1, 2.2, 3.1-3.3, 4, 5.1)', () => {
    // RFC 9728 Section 3: registered well-known suffix.
    it('exports the default registered well-known suffix', () => {
        assert.equal(
            OAUTH_PROTECTED_RESOURCE_WELL_KNOWN_SUFFIX,
            'oauth-protected-resource',
        );
    });

    it('re-exports RFC 9728 symbols from src/index.ts', () => {
        assert.equal(typeof parseProtectedResourceMetadataFromIndex, 'function');
        assert.equal(
            OAUTH_PROTECTED_RESOURCE_WELL_KNOWN_SUFFIX_FROM_INDEX,
            OAUTH_PROTECTED_RESOURCE_WELL_KNOWN_SUFFIX,
        );
    });

    // RFC 9728 Section 3.1: insertion algorithm for resource identifier path handling.
    describe('buildProtectedResourceMetadataUrl', () => {
        it('builds metadata URLs for resources with path and query components', () => {
            assert.equal(
                buildProtectedResourceMetadataUrl('https://example.com'),
                'https://example.com/.well-known/oauth-protected-resource',
            );

            assert.equal(
                buildProtectedResourceMetadataUrl('https://example.com/resource1'),
                'https://example.com/.well-known/oauth-protected-resource/resource1',
            );

            assert.equal(
                buildProtectedResourceMetadataUrl('https://example.com/resource1/'),
                'https://example.com/.well-known/oauth-protected-resource/resource1/',
            );

            assert.equal(
                buildProtectedResourceMetadataUrl('https://example.com/resource1?x=1'),
                'https://example.com/.well-known/oauth-protected-resource/resource1?x=1',
            );

            assert.equal(
                buildProtectedResourceMetadataUrl('https://example.com/?x=1'),
                'https://example.com/.well-known/oauth-protected-resource?x=1',
            );
        });

        it('throws for invalid resource identifiers or suffix values', () => {
            assert.throws(() => buildProtectedResourceMetadataUrl('http://example.com'));
            assert.throws(() => buildProtectedResourceMetadataUrl('https://example.com#frag'));
            assert.throws(() => buildProtectedResourceMetadataUrl('https://example.com', 'bad/suffix'));
        });
    });

    // RFC 9728 Section 2 and Section 3.2: structural parsing and required metadata.
    describe('parseProtectedResourceMetadata / parseProtectedResourceMetadataObject', () => {
        const validMetadata = {
            resource: 'https://resource.example.com',
            authorization_servers: ['https://as.example.com'],
            jwks_uri: 'https://resource.example.com/jwks.json',
            scopes_supported: ['profile', 'email'],
            bearer_methods_supported: ['header'],
            resource_signing_alg_values_supported: ['RS256'],
            resource_name: 'Example Resource',
            resource_documentation: 'https://resource.example.com/docs',
            resource_policy_uri: 'https://resource.example.com/policy',
            resource_tos_uri: 'https://resource.example.com/tos',
            tls_client_certificate_bound_access_tokens: true,
            authorization_details_types_supported: ['example'],
            dpop_signing_alg_values_supported: ['ES256'],
            dpop_bound_access_tokens_required: true,
            signed_metadata: 'header.payload.signature',
            'resource_name#en': 'Example Resource',
            extension_claim: {
                nested: true,
            },
        };

        it('parses valid JSON metadata and preserves extension members', () => {
            const parsed = parseProtectedResourceMetadata(JSON.stringify(validMetadata));
            assert.notEqual(parsed, null);
            assert.equal(parsed?.resource, 'https://resource.example.com');
            assert.deepEqual(parsed?.authorization_servers, ['https://as.example.com']);
            assert.deepEqual(parsed?.extension_claim, { nested: true });
        });

        it('parses valid metadata objects', () => {
            const parsed = parseProtectedResourceMetadataObject(validMetadata);
            assert.notEqual(parsed, null);
            assert.equal(parsed?.resource_tos_uri, 'https://resource.example.com/tos');
        });

        // RFC 9728 Section 3.3: expected resource comparison is exact.
        it('supports exact expected resource string comparison', () => {
            const parsed = parseProtectedResourceMetadataObject(validMetadata, {
                expectedResource: 'https://resource.example.com',
            });
            assert.notEqual(parsed, null);

            const mismatch = parseProtectedResourceMetadataObject(validMetadata, {
                expectedResource: 'https://resource.example.com/',
            });
            assert.equal(mismatch, null);
        });

        it('returns null for malformed JSON and invalid structural values', () => {
            assert.equal(parseProtectedResourceMetadata('{'), null);
            assert.equal(parseProtectedResourceMetadata('[]'), null);
            assert.equal(parseProtectedResourceMetadataObject('nope'), null);
            assert.equal(
                parseProtectedResourceMetadataObject({
                    resource: 'https://resource.example.com',
                    bearer_methods_supported: ['header', 1],
                }),
                null,
            );
            assert.equal(
                parseProtectedResourceMetadataObject({
                    resource: 'https://resource.example.com',
                    tls_client_certificate_bound_access_tokens: 'true',
                }),
                null,
            );
        });
    });

    describe('validateProtectedResourceMetadata', () => {
        it('accepts valid metadata', () => {
            assert.doesNotThrow(() =>
                validateProtectedResourceMetadata({
                    resource: 'https://resource.example.com',
                    authorization_servers: ['https://as.example.com'],
                    jwks_uri: 'https://resource.example.com/jwks.json',
                    bearer_methods_supported: [],
                    resource_signing_alg_values_supported: ['RS256'],
                }),
            );
        });

        it('rejects invalid resource identifiers and issuer lists', () => {
            assert.throws(() =>
                validateProtectedResourceMetadata({
                    resource: 'http://resource.example.com',
                }),
            );

            assert.throws(() =>
                validateProtectedResourceMetadata({
                    resource: 'https://resource.example.com#frag',
                }),
            );

            assert.throws(() =>
                validateProtectedResourceMetadata({
                    resource: 'https://resource.example.com',
                    authorization_servers: ['https://as.example.com?x=1'],
                }),
            );
        });

        it('rejects invalid arrays and invalid bearer methods', () => {
            assert.throws(() =>
                validateProtectedResourceMetadata({
                    resource: 'https://resource.example.com',
                    scopes_supported: [],
                }),
            );

            assert.throws(() =>
                validateProtectedResourceMetadata({
                    resource: 'https://resource.example.com',
                    bearer_methods_supported: ['header', 'invalid'],
                }),
            );
        });

        it('rejects forbidden signing algorithms and invalid URLs', () => {
            assert.throws(() =>
                validateProtectedResourceMetadata({
                    resource: 'https://resource.example.com',
                    resource_signing_alg_values_supported: ['none'],
                }),
            );

            assert.throws(() =>
                validateProtectedResourceMetadata({
                    resource: 'https://resource.example.com',
                    jwks_uri: 'http://resource.example.com/jwks.json',
                }),
            );
        });
    });

    describe('formatProtectedResourceMetadata', () => {
        it('formats metadata as JSON with extension members', () => {
            const formatted = formatProtectedResourceMetadata({
                resource: 'https://resource.example.com',
                authorization_servers: ['https://as.example.com'],
                resource_name: 'Example Resource',
                extension_claim: { nested: true },
            });

            const parsed = JSON.parse(formatted);
            assert.equal(parsed.resource, 'https://resource.example.com');
            assert.deepEqual(parsed.extension_claim, { nested: true });
        });
    });

    // RFC 9728 Section 2.2: signed metadata values take precedence over plain JSON values.
    describe('mergeSignedProtectedResourceMetadata', () => {
        it('merges signed claim values with precedence and validates the result', () => {
            const plain = {
                resource: 'https://resource.example.com',
                bearer_methods_supported: ['header'],
                signed_metadata: 'header.payload.signature',
            };

            const merged = mergeSignedProtectedResourceMetadata(plain, {
                bearer_methods_supported: ['body'],
                scopes_supported: ['profile'],
                signed_metadata: 'ignore.this.value',
                iss: 'https://attester.example.com',
            });

            assert.deepEqual(merged.bearer_methods_supported, ['body']);
            assert.deepEqual(merged.scopes_supported, ['profile']);
            assert.equal(merged.signed_metadata, 'header.payload.signature');
            assert.equal(Object.prototype.hasOwnProperty.call(merged, 'iss'), false);
        });

        it('throws when provided signed claims are invalid', () => {
            assert.throws(() =>
                mergeSignedProtectedResourceMetadata(
                    {
                        resource: 'https://resource.example.com',
                        bearer_methods_supported: ['header'],
                    },
                    {
                        jwks_uri: 'not-absolute',
                    },
                ),
            );

            assert.throws(() =>
                mergeSignedProtectedResourceMetadata(
                    {
                        resource: 'https://resource.example.com',
                    },
                    [],
                ),
            );
        });
    });
});
