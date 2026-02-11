/**
 * Tests for pkce behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    derivePkceCodeChallenge,
    formatPkceAuthorizationRequestParams,
    formatPkceTokenRequestParams,
    generatePkceCodeVerifier,
    parsePkceAuthorizationRequestParams,
    parsePkceTokenRequestParams,
    validatePkceCodeChallenge,
    validatePkceCodeVerifier,
    verifyPkceCodeVerifier,
} from '../src/auth.js';

const PKCE_VALUE_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

describe('PKCE code verifier and challenge helpers (RFC 7636 Sections 4.1-4.2, 4.6, 7.1-7.2, Appendix B)', () => {
    it('validates code_verifier ABNF boundaries (RFC 7636 Section 4.1)', () => {
        assert.doesNotThrow(() => {
            validatePkceCodeVerifier('A'.repeat(43));
            validatePkceCodeVerifier('A'.repeat(128));
        });

        assert.throws(() => validatePkceCodeVerifier('A'.repeat(42)), /code_verifier/);
        assert.throws(() => validatePkceCodeVerifier('A'.repeat(129)), /code_verifier/);
        assert.throws(() => validatePkceCodeVerifier('A'.repeat(42) + '!'), /code_verifier/);
    });

    it('validates code_challenge ABNF boundaries (RFC 7636 Section 4.2)', () => {
        assert.doesNotThrow(() => {
            validatePkceCodeChallenge('B'.repeat(43));
            validatePkceCodeChallenge('B'.repeat(128));
        });

        assert.throws(() => validatePkceCodeChallenge('B'.repeat(42)), /code_challenge/);
        assert.throws(() => validatePkceCodeChallenge('B'.repeat(129)), /code_challenge/);
        assert.throws(() => validatePkceCodeChallenge('B'.repeat(42) + '='), /code_challenge/);
    });

    it('generates verifier from CSPRNG seed with base64url shape (RFC 7636 Section 7.1)', () => {
        const verifier = generatePkceCodeVerifier();
        assert.match(verifier, PKCE_VALUE_RE);
        assert.equal(verifier.length, 43);
    });

    it('supports configurable verifier byte length with strict bounds', () => {
        const verifier = generatePkceCodeVerifier({ byteLength: 96 });
        assert.match(verifier, PKCE_VALUE_RE);
        assert.equal(verifier.length, 128);

        assert.throws(() => generatePkceCodeVerifier({ byteLength: 31 }), /between 32 and 96/);
        assert.throws(() => generatePkceCodeVerifier({ byteLength: 97 }), /between 32 and 96/);
        assert.throws(() => generatePkceCodeVerifier({ byteLength: 32.5 }), /integer/);
    });

    it('derives S256 challenge using Appendix B vector (RFC 7636 Appendix B)', () => {
        const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
        const challenge = derivePkceCodeChallenge(verifier, 'S256');
        assert.equal(challenge, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    });

    it('derives plain challenge as verifier passthrough (RFC 7636 Section 4.2)', () => {
        const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
        assert.equal(derivePkceCodeChallenge(verifier, 'plain'), verifier);
    });

    it('defaults strict derivation and verification helpers to S256', () => {
        const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
        const s256Challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
        assert.equal(derivePkceCodeChallenge(verifier), s256Challenge);
        assert.equal(verifyPkceCodeVerifier(verifier, s256Challenge), true);
    });

    it('verifies challenge match and mismatch (RFC 7636 Section 4.6)', () => {
        const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
        const s256Challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

        assert.equal(verifyPkceCodeVerifier(verifier, s256Challenge, 'S256'), true);
        assert.equal(verifyPkceCodeVerifier(verifier, verifier, 'plain'), true);
        assert.equal(verifyPkceCodeVerifier(verifier, s256Challenge, 'plain'), false);
    });

    it('does not downgrade method checks implicitly (RFC 7636 Section 7.2)', () => {
        const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
        const s256Challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
        assert.equal(verifyPkceCodeVerifier(verifier, s256Challenge, 'plain'), false);
    });

    it('rejects unsupported PKCE methods in strict helpers', () => {
        const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
        const s256Challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
        const unsupportedMethod = 'S512' as unknown as 'plain' | 'S256';

        assert.throws(
            () => derivePkceCodeChallenge(verifier, unsupportedMethod),
            /Unsupported PKCE code_challenge_method/
        );
        assert.throws(
            () => verifyPkceCodeVerifier(verifier, s256Challenge, unsupportedMethod),
            /Unsupported PKCE code_challenge_method/
        );
    });
});

describe('PKCE authorization request parameter helpers (RFC 7636 Section 4.3)', () => {
    it('parses code_challenge and defaults missing method to plain (RFC 7636 Section 4.3)', () => {
        const parsed = parsePkceAuthorizationRequestParams(
            'response_type=code&code_challenge=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        );
        assert.deepEqual(parsed, {
            codeChallenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            codeChallengeMethod: 'plain',
        });
    });

    it('parses S256 method when explicitly provided (RFC 7636 Section 4.3)', () => {
        const parsed = parsePkceAuthorizationRequestParams(
            'code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
        );
        assert.deepEqual(parsed, {
            codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            codeChallengeMethod: 'S256',
        });
    });

    it('returns null for duplicates, unknown method, or invalid challenge', () => {
        assert.equal(
            parsePkceAuthorizationRequestParams(
                'code_challenge=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&code_challenge=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
            ),
            null
        );
        assert.equal(
            parsePkceAuthorizationRequestParams(
                'code_challenge=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&code_challenge_method=S256&code_challenge_method=plain'
            ),
            null
        );
        assert.equal(
            parsePkceAuthorizationRequestParams(
                'code_challenge=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&code_challenge_method=s256'
            ),
            null
        );
        assert.equal(
            parsePkceAuthorizationRequestParams(
                'code_challenge=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA!&code_challenge_method=S256'
            ),
            null
        );
    });

    it('formats and round-trips authorization parameters', () => {
        const formatted = formatPkceAuthorizationRequestParams({
            codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            codeChallengeMethod: 'S256',
        });
        assert.equal(
            formatted,
            'code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
        );

        const parsed = parsePkceAuthorizationRequestParams(formatted);
        assert.deepEqual(parsed, {
            codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            codeChallengeMethod: 'S256',
        });
    });

    it('defaults formatted authorization params to S256 when omitted', () => {
        const formatted = formatPkceAuthorizationRequestParams({
            codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        });
        assert.equal(
            formatted,
            'code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256'
        );
    });

    it('throws when formatting semantically invalid values', () => {
        assert.throws(() => {
            formatPkceAuthorizationRequestParams({
                codeChallenge: 'short',
                codeChallengeMethod: 'plain',
            });
        }, /code_challenge/);

        const unsupportedMethod = 'S512' as unknown as 'plain' | 'S256';
        assert.throws(() => {
            formatPkceAuthorizationRequestParams({
                codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
                codeChallengeMethod: unsupportedMethod,
            });
        }, /Unsupported PKCE code_challenge_method/);
    });
});

describe('PKCE token request parameter helpers (RFC 7636 Section 4.5)', () => {
    it('parses code_verifier parameter for token request (RFC 7636 Section 4.5)', () => {
        const parsed = parsePkceTokenRequestParams(
            'grant_type=authorization_code&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
        );
        assert.deepEqual(parsed, {
            codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        });
    });

    it('returns null for duplicate or invalid code_verifier', () => {
        assert.equal(
            parsePkceTokenRequestParams(
                'code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk&code_verifier=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
            ),
            null
        );
        assert.equal(parsePkceTokenRequestParams('code_verifier=short'), null);
    });

    it('formats and round-trips token request parameters', () => {
        const formatted = formatPkceTokenRequestParams({
            codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        });
        assert.equal(formatted, 'code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');

        const parsed = parsePkceTokenRequestParams(formatted);
        assert.deepEqual(parsed, {
            codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        });
    });

    it('throws for semantically invalid token format input', () => {
        assert.throws(() => {
            formatPkceTokenRequestParams({ codeVerifier: 'invalid!' });
        }, /code_verifier/);
    });
});
