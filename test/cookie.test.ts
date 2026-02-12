/**
 * Tests for cookie behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseCookie,
    formatCookie,
    parseSetCookie,
    formatSetCookie,
    parseCookieDate,
    domainMatches,
    defaultPath,
    pathMatches,
    buildCookieHeader,
} from '../src/cookie.js';

describe('Cookie header (RFC 6265 Section 4.2.1)', () => {
    it('parses cookie pairs (RFC 6265 Section 4.2.1)', () => {
        const parsed = parseCookie('SID=31d4d96e407aad42; lang=en-US');
        assert.equal(parsed.get('SID'), '31d4d96e407aad42');
        assert.equal(parsed.get('lang'), 'en-US');
    });

    it('formats cookie pairs (RFC 6265 Section 4.2.1)', () => {
        const header = formatCookie({ SID: '31d4d96e407aad42', lang: 'en-US' });
        assert.equal(header, 'SID=31d4d96e407aad42; lang=en-US');
    });

    it('handles quoted values and keeps the first duplicate cookie name', () => {
        const parsed = parseCookie('theme="light mode"; theme=dark; escaped="a\\\\b"');
        assert.equal(parsed.get('theme'), 'light mode');
        assert.equal(parsed.get('escaped'), 'a\\b');
    });

    it('parses quoted values with escaped backslash pairs', () => {
        const parsed = parseCookie('token="path\\\\\\\\to\\\\\\\\cookie"');
        assert.equal(parsed.get('token'), 'path\\\\to\\\\cookie');
    });

    it('quotes cookie values containing separators when formatting', () => {
        const header = formatCookie({
            note: 'hello world',
            list: 'a;b',
        });
        assert.equal(header, 'note="hello world"; list="a;b"');
    });

    // RFC 9110 §5.5: reject CR/LF and CTLs in serialized Cookie values.
    it('rejects control bytes in cookie formatting', () => {
        assert.throws(() => formatCookie({ SID: 'abc\r\nInjected: true' }), /control characters/);
    });

    // RFC 6265 §4.1.1 + RFC 9110 §5.6.2: cookie-name uses token syntax.
    it('rejects invalid cookie names in formatting', () => {
        assert.throws(() => formatCookie({ 'bad key': 'value' }), /valid RFC 9110 token/);
    });
});

describe('Set-Cookie header (RFC 6265 Section 4.1.1)', () => {
    it('parses Set-Cookie attributes (RFC 6265 Section 5.2)', () => {
        const parsed = parseSetCookie(
            'sessionId=abc; Max-Age=60; Path=/; HttpOnly; Secure'
        );
        assert.equal(parsed?.name, 'sessionId');
        assert.equal(parsed?.value, 'abc');
        assert.equal(parsed?.attributes?.maxAge, 60);
        assert.equal(parsed?.attributes?.path, '/');
        assert.equal(parsed?.attributes?.httpOnly, true);
        assert.equal(parsed?.attributes?.secure, true);
    });

    it('ignores invalid Expires values (RFC 6265 Section 5.2.1)', () => {
        const parsed = parseSetCookie('a=b; Expires=not-a-date');
        assert.equal(parsed?.attributes?.expires, undefined);
    });

    it('formats Set-Cookie values (RFC 6265 Section 4.1.1)', () => {
        const formatted = formatSetCookie({
            name: 'id',
            value: 'abc',
            attributes: { path: '/', httpOnly: true },
        });
        assert.equal(formatted, 'id=abc; Path=/; HttpOnly');
    });

    // RFC 9110 §5.5: reject CR/LF and CTLs in serialized Set-Cookie values.
    it('rejects control bytes in Set-Cookie extension values', () => {
        assert.throws(() => {
            formatSetCookie({
                name: 'id',
                value: 'abc',
                attributes: {
                    extensions: {
                        note: 'safe\nunsafe',
                    },
                },
            });
        }, /control characters/);
    });

    it('normalizes Domain by stripping a leading dot and lowercasing', () => {
        const parsed = parseSetCookie('id=abc; Domain=.Example.COM');
        assert.equal(parsed?.attributes?.domain, 'example.com');
    });

    it('ignores invalid Max-Age values', () => {
        const parsed = parseSetCookie('id=abc; Max-Age=abc');
        assert.equal(parsed?.attributes?.maxAge, undefined);
    });

    // RFC 6265 §4.1.1: Set-Cookie attributes are ';'-delimited and values must not inject delimiters.
    it('rejects semicolon delimiter injection in Domain and Path attributes', () => {
        assert.throws(() => {
            formatSetCookie({
                name: 'id',
                value: 'abc',
                attributes: { domain: 'example.com;Secure' },
            });
        }, /must not contain ';' delimiter/);

        assert.throws(() => {
            formatSetCookie({
                name: 'id',
                value: 'abc',
                attributes: { path: '/app;HttpOnly' },
            });
        }, /must not contain ';' delimiter/);
    });

    // RFC 6265 §4.1.1: Extension attribute values also share the Set-Cookie ';' delimiter space.
    it('rejects semicolon delimiter injection in extension values', () => {
        assert.throws(() => {
            formatSetCookie({
                name: 'id',
                value: 'abc',
                attributes: {
                    extensions: {
                        note: 'ok;Secure',
                    },
                },
            });
        }, /must not contain ';' delimiter/);
    });
});

describe('Cookie date parsing (RFC 6265 Section 5.1.1)', () => {
    it('maps two-digit years using RFC 6265 rules', () => {
        assert.equal(
            parseCookieDate('Wed, 09 Jun 21 10:18:14 GMT')?.toISOString(),
            '2021-06-09T10:18:14.000Z'
        );
        assert.equal(
            parseCookieDate('Wed, 09 Jun 70 10:18:14 GMT')?.toISOString(),
            '1970-06-09T10:18:14.000Z'
        );
    });

    it('rejects invalid date components', () => {
        assert.equal(parseCookieDate('Wed, 32 Jun 2021 10:18:14 GMT'), null);
        assert.equal(parseCookieDate('Wed, 09 Jun 1600 10:18:14 GMT'), null);
        assert.equal(parseCookieDate('Wed, 09 Jun 2021 24:00:00 GMT'), null);
    });

    it('rejects impossible calendar dates that would otherwise normalize', () => {
        assert.equal(parseCookieDate('Fri, 31 Apr 2021 10:18:14 GMT'), null);
        assert.equal(parseCookieDate('Mon, 29 Feb 2021 10:18:14 GMT'), null);
    });

    it('accepts valid leap-day cookie dates', () => {
        assert.equal(
            parseCookieDate('Sat, 29 Feb 2020 10:18:14 GMT')?.toISOString(),
            '2020-02-29T10:18:14.000Z'
        );
    });

    it('returns null when the cookie-date is missing required tokens', () => {
        assert.equal(parseCookieDate('Wed, Jun 2021 GMT'), null);
    });
});

describe('Cookie matching (RFC 6265 Sections 5.1.3-5.1.4)', () => {
    it('matches domains per suffix rules (RFC 6265 Section 5.1.3)', () => {
        assert.equal(domainMatches('example.com', 'example.com'), true);
        assert.equal(domainMatches('www.example.com', 'example.com'), true);
        assert.equal(domainMatches('example.com', 'www.example.com'), false);
    });

    it('does not suffix-match IP addresses (RFC 6265 Section 5.1.3)', () => {
        assert.equal(domainMatches('127.0.0.1', 'example.com'), false);
        assert.equal(domainMatches('2001:db8::1', 'db8::1'), false);
        assert.equal(domainMatches('127.0.0.1', '127.0.0.1'), true);
    });

    it('computes default-path (RFC 6265 Section 5.1.4)', () => {
        assert.equal(defaultPath('https://example.com/dir/page'), '/dir');
        assert.equal(defaultPath('https://example.com/'), '/');
    });

    it('falls back to root path for invalid URLs', () => {
        assert.equal(defaultPath('not a url'), '/');
    });

    it('matches cookie paths (RFC 6265 Section 5.1.4)', () => {
        assert.equal(pathMatches('/dir/page', '/dir'), true);
        assert.equal(pathMatches('/dir/page', '/dir/other'), false);
        assert.equal(pathMatches('/foobar', '/foo'), false);
        assert.equal(pathMatches('/foo/bar', '/foo/'), true);
    });
});

describe('Cookie header generation (RFC 6265 Section 5.4)', () => {
    it('orders by path length and creation time (RFC 6265 Section 5.4)', () => {
        const header = buildCookieHeader([
            {
                name: 'a',
                value: '1',
                domain: 'example.com',
                path: '/',
                creationTime: new Date('2024-01-01T00:00:00Z'),
                hostOnly: true,
            },
            {
                name: 'b',
                value: '2',
                domain: 'example.com',
                path: '/account',
                creationTime: new Date('2024-01-02T00:00:00Z'),
                hostOnly: true,
            },
        ], 'https://example.com/account/settings');

        assert.equal(header, 'b=2; a=1');
    });

    it('filters expired, secure-only, and httpOnly cookies per request context', () => {
        const cookies = [
            {
                name: 'expired',
                value: '1',
                domain: 'example.com',
                path: '/',
                creationTime: new Date('2024-01-01T00:00:00Z'),
                expires: new Date('2024-01-02T00:00:00Z'),
                hostOnly: true,
            },
            {
                name: 'secure',
                value: '1',
                domain: 'example.com',
                path: '/',
                creationTime: new Date('2024-01-01T00:00:00Z'),
                secureOnly: true,
                hostOnly: true,
            },
            {
                name: 'httpOnly',
                value: '1',
                domain: 'example.com',
                path: '/',
                creationTime: new Date('2024-01-01T00:00:00Z'),
                httpOnly: true,
                hostOnly: true,
            },
        ];

        const now = new Date('2024-01-03T00:00:00Z');
        assert.equal(
            buildCookieHeader(cookies, 'https://example.com/', { now, includeHttpOnly: false, isSecure: false }),
            null,
        );

        assert.equal(
            buildCookieHeader(cookies, 'https://example.com/', { now, includeHttpOnly: true, isSecure: true }),
            'secure=1; httpOnly=1',
        );
    });

    it('applies domain-match rules for non-host-only cookies', () => {
        const header = buildCookieHeader([
            {
                name: 'shared',
                value: '1',
                domain: 'example.com',
                path: '/',
                creationTime: new Date('2024-01-01T00:00:00Z'),
                hostOnly: false,
            },
            {
                name: 'hostonly',
                value: '1',
                domain: 'example.com',
                path: '/',
                creationTime: new Date('2024-01-01T00:00:00Z'),
                hostOnly: true,
            },
        ], 'https://api.example.com/');

        assert.equal(header, 'shared=1');
    });
});
