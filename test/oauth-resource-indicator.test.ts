/**
 * Tests for OAuth resource indicator helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    formatResourceIndicatorAuthorizationRequestParams,
    formatResourceIndicatorTokenRequestParams,
    parseResourceIndicatorAuthorizationRequestParams,
    parseResourceIndicatorTokenRequestParams,
    validateResourceIndicatorUri,
} from '../src/auth.js';

describe('Resource indicator URI validation (RFC 8707 Section 2, RFC 3986 Section 4.3)', () => {
    it('accepts absolute URIs and rejects fragments (RFC 8707 Section 2)', () => {
        assert.doesNotThrow(() => validateResourceIndicatorUri('https://api.example.com/app/'));
        assert.doesNotThrow(() => validateResourceIndicatorUri('urn:example:resource'));

        assert.throws(
            () => validateResourceIndicatorUri('https://api.example.com/app/#frag'),
            /fragment component/
        );
        assert.throws(() => validateResourceIndicatorUri('/app/'), /absolute URI/);
    });

    it('optionally rejects query components (RFC 8707 Section 2)', () => {
        assert.doesNotThrow(() => validateResourceIndicatorUri('https://api.example.com/app/?tenant=1'));
        assert.throws(
            () => validateResourceIndicatorUri('https://api.example.com/app/?tenant=1', { allowQuery: false }),
            /query component/
        );
    });
});

describe('Resource indicator authorization request helpers (RFC 8707 Section 2.1)', () => {
    it('parses single resource authorization request (RFC 8707 Section 2.1)', () => {
        const parsed = parseResourceIndicatorAuthorizationRequestParams(
            'response_type=token&resource=https%3A%2F%2Fapi.example.com%2Fapp%2F'
        );
        assert.deepEqual(parsed, {
            resources: ['https://api.example.com/app/'],
        });
    });

    it('parses multiple resource parameters (RFC 8707 Section 2)', () => {
        const parsed = parseResourceIndicatorAuthorizationRequestParams(
            'resource=https%3A%2F%2Fcal.example.com%2F&resource=https%3A%2F%2Fcontacts.example.com%2F'
        );
        assert.deepEqual(parsed, {
            resources: ['https://cal.example.com/', 'https://contacts.example.com/'],
        });
    });

    it('returns null for missing or malformed resource values', () => {
        assert.equal(parseResourceIndicatorAuthorizationRequestParams('scope=calendar'), null);
        assert.equal(
            parseResourceIndicatorAuthorizationRequestParams(
                'resource=https%3A%2F%2Fapi.example.com%2F%23frag'
            ),
            null
        );
    });

    it('formats and round-trips authorization request parameters', () => {
        const formatted = formatResourceIndicatorAuthorizationRequestParams({
            resources: ['https://api.example.com/app/'],
        });
        assert.equal(formatted, 'resource=https%3A%2F%2Fapi.example.com%2Fapp%2F');

        const parsed = parseResourceIndicatorAuthorizationRequestParams(formatted);
        assert.deepEqual(parsed, {
            resources: ['https://api.example.com/app/'],
        });
    });
});

describe('Resource indicator token request helpers (RFC 8707 Section 2.2)', () => {
    it('formats token request parameters and parses them back', () => {
        const formatted = formatResourceIndicatorTokenRequestParams({
            resources: ['https://cal.example.com/'],
        });
        assert.equal(formatted, 'resource=https%3A%2F%2Fcal.example.com%2F');

        const parsed = parseResourceIndicatorTokenRequestParams(formatted);
        assert.deepEqual(parsed, {
            resources: ['https://cal.example.com/'],
        });
    });

    it('throws when formatting empty resource lists', () => {
        assert.throws(
            () => formatResourceIndicatorTokenRequestParams({ resources: [] }),
            /non-empty array/
        );
    });
});
