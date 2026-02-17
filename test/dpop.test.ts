/**
 * Tests for DPoP helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    computeDpopAth,
    formatDpopAuthorization,
    formatDpopChallenge,
    formatDpopHeader,
    formatDpopNonce,
    formatDpopProofJwt,
    parseDpopAuthorization,
    parseDpopChallenge,
    parseDpopHeader,
    parseDpopNonce,
    parseDpopProofJwt,
    validateDpopProofJwt,
} from '../src/auth.js';
import type { DpopProofJwt } from '../src/types.js';

describe('DPoP proof helpers (RFC 9449 Sections 4.1-4.3)', () => {
    it('computes ath from the RFC example access token (RFC 9449 Section 4.2)', () => {
        const accessToken = 'Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU';
        const ath = computeDpopAth(accessToken);
        assert.equal(ath, 'fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo');
    });

    it('formats and parses a DPoP proof JWT round-trip', () => {
        const proof: DpopProofJwt = {
            header: {
                typ: 'dpop+jwt',
                alg: 'ES256',
                jwk: {
                    kty: 'EC',
                    crv: 'P-256',
                    x: 'l8tFrhx-34tV3hRICRDY9zCkDlpBhF42UQUfWVAWBFs',
                    y: '9VE4jf_Ok_o64zbTTlcuNJajHmt6v9TDVrU0CdvGRDA',
                },
            },
            payload: {
                jti: 'e1j3V_bKic8-LAEB',
                htm: 'GET',
                htu: 'https://resource.example.org/protectedresource',
                iat: 1562262618,
            },
            signature: 'c2ln',
        };

        const jwt = formatDpopProofJwt(proof);
        const parsed = parseDpopProofJwt(jwt);
        assert.deepEqual(parsed, proof);
    });

    it('accepts normalized htu comparisons (RFC 9449 Section 4.3)', () => {
        const proof: DpopProofJwt = {
            header: {
                typ: 'dpop+jwt',
                alg: 'ES256',
                jwk: {
                    kty: 'EC',
                    crv: 'P-256',
                    x: 'x',
                    y: 'y',
                },
            },
            payload: {
                jti: 'abc',
                htm: 'POST',
                htu: 'https://EXAMPLE.com:443/token',
                iat: 1562262616,
            },
            signature: 'c2ln',
        };

        assert.doesNotThrow(() => {
            validateDpopProofJwt(proof, {
                expectedMethod: 'POST',
                expectedHtu: 'https://example.com/token?query=1',
            });
        });
    });

    it('enforces access token hash matches ath (RFC 9449 Section 4.2)', () => {
        const accessToken = 'Kz~8mXK1EalYznwH-LC-1fBAo.4Ljp~zsPE_NeO.gxU';
        const proof: DpopProofJwt = {
            header: {
                typ: 'dpop+jwt',
                alg: 'ES256',
                jwk: {
                    kty: 'EC',
                    crv: 'P-256',
                    x: 'x',
                    y: 'y',
                },
            },
            payload: {
                jti: 'def',
                htm: 'GET',
                htu: 'https://resource.example.org/protectedresource',
                iat: 1562262618,
                ath: computeDpopAth(accessToken),
            },
            signature: 'c2ln',
        };

        assert.doesNotThrow(() => {
            validateDpopProofJwt(proof, { accessToken });
        });

        assert.throws(() => {
            validateDpopProofJwt(proof, { accessToken: 'other-token' });
        }, /ath/);
    });

    it('rejects proofs with private key members in jwk (RFC 9449 Section 4.2)', () => {
        const proof: DpopProofJwt = {
            header: {
                typ: 'dpop+jwt',
                alg: 'ES256',
                jwk: {
                    kty: 'EC',
                    d: 'private',
                },
            },
            payload: {
                jti: 'abc',
                htm: 'GET',
                htu: 'https://resource.example.org/protectedresource',
                iat: 1562262618,
            },
            signature: 'c2ln',
        };

        assert.throws(() => validateDpopProofJwt(proof), /private key/);
    });
});

describe('DPoP header and authentication helpers (RFC 9449 Sections 4.1, 7.1, 8.1)', () => {
    it('parses and formats DPoP headers', () => {
        const proof: DpopProofJwt = {
            header: {
                typ: 'dpop+jwt',
                alg: 'ES256',
                jwk: {
                    kty: 'EC',
                },
            },
            payload: {
                jti: 'abc',
                htm: 'POST',
                htu: 'https://server.example.com/token',
                iat: 1562262616,
            },
            signature: 'c2ln',
        };

        const headerValue = formatDpopHeader(proof);
        assert.deepEqual(parseDpopHeader(headerValue), proof);
        assert.equal(parseDpopHeader('not-a-jwt'), null);
    });

    it('parses and formats DPoP Authorization headers', () => {
        const header = formatDpopAuthorization('abc.def');
        assert.equal(header, 'DPoP abc.def');
        assert.equal(parseDpopAuthorization(header), 'abc.def');
        assert.equal(parseDpopAuthorization('Bearer abc'), null);
    });

    it('parses and formats DPoP challenges with algs and nonce errors', () => {
        const header = formatDpopChallenge({
            realm: 'resource',
            error: 'use_dpop_nonce',
            scope: 'read write',
            algs: ['ES256', 'EdDSA'],
        });

        const parsed = parseDpopChallenge(header);
        assert.deepEqual(parsed, {
            realm: 'resource',
            error: 'use_dpop_nonce',
            scope: 'read write',
            algs: ['ES256', 'EdDSA'],
        });
    });

    it('parses and formats DPoP-Nonce values', () => {
        assert.equal(parseDpopNonce('nonce-123'), 'nonce-123');
        assert.equal(parseDpopNonce('bad nonce'), null);
        assert.equal(formatDpopNonce('nonce-123'), 'nonce-123');
        assert.throws(() => formatDpopNonce('bad nonce'), /NQCHAR/);
    });
});
