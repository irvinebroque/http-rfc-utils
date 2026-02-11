/**
 * Tests for cache status behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCacheStatus, formatCacheStatus } from '../src/cache-status.js';

describe('Cache-Status (RFC 9211 Section 2)', () => {
    it('parses a cache hit example (RFC 9211 Section 3)', () => {
        const parsed = parseCacheStatus('"ExampleCache"; hit');
        assert.deepEqual(parsed, [{
            cache: 'ExampleCache',
            params: { hit: true },
        }]);
    });

    it('parses fwd and ttl values (RFC 9211 Section 2.2, 2.4)', () => {
        const parsed = parseCacheStatus('"ExampleCache"; fwd=uri-miss; ttl=-412');
        assert.deepEqual(parsed, [{
            cache: 'ExampleCache',
            params: { fwd: 'uri-miss', ttl: -412 },
        }]);
    });

    it('parses fwd-status and boolean parameters (RFC 9211 Section 2.3, 2.5, 2.6)', () => {
        const parsed = parseCacheStatus('"Edge"; fwd-status=504; stored; collapsed');
        assert.deepEqual(parsed, [{
            cache: 'Edge',
            params: { fwdStatus: 504, stored: true, collapsed: true },
        }]);
    });

    // RFC 9211 §2.8: detail accepts string or token form.
    it('parses detail parameter in token form', () => {
        const parsed = parseCacheStatus('Edge; detail=MEMORY');
        assert.deepEqual(parsed, [{
            cache: 'Edge',
            params: { detail: 'MEMORY' },
        }]);
    });

    it('preserves list member order (RFC 9211 Section 2)', () => {
        const parsed = parseCacheStatus('"Origin"; hit, "Edge"; fwd=stale');
        assert.equal(parsed?.[0]?.cache, 'Origin');
        assert.equal(parsed?.[1]?.cache, 'Edge');
    });

    it('rejects inner lists (RFC 9211 Section 2)', () => {
        const parsed = parseCacheStatus('("cache")');
        assert.equal(parsed, null);
    });

    it('rejects non-string or non-token cache members (RFC 9211 Section 2)', () => {
        const parsed = parseCacheStatus('1; hit');
        assert.equal(parsed, null);
    });

    it('ignores invalid known parameter types but preserves extensions (RFC 9211 Section 2)', () => {
        const parsed = parseCacheStatus('"Edge"; fwd="uri-miss"; fwd-status=200.5; ttl=1.2; key=token; detail=?1; x=1');
        assert.deepEqual(parsed, [{
            cache: 'Edge',
            params: {
                extensions: { x: 1 },
            },
        }]);
    });

    // RFC 8941 §3.3.4: Tokens can contain uppercase letters, so cache names
    // like "ExampleCache" are output as unquoted tokens (not quoted strings).
    it('formats Cache-Status entries (RFC 9211 Section 2)', () => {
        const formatted = formatCacheStatus([
            { cache: 'ExampleCache', params: { hit: true, ttl: 120 } },
            { cache: 'Edge', params: { fwd: 'stale' } },
        ]);
        assert.equal(formatted, 'ExampleCache;hit;ttl=120, Edge;fwd=stale');
    });

    it('formats fwd-status, stored, collapsed, key, and detail (RFC 9211 Section 2)', () => {
        const formatted = formatCacheStatus([
            {
                cache: 'Edge',
                params: {
                    fwdStatus: 504,
                    stored: true,
                    collapsed: true,
                    key: 'cache-key',
                    detail: 'stale response reused',
                },
            },
        ]);
        assert.equal(formatted, 'Edge;fwd-status=504;stored;collapsed;key="cache-key";detail="stale response reused"');
    });

    it('round-trips token-form detail as typed detail value', () => {
        const parsed = parseCacheStatus('Edge;detail=MEMORY');
        assert.ok(parsed);
        const formatted = formatCacheStatus(parsed);
        const reparsed = parseCacheStatus(formatted);
        assert.deepEqual(reparsed, parsed);
    });

    it('round-trips token cache names (RFC 9211 Section 2)', () => {
        const parsed = parseCacheStatus('Edge;hit;fwd=uri-miss');
        assert.deepEqual(parsed, [{
            cache: 'Edge',
            params: {
                hit: true,
                fwd: 'uri-miss',
            },
        }]);
    });

    it('throws for invalid fwd token values (RFC 9211 Section 2.2)', () => {
        assert.throws(() => {
            formatCacheStatus([{ cache: 'Edge', params: { fwd: 'uri miss' } }]);
        }, /Invalid Cache-Status fwd token/);

        assert.throws(() => {
            formatCacheStatus([{ cache: 'Edge', params: { fwd: 'Uri-Miss' } }]);
        }, /Invalid Cache-Status fwd token/);
    });

    it('throws for non-integer fwd-status and ttl values (RFC 9211 Section 2.3/2.4)', () => {
        assert.throws(() => {
            formatCacheStatus([{ cache: 'Edge', params: { fwdStatus: 200.5 } }]);
        }, /Invalid Cache-Status fwd-status value/);

        assert.throws(() => {
            formatCacheStatus([{ cache: 'Edge', params: { ttl: 1.5 } }]);
        }, /Invalid Cache-Status ttl value/);
    });

    it('preserves extension parameters while protecting known keys (RFC 9211 Section 2)', () => {
        const formatted = formatCacheStatus([
            {
                cache: 'Edge',
                params: {
                    hit: true,
                    extensions: {
                        x: 'one',
                        ttl: 999,
                    },
                },
            },
        ]);

        const parsed = parseCacheStatus(formatted);
        assert.deepEqual(parsed, [{
            cache: 'Edge',
            params: {
                hit: true,
                extensions: { x: 'one' },
            },
        }]);
    });
});
