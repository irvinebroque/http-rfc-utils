import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getNormalizedHeaderValue,
    isSfItem,
    normalizeOptionalHeaderValue,
} from '../src/structured-field-helpers.js';
import type { SfDictionary } from '../src/types.js';

describe('structured-field-helpers', () => {
    it('isSfItem distinguishes SF items from inner lists', () => {
        const itemMember: SfDictionary[string] = { value: true };
        const listMember: SfDictionary[string] = { items: [{ value: 1 }] };

        assert.equal(isSfItem(itemMember), true);
        assert.equal(isSfItem(listMember), false);
    });

    it('normalizes optional header values', () => {
        assert.equal(normalizeOptionalHeaderValue(' value '), 'value');
        assert.equal(normalizeOptionalHeaderValue('   '), null);
        assert.equal(normalizeOptionalHeaderValue(null), null);
        assert.equal(normalizeOptionalHeaderValue(undefined), null);
    });

    it('reads case-insensitive header values from Headers and records', () => {
        const headers = new Headers();
        headers.set('CDN-Cache-Control', ' max-age=60 ');

        assert.equal(getNormalizedHeaderValue(headers, 'cdn-cache-control'), 'max-age=60');
        assert.equal(getNormalizedHeaderValue({ 'CDN-Cache-Control': ' no-store ' }, 'cdn-cache-control'), 'no-store');
        assert.equal(getNormalizedHeaderValue({ 'CDN-Cache-Control': '   ' }, 'cdn-cache-control'), null);
    });
});
