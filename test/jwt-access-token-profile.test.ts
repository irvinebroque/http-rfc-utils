/**
 * Tests for RFC 9068 JWT access token profile helpers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatJwtAccessTokenClaims,
    formatJwtAccessTokenHeader,
    parseJwtAccessToken,
    validateJwtAccessToken,
    validateJwtAccessTokenClaims,
    validateJwtAccessTokenHeader,
} from '../src/auth/jwt-access-token.js';
import {
    parseJwtAccessToken as parseJwtAccessTokenFromIndex,
} from '../src/index.js';

function encodeSegment(value: unknown): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function buildToken(header: unknown, claims: unknown, signature = 'signature'): string {
    const signatureSegment = Buffer.from(signature, 'utf8').toString('base64url');
    return `${encodeSegment(header)}.${encodeSegment(claims)}.${signatureSegment}`;
}

describe('JWT access token profile (RFC 9068 Sections 2 and 4)', () => {
    it('parses and validates RFC 9068 example claims', () => {
        const header = {
            typ: 'at+jwt',
            alg: 'RS256',
            kid: 'RjEwOwOA',
        };
        const claims = {
            iss: 'https://authorization-server.example.com/',
            sub: '5ba552d67',
            aud: 'https://rs.example.com/',
            exp: 1639528912,
            iat: 1618354090,
            jti: 'dbe39bf3a3ba4238a513f51d6e1691c4',
            client_id: 's6BhdRkqt3',
            scope: 'openid profile reademail',
        };

        const token = buildToken(header, claims);
        const parsed = parseJwtAccessToken(token, {
            expectedIssuer: 'https://authorization-server.example.com/',
            expectedAudience: 'https://rs.example.com/',
            now: 1618354091,
        });

        assert.notEqual(parsed, null);
        assert.equal(parsed?.claims.client_id, 's6BhdRkqt3');
        assert.equal(parsed?.header.typ, 'at+jwt');
    });

    it('re-exports parseJwtAccessToken from src/index.ts', () => {
        assert.equal(typeof parseJwtAccessTokenFromIndex, 'function');
    });

    it('rejects invalid header typ and alg values', () => {
        assert.throws(() =>
            validateJwtAccessTokenHeader({
                typ: 'JWT',
                alg: 'RS256',
            }),
        );

        assert.throws(() =>
            validateJwtAccessTokenHeader({
                typ: 'at+jwt',
                alg: 'none',
            }),
        );
    });

    it('rejects missing required claims and invalid audience values', () => {
        assert.throws(() =>
            validateJwtAccessTokenClaims({
                iss: 'https://issuer.example.com',
                sub: 'subject',
                aud: ['https://rs.example.com'],
                exp: 10,
                iat: 1,
                jti: 'token',
                client_id: '',
            }),
        );

        assert.throws(() =>
            validateJwtAccessTokenClaims({
                iss: 'https://issuer.example.com',
                sub: 'subject',
                aud: [],
                exp: 10,
                iat: 1,
                jti: 'token',
                client_id: 'client',
            }),
        );
    });

    it('enforces expected audience matching', () => {
        assert.throws(() =>
            validateJwtAccessTokenClaims(
                {
                    iss: 'https://issuer.example.com',
                    sub: 'subject',
                    aud: ['https://rs.example.com', 'https://other.example.com'],
                    exp: 10,
                    iat: 1,
                    jti: 'token',
                    client_id: 'client',
                },
                {
                    expectedAudience: 'https://missing.example.com',
                },
            ),
        );
    });

    it('applies expiration and clock skew checks', () => {
        const token = {
            header: { typ: 'at+jwt', alg: 'RS256' },
            claims: {
                iss: 'https://issuer.example.com',
                sub: 'subject',
                aud: 'https://rs.example.com',
                exp: 100,
                iat: 50,
                jti: 'token',
                client_id: 'client',
            },
            signature: 'sig',
        };

        assert.throws(() =>
            validateJwtAccessToken(token, {
                now: 100,
            }),
        );

        assert.doesNotThrow(() =>
            validateJwtAccessToken(token, {
                now: 100,
                clockSkewSeconds: 1,
            }),
        );
    });

    it('formats header and claims with deterministic ordering', () => {
        const headerJson = formatJwtAccessTokenHeader({
            typ: 'at+jwt',
            alg: 'RS256',
            kid: 'key-1',
            extra: 'value',
        });
        const claimsJson = formatJwtAccessTokenClaims({
            iss: 'https://issuer.example.com',
            sub: 'subject',
            aud: 'https://rs.example.com',
            exp: 10,
            iat: 1,
            jti: 'token',
            client_id: 'client',
            scope: 'read',
            extra: 'value',
        });

        assert.ok(headerJson.indexOf('"typ"') < headerJson.indexOf('"alg"'));
        assert.ok(claimsJson.indexOf('"iss"') < claimsJson.indexOf('"sub"'));
        assert.ok(claimsJson.indexOf('"scope"') < claimsJson.indexOf('"extra"'));
    });
});
