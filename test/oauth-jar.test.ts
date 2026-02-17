/**
 * Tests for OAuth JAR authorization request parameters.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatJarAuthorizationRequestParams,
    parseJarAuthorizationRequestParams,
    validateJarAuthorizationRequestParams,
} from '../src/auth/jar.js';
import { parseJarAuthorizationRequestParams as parseJarAuthorizationRequestParamsFromIndex } from '../src/index.js';

const SAMPLE_JWS = 'eyJhbGciOiJSUzI1NiJ9.eyJjbGllbnRfaWQiOiJzNkJoZFJrcXQzIn0.sig';

describe('OAuth JAR (RFC 9101 Sections 4, 5, 5.2)', () => {
    it('re-exports JAR helpers from src/index.ts', () => {
        assert.equal(typeof parseJarAuthorizationRequestParamsFromIndex, 'function');
    });

    // RFC 9101 Section 5: request and request_uri are mutually exclusive and require client_id.
    it('parses a request parameter authorization request', () => {
        const parsed = parseJarAuthorizationRequestParams(
            `client_id=s6BhdRkqt3&request=${SAMPLE_JWS}`,
        );
        assert.deepEqual(parsed, {
            clientId: 's6BhdRkqt3',
            request: SAMPLE_JWS,
        });
    });

    it('parses a request_uri authorization request', () => {
        const parsed = parseJarAuthorizationRequestParams({
            client_id: 's6BhdRkqt3',
            request_uri: 'https://tfp.example.org/request.jwt/GkurKxf5',
        });
        assert.deepEqual(parsed, {
            clientId: 's6BhdRkqt3',
            requestUri: 'https://tfp.example.org/request.jwt/GkurKxf5',
        });
    });

    it('returns null for invalid request/request_uri combinations', () => {
        assert.equal(
            parseJarAuthorizationRequestParams(`client_id=s6BhdRkqt3&request=${SAMPLE_JWS}&request_uri=https://a`),
            null,
        );
        assert.equal(parseJarAuthorizationRequestParams('client_id=s6BhdRkqt3'), null);
        assert.equal(parseJarAuthorizationRequestParams('request=abc.def.ghi'), null);
        assert.equal(parseJarAuthorizationRequestParams('client_id=s6BhdRkqt3&request=abc.def'), null);
        assert.equal(parseJarAuthorizationRequestParams('client_id=s6BhdRkqt3&request_uri=not-a-uri'), null);
    });

    // RFC 9101 Section 5.2: request_uri is an absolute URI and must be https or URN.
    it('validates request_uri scheme requirements', () => {
        assert.doesNotThrow(() =>
            validateJarAuthorizationRequestParams({
                clientId: 's6BhdRkqt3',
                requestUri: 'https://tfp.example.org/request.jwt/GkurKxf5',
            }),
        );

        assert.doesNotThrow(() =>
            validateJarAuthorizationRequestParams({
                clientId: 's6BhdRkqt3',
                requestUri: 'urn:example:request-object:1234',
            }),
        );

        assert.throws(() =>
            validateJarAuthorizationRequestParams({
                clientId: 's6BhdRkqt3',
                requestUri: 'http://tfp.example.org/request.jwt/GkurKxf5',
            }),
        );
    });

    // RFC 9101 Section 5.2: request_uri SHOULD NOT exceed 512 ASCII characters.
    it('enforces optional request_uri length limits when configured', () => {
        assert.throws(() =>
            validateJarAuthorizationRequestParams(
                {
                    clientId: 's6BhdRkqt3',
                    requestUri: 'https://example.com/request.jwt/too-long',
                },
                { maxRequestUriLength: 10 },
            ),
        );
    });

    it('formats authorization request parameters for round-trip parsing', () => {
        const formatted = formatJarAuthorizationRequestParams({
            clientId: 's6BhdRkqt3',
            request: SAMPLE_JWS,
        });
        assert.equal(
            formatted,
            `client_id=s6BhdRkqt3&request=${encodeURIComponent(SAMPLE_JWS)}`,
        );
        assert.deepEqual(parseJarAuthorizationRequestParams(formatted), {
            clientId: 's6BhdRkqt3',
            request: SAMPLE_JWS,
        });
    });
});
