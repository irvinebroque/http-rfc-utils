/**
 * Tests for Clear-Site-Data header behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    parseClearSiteData,
    formatClearSiteData,
    validateClearSiteData,
} from '../src/clear-site-data.js';

// W3C Clear Site Data Section 3.1 + Section 4.1 define a quoted-string list and parsing algorithm.
describe('parseClearSiteData (W3C Clear Site Data Sections 3.1 and 4.1)', () => {
    it('parses known directives from a single header value', () => {
        const parsed = parseClearSiteData('"cache", "cookies", "storage"');
        assert.deepEqual(parsed, ['cache', 'cookies', 'storage']);
    });

    it('parses repeated header values provided as string[]', () => {
        const parsed = parseClearSiteData(['"cache"', '"executionContexts"']);
        assert.deepEqual(parsed, ['cache', 'executionContexts']);
    });

    // W3C Clear Site Data Section 4.1: "*" appends all known types in order.
    it('expands wildcard directives in canonical known-type order', () => {
        const parsed = parseClearSiteData('"*"');
        assert.deepEqual(parsed, ['cache', 'cookies', 'storage', 'executionContexts']);
    });

    // W3C Clear Site Data Section 3.1: user agents MUST ignore unknown types.
    it('ignores unknown but syntactically valid directives', () => {
        const parsed = parseClearSiteData('"futureType", "cache", "nextType"');
        assert.deepEqual(parsed, ['cache']);
    });

    it('returns an empty list for malformed member syntax', () => {
        assert.deepEqual(parseClearSiteData('cache'), []);
        assert.deepEqual(parseClearSiteData('"cache",'), []);
        assert.deepEqual(parseClearSiteData('"cache", malformed'), []);
        assert.deepEqual(parseClearSiteData(['"cache"', 'bad']), []);
    });

    it('returns an empty list for nullish input', () => {
        assert.deepEqual(parseClearSiteData(null), []);
        assert.deepEqual(parseClearSiteData(undefined), []);
    });
});

describe('validateClearSiteData (W3C Clear Site Data Section 3.1)', () => {
    it('accepts known directives and expands wildcard values', () => {
        assert.deepEqual(validateClearSiteData(['cache', '*']), [
            'cache',
            'cache',
            'cookies',
            'storage',
            'executionContexts',
        ]);
    });

    it('throws for empty or unknown directives', () => {
        assert.throws(() => validateClearSiteData([]), /at least one value/);
        assert.throws(() => validateClearSiteData(['']), /must be non-empty/);
        assert.throws(() => validateClearSiteData(['futureType']), /Unknown Clear-Site-Data directive/);
    });
});

describe('formatClearSiteData (W3C Clear Site Data Section 3.1)', () => {
    it('formats a quoted-string list', () => {
        assert.equal(formatClearSiteData(['cache', 'storage']), '"cache", "storage"');
    });

    it('expands wildcard values before formatting', () => {
        assert.equal(
            formatClearSiteData(['*']),
            '"cache", "cookies", "storage", "executionContexts"',
        );
    });

    it('throws for semantic-invalid input', () => {
        assert.throws(() => formatClearSiteData([]), /at least one value/);
        assert.throws(() => formatClearSiteData(['futureType']), /Unknown Clear-Site-Data directive/);
    });

    it('round-trips parse and format for known directives', () => {
        const original = ['cache', 'cookies', 'storage'];
        const formatted = formatClearSiteData(original);
        const parsed = parseClearSiteData(formatted);
        assert.deepEqual(parsed, original);
    });
});
