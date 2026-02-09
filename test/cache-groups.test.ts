import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseCacheGroups,
    formatCacheGroups,
    parseCacheGroupInvalidation,
    formatCacheGroupInvalidation,
    sharesCacheGroup,
} from '../src/cache-groups.js';

// RFC 9875 §2: Cache-Groups is an SF List of Strings.
describe('parseCacheGroups', () => {
    it('parses a list of string members', () => {
        assert.deepEqual(parseCacheGroups('"scripts", "styles"'), ['scripts', 'styles']);
    });

    // RFC 9875 §2: unrecognized parameters are ignored.
    it('ignores member parameters for semantics', () => {
        assert.deepEqual(parseCacheGroups('"scripts";x=1, "styles";foo=?1'), ['scripts', 'styles']);
    });

    // RFC 9875 §2 + RFC 9651 §3.1: field must be an SF List whose members are Strings.
    it('rejects non-string members and inner lists', () => {
        assert.equal(parseCacheGroups('token'), null);
        assert.equal(parseCacheGroups('("scripts")'), null);
    });

    // RFC 9875 §2: implementations MUST support at least 32 groups and 32 chars/member.
    it('supports at least 32 groups with 32-character members', () => {
        const groups = Array.from({ length: 32 }, (_, index) => `${String(index).padStart(2, '0')}-${'g'.repeat(29)}`);
        const header = formatCacheGroups(groups);
        assert.deepEqual(parseCacheGroups(header), groups);
    });
});

// RFC 9875 §2: Cache-Groups serialization is an SF List of Strings.
describe('formatCacheGroups', () => {
    it('formats members as sf-string items', () => {
        assert.equal(formatCacheGroups(['scripts', 'styles']), '"scripts", "styles"');
    });
});

// RFC 9875 §3: Cache-Group-Invalidation is an SF List of Strings.
describe('parseCacheGroupInvalidation', () => {
    it('parses invalidation groups for unsafe methods', () => {
        assert.deepEqual(parseCacheGroupInvalidation('"news", "home"', 'POST'), ['news', 'home']);
    });

    // RFC 9875 §3: field MUST be ignored on responses to safe methods.
    it('ignores invalidation for safe methods', () => {
        assert.deepEqual(parseCacheGroupInvalidation('"news"', 'GET'), []);
        assert.deepEqual(parseCacheGroupInvalidation('"news"', 'HEAD'), []);
        assert.deepEqual(parseCacheGroupInvalidation('"news"', 'OPTIONS'), []);
        assert.deepEqual(parseCacheGroupInvalidation('"news"', 'TRACE'), []);
        assert.deepEqual(parseCacheGroupInvalidation('not-sf', 'get'), []);
    });

    // RFC 9875 §3: unrecognized parameters are ignored.
    it('ignores unrecognized parameters in invalidation members', () => {
        assert.deepEqual(parseCacheGroupInvalidation('"news";x=1', 'PATCH'), ['news']);
    });
});

// RFC 9875 §3: serialization is an SF List of Strings.
describe('formatCacheGroupInvalidation', () => {
    it('formats members as sf-string items', () => {
        assert.equal(formatCacheGroupInvalidation(['news', 'home']), '"news", "home"');
    });
});

// RFC 9875 §2.1: same-group match requires same-origin and case-sensitive group equality.
describe('sharesCacheGroup', () => {
    it('returns true when origins match and at least one group matches exactly', () => {
        assert.equal(
            sharesCacheGroup(
                ['scripts', 'styles'],
                'https://example.com:443',
                ['images', 'styles'],
                'https://example.com'
            ),
            true
        );
    });

    it('returns false when group names differ by case', () => {
        assert.equal(
            sharesCacheGroup(['Scripts'], 'https://example.com', ['scripts'], 'https://example.com'),
            false
        );
    });

    it('returns false when origins differ', () => {
        assert.equal(
            sharesCacheGroup(['scripts'], 'https://a.example', ['scripts'], 'https://b.example'),
            false
        );
    });

    it('accepts URL instances for origin comparison', () => {
        assert.equal(
            sharesCacheGroup(
                ['scripts'],
                new URL('https://example.com:443/path'),
                ['scripts'],
                new URL('https://example.com/other')
            ),
            true
        );
    });
});
