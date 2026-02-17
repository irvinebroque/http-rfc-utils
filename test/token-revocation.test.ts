/**
 * Tests for OAuth token revocation helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    formatTokenRevocationRequestParams,
    parseTokenRevocationRequestParams,
    validateTokenRevocationRequestParams,
} from '../src/auth.js';

describe('Token revocation request helpers (RFC 7009 Section 2.1)', () => {
    it('parses the example refresh token revocation request (RFC 7009 Section 2.1)', () => {
        const parsed = parseTokenRevocationRequestParams(
            'token=45ghiukldjahdnhzdauz&token_type_hint=refresh_token'
        );
        assert.deepEqual(parsed, {
            token: '45ghiukldjahdnhzdauz',
            tokenTypeHint: 'refresh_token',
        });
    });

    it('parses minimal token-only requests', () => {
        const parsed = parseTokenRevocationRequestParams('token=agabcdefddddafdd');
        assert.deepEqual(parsed, { token: 'agabcdefddddafdd' });
    });

    it('accepts unknown token_type_hint values for extensions', () => {
        const parsed = parseTokenRevocationRequestParams('token=abc&token_type_hint=custom_token');
        assert.deepEqual(parsed, {
            token: 'abc',
            tokenTypeHint: 'custom_token',
        });
    });

    it('returns null for missing/duplicate token or invalid token_type_hint syntax', () => {
        assert.equal(parseTokenRevocationRequestParams('token='), null);
        assert.equal(parseTokenRevocationRequestParams('token=one&token=two'), null);
        assert.equal(parseTokenRevocationRequestParams('token=abc&token_type_hint=bad hint'), null);
        assert.equal(
            parseTokenRevocationRequestParams(
                'token=abc&token_type_hint=refresh_token&token_type_hint=access_token'
            ),
            null
        );
    });
});

describe('Token revocation request formatting and validation (RFC 7009 Section 2.1)', () => {
    it('formats token revocation requests with optional hints', () => {
        assert.equal(formatTokenRevocationRequestParams({ token: 'abc' }), 'token=abc');
        assert.equal(
            formatTokenRevocationRequestParams({ token: 'abc', tokenTypeHint: 'access_token' }),
            'token=abc&token_type_hint=access_token'
        );
    });

    it('round-trips formatted values', () => {
        const formatted = formatTokenRevocationRequestParams({
            token: '45ghiukldjahdnhzdauz',
            tokenTypeHint: 'refresh_token',
        });
        assert.equal(formatted, 'token=45ghiukldjahdnhzdauz&token_type_hint=refresh_token');
        assert.deepEqual(parseTokenRevocationRequestParams(formatted), {
            token: '45ghiukldjahdnhzdauz',
            tokenTypeHint: 'refresh_token',
        });
    });

    it('throws on semantically invalid input', () => {
        assert.throws(() => validateTokenRevocationRequestParams({ token: '' }), /token must be a non-empty string/);
        assert.throws(
            () => validateTokenRevocationRequestParams({ token: 'abc', tokenTypeHint: 'bad hint' }),
            /token_type_hint/
        );
    });
});
