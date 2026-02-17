/**
 * Tests for OAuth authorization server issuer identification helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatAuthorizationResponseIssuerParam,
    parseAuthorizationResponseIssuerParam,
    validateAuthorizationResponseIssuer,
} from '../src/oauth-authorization-server-issuer.js';
import {
    parseAuthorizationResponseIssuerParam as parseAuthorizationResponseIssuerParamFromIndex,
} from '../src/index.js';

describe('OAuth 2.0 Authorization Server Issuer Identification (RFC 9207 Sections 2, 2.4, 3)', () => {
    it('re-exports RFC 9207 helpers from src/index.ts', () => {
        assert.equal(typeof parseAuthorizationResponseIssuerParamFromIndex, 'function');
    });

    // RFC 9207 Section 2.1 and Section 2.2: issuer parameter appears in responses.
    it('parses issuer parameters from authorization responses', () => {
        const params =
            'code=x1848ZT64p4IirMPT0R-X3141MFPTuBX-VFL_cvpI&state=abc&iss=https%3A%2F%2Fhonest.as.example';
        const parsed = parseAuthorizationResponseIssuerParam(params);
        assert.deepEqual(parsed, { issuer: 'https://honest.as.example' });
    });

    it('returns null for missing issuer when required', () => {
        assert.equal(parseAuthorizationResponseIssuerParam('code=abc', { requireIssuer: true }), null);
        assert.deepEqual(parseAuthorizationResponseIssuerParam('code=abc'), {});
    });

    it('rejects duplicate issuer parameters', () => {
        assert.equal(
            parseAuthorizationResponseIssuerParam('iss=https%3A%2F%2Fone.example&iss=https%3A%2F%2Ftwo.example'),
            null,
        );
    });

    // RFC 9207 Section 2 and Section 2.4: https-only issuer with exact string comparison.
    it('validates issuer syntax and exact matching', () => {
        assert.doesNotThrow(() =>
            validateAuthorizationResponseIssuer('https://as.example.com', {
                expectedIssuer: 'https://as.example.com',
            }),
        );

        assert.throws(() =>
            validateAuthorizationResponseIssuer('https://as.example.com', {
                expectedIssuer: 'https://as.example.com/',
            }),
        );

        assert.throws(() => validateAuthorizationResponseIssuer('http://as.example.com'));
        assert.throws(() => validateAuthorizationResponseIssuer('https://as.example.com?bad=1'));
    });

    it('formats issuer parameters as x-www-form-urlencoded data', () => {
        assert.equal(
            formatAuthorizationResponseIssuerParam('https://as.example.com'),
            'iss=https%3A%2F%2Fas.example.com',
        );
    });
});
