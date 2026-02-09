import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseTargetedCacheControl,
    formatTargetedCacheControl,
    parseCdnCacheControl,
    formatCdnCacheControl,
    selectTargetedCacheControl,
} from '../src/targeted-cache-control.js';

// RFC 9213 §2.1: Targeted cache-control fields are SF dictionaries.
describe('parseTargetedCacheControl', () => {
    it('parses known directives from an SF dictionary', () => {
        const parsed = parseTargetedCacheControl('max-age=60, no-store, must-revalidate');
        assert.deepEqual(parsed, {
            maxAge: 60,
            noStore: true,
            mustRevalidate: true,
        });
    });

    // RFC 9213 §2.1: directive parameters are ignored unless explicitly supported.
    it('ignores parameters on known directives', () => {
        const parsed = parseTargetedCacheControl('max-age=60;x=1, no-store;y=?1');
        assert.deepEqual(parsed, {
            maxAge: 60,
            noStore: true,
        });
    });

    // RFC 9213 §2.1: unknown extensions are preserved uninterpreted.
    it('preserves unknown extension members', () => {
        const parsed = parseTargetedCacheControl('max-age=60, foo;bar, ext=(1 2);a=?1');
        assert.deepEqual(parsed, {
            maxAge: 60,
            extensions: {
                foo: { value: true, params: { bar: true } },
                ext: { items: [{ value: 1 }, { value: 2 }], params: { a: true } },
            },
        });
    });

    // RFC 9213 §2.1: invalid/empty targeted field values are ignored.
    it('returns null for empty, invalid, and semantically empty values', () => {
        assert.equal(parseTargetedCacheControl(''), null);
        assert.equal(parseTargetedCacheControl('   '), null);
        assert.equal(parseTargetedCacheControl('max-age=60,,'), null);
        assert.equal(parseTargetedCacheControl('max-age=10.5'), null);
    });

    // RFC 9213 §2.1: known numeric directives use strict integer validation.
    it('rejects invalid numeric directives without coercion', () => {
        const parsed = parseTargetedCacheControl('max-age=10.5, stale-if-error=-1, s-maxage=300');
        assert.deepEqual(parsed, {
            sMaxAge: 300,
        });
    });
});

// RFC 9213 §2.1: serialization as SF dictionary.
describe('formatTargetedCacheControl', () => {
    it('serializes known directives in deterministic order', () => {
        const formatted = formatTargetedCacheControl({
            noStore: true,
            maxAge: 60,
            staleWhileRevalidate: 30,
        });
        assert.equal(formatted, 'no-store, max-age=60, stale-while-revalidate=30');
    });

    // RFC 9213 §2.1: unknown extension members are forwarded uninterpreted.
    it('serializes unknown extensions alongside known directives', () => {
        const formatted = formatTargetedCacheControl({
            maxAge: 60,
            extensions: {
                abc: { value: true },
                ext: { value: 9, params: { p: 1 } },
            },
        });
        assert.equal(formatted, 'max-age=60, abc, ext=9;p=1');
    });

    // RFC 9213 §2.1 + RFC 8941 §3.3.1: numeric members must be integers.
    it('throws on invalid known numeric directive values', () => {
        assert.throws(
            () => formatTargetedCacheControl({ maxAge: 10.5 }),
            /max-age/
        );
    });
});

// RFC 9213 §3.1: CDN-Cache-Control is a targeted cache-control field.
describe('CDN-Cache-Control helpers', () => {
    it('parseCdnCacheControl delegates to targeted parsing semantics', () => {
        assert.deepEqual(parseCdnCacheControl('max-age=300, no-store'), {
            maxAge: 300,
            noStore: true,
        });
    });

    it('formatCdnCacheControl delegates to targeted serialization semantics', () => {
        assert.equal(
            formatCdnCacheControl({ sMaxAge: 120, immutable: true }),
            's-maxage=120, immutable'
        );
    });
});

// RFC 9213 §2.2: target-list selection and fallback behavior.
describe('selectTargetedCacheControl', () => {
    it('uses first valid non-empty targeted field in target-list order', () => {
        const selection = selectTargetedCacheControl(
            ['examplecdn-cache-control', 'cdn-cache-control', 'surrogate-control'],
            {
                'ExampleCDN-Cache-Control': 'max-age=10.5',
                'CDN-Cache-Control': 'max-age=300',
                'Surrogate-Control': 'max-age=100',
                'Cache-Control': 'max-age=30',
            }
        );

        assert.deepEqual(selection, {
            source: 'targeted',
            fieldName: 'cdn-cache-control',
            targeted: { maxAge: 300 },
            fallback: null,
        });
    });

    it('falls back to Cache-Control when no targeted field is usable', () => {
        const selection = selectTargetedCacheControl(
            ['cdn-cache-control', 'surrogate-control'],
            {
                'CDN-Cache-Control': '',
                'Surrogate-Control': 'max-age=5.5',
                'Cache-Control': 'public, max-age=60',
            }
        );

        assert.deepEqual(selection, {
            source: 'fallback',
            fieldName: null,
            targeted: null,
            fallback: 'public, max-age=60',
        });
    });

    it('uses explicit fallback override when provided', () => {
        const selection = selectTargetedCacheControl(
            ['cdn-cache-control'],
            {
                'CDN-Cache-Control': 'max-age=10.5',
                'Cache-Control': 'max-age=60',
            },
            'private, max-age=0'
        );

        assert.deepEqual(selection, {
            source: 'fallback',
            fieldName: null,
            targeted: null,
            fallback: 'private, max-age=0',
        });
    });

    it('supports Headers as input and returns none when all inputs are empty', () => {
        const headers = new Headers();
        headers.set('CDN-Cache-Control', ' ');
        headers.set('Cache-Control', '');

        const selection = selectTargetedCacheControl(['cdn-cache-control'], headers);
        assert.deepEqual(selection, {
            source: 'none',
            fieldName: null,
            targeted: null,
            fallback: null,
        });
    });
});
