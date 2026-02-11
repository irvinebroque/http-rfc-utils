/**
 * Tests for language behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAcceptLanguage, negotiateLanguage } from '../src/language.js';

describe('Accept-Language (RFC 9110 Section 12.5.4, RFC 4647 Section 3)', () => {
    it('parses and sorts by q value (RFC 9110 Section 12.4.2)', () => {
        const ranges = parseAcceptLanguage('da, en-gb;q=0.8, en;q=0.7');
        assert.equal(ranges[0]?.tag, 'da');
        assert.equal(ranges[1]?.tag, 'en-gb');
        assert.equal(ranges[2]?.tag, 'en');
    });

    it('sorts by q then specificity when q values tie', () => {
        const ranges = parseAcceptLanguage('en;q=0.8, en-us;q=0.8, *;q=0.8');
        assert.deepEqual(ranges.map(range => range.tag), ['en-us', 'en', '*']);
    });

    // RFC 9110 Section 12.4.2 (qvalue grammar)
    it('rejects invalid qvalues', () => {
        const ranges = parseAcceptLanguage('en;q=1.5, fr;q=0.8');
        assert.equal(ranges.length, 1);
        assert.equal(ranges[0]?.tag, 'fr');
    });

    it('applies basic filtering (RFC 4647 Section 3)', () => {
        const ranges = parseAcceptLanguage('en');
        const selected = negotiateLanguage(ranges, ['en-US', 'fr']);
        assert.equal(selected, 'en-US');
    });

    it('supports wildcard matching (RFC 4647 Section 3)', () => {
        const ranges = parseAcceptLanguage('*;q=0.5');
        const selected = negotiateLanguage(ranges, ['fr', 'en']);
        assert.equal(selected, 'fr');
    });
});
