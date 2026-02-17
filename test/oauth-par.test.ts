/**
 * Tests for OAuth 2.0 Pushed Authorization Requests (PAR).
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatPushedAuthorizationErrorResponse,
    formatPushedAuthorizationRequest,
    formatPushedAuthorizationResponse,
    parsePushedAuthorizationErrorResponse,
    parsePushedAuthorizationRequest,
    parsePushedAuthorizationResponse,
    validatePushedAuthorizationErrorResponse,
    validatePushedAuthorizationRequest,
    validatePushedAuthorizationResponse,
} from '../src/oauth-par.js';
import {
    parsePushedAuthorizationRequest as parsePushedAuthorizationRequestFromIndex,
} from '../src/index.js';

describe('OAuth 2.0 Pushed Authorization Requests (RFC 9126 Sections 2.1-2.3)', () => {
    // RFC 9126 Section 2.1: request_uri MUST NOT be provided.
    it('parses pushed authorization requests and rejects request_uri', () => {
        const params = 'response_type=code&client_id=client123&redirect_uri=https%3A%2F%2Fclient.example.org%2Fcb';
        const parsed = parsePushedAuthorizationRequest(params);
        assert.notEqual(parsed, null);
        assert.equal(parsed?.params.client_id, 'client123');

        const withRequestUri = parsePushedAuthorizationRequest(`${params}&request_uri=urn:example:bad`);
        assert.equal(withRequestUri, null);
    });

    it('returns null for duplicate parameters or missing client_id', () => {
        assert.equal(
            parsePushedAuthorizationRequest('client_id=one&client_id=two'),
            null,
        );

        assert.equal(
            parsePushedAuthorizationRequest('response_type=code&redirect_uri=https%3A%2F%2Fclient.example.org%2Fcb'),
            null,
        );
    });

    it('supports optional client_id enforcement', () => {
        const parsed = parsePushedAuthorizationRequest(
            'response_type=code',
            { requireClientId: false },
        );

        assert.notEqual(parsed, null);
        assert.equal(parsed?.params.response_type, 'code');
    });

    it('formats pushed authorization requests deterministically', () => {
        const formatted = formatPushedAuthorizationRequest({
            params: {
                redirect_uri: 'https://client.example.org/cb',
                client_id: 'client123',
                response_type: 'code',
            },
        });

        assert.equal(
            formatted,
            'client_id=client123&redirect_uri=https%3A%2F%2Fclient.example.org%2Fcb&response_type=code',
        );
    });

    // RFC 9126 Section 2.2: request_uri + expires_in success response.
    it('parses and formats successful response payloads', () => {
        const payload = {
            request_uri: 'urn:example:bwc4JK-ESC0w8acc191e-Y1LTC2',
            expires_in: 90,
        };
        const parsed = parsePushedAuthorizationResponse(JSON.stringify(payload));
        assert.deepEqual(parsed, {
            requestUri: 'urn:example:bwc4JK-ESC0w8acc191e-Y1LTC2',
            expiresIn: 90,
        });

        const formatted = formatPushedAuthorizationResponse({
            requestUri: 'urn:example:bwc4JK-ESC0w8acc191e-Y1LTC2',
            expiresIn: 90,
        });
        assert.equal(formatted, JSON.stringify(payload, null, 2));
    });

    it('rejects invalid successful response payloads', () => {
        assert.equal(parsePushedAuthorizationResponse('{"request_uri":"urn:test","expires_in":0}'), null);
        assert.throws(() =>
            validatePushedAuthorizationResponse({
                requestUri: 'urn:test',
                expiresIn: 0,
            }),
        );
    });

    // RFC 9126 Section 2.3: OAuth error response format (RFC 6749 Section 5.2).
    it('parses and formats error response payloads', () => {
        const payload = {
            error: 'invalid_request',
            error_description: 'Missing redirect_uri',
        };

        const parsed = parsePushedAuthorizationErrorResponse(JSON.stringify(payload));
        assert.deepEqual(parsed, {
            error: 'invalid_request',
            errorDescription: 'Missing redirect_uri',
            errorUri: undefined,
        });

        const formatted = formatPushedAuthorizationErrorResponse({
            error: 'invalid_request',
            errorDescription: 'Missing redirect_uri',
        });
        assert.equal(formatted, JSON.stringify(payload, null, 2));
    });

    it('validates error response payloads', () => {
        assert.throws(() => validatePushedAuthorizationErrorResponse({ error: '' }));
        assert.throws(() =>
            validatePushedAuthorizationErrorResponse({
                error: 'invalid_request',
                errorDescription: '',
            }),
        );
    });

    it('re-exports PAR helpers from src/index.ts', () => {
        assert.equal(typeof parsePushedAuthorizationRequestFromIndex, 'function');
    });
});
