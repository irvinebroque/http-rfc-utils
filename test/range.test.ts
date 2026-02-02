import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseRange,
    formatContentRange,
    parseContentRange,
    acceptRanges,
    evaluateRange,
} from '../src/range.js';

describe('Range Requests (RFC 9110 Sections 14.2-14.4, 13.1.5)', () => {
    it('parses byte-range-spec (RFC 9110 Section 14.1.2)', () => {
        const parsed = parseRange('bytes=0-99');
        assert.equal(parsed?.unit, 'bytes');
        assert.deepEqual(parsed?.ranges, [{ start: 0, end: 99 }]);
    });

    it('parses suffix byte-range-spec (RFC 9110 Section 14.1.2)', () => {
        const parsed = parseRange('bytes=-500');
        assert.equal(parsed?.unit, 'bytes');
        assert.deepEqual(parsed?.ranges, [{ start: -500, end: -1 }]);
    });

    it('parses open-ended byte-range-spec (RFC 9110 Section 14.1.2)', () => {
        const parsed = parseRange('bytes=500-');
        assert.equal(parsed?.unit, 'bytes');
        assert.deepEqual(parsed?.ranges, [{ start: 500, end: Number.POSITIVE_INFINITY }]);
    });

    it('rejects invalid range syntax (RFC 9110 Section 14.2)', () => {
        assert.equal(parseRange('bytes=abc'), null);
        assert.equal(parseRange('bytes=1-0'), null);
    });

    it('formats Content-Range (RFC 9110 Section 14.4)', () => {
        assert.equal(formatContentRange({ start: 0, end: 99 }, 200), 'bytes 0-99/200');
    });

    it('parses Content-Range (RFC 9110 Section 14.4)', () => {
        const parsed = parseContentRange('bytes 0-99/200');
        assert.deepEqual(parsed, {
            unit: 'bytes',
            range: { start: 0, end: 99 },
            size: 200,
        });
    });

    it('returns Accept-Ranges value (RFC 9110 Section 14.3)', () => {
        assert.equal(acceptRanges(), 'bytes');
        assert.equal(acceptRanges('none'), 'none');
    });

    it('evaluates a satisfiable range request (RFC 9110 Section 14.2)', () => {
        const request = new Request('https://example.com', {
            headers: { Range: 'bytes=0-9' },
        });

        const result = evaluateRange(request, 100);
        assert.equal(result.type, 'partial');
        assert.deepEqual(result.ranges, [{ start: 0, end: 9 }]);
        assert.equal(result.headers?.['Content-Range'], 'bytes 0-9/100');
    });

    it('returns unsatisfiable for out-of-range (RFC 9110 Section 15.5.17)', () => {
        const request = new Request('https://example.com', {
            headers: { Range: 'bytes=200-300' },
        });

        const result = evaluateRange(request, 100);
        assert.equal(result.type, 'unsatisfiable');
        assert.equal(result.headers?.['Content-Range'], 'bytes */100');
    });

    it('ignores Range when If-Range does not match (RFC 9110 Section 13.1.5)', () => {
        const request = new Request('https://example.com', {
            headers: {
                Range: 'bytes=0-9',
                'If-Range': '"mismatch"',
            },
        });

        const result = evaluateRange(request, 100, '"etag"');
        assert.equal(result.type, 'ignored');
    });

    it('honors Range when If-Range matches ETag (RFC 9110 Section 13.1.5)', () => {
        const request = new Request('https://example.com', {
            headers: {
                Range: 'bytes=0-9',
                'If-Range': '"etag"',
            },
        });

        const result = evaluateRange(request, 100, '"etag"');
        assert.equal(result.type, 'partial');
    });

    // RFC 9110 Section 13.1.5: If-Range can be an HTTP-date.
    it('honors Range when If-Range HTTP-date matches', () => {
        const lastModified = new Date('2024-01-10T00:00:00Z');
        const request = new Request('https://example.com', {
            headers: {
                Range: 'bytes=0-9',
                'If-Range': 'Mon, 15 Jan 2024 12:00:00 GMT',
            },
        });

        const result = evaluateRange(request, 100, undefined, lastModified);
        assert.equal(result.type, 'partial');
    });

    // RFC 9110 Section 14.2: Range applies to GET; others are ignored.
    it('ignores Range for non-GET requests', () => {
        const request = new Request('https://example.com', {
            method: 'POST',
            headers: {
                Range: 'bytes=0-9',
            },
        });

        const result = evaluateRange(request, 100);
        assert.equal(result.type, 'ignored');
    });
});
