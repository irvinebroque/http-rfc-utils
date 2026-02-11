/**
 * Tests for patch behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseAcceptPatch,
    formatAcceptPatch,
    supportsPatch,
} from '../src/patch.js';

// RFC 5789 §3.1: Accept-Patch = 1#media-type.
describe('parseAcceptPatch (RFC 5789 Section 3.1)', () => {
    it('parses ordered media types and preserves parameter order', () => {
        const parsed = parseAcceptPatch(
            'application/json-patch+json;profile="https://example.test/p";charset=utf-8, application/merge-patch+json'
        );

        assert.deepEqual(parsed, [
            {
                type: 'application',
                subtype: 'json-patch+json',
                parameters: [
                    { name: 'profile', value: 'https://example.test/p' },
                    { name: 'charset', value: 'utf-8' },
                ],
            },
            {
                type: 'application',
                subtype: 'merge-patch+json',
                parameters: [],
            },
        ]);
    });

    it('parses multiple field instances as a combined member list', () => {
        const parsed = parseAcceptPatch([
            'application/json-patch+json',
            'application/merge-patch+json; charset=utf-8',
        ]);

        assert.deepEqual(parsed, [
            {
                type: 'application',
                subtype: 'json-patch+json',
                parameters: [],
            },
            {
                type: 'application',
                subtype: 'merge-patch+json',
                parameters: [{ name: 'charset', value: 'utf-8' }],
            },
        ]);
    });

    it('returns null for malformed media-type members', () => {
        assert.equal(parseAcceptPatch('application/json-patch+json, invalid'), null);
        assert.equal(parseAcceptPatch('application/json-patch+json, application/merge patch+json'), null);
        assert.equal(parseAcceptPatch('application/json-patch+json, application/merge-patch+json;'), null);
        assert.equal(parseAcceptPatch('application/json-patch+json,,application/merge-patch+json'), null);
    });

    it('returns null for malformed parameters', () => {
        assert.equal(parseAcceptPatch('application/json-patch+json; profile'), null);
        assert.equal(parseAcceptPatch('application/json-patch+json; profile='), null);
        assert.equal(parseAcceptPatch('application/json-patch+json; profile="unterminated'), null);
    });
});

// RFC 5789 §3.1: Accept-Patch advertises media types as a comma-separated list.
describe('formatAcceptPatch (RFC 5789 Section 3.1)', () => {
    it('formats media types with normalized tokens and stable order', () => {
        const value = formatAcceptPatch([
            {
                type: 'Application',
                subtype: 'Merge-Patch+Json',
                parameters: [
                    { name: 'Charset', value: 'utf-8' },
                    { name: 'profile', value: 'https://example.test/p v1' },
                ],
            },
            {
                type: 'application',
                subtype: 'json-patch+json',
                parameters: [],
            },
        ]);

        assert.equal(
            value,
            'application/merge-patch+json;charset=utf-8;profile="https://example.test/p v1", application/json-patch+json'
        );
    });
});

// RFC 5789 §3.1: Presence of Accept-Patch implies PATCH is allowed.
describe('supportsPatch (RFC 5789 Section 3.1)', () => {
    it('returns true when a valid Accept-Patch value is present', () => {
        assert.equal(supportsPatch('application/json-patch+json'), true);
    });

    it('returns false when header is absent or malformed', () => {
        assert.equal(supportsPatch(null), false);
        assert.equal(supportsPatch(undefined), false);
        assert.equal(supportsPatch('application/json-patch+json,'), false);
    });

    it('checks support for a specific patch media type', () => {
        const value = 'application/json-patch+json, application/merge-patch+json;charset=utf-8';

        assert.equal(supportsPatch(value, 'application/merge-patch+json'), true);
        assert.equal(supportsPatch([
            { type: 'Application', subtype: 'Merge-Patch+Json', parameters: [] },
        ], 'application/merge-patch+json'), true);
        assert.equal(supportsPatch(value, 'application/xml-patch+xml'), false);
        assert.equal(supportsPatch(value, 'invalid'), false);
    });
});
