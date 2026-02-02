import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    cacheControl,
    getCacheHeaders,
    parseCacheControl,
    CachePresets,
} from '../src/cache.js';

// RFC 9111 §5.2: Cache-Control directives and formatting.
describe('cacheControl', () => {
    it('returns empty string for empty options', () => {
        assert.equal(cacheControl({}), '');
    });

    it('handles single boolean directive', () => {
        assert.equal(cacheControl({ public: true }), 'public');
    });

    it('handles multiple directives', () => {
        assert.equal(
            cacheControl({ public: true, maxAge: 3600 }),
            'public, max-age=3600'
        );
    });

    describe('directive order', () => {
        it('outputs directives in RFC-conventional order', () => {
            const result = cacheControl({
                public: true,
                noCache: true,
                noStore: true,
                maxAge: 3600,
                sMaxAge: 7200,
                mustRevalidate: true,
                proxyRevalidate: true,
                immutable: true,
                staleWhileRevalidate: 60,
                staleIfError: 300,
            });
            assert.equal(
                result,
                'public, no-cache, no-store, max-age=3600, s-maxage=7200, must-revalidate, proxy-revalidate, immutable, stale-while-revalidate=60, stale-if-error=300'
            );
        });
    });

    describe('numeric directives', () => {
        it('handles maxAge', () => {
            assert.equal(cacheControl({ maxAge: 3600 }), 'max-age=3600');
        });

        it('handles sMaxAge', () => {
            assert.equal(cacheControl({ sMaxAge: 7200 }), 's-maxage=7200');
        });

        it('handles staleWhileRevalidate', () => {
            assert.equal(
                cacheControl({ staleWhileRevalidate: 60 }),
                'stale-while-revalidate=60'
            );
        });

        it('handles staleIfError', () => {
            assert.equal(
                cacheControl({ staleIfError: 300 }),
                'stale-if-error=300'
            );
        });

        it('floors fractional values', () => {
            assert.equal(cacheControl({ maxAge: 3600.9 }), 'max-age=3600');
        });

        it('handles zero values', () => {
            assert.equal(cacheControl({ maxAge: 0 }), 'max-age=0');
        });

        it('ignores negative values', () => {
            assert.equal(cacheControl({ maxAge: -1 }), '');
        });
    });

    describe('boolean directives', () => {
        it('handles noCache', () => {
            assert.equal(cacheControl({ noCache: true }), 'no-cache');
        });

        it('handles noStore', () => {
            assert.equal(cacheControl({ noStore: true }), 'no-store');
        });

        it('handles mustRevalidate', () => {
            assert.equal(cacheControl({ mustRevalidate: true }), 'must-revalidate');
        });

        it('handles proxyRevalidate', () => {
            assert.equal(cacheControl({ proxyRevalidate: true }), 'proxy-revalidate');
        });

        it('handles immutable', () => {
            assert.equal(cacheControl({ immutable: true }), 'immutable');
        });

        // RFC 9111 Section 5.2.2.4: no-cache supports field-name lists.
        it('formats no-cache field list as quoted-string', () => {
            const result = cacheControl({
                noCache: true,
                noCacheFields: ['set-cookie', 'x-token'],
            });
            assert.equal(result, 'no-cache="set-cookie, x-token"');
        });

        // RFC 9111 Section 5.2.2.7: private supports field-name lists.
        it('formats private field list as quoted-string', () => {
            const result = cacheControl({
                private: true,
                privateFields: ['authorization'],
            });
            assert.equal(result, 'private="authorization"');
        });

        it('ignores false boolean directives', () => {
            assert.equal(cacheControl({ public: false, noCache: false }), '');
        });
    });

    describe('private directive', () => {
        it('handles private', () => {
            assert.equal(cacheControl({ private: true }), 'private');
        });

        it('combines private with other directives', () => {
            assert.equal(
                cacheControl({ private: true, maxAge: 0, mustRevalidate: true }),
                'private, max-age=0, must-revalidate'
            );
        });
    });

    describe('mutual exclusion', () => {
        it('private takes precedence over public', () => {
            const result = cacheControl({ public: true, private: true });
            assert.equal(result, 'private');
            assert.ok(!result.includes('public'));
        });

        it('does not include both public and private', () => {
            const result = cacheControl({ public: true, private: true, maxAge: 3600 });
            const directives = result.split(', ');
            const hasPublic = directives.includes('public');
            const hasPrivate = directives.includes('private');
            assert.ok(!(hasPublic && hasPrivate), 'should not have both public and private');
        });
    });
});

