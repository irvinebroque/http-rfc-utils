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

    // RFC 4647 Section 2.1: basic language-range grammar.
    it('accepts valid basic language ranges and wildcard', () => {
        const ranges = parseAcceptLanguage('EN, zh-Hant, de-CH-1996, *;q=0.1');
        assert.deepEqual(ranges.map(range => range.tag), ['de-ch-1996', 'zh-hant', 'en', '*']);
    });

    // RFC 4647 Section 2.1: `*` is only valid as a standalone range.
    it('rejects malformed wildcard forms', () => {
        const ranges = parseAcceptLanguage('en-*, *-us, *-*-x, fr');
        assert.deepEqual(ranges.map(range => range.tag), ['fr']);
    });

    // RFC 4647 Section 2.1: first subtag is 1*8ALPHA; subtags are 1*8alphanum.
    it('rejects invalid language-range subtags and characters', () => {
        const ranges = parseAcceptLanguage('123, en--us, en_uk, abcdefghi, en-us');
        assert.deepEqual(ranges.map(range => range.tag), ['en-us']);
    });

    // RFC 9110 Section 12.4.2 (qvalue grammar)
    it('rejects invalid qvalues', () => {
        const ranges = parseAcceptLanguage('en;q=1.5, fr;q=0.8');
        assert.equal(ranges.length, 1);
        assert.equal(ranges[0]?.tag, 'fr');
    });

    it('keeps valid ranges when the list contains invalid members', () => {
        const ranges = parseAcceptLanguage('en-US, en--GB, fr-FR;q=0.7, *-x;q=0.9');
        assert.deepEqual(ranges, [
            { tag: 'en-us', q: 1 },
            { tag: 'fr-fr', q: 0.7 },
        ]);
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
