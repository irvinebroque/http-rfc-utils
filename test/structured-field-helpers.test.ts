/**
 * Tests for structured field helpers behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    expectSfItem,
    getNormalizedHeaderValue,
    hasNoSfParams,
    isSfKeyText,
    isSfItem,
    isSfTokenText,
    normalizeOptionalHeaderValue,
} from '../src/structured-field-helpers.js';
import { SfToken } from '../src/types.js';
import type { SfDictionary, SfList } from '../src/types.js';

// RFC 8941 §3.1: List/Dictionary members are either Item or Inner List.
// RFC 9110 §5.5 and §5.6.3: field value normalization and OWS trimming.
describe('structured-field-helpers (RFC 8941 §3.1, RFC 9110 §5.5/§5.6.3)', () => {
    it('isSfItem distinguishes Item members from Inner Lists (RFC 8941 §3.1)', () => {
        const itemMember: SfDictionary[string] = { value: true };
        const listMember: SfDictionary[string] = { items: [{ value: 1 }] };

        assert.equal(isSfItem(itemMember), true);
        assert.equal(isSfItem(listMember), false);
    });

    it('normalizes optional header values with OWS trimming (RFC 9110 §5.6.3)', () => {
        assert.equal(normalizeOptionalHeaderValue(' value '), 'value');
        assert.equal(normalizeOptionalHeaderValue('   '), null);
        assert.equal(normalizeOptionalHeaderValue(null), null);
        assert.equal(normalizeOptionalHeaderValue(undefined), null);
    });

    it('reads case-insensitive header values from Headers and records (RFC 9110 §5.1)', () => {
        const headers = new Headers();
        headers.set('CDN-Cache-Control', ' max-age=60 ');

        assert.equal(getNormalizedHeaderValue(headers, 'cdn-cache-control'), 'max-age=60');
        assert.equal(getNormalizedHeaderValue({ 'CDN-Cache-Control': ' no-store ' }, 'cdn-cache-control'), 'no-store');
        assert.equal(getNormalizedHeaderValue({ 'CDN-Cache-Control': '   ' }, 'cdn-cache-control'), null);
    });

    it('validates RFC 8941 token and key text constraints', () => {
        assert.equal(isSfTokenText('backend.example.org:8001'), true);
        assert.equal(isSfTokenText('backend server'), false);
        assert.equal(isSfKeyText('sec-ch-ua'), true);
        assert.equal(isSfKeyText('Sec-CH-UA'), false);
    });

    it('extracts sf-item members and validates params emptiness', () => {
        const list: SfList = [{ value: new SfToken('ok') }, { items: [{ value: 'nope' }] }];
        const item = expectSfItem(list[0]!);
        assert.ok(item);
        assert.equal(hasNoSfParams(item), true);
        assert.equal(expectSfItem(list[1]!), null);
        assert.equal(hasNoSfParams({ value: 'x', params: {} }), true);
        assert.equal(hasNoSfParams({ value: 'x', params: { a: 1 } }), false);
    });
});
