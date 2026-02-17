/**
 * Tests for OAuth client registration helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatOAuthClientRegistrationErrorResponse,
    formatOAuthClientRegistrationRequest,
    formatOAuthClientRegistrationResponse,
    mergeSoftwareStatementClientMetadata,
    parseOAuthClientRegistrationErrorResponse,
    parseOAuthClientRegistrationErrorResponseObject,
    parseOAuthClientRegistrationRequest,
    parseOAuthClientRegistrationRequestObject,
    parseOAuthClientRegistrationResponse,
    parseOAuthClientRegistrationResponseObject,
    validateOAuthClientRegistrationErrorResponse,
    validateOAuthClientRegistrationRequest,
    validateOAuthClientRegistrationResponse,
} from '../src/oauth-client-registration.js';
import {
    parseOAuthClientRegistrationRequest as parseOAuthClientRegistrationRequestFromIndex,
} from '../src/index.js';

describe('OAuth 2.0 Dynamic Client Registration Protocol (RFC 7591 Sections 2-3)', () => {
    it('re-exports RFC 7591 symbols from src/index.ts', () => {
        assert.equal(typeof parseOAuthClientRegistrationRequestFromIndex, 'function');
    });

    // RFC 7591 Section 3.1: registration request JSON structure and metadata members.
    describe('parseOAuthClientRegistrationRequest / parseOAuthClientRegistrationRequestObject', () => {
        const request = {
            redirect_uris: ['https://client.example.org/callback'],
            client_name: 'My Example Client',
            'client_name#ja-Jpan-JP': '\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u540D',
            token_endpoint_auth_method: 'client_secret_basic',
            logo_uri: 'https://client.example.org/logo.png',
            jwks_uri: 'https://client.example.org/my_public_keys.jwks',
            example_extension_parameter: 'example_value',
        };

        it('parses valid JSON request metadata and preserves extension members', () => {
            const parsed = parseOAuthClientRegistrationRequest(JSON.stringify(request));
            assert.notEqual(parsed, null);
            assert.equal(parsed?.client_name, 'My Example Client');
            assert.equal(parsed?.['client_name#ja-Jpan-JP'], '\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u540D');
            assert.equal(parsed?.example_extension_parameter, 'example_value');
        });

        it('parses valid request objects', () => {
            const parsed = parseOAuthClientRegistrationRequestObject(request);
            assert.notEqual(parsed, null);
            assert.deepEqual(parsed?.redirect_uris, ['https://client.example.org/callback']);
        });

        it('returns null for malformed JSON and invalid metadata shapes', () => {
            assert.equal(parseOAuthClientRegistrationRequest('{'), null);
            assert.equal(parseOAuthClientRegistrationRequest('[]'), null);
            assert.equal(parseOAuthClientRegistrationRequestObject('nope'), null);
            assert.equal(
                parseOAuthClientRegistrationRequestObject({
                    redirect_uris: ['https://client.example.org/callback', 1],
                }),
                null,
            );
        });

        it('returns null when jwks and jwks_uri are both present', () => {
            assert.equal(
                parseOAuthClientRegistrationRequestObject({
                    redirect_uris: ['https://client.example.org/callback'],
                    jwks_uri: 'https://client.example.org/jwks.json',
                    jwks: { keys: [] },
                }),
                null,
            );
        });
    });

    // RFC 7591 Section 2.1: grant_types and response_types consistency guidance.
    describe('validateOAuthClientRegistrationRequest', () => {
        it('enforces grant/response consistency by default', () => {
            assert.throws(() =>
                validateOAuthClientRegistrationRequest({
                    grant_types: ['implicit'],
                    response_types: ['code'],
                }),
            );
        });

        it('allows inconsistent grant/response values when configured', () => {
            assert.doesNotThrow(() =>
                validateOAuthClientRegistrationRequest(
                    {
                        grant_types: ['implicit'],
                        response_types: ['code'],
                    },
                    { enforceGrantTypeResponseTypeConsistency: false },
                ),
            );
        });

        // RFC 7591 Section 2: jwks must include a keys array when present.
        it('rejects jwks values without keys arrays', () => {
            assert.throws(() =>
                validateOAuthClientRegistrationRequest({
                    jwks: { not_keys: [] },
                }),
            );
        });
    });

    // RFC 7591 Section 3.2.1: client_id and secret issuance semantics.
    describe('validateOAuthClientRegistrationResponse', () => {
        it('validates required response fields and epoch timestamps', () => {
            assert.doesNotThrow(() =>
                validateOAuthClientRegistrationResponse({
                    client_id: 's6BhdRkqt3',
                    client_secret: 'secret',
                    client_secret_expires_at: 0,
                    client_id_issued_at: 2893256800,
                    redirect_uris: ['https://client.example.org/callback'],
                }),
            );
        });

        it('throws when client_secret lacks client_secret_expires_at', () => {
            assert.throws(() =>
                validateOAuthClientRegistrationResponse({
                    client_id: 's6BhdRkqt3',
                    client_secret: 'secret',
                    redirect_uris: ['https://client.example.org/callback'],
                }),
            );
        });
    });

    // RFC 7591 Section 3.2.1: successful response serialization.
    describe('formatOAuthClientRegistrationResponse', () => {
        it('formats valid response JSON', () => {
            const response = {
                client_id: 's6BhdRkqt3',
                client_secret: 'secret',
                client_secret_expires_at: 0,
                redirect_uris: ['https://client.example.org/callback'],
                grant_types: ['authorization_code'],
                response_types: ['code'],
            };

            const formatted = formatOAuthClientRegistrationResponse(response);
            const parsed = JSON.parse(formatted) as Record<string, unknown>;

            assert.equal(parsed.client_id, 's6BhdRkqt3');
            assert.deepEqual(parsed.redirect_uris, ['https://client.example.org/callback']);
        });
    });

    // RFC 7591 Section 3.2.2: error response shape and ASCII constraints.
    describe('OAuth client registration error responses', () => {
        it('parses and formats valid error responses', () => {
            const error = {
                error: 'invalid_client_metadata',
                error_description: 'Redirect URIs are invalid',
                extra: 'ignored',
            };

            const parsed = parseOAuthClientRegistrationErrorResponse(JSON.stringify(error));
            assert.notEqual(parsed, null);

            const formatted = formatOAuthClientRegistrationErrorResponse(error);
            const parsedFormatted = JSON.parse(formatted) as Record<string, unknown>;
            assert.equal(parsedFormatted.error, 'invalid_client_metadata');
            assert.equal(parsedFormatted.extra, 'ignored');
        });

        it('returns null or throws for invalid error shapes', () => {
            assert.equal(parseOAuthClientRegistrationErrorResponse('[]'), null);
            assert.equal(parseOAuthClientRegistrationErrorResponseObject({}), null);
            assert.throws(() =>
                validateOAuthClientRegistrationErrorResponse({
                    error: 'bad\u{1F4A5}',
                }),
            );
        });
    });

    // RFC 7591 Section 2.3: software statement values take precedence over JSON metadata.
    describe('mergeSoftwareStatementClientMetadata', () => {
        it('prefers software statement claims and ignores registered JWT claims', () => {
            const merged = mergeSoftwareStatementClientMetadata(
                {
                    client_name: 'Plain Client',
                    redirect_uris: ['https://client.example.org/callback'],
                },
                {
                    client_name: 'Statement Client',
                    iss: 'https://issuer.example.org',
                    client_uri: 'https://client.example.org',
                },
            );

            assert.equal(merged.client_name, 'Statement Client');
            assert.equal(merged.client_uri, 'https://client.example.org');
            assert.equal(Object.prototype.hasOwnProperty.call(merged, 'iss'), false);
        });
    });

    // RFC 7591 Section 3.1: request formatting preserves metadata and extensions.
    describe('formatOAuthClientRegistrationRequest', () => {
        it('formats request metadata JSON', () => {
            const formatted = formatOAuthClientRegistrationRequest({
                redirect_uris: ['https://client.example.org/callback'],
                client_name: 'Example Client',
                software_statement: 'header.payload.signature',
                example_extension_parameter: 'example_value',
            });

            const parsed = JSON.parse(formatted) as Record<string, unknown>;
            assert.equal(parsed.client_name, 'Example Client');
            assert.equal(parsed.software_statement, 'header.payload.signature');
            assert.equal(parsed.example_extension_parameter, 'example_value');
        });
    });

    // RFC 7591 Section 3.2.1: response parsing preserves server-provided metadata.
    describe('parseOAuthClientRegistrationResponse / parseOAuthClientRegistrationResponseObject', () => {
        const response = {
            client_id: 's6BhdRkqt3',
            client_secret: 'secret',
            client_secret_expires_at: 0,
            redirect_uris: ['https://client.example.org/callback'],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            example_extension_parameter: 'example_value',
        };

        it('parses valid response JSON and preserves extension members', () => {
            const parsed = parseOAuthClientRegistrationResponse(JSON.stringify(response));
            assert.notEqual(parsed, null);
            assert.equal(parsed?.client_id, 's6BhdRkqt3');
            assert.equal(parsed?.example_extension_parameter, 'example_value');
        });

        it('parses valid response objects', () => {
            const parsed = parseOAuthClientRegistrationResponseObject(response);
            assert.notEqual(parsed, null);
            assert.equal(parsed?.client_secret_expires_at, 0);
        });

        it('returns null for invalid response shapes', () => {
            assert.equal(parseOAuthClientRegistrationResponse('nope'), null);
            assert.equal(
                parseOAuthClientRegistrationResponseObject({
                    client_id: 's6BhdRkqt3',
                    client_secret: 'secret',
                }),
                null,
            );
        });
    });
});
