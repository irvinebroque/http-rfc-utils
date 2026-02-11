/**
 * Tests for pagination behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_LIMIT,
    MAX_LIMIT,
    parsePaginationParams,
    decodeCursor,
    encodeCursor,
    buildPaginationLinks,
    lastPageOffset,
    isFirstPage,
    isLastPage,
} from '../src/pagination.js';
import { isPaginationError, isPaginationParams } from '../src/types.js';

// Non-RFC: Pagination defaults.
describe('Constants', () => {
    it('DEFAULT_LIMIT equals 50', () => {
        assert.equal(DEFAULT_LIMIT, 50);
    });

    it('MAX_LIMIT equals 100', () => {
        assert.equal(MAX_LIMIT, 100);
    });
});

// Non-RFC: Cursor encoding helpers.
describe('Cursor encoding/decoding', () => {
    describe('encodeCursor', () => {
        it('produces base64 string', () => {
            const cursor = encodeCursor(42);
            // Base64 strings only contain [A-Za-z0-9+/=]
            assert.match(cursor, /^[A-Za-z0-9+/=]+$/);
            // Should decode to valid JSON
            const decoded = atob(cursor);
            assert.doesNotThrow(() => JSON.parse(decoded));
        });
    });

    describe('decodeCursor', () => {
        it('reverses encodeCursor', () => {
            const cursor = encodeCursor(42);
            const decoded = decodeCursor(cursor);
            assert.deepEqual(decoded, { offset: 42 });
        });

        it('round-trip: decodeCursor(encodeCursor(n)) equals { offset: n }', () => {
            const testValues = [0, 1, 50, 100, 999, 10000];
            for (const n of testValues) {
                const result = decodeCursor(encodeCursor(n));
                assert.deepEqual(result, { offset: n }, `Failed for offset ${n}`);
            }
        });

        it('returns null for invalid base64', () => {
            const result = decodeCursor('not-valid-base64!!!');
            assert.equal(result, null);
        });

        it('returns null for non-JSON payload', () => {
            const cursor = btoa('not json at all');
            const result = decodeCursor(cursor);
            assert.equal(result, null);
        });

        it('returns null for missing offset field', () => {
            const cursor = btoa(JSON.stringify({ page: 5 }));
            const result = decodeCursor(cursor);
            assert.equal(result, null);
        });

        it('returns null for negative offset', () => {
            const cursor = btoa(JSON.stringify({ offset: -10 }));
            const result = decodeCursor(cursor);
            assert.equal(result, null);
        });

        it('returns null for non-integer offset (e.g., 1.5)', () => {
            const cursor = btoa(JSON.stringify({ offset: 1.5 }));
            const result = decodeCursor(cursor);
            assert.equal(result, null);
        });

        it('returns null for empty string', () => {
            const result = decodeCursor('');
            assert.equal(result, null);
        });

        it('returns null for offset as string', () => {
            const cursor = btoa(JSON.stringify({ offset: '42' }));
            const result = decodeCursor(cursor);
            assert.equal(result, null);
        });

        it('returns null for offset as null', () => {
            const cursor = btoa(JSON.stringify({ offset: null }));
            const result = decodeCursor(cursor);
            assert.equal(result, null);
        });
    });
});

// Non-RFC: Pagination query parameter parsing.
describe('parsePaginationParams', () => {
    const makeUrl = (params: Record<string, string> = {}) => {
        const url = new URL('https://example.com/items');
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        return url;
    };

    describe('defaults and basic extraction', () => {
        it('uses default limit when not specified', () => {
            const result = parsePaginationParams(makeUrl());
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, DEFAULT_LIMIT);
            assert.equal(result.offset, 0);
        });

        it('extracts limit from query params', () => {
            const result = parsePaginationParams(makeUrl({ limit: '25' }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, 25);
        });

        it('extracts offset from query params', () => {
            const result = parsePaginationParams(makeUrl({ offset: '100' }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.offset, 100);
        });

        it('extracts sort from query params', () => {
            const result = parsePaginationParams(makeUrl({ sort: '-createdAt' }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.sort, '-createdAt');
        });

        it('does not include sort when not specified', () => {
            const result = parsePaginationParams(makeUrl());
            assert.ok(isPaginationParams(result));
            assert.equal(result.sort, undefined);
        });
    });

    describe('limit clamping', () => {
        it('clamps limit to MAX_LIMIT', () => {
            const result = parsePaginationParams(makeUrl({ limit: '500' }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, MAX_LIMIT);
        });

        it('clamps limit minimum to 1', () => {
            const result = parsePaginationParams(makeUrl({ limit: '0' }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, 1);
        });

        it('clamps negative limit to 1', () => {
            const result = parsePaginationParams(makeUrl({ limit: '-5' }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, 1);
        });

        it('floors fractional limit', () => {
            const result = parsePaginationParams(makeUrl({ limit: '25.9' }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, 25);
        });
    });

    describe('cursor handling', () => {
        it('decodes cursor and extracts offset', () => {
            const cursor = encodeCursor(75);
            const result = parsePaginationParams(makeUrl({ cursor }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.offset, 75);
        });

        it('cursor takes precedence over offset param', () => {
            const cursor = encodeCursor(75);
            const result = parsePaginationParams(makeUrl({ cursor, offset: '100' }));
            assert.ok(isPaginationParams(result));
            assert.equal(result.offset, 75);
        });

        it('returns error for invalid cursor', () => {
            const result = parsePaginationParams(makeUrl({ cursor: 'invalid!!!' }));
            assert.ok(isPaginationError(result));
            assert.equal(result.error, 'invalid_cursor');
        });
    });

    describe('error cases', () => {
        it('returns error for non-numeric limit', () => {
            const result = parsePaginationParams(makeUrl({ limit: 'abc' }));
            assert.ok(isPaginationError(result));
            assert.equal(result.error, 'invalid_limit');
        });

        it('returns error for negative offset', () => {
            const result = parsePaginationParams(makeUrl({ offset: '-10' }));
            assert.ok(isPaginationError(result));
            assert.equal(result.error, 'invalid_offset');
        });

        it('returns error for non-numeric offset', () => {
            const result = parsePaginationParams(makeUrl({ offset: 'xyz' }));
            assert.ok(isPaginationError(result));
            assert.equal(result.error, 'invalid_offset');
        });
    });

    describe('custom options', () => {
        it('respects custom defaultLimit option', () => {
            const result = parsePaginationParams(makeUrl(), { defaultLimit: 20 });
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, 20);
        });

        it('respects custom maxLimit option', () => {
            const result = parsePaginationParams(makeUrl({ limit: '200' }), { maxLimit: 150 });
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, 150);
        });

        it('custom maxLimit clamps values correctly', () => {
            const result = parsePaginationParams(makeUrl({ limit: '50' }), { maxLimit: 30 });
            assert.ok(isPaginationParams(result));
            assert.equal(result.limit, 30);
        });
    });
});

// RFC 8288 §3, §3.3: Link header relation targets for pagination.
describe('buildPaginationLinks', () => {
    const baseUrl = 'https://example.com/items';

    describe('required links', () => {
        it('includes self, first, and last always', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 50);
            assert.ok('self' in links);
            assert.ok('first' in links);
            assert.ok('last' in links);
        });

        it('self link contains current offset', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 50);
            const selfUrl = new URL(links.self);
            const cursor = selfUrl.searchParams.get('cursor');
            assert.ok(cursor);
            const decoded = decodeCursor(cursor);
            assert.deepEqual(decoded, { offset: 50 });
        });

        it('first link contains offset 0', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 50);
            const firstUrl = new URL(links.first);
            const cursor = firstUrl.searchParams.get('cursor');
            assert.ok(cursor);
            const decoded = decodeCursor(cursor);
            assert.deepEqual(decoded, { offset: 0 });
        });

        it('last link contains correct last page offset', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 0);
            const lastUrl = new URL(links.last);
            const cursor = lastUrl.searchParams.get('cursor');
            assert.ok(cursor);
            const decoded = decodeCursor(cursor);
            assert.deepEqual(decoded, { offset: 90 });
        });
    });

    describe('prev link', () => {
        it('omits prev on first page (offset=0)', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 0);
            assert.equal(links.prev, undefined);
        });

        it('includes prev on non-first pages', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 20);
            assert.ok(links.prev);
            const prevUrl = new URL(links.prev);
            const cursor = prevUrl.searchParams.get('cursor');
            assert.ok(cursor);
            const decoded = decodeCursor(cursor);
            assert.deepEqual(decoded, { offset: 10 });
        });
    });

    describe('next link', () => {
        it('omits next on last page', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 90);
            assert.equal(links.next, undefined);
        });

        it('omits next when offset + limit >= totalCount', () => {
            const links = buildPaginationLinks(baseUrl, 95, 10, 90);
            assert.equal(links.next, undefined);
        });

        it('includes next on non-last pages', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 50);
            assert.ok(links.next);
            const nextUrl = new URL(links.next);
            const cursor = nextUrl.searchParams.get('cursor');
            assert.ok(cursor);
            const decoded = decodeCursor(cursor);
            assert.deepEqual(decoded, { offset: 60 });
        });
    });

    describe('middle pages', () => {
        it('includes prev and next on middle pages', () => {
            const links = buildPaginationLinks(baseUrl, 100, 10, 50);
            assert.ok(links.prev);
            assert.ok(links.next);
        });
    });

    describe('extra params', () => {
        it('preserves extra query params in all links', () => {
            const extraParams = new URLSearchParams();
            extraParams.set('sort', '-date');
            extraParams.set('filter', 'active');

            const links = buildPaginationLinks(baseUrl, 100, 10, 50, extraParams);

            for (const [name, href] of Object.entries(links)) {
                if (href) {
                    const url = new URL(href);
                    assert.equal(url.searchParams.get('sort'), '-date', `${name} missing sort`);
                    assert.equal(url.searchParams.get('filter'), 'active', `${name} missing filter`);
                }
            }
        });

        it('does not duplicate pagination params from extraParams', () => {
            const extraParams = new URLSearchParams();
            extraParams.set('cursor', 'should-be-ignored');
            extraParams.set('limit', '999');
            extraParams.set('offset', '999');
            extraParams.set('sort', '-date');

            const links = buildPaginationLinks(baseUrl, 100, 10, 50, extraParams);
            const selfUrl = new URL(links.self);

            // Limit should be the actual limit, not the extra param
            assert.equal(selfUrl.searchParams.get('limit'), '10');
            // Sort should still be preserved
            assert.equal(selfUrl.searchParams.get('sort'), '-date');
        });
    });

    describe('edge cases', () => {
        it('handles single-page results (prev and next both omitted)', () => {
            const links = buildPaginationLinks(baseUrl, 5, 10, 0);
            assert.equal(links.prev, undefined);
            assert.equal(links.next, undefined);
            assert.ok(links.self);
            assert.ok(links.first);
            assert.ok(links.last);
        });

        it('handles empty results (totalCount=0)', () => {
            const links = buildPaginationLinks(baseUrl, 0, 10, 0);
            assert.equal(links.prev, undefined);
            assert.equal(links.next, undefined);
            assert.ok(links.self);
            assert.ok(links.first);
            assert.ok(links.last);

            // Last page should be offset 0 for empty results
            const lastUrl = new URL(links.last);
            const cursor = lastUrl.searchParams.get('cursor');
            assert.ok(cursor);
            const decoded = decodeCursor(cursor);
            assert.deepEqual(decoded, { offset: 0 });
        });

        it('calculates last page offset correctly', () => {
            // 101 items, 10 per page = last page starts at 100
            const links = buildPaginationLinks(baseUrl, 101, 10, 0);
            const lastUrl = new URL(links.last);
            const cursor = lastUrl.searchParams.get('cursor');
            assert.ok(cursor);
            const decoded = decodeCursor(cursor);
            assert.deepEqual(decoded, { offset: 100 });
        });

        it('all links include limit parameter', () => {
            const links = buildPaginationLinks(baseUrl, 100, 25, 50);

            for (const [name, href] of Object.entries(links)) {
                if (href) {
                    const url = new URL(href);
                    assert.equal(url.searchParams.get('limit'), '25', `${name} missing limit`);
                }
            }
        });
    });
});

// Non-RFC: Pagination helper calculations.
describe('Helper functions', () => {
    describe('lastPageOffset', () => {
        it('lastPageOffset(100, 10) equals 90', () => {
            assert.equal(lastPageOffset(100, 10), 90);
        });

        it('lastPageOffset(101, 10) equals 100', () => {
            assert.equal(lastPageOffset(101, 10), 100);
        });

        it('lastPageOffset(0, 10) equals 0', () => {
            assert.equal(lastPageOffset(0, 10), 0);
        });

        it('lastPageOffset(5, 10) equals 0 (less than page size)', () => {
            assert.equal(lastPageOffset(5, 10), 0);
        });

        it('lastPageOffset(10, 10) equals 0 (exactly one page)', () => {
            assert.equal(lastPageOffset(10, 10), 0);
        });

        it('lastPageOffset(11, 10) equals 10 (one item on last page)', () => {
            assert.equal(lastPageOffset(11, 10), 10);
        });

        it('handles negative totalCount as 0', () => {
            assert.equal(lastPageOffset(-5, 10), 0);
        });
    });

    describe('isFirstPage', () => {
        it('isFirstPage(0) equals true', () => {
            assert.equal(isFirstPage(0), true);
        });

        it('isFirstPage(10) equals false', () => {
            assert.equal(isFirstPage(10), false);
        });

        it('isFirstPage(1) equals false', () => {
            assert.equal(isFirstPage(1), false);
        });
    });

    describe('isLastPage', () => {
        it('isLastPage(90, 10, 100) equals true', () => {
            assert.equal(isLastPage(90, 10, 100), true);
        });

        it('isLastPage(80, 10, 100) equals false', () => {
            assert.equal(isLastPage(80, 10, 100), false);
        });

        it('isLastPage(0, 10, 5) equals true (single page)', () => {
            assert.equal(isLastPage(0, 10, 5), true);
        });

        it('isLastPage(0, 10, 0) equals true (empty results)', () => {
            assert.equal(isLastPage(0, 10, 0), true);
        });

        it('isLastPage(90, 10, 95) equals true (partial last page)', () => {
            assert.equal(isLastPage(90, 10, 95), true);
        });

        it('isLastPage(100, 10, 100) equals true (offset at exact end)', () => {
            assert.equal(isLastPage(100, 10, 100), true);
        });
    });
});

// Non-RFC: Pagination type guards.
describe('Type guards', () => {
    describe('isPaginationError', () => {
        it('returns true for error objects', () => {
            const error = { error: 'invalid_cursor', message: 'Invalid cursor' };
            assert.equal(isPaginationError(error), true);
        });

        it('returns false for params objects', () => {
            const params = { limit: 50, offset: 0 };
            assert.equal(isPaginationError(params), false);
        });
    });

    describe('isPaginationParams', () => {
        it('returns true for params objects', () => {
            const params = { limit: 50, offset: 0 };
            assert.equal(isPaginationParams(params), true);
        });

        it('returns true for params with sort', () => {
            const params = { limit: 50, offset: 0, sort: '-date' };
            assert.equal(isPaginationParams(params), true);
        });

        it('returns false for error objects', () => {
            const error = { error: 'invalid_cursor', message: 'Invalid cursor' };
            assert.equal(isPaginationParams(error), false);
        });
    });
});
