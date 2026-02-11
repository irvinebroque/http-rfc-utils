/**
 * Tests for robots behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseRobotsTxt,
    formatRobotsTxt,
    matchUserAgent,
    isAllowed,
} from '../src/robots.js';

// RFC 9309 §2.1-2.2: Robots exclusion protocol parsing and matching.
describe('RFC 9309 Robots Exclusion Protocol', () => {
    describe('parseRobotsTxt', () => {
        it('parses a basic robots.txt', () => {
            const text = `User-agent: *\nDisallow: /private\nAllow: /\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups.length, 1);
            assert.deepEqual(config.groups[0].userAgents, ['*']);
            assert.deepEqual(config.groups[0].disallow, ['/private']);
            assert.deepEqual(config.groups[0].allow, ['/']);
        });

        it('parses multiple groups', () => {
            const text = `User-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nDisallow: /secret\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups.length, 2);
            assert.deepEqual(config.groups[0].userAgents, ['Googlebot']);
            assert.deepEqual(config.groups[1].userAgents, ['Bingbot']);
        });

        it('parses multiple user-agents per group', () => {
            const text = `User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: /\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups.length, 1);
            assert.deepEqual(config.groups[0].userAgents, ['Googlebot', 'Bingbot']);
        });

        it('parses Sitemap directives', () => {
            const text = `User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\nSitemap: https://example.com/sitemap2.xml\n`;
            const config = parseRobotsTxt(text);
            assert.deepEqual(config.sitemaps, [
                'https://example.com/sitemap.xml',
                'https://example.com/sitemap2.xml',
            ]);
        });

        it('parses Crawl-delay', () => {
            const text = `User-agent: *\nCrawl-delay: 10\nDisallow: /\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups[0].crawlDelay, 10);
        });

        it('strips comments', () => {
            const text = `# This is a comment\nUser-agent: * # inline comment\nDisallow: /private # also a comment\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups.length, 1);
            assert.deepEqual(config.groups[0].userAgents, ['*']);
            assert.deepEqual(config.groups[0].disallow, ['/private']);
        });

        it('handles empty lines between groups', () => {
            const text = `User-agent: A\nDisallow: /a\n\n\nUser-agent: B\nDisallow: /b\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups.length, 2);
        });

        it('handles empty input', () => {
            const config = parseRobotsTxt('');
            assert.equal(config.groups.length, 0);
            assert.equal(config.sitemaps.length, 0);
        });

        it('handles BOM prefix', () => {
            const text = `\uFEFFUser-agent: *\nAllow: /\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups.length, 1);
        });

        it('handles CRLF line endings', () => {
            const text = `User-agent: *\r\nDisallow: /private\r\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups.length, 1);
            assert.deepEqual(config.groups[0].disallow, ['/private']);
        });

        it('parses Host directive (Yandex extension)', () => {
            const text = `User-agent: *\nAllow: /\n\nHost: example.com\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.host, 'example.com');
        });

        // RFC 9309 §2.4: Lines over 500 bytes SHOULD be ignored.
        it('ignores lines over 500 bytes', () => {
            const longPath = '/a'.repeat(300);
            const text = `User-agent: *\nDisallow: ${longPath}\nDisallow: /short\n`;
            const config = parseRobotsTxt(text);
            assert.deepEqual(config.groups[0].disallow, ['/short']);
        });

        it('ignores empty Disallow value', () => {
            const text = `User-agent: *\nDisallow:\n`;
            const config = parseRobotsTxt(text);
            assert.deepEqual(config.groups[0].disallow, []);
        });

        it('starts new group when user-agent follows rules', () => {
            const text = `User-agent: A\nDisallow: /a\nUser-agent: B\nDisallow: /b\n`;
            const config = parseRobotsTxt(text);
            assert.equal(config.groups.length, 2);
            assert.deepEqual(config.groups[0].userAgents, ['A']);
            assert.deepEqual(config.groups[1].userAgents, ['B']);
        });
    });

    describe('formatRobotsTxt', () => {
        it('formats a basic config', () => {
            const config = {
                groups: [
                    { userAgents: ['*'], allow: ['/'], disallow: ['/private'] },
                ],
                sitemaps: ['https://example.com/sitemap.xml'],
            };
            const text = formatRobotsTxt(config);
            assert.ok(text.includes('User-agent: *'));
            assert.ok(text.includes('Allow: /'));
            assert.ok(text.includes('Disallow: /private'));
            assert.ok(text.includes('Sitemap: https://example.com/sitemap.xml'));
        });

        it('formats multiple groups', () => {
            const config = {
                groups: [
                    { userAgents: ['Googlebot'], allow: ['/'], disallow: [] },
                    { userAgents: ['Bingbot'], allow: [], disallow: ['/'] },
                ],
                sitemaps: [],
            };
            const text = formatRobotsTxt(config);
            assert.ok(text.includes('User-agent: Googlebot'));
            assert.ok(text.includes('User-agent: Bingbot'));
        });

        it('includes Crawl-delay', () => {
            const config = {
                groups: [
                    { userAgents: ['*'], allow: [], disallow: ['/'], crawlDelay: 5 },
                ],
                sitemaps: [],
            };
            const text = formatRobotsTxt(config);
            assert.ok(text.includes('Crawl-delay: 5'));
        });

        it('includes Host directive', () => {
            const config = {
                groups: [{ userAgents: ['*'], allow: ['/'], disallow: [] }],
                sitemaps: [],
                host: 'example.com',
            };
            const text = formatRobotsTxt(config);
            assert.ok(text.includes('Host: example.com'));
        });

        it('ends with a newline', () => {
            const config = {
                groups: [{ userAgents: ['*'], allow: ['/'], disallow: [] }],
                sitemaps: [],
            };
            const text = formatRobotsTxt(config);
            assert.ok(text.endsWith('\n'));
        });

        it('round-trips a parsed file', () => {
            const original = `User-agent: *\nAllow: /\nDisallow: /private\n\nSitemap: https://example.com/sitemap.xml\n`;
            const config = parseRobotsTxt(original);
            const formatted = formatRobotsTxt(config);
            const reparsed = parseRobotsTxt(formatted);
            assert.deepEqual(reparsed.groups, config.groups);
            assert.deepEqual(reparsed.sitemaps, config.sitemaps);
        });
    });

    // RFC 9309 §2.3: User-agent matching is case-insensitive substring.
    describe('matchUserAgent', () => {
        it('matches wildcard group', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /\n`);
            const group = matchUserAgent(config, 'AnyBot/1.0');
            assert.ok(group);
            assert.deepEqual(group.userAgents, ['*']);
        });

        it('matches specific user agent over wildcard', () => {
            const config = parseRobotsTxt(
                `User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n`
            );
            const group = matchUserAgent(config, 'Googlebot/2.1');
            assert.ok(group);
            assert.deepEqual(group.userAgents, ['Googlebot']);
        });

        it('matches case-insensitively', () => {
            const config = parseRobotsTxt(`User-agent: GoogleBot\nDisallow: /\n`);
            const group = matchUserAgent(config, 'googlebot');
            assert.ok(group);
        });

        it('uses longest substring match', () => {
            const config = parseRobotsTxt(
                `User-agent: Bot\nDisallow: /a\n\nUser-agent: Googlebot\nDisallow: /b\n`
            );
            const group = matchUserAgent(config, 'Googlebot/2.1');
            assert.ok(group);
            assert.deepEqual(group.disallow, ['/b']);
        });

        it('returns null when no match and no wildcard', () => {
            const config = parseRobotsTxt(`User-agent: Googlebot\nDisallow: /\n`);
            const group = matchUserAgent(config, 'Bingbot');
            assert.equal(group, null);
        });
    });

    // RFC 9309 §2.2: Longest-match-wins for Allow vs Disallow.
    describe('isAllowed', () => {
        it('allows when no matching group', () => {
            const config = parseRobotsTxt(`User-agent: Googlebot\nDisallow: /\n`);
            assert.equal(isAllowed(config, 'Bingbot', '/anything'), true);
        });

        it('disallows a path', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /private\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/private/secret'), false);
        });

        it('allows a path not matched by any rule', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /private\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/public'), true);
        });

        // RFC 9309 §2.2: Longest path wins.
        it('uses longest match: Allow overrides shorter Disallow', () => {
            const config = parseRobotsTxt(
                `User-agent: *\nDisallow: /a\nAllow: /a/b\n`
            );
            assert.equal(isAllowed(config, 'AnyBot', '/a/b/c'), true);
        });

        it('uses longest match: Disallow overrides shorter Allow', () => {
            const config = parseRobotsTxt(
                `User-agent: *\nAllow: /a\nDisallow: /a/b\n`
            );
            assert.equal(isAllowed(config, 'AnyBot', '/a/b/c'), false);
        });

        it('equal length: Allow wins', () => {
            const config = parseRobotsTxt(
                `User-agent: *\nAllow: /a\nDisallow: /a\n`
            );
            assert.equal(isAllowed(config, 'AnyBot', '/a'), true);
        });

        // RFC 9309 §2.2.2: Wildcard * in paths.
        it('handles wildcard in path pattern', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /a/*/c\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/a/b/c'), false);
            assert.equal(isAllowed(config, 'AnyBot', '/a/anything/c'), false);
        });

        it('handles many wildcards without changing match semantics', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /x*y*z\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/x-middle-y-end-z-tail'), false);
            assert.equal(isAllowed(config, 'AnyBot', '/x-middle-z-end-y-tail'), true);
        });

        it('remains stable for wildcard-heavy non-matches', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /a*a*a*a*a*a*a*a*a*b$\n`);
            const path = '/' + 'a'.repeat(512) + 'c';

            for (let i = 0; i < 200; i++) {
                assert.equal(isAllowed(config, 'AnyBot', path), true);
            }
        });

        // RFC 9309 §2.2.2: $ end-of-URL anchor.
        it('handles $ end-of-URL anchor', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /*.php$\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/page.php'), false);
            assert.equal(isAllowed(config, 'AnyBot', '/page.php?id=1'), true);
        });

        it('treats non-terminal $ as a literal character', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /price$usd\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/price$usd'), false);
            assert.equal(isAllowed(config, 'AnyBot', '/price-usd'), true);
        });

        it('keeps non-anchored patterns prefix-based', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /*.php\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/page.php?id=1'), false);
            assert.equal(isAllowed(config, 'AnyBot', '/page.html'), true);
        });

        it('disallow all with /', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow: /\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/anything'), false);
        });

        it('allow all with empty disallow', () => {
            const config = parseRobotsTxt(`User-agent: *\nDisallow:\n`);
            assert.equal(isAllowed(config, 'AnyBot', '/anything'), true);
        });

        it('returns stable results across repeated evaluations', () => {
            const config = parseRobotsTxt(`User-agent: *\nAllow: /public/*\nDisallow: /private/*\n`);

            for (let i = 0; i < 20; i++) {
                assert.equal(isAllowed(config, 'AnyBot', '/public/page'), true);
                assert.equal(isAllowed(config, 'AnyBot', '/private/secret'), false);
            }
        });
    });
});