// RFC 9111 §5.2.2: Response Cache-Control directives.
// RFC 9110 §8.8.2, §8.8.3, §5.6.7: Last-Modified/ETag/HTTP-date.
describe('getCacheHeaders', () => {
    const etag = '"abc123"';
    const lastModified = new Date('2024-01-15T12:00:00Z');

    it('returns Cache-Control, ETag, and Last-Modified headers', () => {
        const headers = getCacheHeaders(etag, lastModified);
        assert.ok('Cache-Control' in headers);
        assert.ok('ETag' in headers);
        assert.ok('Last-Modified' in headers);
    });

    it('uses default options when none provided', () => {
        const headers = getCacheHeaders(etag, lastModified);
        assert.equal(headers['Cache-Control'], 'public, max-age=0, must-revalidate');
    });

    it('respects custom options', () => {
        const headers = getCacheHeaders(etag, lastModified, {
            private: true,
            maxAge: 3600,
        });
        assert.equal(headers['Cache-Control'], 'private, max-age=3600');
    });

    it('includes correct ETag value', () => {
        const headers = getCacheHeaders(etag, lastModified);
        assert.equal(headers['ETag'], '"abc123"');
    });

    it('formats Last-Modified as HTTP-date', () => {
        const headers = getCacheHeaders(etag, lastModified);
        // HTTP-date format: "Mon, 15 Jan 2024 12:00:00 GMT"
        assert.equal(headers['Last-Modified'], 'Mon, 15 Jan 2024 12:00:00 GMT');
    });

    it('handles different dates correctly', () => {
        const date = new Date('2023-06-20T18:30:45Z');
        const headers = getCacheHeaders(etag, date);
        assert.equal(headers['Last-Modified'], 'Tue, 20 Jun 2023 18:30:45 GMT');
    });
});

// RFC 9111 §5.2: Cache-Control parsing and directive handling.
// RFC 9111 §1.2.2: delta-seconds.
describe('parseCacheControl', () => {
    it('parses single boolean directive', () => {
        const result = parseCacheControl('public');
        assert.deepEqual(result, { public: true });
    });

    it('parses directive with value', () => {
        const result = parseCacheControl('max-age=3600');
        assert.deepEqual(result, { maxAge: 3600 });
    });

    // RFC 9111 Section 5.2.2.4: no-cache field-name list parsing.
    it('parses no-cache field-name list', () => {
        const result = parseCacheControl('no-cache="set-cookie, x-token"');
        assert.deepEqual(result, {
            noCache: true,
            noCacheFields: ['set-cookie', 'x-token'],
        });
    });

    // RFC 9111 Section 5.2.2.7: private field-name list parsing.
    it('parses private field-name list', () => {
        const result = parseCacheControl('private="authorization"');
        assert.deepEqual(result, {
            private: true,
            privateFields: ['authorization'],
        });
    });

    it('parses multiple directives', () => {
        const result = parseCacheControl('public, max-age=3600, must-revalidate');
        assert.deepEqual(result, {
            public: true,
            maxAge: 3600,
            mustRevalidate: true,
        });
    });

    it('handles whitespace around equals sign', () => {
        const result = parseCacheControl('max-age = 3600');
        assert.deepEqual(result, { maxAge: 3600 });
    });

    it('handles extra whitespace between directives', () => {
        const result = parseCacheControl('public,   max-age=3600,  no-cache');
        assert.deepEqual(result, {
            public: true,
            maxAge: 3600,
            noCache: true,
        });
    });

    it('ignores unknown directives', () => {
        const result = parseCacheControl('public, unknown-directive, max-age=3600');
        assert.deepEqual(result, {
            public: true,
            maxAge: 3600,
        });
    });

    it('returns empty object for empty string', () => {
        const result = parseCacheControl('');
        assert.deepEqual(result, {});
    });

    it('is case-insensitive', () => {
        const result = parseCacheControl('PUBLIC, Max-Age=3600, NO-CACHE');
        assert.deepEqual(result, {
            public: true,
            maxAge: 3600,
            noCache: true,
        });
    });

    it('parses all known directives', () => {
        const result = parseCacheControl(
            'private, no-cache, no-store, max-age=100, s-maxage=200, must-revalidate, proxy-revalidate, immutable, stale-while-revalidate=60, stale-if-error=300'
        );
        assert.deepEqual(result, {
            private: true,
            noCache: true,
            noStore: true,
            maxAge: 100,
            sMaxAge: 200,
            mustRevalidate: true,
            proxyRevalidate: true,
            immutable: true,
            staleWhileRevalidate: 60,
            staleIfError: 300,
        });
    });

    it('ignores invalid numeric values', () => {
        const result = parseCacheControl('max-age=invalid');
        assert.deepEqual(result, {});
    });

    // RFC 9111 Section 1.2.2 (delta-seconds)
    it('ignores fractional delta-seconds', () => {
        const result = parseCacheControl('max-age=10.5');
        assert.deepEqual(result, {});
    });

    // RFC 9111 Section 1.2.2 (delta-seconds)
    it('clamps delta-seconds overflow', () => {
        const result = parseCacheControl('max-age=99999999999');
        assert.deepEqual(result, { maxAge: 2147483648 });
    });

    it('ignores negative numeric values', () => {
        const result = parseCacheControl('max-age=-100');
        assert.deepEqual(result, {});
    });
});

