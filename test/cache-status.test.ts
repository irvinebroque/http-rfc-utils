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

    it('preserves list member order (RFC 9211 Section 2)', () => {
        const parsed = parseCacheStatus('"Origin"; hit, "Edge"; fwd=stale');
        assert.equal(parsed?.[0]?.cache, 'Origin');
        assert.equal(parsed?.[1]?.cache, 'Edge');
    });

    it('rejects inner lists (RFC 9211 Section 2)', () => {
        const parsed = parseCacheStatus('("cache")');
        assert.equal(parsed, null);
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
});
