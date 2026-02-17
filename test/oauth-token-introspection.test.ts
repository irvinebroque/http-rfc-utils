/**
 * Tests for OAuth 2.0 token introspection helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatTokenIntrospectionRequestParams,
    formatTokenIntrospectionResponse,
    parseTokenIntrospectionRequestParams,
    parseTokenIntrospectionResponse,
    parseTokenIntrospectionResponseObject,
    validateTokenIntrospectionRequestParams,
    validateTokenIntrospectionResponse,
} from '../src/auth/oauth-token-introspection.js';
import {
    parseTokenIntrospectionResponse as parseTokenIntrospectionResponseFromIndex,
    parseTokenIntrospectionRequestParams as parseTokenIntrospectionRequestParamsFromIndex,
} from '../src/index.js';

describe('OAuth 2.0 Token Introspection (RFC 7662 Sections 2.1-2.2)', () => {
    it('re-exports RFC 7662 helpers from src/index.ts', () => {
        assert.equal(typeof parseTokenIntrospectionResponseFromIndex, 'function');
        assert.equal(typeof parseTokenIntrospectionRequestParamsFromIndex, 'function');
    });

    // RFC 7662 Section 2.1: token parameter is required and token_type_hint is optional.
    describe('parseTokenIntrospectionRequestParams', () => {
        it('parses request parameters with optional hints and extensions', () => {
            const parsed = parseTokenIntrospectionRequestParams(
                'token=abc123&token_type_hint=access_token&resource=https%3A%2F%2Fapi.example.com',
            );

            assert.notEqual(parsed, null);
            assert.equal(parsed?.token, 'abc123');
            assert.equal(parsed?.token_type_hint, 'access_token');
            assert.deepEqual(parsed?.extensions, {
                resource: 'https://api.example.com',
            });
        });

        it('returns null for missing token or duplicated parameters', () => {
            assert.equal(parseTokenIntrospectionRequestParams('token_type_hint=access_token'), null);
            assert.equal(parseTokenIntrospectionRequestParams('token='), null);
            assert.equal(parseTokenIntrospectionRequestParams('token=one&token=two'), null);
            assert.equal(parseTokenIntrospectionRequestParams('token=one&token_type_hint=a&token_type_hint=b'), null);
        });

        it('returns null for duplicate extension parameters', () => {
            assert.equal(parseTokenIntrospectionRequestParams('token=abc&resource=a&resource=b'), null);
        });
    });

    // RFC 7662 Section 2.1: format and validate required request parameters.
    describe('formatTokenIntrospectionRequestParams / validateTokenIntrospectionRequestParams', () => {
        it('formats request parameters deterministically with sorted extensions', () => {
            const formatted = formatTokenIntrospectionRequestParams({
                token: 'abc123',
                token_type_hint: 'access_token',
                extensions: {
                    resource: 'https://api.example.com',
                    aud: 'api',
                },
            });

            assert.equal(
                formatted,
                'token=abc123&token_type_hint=access_token&aud=api&resource=https%3A%2F%2Fapi.example.com',
            );
        });

        it('throws for invalid request parameters', () => {
            assert.throws(() =>
                validateTokenIntrospectionRequestParams({
                    token: '',
                }),
            );
            assert.throws(() =>
                validateTokenIntrospectionRequestParams({
                    token: 'ok',
                    token_type_hint: '',
                }),
            );
            assert.throws(() =>
                validateTokenIntrospectionRequestParams({
                    token: 'ok',
                    extensions: {
                        token: 'nope',
                    },
                }),
            );
        });
    });

    // RFC 7662 Section 2.2: active is required, metadata fields are typed.
    describe('parseTokenIntrospectionResponse / parseTokenIntrospectionResponseObject', () => {
        const sampleResponse = {
            active: true,
            client_id: 'client-123',
            username: 'jdoe',
            scope: 'read write',
            sub: 'sub-123',
            aud: ['https://api.example.com'],
            iss: 'https://issuer.example.com',
            exp: 1419356238,
            iat: 1419350238,
            extension_field: 'extra',
        };

        it('parses valid JSON introspection responses and preserves extensions', () => {
            const parsed = parseTokenIntrospectionResponse(JSON.stringify(sampleResponse));
            assert.notEqual(parsed, null);
            assert.equal(parsed?.active, true);
            assert.equal(parsed?.client_id, 'client-123');
            assert.deepEqual(parsed?.aud, ['https://api.example.com']);
            assert.equal(parsed?.extension_field, 'extra');
        });

        it('parses valid response objects', () => {
            const parsed = parseTokenIntrospectionResponseObject(sampleResponse);
            assert.notEqual(parsed, null);
            assert.equal(parsed?.scope, 'read write');
        });

        it('returns null for malformed JSON and invalid response shapes', () => {
            assert.equal(parseTokenIntrospectionResponse('{'), null);
            assert.equal(parseTokenIntrospectionResponse('[]'), null);
            assert.equal(parseTokenIntrospectionResponseObject({ active: 'true' }), null);
            assert.equal(parseTokenIntrospectionResponseObject({ active: true, exp: 'nope' }), null);
            assert.equal(parseTokenIntrospectionResponseObject({ active: true, aud: [1] }), null);
        });
    });

    // RFC 7662 Section 2.2: format and validate response payloads.
    describe('formatTokenIntrospectionResponse / validateTokenIntrospectionResponse', () => {
        it('formats valid responses with extension fields preserved', () => {
            const formatted = formatTokenIntrospectionResponse({
                active: false,
                extension_flag: true,
            });

            assert.deepEqual(JSON.parse(formatted), {
                active: false,
                extension_flag: true,
            });
        });

        it('throws for invalid response values', () => {
            assert.throws(() =>
                validateTokenIntrospectionResponse({
                    active: 'false' as unknown as boolean,
                }),
            );
            assert.throws(() =>
                validateTokenIntrospectionResponse({
                    active: true,
                    nbf: -1,
                }),
            );
        });
    });
});
