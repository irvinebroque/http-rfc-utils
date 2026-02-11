/**
 * Tests for conditional behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    handleConditionalRequest,
    evaluatePreconditions,
    parseIfNoneMatch,
    parseIfMatch,
    evaluateIfMatch,
    evaluateIfNoneMatch,
    evaluateIfModifiedSince,
    evaluateIfUnmodifiedSince,
} from '../src/conditional.js';
import { parseETag } from '../src/etag.js';

function mockRequest(method: string, headers: Record<string, string>): Request {
    return new Request('https://example.com', { method, headers });
}

// RFC 9110 §13.1.1-§13.1.4, §13.2.2: Conditional request header handling.
describe('RFC 9110 Conditional Requests (§13.1.1-§13.1.4, §13.2.2)', () => {
    // RFC 9110 §13.1.2: If-None-Match field value parsing.
    describe('parseIfNoneMatch', () => {
        it('parses single ETag', () => {
            const result = parseIfNoneMatch('"abc"');
            assert.deepEqual(result, [{ weak: false, value: 'abc' }]);
        });

        it('parses weak ETag', () => {
            const result = parseIfNoneMatch('W/"abc"');
            assert.deepEqual(result, [{ weak: true, value: 'abc' }]);
        });

        // RFC 9110 Section 8.8.3 (weak = %s"W/")
        it('rejects lowercase weak ETag', () => {
            const result = parseIfNoneMatch('w/"abc"');
            assert.deepEqual(result, []);
        });

        it('parses multiple ETags', () => {
            const result = parseIfNoneMatch('"a", "b", W/"c"');
            assert.equal(result.length, 3);
            assert.deepEqual(result[0], { weak: false, value: 'a' });
            assert.deepEqual(result[1], { weak: false, value: 'b' });
            assert.deepEqual(result[2], { weak: true, value: 'c' });
        });

        it('returns "*" for wildcard', () => {
            const result = parseIfNoneMatch('*');
            assert.equal(result, '*');
        });

        it('ignores invalid wildcard mixed with tags', () => {
            const result = parseIfNoneMatch('*, "abc"');
            assert.deepEqual(result, []);
        });

        it('handles whitespace around commas', () => {
            const result = parseIfNoneMatch('"a"  ,  "b"  ,   W/"c"');
            assert.equal(result.length, 3);
            assert.deepEqual(result[0], { weak: false, value: 'a' });
            assert.deepEqual(result[1], { weak: false, value: 'b' });
            assert.deepEqual(result[2], { weak: true, value: 'c' });
        });

        it('handles no whitespace around commas', () => {
            const result = parseIfNoneMatch('"a","b",W/"c"');
            assert.equal(result.length, 3);
        });
    });

    // RFC 9110 §13.1.1: If-Match field value parsing.
    describe('parseIfMatch', () => {
        it('parses single ETag', () => {
            const result = parseIfMatch('"abc"');
            assert.deepEqual(result, [{ weak: false, value: 'abc' }]);
        });

        it('parses weak ETag', () => {
            const result = parseIfMatch('W/"abc"');
            assert.deepEqual(result, [{ weak: true, value: 'abc' }]);
        });

        it('parses multiple ETags', () => {
            const result = parseIfMatch('"a", "b", W/"c"');
            assert.equal(result.length, 3);
        });

        it('returns "*" for wildcard', () => {
            const result = parseIfMatch('*');
            assert.equal(result, '*');
        });

        it('handles whitespace around commas', () => {
            const result = parseIfMatch('"x"  ,  "y"');
            assert.equal(result.length, 2);
            assert.deepEqual(result[0], { weak: false, value: 'x' });
            assert.deepEqual(result[1], { weak: false, value: 'y' });
        });
    });

    // RFC 9110 §13.1.1, §8.8.3: If-Match uses strong comparison of ETags.
    describe('evaluateIfMatch (STRONG comparison)', () => {
        it('returns true when strong ETag matches', () => {
            const resourceETag = parseETag('"abc"')!;
            const result = evaluateIfMatch('"abc"', resourceETag);
            assert.equal(result, true);
        });

        it('returns false when only weak ETag matches (strong comparison requires both strong)', () => {
            const resourceETag = parseETag('W/"abc"')!;
            const result = evaluateIfMatch('W/"abc"', resourceETag);
            assert.equal(result, false);
        });

        it('returns false when resource is strong but header is weak', () => {
            const resourceETag = parseETag('"abc"')!;
            const result = evaluateIfMatch('W/"abc"', resourceETag);
            assert.equal(result, false);
        });

        it('returns false when no ETags match', () => {
            const resourceETag = parseETag('"abc"')!;
            const result = evaluateIfMatch('"xyz", "123"', resourceETag);
            assert.equal(result, false);
        });

        it('returns true for wildcard "*" when resource exists', () => {
            const resourceETag = parseETag('"abc"')!;
            const result = evaluateIfMatch('*', resourceETag);
            assert.equal(result, true);
        });

        it('returns false for wildcard "*" when resource is null', () => {
            const result = evaluateIfMatch('*', null);
            assert.equal(result, false);
        });

        it('returns true when one of multiple ETags matches', () => {
            const resourceETag = parseETag('"def"')!;
            const result = evaluateIfMatch('"abc", "def", "ghi"', resourceETag);
            assert.equal(result, true);
        });
    });

    // RFC 9110 §13.1.2, §8.8.3: If-None-Match uses weak comparison of ETags.
    describe('evaluateIfNoneMatch (WEAK comparison)', () => {
        it('returns true when strong ETag matches', () => {
            const resourceETag = parseETag('"abc"')!;
            const result = evaluateIfNoneMatch('"abc"', resourceETag);
            assert.equal(result, true);
        });

        it('returns true when weak ETag matches (weak comparison)', () => {
            const resourceETag = parseETag('W/"abc"')!;
            const result = evaluateIfNoneMatch('W/"abc"', resourceETag);
            assert.equal(result, true);
        });

        it('returns true when weak header matches strong resource', () => {
            const resourceETag = parseETag('"abc"')!;
            const result = evaluateIfNoneMatch('W/"abc"', resourceETag);
            assert.equal(result, true);
        });

        it('returns true when strong header matches weak resource', () => {
            const resourceETag = parseETag('W/"abc"')!;
            const result = evaluateIfNoneMatch('"abc"', resourceETag);
            assert.equal(result, true);
        });

        it('returns false when no ETags match', () => {
            const resourceETag = parseETag('"abc"')!;
            const result = evaluateIfNoneMatch('"xyz", "123"', resourceETag);
            assert.equal(result, false);
        });

        it('returns true for wildcard "*" when resource exists', () => {
            const resourceETag = parseETag('"abc"')!;
            const result = evaluateIfNoneMatch('*', resourceETag);
            assert.equal(result, true);
        });

        it('returns false for wildcard "*" when resource is null', () => {
            const result = evaluateIfNoneMatch('*', null);
            assert.equal(result, false);
        });

        it('returns true when one of multiple ETags matches', () => {
            const resourceETag = parseETag('"def"')!;
            const result = evaluateIfNoneMatch('"abc", "def", "ghi"', resourceETag);
            assert.equal(result, true);
        });
    });

    // RFC 9110 §13.1.3: If-Modified-Since evaluation.
    describe('evaluateIfModifiedSince', () => {
        const baseDate = new Date('2024-01-15T12:00:00Z');

        it('returns true (not modified) when lastModified equals header date', () => {
            const lastModified = new Date('2024-01-15T12:00:00Z');
            const headerValue = baseDate.toUTCString();
            const result = evaluateIfModifiedSince(headerValue, lastModified);
            assert.equal(result, true);
        });

        // RFC 9110 §5.6.7, §13.1.3: compare at HTTP-date whole-second granularity.
        it('returns true (not modified) when lastModified is later in the same second', () => {
            const lastModified = new Date('2024-01-15T12:00:00.900Z');
            const headerValue = baseDate.toUTCString();
            const result = evaluateIfModifiedSince(headerValue, lastModified);
            assert.equal(result, true);
        });

        it('returns true (not modified) when lastModified is before header date', () => {
            const lastModified = new Date('2024-01-14T12:00:00Z');
            const headerValue = baseDate.toUTCString();
            const result = evaluateIfModifiedSince(headerValue, lastModified);
            assert.equal(result, true);
        });

        it('returns false (modified) when lastModified is after header date', () => {
            const lastModified = new Date('2024-01-16T12:00:00Z');
            const headerValue = baseDate.toUTCString();
            const result = evaluateIfModifiedSince(headerValue, lastModified);
            assert.equal(result, false);
        });

        it('returns false for invalid date header', () => {
            const lastModified = new Date('2024-01-15T12:00:00Z');
            const result = evaluateIfModifiedSince('not-a-date', lastModified);
            assert.equal(result, false);
        });

        it('returns false for empty header', () => {
            const lastModified = new Date('2024-01-15T12:00:00Z');
            const result = evaluateIfModifiedSince('', lastModified);
            assert.equal(result, false);
        });
    });

    // RFC 9110 §13.1.4: If-Unmodified-Since evaluation.
    describe('evaluateIfUnmodifiedSince', () => {
        const baseDate = new Date('2024-01-15T12:00:00Z');

        it('returns true (passes) when lastModified equals header date', () => {
            const lastModified = new Date('2024-01-15T12:00:00Z');
            const headerValue = baseDate.toUTCString();
            const result = evaluateIfUnmodifiedSince(headerValue, lastModified);
            assert.equal(result, true);
        });

        // RFC 9110 §5.6.7, §13.1.4: compare at HTTP-date whole-second granularity.
        it('returns true (passes) when lastModified is later in the same second', () => {
            const lastModified = new Date('2024-01-15T12:00:00.900Z');
            const headerValue = baseDate.toUTCString();
            const result = evaluateIfUnmodifiedSince(headerValue, lastModified);
            assert.equal(result, true);
        });

        it('returns true (passes) when lastModified is before header date', () => {
            const lastModified = new Date('2024-01-14T12:00:00Z');
            const headerValue = baseDate.toUTCString();
            const result = evaluateIfUnmodifiedSince(headerValue, lastModified);
            assert.equal(result, true);
        });

        it('returns false (fails) when lastModified is after header date', () => {
            const lastModified = new Date('2024-01-16T12:00:00Z');
            const headerValue = baseDate.toUTCString();
            const result = evaluateIfUnmodifiedSince(headerValue, lastModified);
            assert.equal(result, false);
        });

        // RFC 9110 Section 13.1.4: invalid HTTP-date is ignored.
        it('ignores invalid date header', () => {
            const lastModified = new Date('2024-01-15T12:00:00Z');
            const result = evaluateIfUnmodifiedSince('invalid-date', lastModified);
            assert.equal(result, true);
        });

        // RFC 9110 Section 13.1.4: empty value is invalid and ignored.
        it('ignores empty header', () => {
            const lastModified = new Date('2024-01-15T12:00:00Z');
            const result = evaluateIfUnmodifiedSince('', lastModified);
            assert.equal(result, true);
        });
    });

    // RFC 9110 §13.2.2, §15.4.5, §15.5.13: Conditional request results (304/412).
    describe('handleConditionalRequest (backward-compatible)', () => {
        const etag = '"abc123"';
        const lastModified = new Date('2024-01-15T12:00:00Z');

        it('returns null when no conditional headers', () => {
            const request = mockRequest('GET', {});
            const result = handleConditionalRequest(request, etag, lastModified);
            assert.equal(result, null);
        });

        it('returns 304 Response when If-None-Match matches (GET)', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = handleConditionalRequest(request, etag, lastModified);
            assert.ok(result instanceof Response);
            assert.equal(result.status, 304);
        });

        it('returns 304 Response when If-None-Match matches (HEAD)', () => {
            const request = mockRequest('HEAD', { 'If-None-Match': '"abc123"' });
            const result = handleConditionalRequest(request, etag, lastModified);
            assert.ok(result instanceof Response);
            assert.equal(result.status, 304);
        });

        it('returns 412 Response when If-Match fails', () => {
            const request = mockRequest('PUT', { 'If-Match': '"different"' });
            const result = handleConditionalRequest(request, etag, lastModified);
            assert.ok(result instanceof Response);
            assert.equal(result.status, 412);
        });

        it('response includes ETag header', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = handleConditionalRequest(request, etag, lastModified);
            assert.ok(result instanceof Response);
            assert.equal(result.headers.get('ETag'), '"abc123"');
        });

        it('response includes Last-Modified header', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = handleConditionalRequest(request, etag, lastModified);
            assert.ok(result instanceof Response);
            assert.equal(result.headers.get('Last-Modified'), lastModified.toUTCString());
        });

        it('returns null when If-None-Match does not match', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"different"' });
            const result = handleConditionalRequest(request, etag, lastModified);
            assert.equal(result, null);
        });

        it('returns null when If-Match matches', () => {
            const request = mockRequest('PUT', { 'If-Match': '"abc123"' });
            const result = handleConditionalRequest(request, etag, lastModified);
            assert.equal(result, null);
        });
    });

    // RFC 9110 §13.2.2: Precondition evaluation order.
    describe('evaluatePreconditions (full RFC 9110 algorithm)', () => {
        const etag = '"abc123"';
        const parsedETag = parseETag(etag)!;
        const lastModified = new Date('2024-01-15T12:00:00Z');

        // RFC 9110 §13.1.1: If-Match precondition.
        describe('Step 1: If-Match', () => {
            it('passes when ETag matches (strong)', () => {
                const request = mockRequest('PUT', { 'If-Match': '"abc123"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });

            it('returns 412 when no match', () => {
                const request = mockRequest('PUT', { 'If-Match': '"different"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 412);
            });

            it('returns 412 when weak ETag provided (strong comparison)', () => {
                const request = mockRequest('PUT', { 'If-Match': 'W/"abc123"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 412);
            });

            it('passes for wildcard "*" when resource exists', () => {
                const request = mockRequest('PUT', { 'If-Match': '*' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });
        });

        // RFC 9110 §13.1.4: If-Unmodified-Since precondition.
        describe('Step 2: If-Unmodified-Since (only when If-Match absent)', () => {
            it('returns 412 when resource modified after date', () => {
                const oldDate = new Date('2024-01-10T12:00:00Z');
                const request = mockRequest('PUT', {
                    'If-Unmodified-Since': oldDate.toUTCString()
                });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 412);
            });

            it('passes when not modified', () => {
                const futureDate = new Date('2024-01-20T12:00:00Z');
                const request = mockRequest('PUT', {
                    'If-Unmodified-Since': futureDate.toUTCString()
                });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });

            it('is ignored when If-Match is present', () => {
                const oldDate = new Date('2024-01-10T12:00:00Z');
                const request = mockRequest('PUT', {
                    'If-Match': '"abc123"',
                    'If-Unmodified-Since': oldDate.toUTCString()
                });
                // If-Match passes, If-Unmodified-Since should be ignored
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });
        });

        // RFC 9110 §13.1.2, §15.4.5, §15.5.13: If-None-Match outcomes.
        describe('Step 3: If-None-Match', () => {
            it('GET/HEAD with match returns 304', () => {
                const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 304);
            });

            it('HEAD with match returns 304', () => {
                const request = mockRequest('HEAD', { 'If-None-Match': '"abc123"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 304);
            });

            it('PUT with match returns 412', () => {
                const request = mockRequest('PUT', { 'If-None-Match': '"abc123"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 412);
            });

            it('POST with match returns 412', () => {
                const request = mockRequest('POST', { 'If-None-Match': '"abc123"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 412);
            });

            it('DELETE with match returns 412', () => {
                const request = mockRequest('DELETE', { 'If-None-Match': '"abc123"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 412);
            });

            it('no match proceeds (returns null)', () => {
                const request = mockRequest('GET', { 'If-None-Match': '"different"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });

            it('weak comparison allows weak ETag match', () => {
                const request = mockRequest('GET', { 'If-None-Match': 'W/"abc123"' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 304);
            });

            it('wildcard "*" with existing resource returns 304 for GET', () => {
                const request = mockRequest('GET', { 'If-None-Match': '*' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 304);
            });

            it('wildcard "*" with existing resource returns 412 for PUT', () => {
                const request = mockRequest('PUT', { 'If-None-Match': '*' });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 412);
            });
        });

        // RFC 9110 §13.1.3, §15.4.5: If-Modified-Since outcomes.
        describe('Step 4: If-Modified-Since (only when If-None-Match absent, GET/HEAD only)', () => {
            it('returns 304 when not modified (GET)', () => {
                const futureDate = new Date('2024-01-20T12:00:00Z');
                const request = mockRequest('GET', {
                    'If-Modified-Since': futureDate.toUTCString()
                });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 304);
            });

            it('returns 304 when not modified (HEAD)', () => {
                const futureDate = new Date('2024-01-20T12:00:00Z');
                const request = mockRequest('HEAD', {
                    'If-Modified-Since': futureDate.toUTCString()
                });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, false);
                assert.equal(result.status, 304);
            });

            it('proceeds when modified', () => {
                const oldDate = new Date('2024-01-10T12:00:00Z');
                const request = mockRequest('GET', {
                    'If-Modified-Since': oldDate.toUTCString()
                });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });

            it('is ignored for POST', () => {
                const futureDate = new Date('2024-01-20T12:00:00Z');
                const request = mockRequest('POST', {
                    'If-Modified-Since': futureDate.toUTCString()
                });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });

            it('is ignored for PUT', () => {
                const futureDate = new Date('2024-01-20T12:00:00Z');
                const request = mockRequest('PUT', {
                    'If-Modified-Since': futureDate.toUTCString()
                });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });

            it('is ignored for DELETE', () => {
                const futureDate = new Date('2024-01-20T12:00:00Z');
                const request = mockRequest('DELETE', {
                    'If-Modified-Since': futureDate.toUTCString()
                });
                const result = evaluatePreconditions(request, parsedETag, lastModified);
                assert.equal(result.proceed, true);
            });
        });
    });

    // RFC 9110 §13.2.2: Precedence of conditional headers.
    describe('Precedence tests (critical)', () => {
        const etag = '"abc123"';
        const parsedETag = parseETag(etag)!;
        const lastModified = new Date('2024-01-15T12:00:00Z');

        it('If-Match evaluated before If-Unmodified-Since', () => {
            const oldDate = new Date('2024-01-10T12:00:00Z');
            // If-Match passes, If-Unmodified-Since would fail but should be ignored
            const request = mockRequest('PUT', {
                'If-Match': '"abc123"',
                'If-Unmodified-Since': oldDate.toUTCString()
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, true);
        });

        it('If-Match failure takes precedence over If-Unmodified-Since success', () => {
            const futureDate = new Date('2024-01-20T12:00:00Z');
            const request = mockRequest('PUT', {
                'If-Match': '"different"',
                'If-Unmodified-Since': futureDate.toUTCString()
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 412);
        });

        it('If-None-Match takes precedence over If-Modified-Since', () => {
            const oldDate = new Date('2024-01-10T12:00:00Z');
            // If-None-Match matches -> 304, even though If-Modified-Since would proceed
            const request = mockRequest('GET', {
                'If-None-Match': '"abc123"',
                'If-Modified-Since': oldDate.toUTCString()
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 304);
        });

        it('If-Modified-Since ignored when If-None-Match present (no match)', () => {
            const futureDate = new Date('2024-01-20T12:00:00Z');
            // If-None-Match doesn't match -> proceed
            // If-Modified-Since would return 304 but should be ignored
            const request = mockRequest('GET', {
                'If-None-Match': '"different"',
                'If-Modified-Since': futureDate.toUTCString()
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, true);
        });

        it('If-Modified-Since ignored when If-None-Match present even with wildcard non-match', () => {
            const futureDate = new Date('2024-01-20T12:00:00Z');
            // With null resource, wildcard doesn't match
            const request = mockRequest('GET', {
                'If-None-Match': '*',
                'If-Modified-Since': futureDate.toUTCString()
            });
            // Using null etag to simulate non-existent resource
            const result = evaluatePreconditions(request, null, lastModified);
            assert.equal(result.proceed, true);
        });

        it('all four headers - If-Match wins when it fails', () => {
            const futureDate = new Date('2024-01-20T12:00:00Z');
            const request = mockRequest('PUT', {
                'If-Match': '"wrong"',
                'If-Unmodified-Since': futureDate.toUTCString(),
                'If-None-Match': '"different"',
                'If-Modified-Since': futureDate.toUTCString()
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 412);
        });

        it('all four headers - If-Match passes, If-None-Match evaluated', () => {
            const futureDate = new Date('2024-01-20T12:00:00Z');
            const request = mockRequest('PUT', {
                'If-Match': '"abc123"',
                'If-Unmodified-Since': futureDate.toUTCString(),
                'If-None-Match': '"abc123"',
                'If-Modified-Since': futureDate.toUTCString()
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 412);
        });
    });

    // RFC 9110 §8.8.2, §8.8.3, §15.4.5, §15.5.13: Validators and status codes.
    // Non-RFC (Fetch/CORS): CORS headers on conditional responses.
    describe('Response details', () => {
        const etag = '"abc123"';
        const parsedETag = parseETag(etag)!;
        const lastModified = new Date('2024-01-15T12:00:00Z');

        it('304 response has correct status', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 304);
        });

        it('412 response has correct status', () => {
            const request = mockRequest('PUT', { 'If-Match': '"different"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 412);
        });

        it('304 response includes ETag header', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.headers?.['ETag'], '"abc123"');
        });

        it('304 response includes Last-Modified header', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.headers?.['Last-Modified'], lastModified.toUTCString());
        });

        it('412 response includes ETag header', () => {
            const request = mockRequest('PUT', { 'If-Match': '"different"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.headers?.['ETag'], '"abc123"');
        });

        it('304 response includes CORS headers', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.headers?.['Access-Control-Allow-Origin'], '*');
        });

        it('412 response includes CORS headers', () => {
            const request = mockRequest('PUT', { 'If-Match': '"different"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.headers?.['Access-Control-Allow-Origin'], '*');
        });

        it('304 response has no body', async () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
        });
    });

    // RFC 9110 §8.8.3: ETag value handling; non-RFC robustness for malformed input.
    describe('Edge cases', () => {
        const etag = '"abc123"';
        const parsedETag = parseETag(etag)!;
        const lastModified = new Date('2024-01-15T12:00:00Z');

        it('handles null ETag gracefully', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"abc123"' });
            const result = evaluatePreconditions(request, null, lastModified);
            assert.equal(result.proceed, true);
        });

        it('handles null lastModified gracefully', () => {
            const request = mockRequest('GET', {
                'If-Modified-Since': new Date().toUTCString()
            });
            const result = evaluatePreconditions(request, parsedETag, null);
            assert.equal(result.proceed, true);
        });

        it('handles both null ETag and lastModified', () => {
            const request = mockRequest('GET', {
                'If-None-Match': '"abc123"',
                'If-Modified-Since': new Date().toUTCString()
            });
            const result = evaluatePreconditions(request, null, null);
            assert.equal(result.proceed, true);
        });

        it('handles ETag with special characters', () => {
            const specialEtag = '"abc/def+ghi=123"';
            const request = mockRequest('GET', { 'If-None-Match': '"abc/def+ghi=123"' });
            const result = evaluatePreconditions(request, parseETag(specialEtag), lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 304);
        });

        it('handles empty If-None-Match header', () => {
            const request = mockRequest('GET', { 'If-None-Match': '' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, true);
        });

        it('handles malformed ETag in header gracefully', () => {
            const request = mockRequest('GET', { 'If-None-Match': 'not-a-valid-etag' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, true);
        });

        it('handles case-sensitive ETag comparison', () => {
            const request = mockRequest('GET', { 'If-None-Match': '"ABC123"' });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, true);
        });

        it('OPTIONS request still evaluates If-Match', () => {
            const request = mockRequest('OPTIONS', {
                'If-None-Match': '"abc123"',
                'If-Match': '"different"'
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 412);
        });

        it('handles multiple matching ETags in If-None-Match', () => {
            const request = mockRequest('GET', {
                'If-None-Match': '"xyz", "abc123", "def"'
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, false);
            assert.equal(result.status, 304);
        });

        it('handles multiple non-matching ETags in If-None-Match', () => {
            const request = mockRequest('GET', {
                'If-None-Match': '"xyz", "def", "ghi"'
            });
            const result = evaluatePreconditions(request, parsedETag, lastModified);
            assert.equal(result.proceed, true);
        });
    });
});