// RFC 9111 §5.2.2: Response Cache-Control directives.
describe('CachePresets', () => {
    it('noStore preset is correct', () => {
        assert.deepEqual(CachePresets.noStore, { noStore: true });
    });

    it('revalidate preset is correct', () => {
        assert.deepEqual(CachePresets.revalidate, {
            public: true,
            maxAge: 0,
            mustRevalidate: true,
        });
    });

    it('shortTerm preset is correct (1 hour)', () => {
        assert.deepEqual(CachePresets.shortTerm, {
            public: true,
            maxAge: 3600,
        });
    });

    it('mediumTerm preset is correct (1 day)', () => {
        assert.deepEqual(CachePresets.mediumTerm, {
            public: true,
            maxAge: 86400,
        });
    });

    it('immutable preset is correct (1 year)', () => {
        assert.deepEqual(CachePresets.immutable, {
            public: true,
            maxAge: 31536000,
            immutable: true,
        });
    });

    it('private preset is correct', () => {
        assert.deepEqual(CachePresets.private, {
            private: true,
            maxAge: 0,
            mustRevalidate: true,
        });
    });

    it('presets generate expected Cache-Control strings', () => {
        assert.equal(cacheControl(CachePresets.noStore), 'no-store');
        assert.equal(cacheControl(CachePresets.revalidate), 'public, max-age=0, must-revalidate');
        assert.equal(cacheControl(CachePresets.shortTerm), 'public, max-age=3600');
        assert.equal(cacheControl(CachePresets.mediumTerm), 'public, max-age=86400');
        assert.equal(cacheControl(CachePresets.immutable), 'public, max-age=31536000, immutable');
        assert.equal(cacheControl(CachePresets.private), 'private, max-age=0, must-revalidate');
    });
});

// RFC 9111 §5.2: Cache-Control formatting/parsing round-trip.
describe('round-trip', () => {
    it('parseCacheControl(cacheControl(options)) produces equivalent options', () => {
        const original = {
            public: true,
            maxAge: 3600,
            mustRevalidate: true,
        };
        const header = cacheControl(original);
        const parsed = parseCacheControl(header);
        assert.deepEqual(parsed, original);
    });

    it('round-trips complex options', () => {
        const original = {
            private: true,
            noCache: true,
            maxAge: 0,
            sMaxAge: 600,
            mustRevalidate: true,
            staleWhileRevalidate: 60,
            staleIfError: 300,
        };
        const header = cacheControl(original);
        const parsed = parseCacheControl(header);
        assert.deepEqual(parsed, original);
    });

    it('round-trips immutable preset', () => {
        const header = cacheControl(CachePresets.immutable);
        const parsed = parseCacheControl(header);
        assert.deepEqual(parsed, CachePresets.immutable);
    });

    it('round-trips all boolean directives', () => {
        const original = {
            public: true,
            noCache: true,
            noStore: true,
            mustRevalidate: true,
            proxyRevalidate: true,
            immutable: true,
        };
        const header = cacheControl(original);
        const parsed = parseCacheControl(header);
        assert.deepEqual(parsed, original);
    });

    it('handles false booleans in original (not present in round-trip)', () => {
        const original = {
            public: true,
            noCache: false,
            maxAge: 3600,
        };
        const header = cacheControl(original);
        const parsed = parseCacheControl(header);
        // parsed won't have noCache at all since it wasn't in the header
        assert.deepEqual(parsed, {
            public: true,
            maxAge: 3600,
        });
    });
});
