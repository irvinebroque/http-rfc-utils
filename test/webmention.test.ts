/**
 * Tests for Webmention behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    WEBMENTION_CONTENT_TYPE,
    WEBMENTION_REL,
    discoverWebmentionEndpoint,
    formatWebmentionRequest,
    isWebmentionSuccessStatus,
    parseWebmentionRequest,
    validateWebmentionRequest,
} from '../src/webmention.js';
import {
    WEBMENTION_REL as WEBMENTION_REL_FROM_INDEX,
    discoverWebmentionEndpoint as discoverWebmentionEndpointFromIndex,
} from '../src/index.js';

// W3C Webmention Sections 3.1.2, 3.1.3, 3.2.1, 3.2.3, and 6.
describe('Webmention helpers (W3C Webmention Sections 3.1.2, 3.1.3, 3.2.1, 3.2.3, 6)', () => {
    // W3C Webmention Section 6: registered relation type and protocol media type.
    it('exposes protocol constants', () => {
        assert.equal(WEBMENTION_REL, 'webmention');
        assert.equal(WEBMENTION_CONTENT_TYPE, 'application/x-www-form-urlencoded');
    });

    it('re-exports Webmention symbols from src/index.ts', () => {
        assert.equal(typeof discoverWebmentionEndpointFromIndex, 'function');
        assert.equal(WEBMENTION_REL_FROM_INDEX, WEBMENTION_REL);
    });

    // W3C Webmention Section 3.1.2: Link header discovery takes precedence.
    describe('discoverWebmentionEndpoint', () => {
        it('discovers endpoint from HTTP Link header first', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/posts/123',
                linkHeader: '</webmention-endpoint>; rel="webmention"',
                html: '<link rel="webmention" href="/ignored">',
                contentType: 'text/html; charset=utf-8',
            });

            assert.deepEqual(result, {
                endpoint: 'https://target.example/webmention-endpoint',
                source: 'http-link',
            });
        });

        it('supports multiple Link header field-values in order', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/posts/123',
                linkHeader: [
                    '</wrong>; rel="alternate"',
                    '</wm>; rel="webmention"',
                ],
            });

            assert.deepEqual(result, {
                endpoint: 'https://target.example/wm',
                source: 'http-link',
            });
        });

        it('matches exact rel token among multiple rel values', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/',
                linkHeader: '</wm>; rel="alternate webmention"',
            });

            assert.deepEqual(result, {
                endpoint: 'https://target.example/wm',
                source: 'http-link',
            });
        });

        // W3C Webmention Section 3.1.2: fallback to HTML rel discovery when no Link endpoint.
        it('falls back to HTML discovery for text/html responses', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/post',
                html: '<html><head><link rel="webmention" href="/wm"></head></html>',
                contentType: 'text/html',
            });

            assert.deepEqual(result, {
                endpoint: 'https://target.example/wm',
                source: 'html-link',
            });
        });

        it('uses first <link> or <a> endpoint in document order', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/post',
                html: [
                    '<html><head></head><body>',
                    '<a rel="webmention" href="/first"></a>',
                    '<link rel="webmention" href="/second">',
                    '</body></html>',
                ].join(''),
                contentType: 'text/html',
            });

            assert.deepEqual(result, {
                endpoint: 'https://target.example/first',
                source: 'html-a',
            });
        });

        it('ignores false endpoints inside HTML comments', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/post',
                html: [
                    '<html><head>',
                    '<!-- <link rel="webmention" href="/comment-only"> -->',
                    '<link rel="webmention" href="/real">',
                    '</head></html>',
                ].join(''),
                contentType: 'text/html',
            });

            assert.deepEqual(result, {
                endpoint: 'https://target.example/real',
                source: 'html-link',
            });
        });

        it('requires exact rel token match in HTML', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/post',
                html: '<link rel="webmentioning" href="/bad">',
                contentType: 'text/html',
            });

            assert.equal(result, null);
        });

        it('ignores HTML fallback for non-HTML content types', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/post',
                html: '<link rel="webmention" href="/wm">',
                contentType: 'application/json',
            });

            assert.equal(result, null);
        });

        it('supports legacy relation URI when explicitly enabled', () => {
            const result = discoverWebmentionEndpoint({
                target: 'https://target.example/post',
                html: '<link rel="http://webmention.org/" href="/wm">',
                contentType: 'text/html',
                allowLegacyRelationUri: true,
            });

            assert.deepEqual(result, {
                endpoint: 'https://target.example/wm',
                source: 'html-link',
            });
        });

        it('returns null for invalid target URLs', () => {
            const result = discoverWebmentionEndpoint({
                target: 'not-a-url',
                linkHeader: '</wm>; rel="webmention"',
            });

            assert.equal(result, null);
        });
    });

    // W3C Webmention Section 3.1.3 and 3.2.1: source/target form fields and URL validation.
    describe('parseWebmentionRequest / validateWebmentionRequest / formatWebmentionRequest', () => {
        it('parses a valid form-encoded request body', () => {
            const result = parseWebmentionRequest(
                'source=https%3A%2F%2Fsource.example%2Fentry&target=https%3A%2F%2Ftarget.example%2Fpost',
            );

            assert.deepEqual(result, {
                source: 'https://source.example/entry',
                target: 'https://target.example/post',
            });
        });

        it('parses URLSearchParams and object inputs', () => {
            const params = new URLSearchParams();
            params.set('source', 'https://source.example/entry');
            params.set('target', 'https://target.example/post');

            assert.deepEqual(parseWebmentionRequest(params), {
                source: 'https://source.example/entry',
                target: 'https://target.example/post',
            });

            assert.deepEqual(parseWebmentionRequest({
                source: 'https://source.example/entry',
                target: 'https://target.example/post',
            }), {
                source: 'https://source.example/entry',
                target: 'https://target.example/post',
            });
        });

        it('returns null for missing or duplicated required fields', () => {
            assert.equal(parseWebmentionRequest('source=https://source.example/entry'), null);
            assert.equal(parseWebmentionRequest('target=https://target.example/post'), null);
            assert.equal(
                parseWebmentionRequest('source=https://a.example&source=https://b.example&target=https://target.example/post'),
                null,
            );
            assert.equal(
                parseWebmentionRequest('source=https://source.example/entry&target=https://a.example&target=https://b.example'),
                null,
            );
        });

        // W3C Webmention Section 3.2.1: source and target must be valid URLs and not equal.
        it('rejects same source and target URL (after normalization)', () => {
            assert.equal(
                parseWebmentionRequest('source=http://example.com:80/post&target=http://example.com/post'),
                null,
            );

            assert.throws(() =>
                validateWebmentionRequest({
                    source: 'https://example.com/post',
                    target: 'https://example.com/post',
                }),
            );
        });

        it('rejects unsupported URL schemes by default and supports overrides', () => {
            assert.equal(
                parseWebmentionRequest('source=mailto%3Aops%40example.com&target=https%3A%2F%2Ftarget.example%2Fpost'),
                null,
            );

            assert.deepEqual(
                parseWebmentionRequest(
                    'source=mailto%3Aops%40example.com&target=https%3A%2F%2Ftarget.example%2Fpost',
                    { supportedSchemes: ['mailto', 'https'] },
                ),
                {
                    source: 'mailto:ops@example.com',
                    target: 'https://target.example/post',
                },
            );
        });

        it('formats valid requests as x-www-form-urlencoded content', () => {
            const body = formatWebmentionRequest({
                source: 'https://source.example/post?id=7',
                target: 'https://target.example/post?id=9',
            });

            assert.equal(
                body,
                'source=https%3A%2F%2Fsource.example%2Fpost%3Fid%3D7&target=https%3A%2F%2Ftarget.example%2Fpost%3Fid%3D9',
            );

            const roundTrip = parseWebmentionRequest(body);
            assert.deepEqual(roundTrip, {
                source: 'https://source.example/post?id=7',
                target: 'https://target.example/post?id=9',
            });
        });
    });

    // W3C Webmention Section 3.1.3: any 2xx response code is success.
    describe('isWebmentionSuccessStatus', () => {
        it('returns true for any 2xx status and false otherwise', () => {
            assert.equal(isWebmentionSuccessStatus(200), true);
            assert.equal(isWebmentionSuccessStatus(201), true);
            assert.equal(isWebmentionSuccessStatus(202), true);
            assert.equal(isWebmentionSuccessStatus(204), true);

            assert.equal(isWebmentionSuccessStatus(199), false);
            assert.equal(isWebmentionSuccessStatus(300), false);
            assert.equal(isWebmentionSuccessStatus(400), false);
            assert.equal(isWebmentionSuccessStatus(202.5), false);
        });
    });
});
