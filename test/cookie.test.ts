import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseCookie,
    formatCookie,
    parseSetCookie,
    formatSetCookie,
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
});

describe('Cookie matching (RFC 6265 Sections 5.1.3-5.1.4)', () => {
    it('matches domains per suffix rules (RFC 6265 Section 5.1.3)', () => {
        assert.equal(domainMatches('example.com', 'example.com'), true);
        assert.equal(domainMatches('www.example.com', 'example.com'), true);
        assert.equal(domainMatches('example.com', 'www.example.com'), false);
    });

    it('computes default-path (RFC 6265 Section 5.1.4)', () => {
        assert.equal(defaultPath('https://example.com/dir/page'), '/dir');
        assert.equal(defaultPath('https://example.com/'), '/');
    });

    it('matches cookie paths (RFC 6265 Section 5.1.4)', () => {
        assert.equal(pathMatches('/dir/page', '/dir'), true);
        assert.equal(pathMatches('/dir/page', '/dir/other'), false);
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
});
