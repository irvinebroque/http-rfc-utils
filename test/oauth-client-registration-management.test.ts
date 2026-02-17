/**
 * Tests for OAuth client registration management helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OAuthClientConfigurationUpdateRequest } from '../src/types.js';
import {
    formatOAuthClientConfigurationResponse,
    formatOAuthClientConfigurationUpdateRequest,
    parseOAuthClientConfigurationResponse,
    parseOAuthClientConfigurationResponseObject,
    parseOAuthClientConfigurationUpdateRequest,
    parseOAuthClientConfigurationUpdateRequestObject,
    validateOAuthClientConfigurationResponse,
    validateOAuthClientConfigurationUpdateRequest,
} from '../src/oauth-client-registration-management.js';
import {
    parseOAuthClientConfigurationResponse as parseOAuthClientConfigurationResponseFromIndex,
} from '../src/index.js';

describe('OAuth 2.0 Dynamic Client Registration Management Protocol (RFC 7592 Sections 2-3)', () => {
    it('re-exports RFC 7592 symbols from src/index.ts', () => {
        assert.equal(typeof parseOAuthClientConfigurationResponseFromIndex, 'function');
    });

    // RFC 7592 Section 3: client information response includes registration access token and client URI.
    describe('parseOAuthClientConfigurationResponse / parseOAuthClientConfigurationResponseObject', () => {
        const response = {
            registration_access_token: 'reg-23410913-abewfq.123483',
            registration_client_uri: 'https://server.example.com/register/s6BhdRkqt3',
            client_id: 's6BhdRkqt3',
            client_secret: 'secret',
            client_id_issued_at: 2893256800,
            client_secret_expires_at: 2893276800,
            redirect_uris: ['https://client.example.org/callback'],
        };

        it('parses valid response JSON and preserves registration fields', () => {
            const parsed = parseOAuthClientConfigurationResponse(JSON.stringify(response));
            assert.notEqual(parsed, null);
            assert.equal(parsed?.registration_access_token, response.registration_access_token);
            assert.equal(parsed?.registration_client_uri, response.registration_client_uri);
        });

        it('parses valid response objects', () => {
            const parsed = parseOAuthClientConfigurationResponseObject(response);
            assert.notEqual(parsed, null);
            assert.equal(parsed?.client_id, 's6BhdRkqt3');
        });

        it('returns null for invalid response shapes', () => {
            assert.equal(parseOAuthClientConfigurationResponse('nope'), null);
            assert.equal(
                parseOAuthClientConfigurationResponseObject({
                    client_id: 's6BhdRkqt3',
                    registration_access_token: '',
                    registration_client_uri: 'https://server.example.com/register/s6BhdRkqt3',
                }),
                null,
            );
        });
    });

    // RFC 7592 Section 3: registration_access_token and registration_client_uri are required.
    describe('validateOAuthClientConfigurationResponse', () => {
        it('throws when required registration fields are missing', () => {
            assert.throws(() =>
                validateOAuthClientConfigurationResponse({
                    client_id: 's6BhdRkqt3',
                    registration_access_token: '',
                    registration_client_uri: 'https://server.example.com/register/s6BhdRkqt3',
                }),
            );
        });

        it('throws when registration_client_uri is not an absolute URL', () => {
            assert.throws(() =>
                validateOAuthClientConfigurationResponse({
                    client_id: 's6BhdRkqt3',
                    registration_access_token: 'reg-123',
                    registration_client_uri: '/register/s6BhdRkqt3',
                }),
            );
        });
    });

    // RFC 7592 Section 2.2: update request MUST include client_id and exclude registration access token/client URI.
    describe('OAuth client configuration update requests', () => {
        const updateRequest = {
            client_id: 's6BhdRkqt3',
            client_secret: 'secret',
            redirect_uris: ['https://client.example.org/callback'],
            grant_types: ['authorization_code'],
        };

        it('parses valid update request JSON', () => {
            const parsed = parseOAuthClientConfigurationUpdateRequest(JSON.stringify(updateRequest));
            assert.notEqual(parsed, null);
            assert.equal(parsed?.client_id, 's6BhdRkqt3');
        });

        it('parses valid update request objects', () => {
            const parsed = parseOAuthClientConfigurationUpdateRequestObject(updateRequest);
            assert.notEqual(parsed, null);
            assert.equal(parsed?.client_secret, 'secret');
        });

        it('rejects forbidden registration-management fields in update requests', () => {
            assert.equal(
                parseOAuthClientConfigurationUpdateRequestObject({
                    client_id: 's6BhdRkqt3',
                    registration_access_token: 'reg-123',
                }),
                null,
            );
            assert.throws(() =>
                validateOAuthClientConfigurationUpdateRequest({
                    client_id: 's6BhdRkqt3',
                    client_secret_expires_at: 10,
                } as OAuthClientConfigurationUpdateRequest),
            );
        });

        it('formats update requests with required client_id', () => {
            const formatted = formatOAuthClientConfigurationUpdateRequest(updateRequest);
            const parsed = JSON.parse(formatted) as Record<string, unknown>;
            assert.equal(parsed.client_id, 's6BhdRkqt3');
        });
    });

    // RFC 7592 Section 3: response formatting preserves management fields.
    describe('formatOAuthClientConfigurationResponse', () => {
        it('formats response JSON with registration fields', () => {
            const formatted = formatOAuthClientConfigurationResponse({
                registration_access_token: 'reg-23410913-abewfq.123483',
                registration_client_uri: 'https://server.example.com/register/s6BhdRkqt3',
                client_id: 's6BhdRkqt3',
                redirect_uris: ['https://client.example.org/callback'],
            });

            const parsed = JSON.parse(formatted) as Record<string, unknown>;
            assert.equal(parsed.registration_access_token, 'reg-23410913-abewfq.123483');
            assert.equal(parsed.registration_client_uri, 'https://server.example.com/register/s6BhdRkqt3');
        });
    });
});
