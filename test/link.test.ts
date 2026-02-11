/**
 * Tests for link behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    LinkRelation,
    formatLink,
    formatLinkHeader,
    buildLinkHeader,
    parseLinkHeader,
    quoteIfNeeded,
    unquote,
} from '../src/link.js';

// RFC 8288 §6.2.2: Registered link relation types.
describe('LinkRelation constants', () => {
    it('SELF equals "self"', () => {
        assert.equal(LinkRelation.SELF, 'self');
    });

    it('NEXT equals "next"', () => {
        assert.equal(LinkRelation.NEXT, 'next');
    });

    it('PREV equals "prev"', () => {
        assert.equal(LinkRelation.PREV, 'prev');
    });

    it('FIRST equals "first"', () => {
        assert.equal(LinkRelation.FIRST, 'first');
    });

    it('LAST equals "last"', () => {
        assert.equal(LinkRelation.LAST, 'last');
    });

    it('ALTERNATE equals "alternate"', () => {
        assert.equal(LinkRelation.ALTERNATE, 'alternate');
    });

    it('CANONICAL equals "canonical"', () => {
        assert.equal(LinkRelation.CANONICAL, 'canonical');
    });

    // RFC 8594 §6: sunset link relation.
    it('SUNSET equals "sunset"', () => {
        assert.equal(LinkRelation.SUNSET, 'sunset');
    });

    // RFC 9745 §4: deprecation link relation.
    it('DEPRECATION equals "deprecation"', () => {
        assert.equal(LinkRelation.DEPRECATION, 'deprecation');
    });

    // RFC 9264 §6: linkset link relation.
    it('LINKSET equals "linkset"', () => {
        assert.equal(LinkRelation.LINKSET, 'linkset');
    });

    // RFC 9727 §7.2: api-catalog link relation.
    it('API_CATALOG equals "api-catalog"', () => {
        assert.equal(LinkRelation.API_CATALOG, 'api-catalog');
    });
});

// RFC 8288 §3.2: Link-param quoting rules.
describe('quoteIfNeeded', () => {
    it('returns unquoted if no special chars', () => {
        assert.equal(quoteIfNeeded('simple'), 'simple');
    });

    it('returns unquoted for alphanumeric with hyphens', () => {
        assert.equal(quoteIfNeeded('text-plain'), 'text-plain');
    });

    it('quotes if contains comma', () => {
        assert.equal(quoteIfNeeded('a,b'), '"a,b"');
    });

    it('quotes if contains semicolon', () => {
        assert.equal(quoteIfNeeded('a;b'), '"a;b"');
    });

    it('quotes if contains quotes and escapes them', () => {
        assert.equal(quoteIfNeeded('say "hi"'), '"say \\"hi\\""');
    });

    it('quotes if contains whitespace', () => {
        assert.equal(quoteIfNeeded('hello world'), '"hello world"');
    });

    it('quotes if contains tab', () => {
        assert.equal(quoteIfNeeded('hello\tworld'), '"hello\tworld"');
    });

    it('escapes backslashes when quoting', () => {
        assert.equal(quoteIfNeeded('back\\slash'), '"back\\\\slash"');
    });

    it('handles empty string', () => {
        assert.equal(quoteIfNeeded(''), '""');
    });

    it('quotes angle brackets', () => {
        assert.equal(quoteIfNeeded('<url>'), '"<url>"');
    });
});

// RFC 8288 §3.2: Link-param quoted-string unescaping.
describe('unquote', () => {
    it('removes surrounding quotes', () => {
        assert.equal(unquote('"hello"'), 'hello');
    });

    it('resolves escaped quotes', () => {
        assert.equal(unquote('"say \\"hi\\""'), 'say "hi"');
    });

    it('resolves escaped backslash', () => {
        assert.equal(unquote('"back\\\\slash"'), 'back\\slash');
    });

    it('returns unchanged if not quoted', () => {
        assert.equal(unquote('hello'), 'hello');
    });

    it('returns unchanged if only opening quote', () => {
        assert.equal(unquote('"hello'), '"hello');
    });

    it('returns unchanged if only closing quote', () => {
        assert.equal(unquote('hello"'), 'hello"');
    });

    it('handles empty quoted string', () => {
        assert.equal(unquote('""'), '');
    });

    it('handles multiple escaped characters', () => {
        assert.equal(unquote('"a\\"b\\\\c\\"d"'), 'a"b\\c"d');
    });

    it('preserves unescaped content inside quotes', () => {
        assert.equal(unquote('"hello world"'), 'hello world');
    });
});

// RFC 8288 §3.1, §3.2, §3.3: Link-value formatting and parameters.
describe('formatLink', () => {
    it('formats basic link with rel', () => {
        const result = formatLink({ href: 'https://example.com', rel: 'next' });
        assert.equal(result, '<https://example.com>; rel="next"');
    });

    // RFC 8288 §3.3: rel parameter MUST be present in each link-value.
    it('throws when rel is missing, empty, or whitespace-only', () => {
        assert.throws(() => {
            formatLink({ href: 'https://example.com', rel: '' });
        }, /non-empty/);

        assert.throws(() => {
            formatLink({ href: 'https://example.com', rel: '   ' });
        }, /non-empty/);

        assert.throws(() => {
            formatLink({ href: 'https://example.com' } as unknown as { href: string; rel: string });
        }, /non-empty/);
    });

    // RFC 8288 §3.3: rel is required; formatter emits rel first.
    it('emits rel first and preserves extension parameters', () => {
        const result = formatLink({
            href: 'https://example.com',
            rel: 'alternate',
            title: 'English Version',
            foo: 'bar',
        });
        assert.equal(result, '<https://example.com>; rel="alternate"; title="English Version"; foo=bar');
    });

    it('formats link with type attribute', () => {
        const result = formatLink({
            href: 'https://example.com',
            rel: 'alternate',
            type: 'text/html',
        });
        assert.equal(result, '<https://example.com>; rel="alternate"; type="text/html"');
    });

    it('formats link with title attribute', () => {
        const result = formatLink({
            href: 'https://example.com',
            rel: 'next',
            title: 'Next Page',
        });
        assert.equal(result, '<https://example.com>; rel="next"; title="Next Page"');
    });

    it('formats link with hreflang attribute', () => {
        const result = formatLink({
            href: 'https://example.com',
            rel: 'alternate',
            hreflang: 'en',
        });
        assert.equal(result, '<https://example.com>; rel="alternate"; hreflang="en"');
    });

    it('formats link with all optional attributes', () => {
        const result = formatLink({
            href: 'https://example.com',
            rel: 'alternate',
            type: 'text/html',
            title: 'English Version',
            hreflang: 'en',
        });
        assert.equal(
            result,
            '<https://example.com>; rel="alternate"; type="text/html"; title="English Version"; hreflang="en"'
        );
    });

    it('quotes attribute values with special characters', () => {
        const result = formatLink({
            href: 'https://example.com',
            rel: 'next',
            title: 'Hello, World',
        });
        assert.equal(result, '<https://example.com>; rel="next"; title="Hello, World"');
    });

    it('escapes quotes in attribute values', () => {
        const result = formatLink({
            href: 'https://example.com',
            rel: 'next',
            title: 'Say "Hi"',
        });
        assert.equal(result, '<https://example.com>; rel="next"; title="Say \\"Hi\\""');
    });

    it('handles URLs with query parameters', () => {
        const result = formatLink({
            href: 'https://example.com?page=2&limit=10',
            rel: 'next',
        });
        assert.equal(result, '<https://example.com?page=2&limit=10>; rel="next"');
    });

    // RFC 9110 §5.5: serialized field values must reject CR/LF and CTLs.
    it('rejects control bytes in href and parameter values', () => {
        assert.throws(() => {
            formatLink({ href: 'https://example.com\r\nInjected: 1', rel: 'next' });
        }, /control characters/);

        assert.throws(() => {
            formatLink({ href: 'https://example.com', rel: 'next', title: 'ok\u0000bad' });
        }, /control characters/);
    });

    // RFC 9110 §5.6.2: parameter names are tokens.
    it('rejects invalid extension parameter names', () => {
        assert.throws(() => {
            formatLink({
                href: 'https://example.com',
                rel: 'next',
                'bad key': 'value',
            });
        }, /valid RFC 9110 token/);
    });
});

// RFC 8288 §3: Link header field-value formatting.
describe('formatLinkHeader', () => {
    it('joins multiple links with comma-space', () => {
        const links = [
            { href: 'https://example.com/1', rel: 'self' },
            { href: 'https://example.com/2', rel: 'next' },
        ];
        const result = formatLinkHeader(links);
        assert.equal(
            result,
            '<https://example.com/1>; rel="self", <https://example.com/2>; rel="next"'
        );
    });

    it('handles empty array', () => {
        const result = formatLinkHeader([]);
        assert.equal(result, '');
    });

    it('handles single link', () => {
        const links = [{ href: 'https://example.com', rel: 'self' }];
        const result = formatLinkHeader(links);
        assert.equal(result, '<https://example.com>; rel="self"');
    });

    it('handles three links', () => {
        const links = [
            { href: 'https://example.com/1', rel: 'prev' },
            { href: 'https://example.com/2', rel: 'self' },
            { href: 'https://example.com/3', rel: 'next' },
        ];
        const result = formatLinkHeader(links);
        assert.equal(
            result,
            '<https://example.com/1>; rel="prev", <https://example.com/2>; rel="self", <https://example.com/3>; rel="next"'
        );
    });
});

// RFC 8288 §3, §3.3: Link header with relation types.
describe('buildLinkHeader', () => {
    it('creates Link header from PaginationLinks with all fields', () => {
        const paginationLinks = {
            self: 'https://example.com/api?page=2',
            first: 'https://example.com/api?page=1',
            last: 'https://example.com/api?page=5',
            prev: 'https://example.com/api?page=1',
            next: 'https://example.com/api?page=3',
        };
        const result = buildLinkHeader(paginationLinks);

        assert.ok(result.includes('<https://example.com/api?page=2>; rel="self"'));
        assert.ok(result.includes('<https://example.com/api?page=1>; rel="first"'));
        assert.ok(result.includes('<https://example.com/api?page=5>; rel="last"'));
        assert.ok(result.includes('<https://example.com/api?page=1>; rel="prev"'));
        assert.ok(result.includes('<https://example.com/api?page=3>; rel="next"'));
    });

    it('includes self, first, last', () => {
        const paginationLinks = {
            self: 'https://example.com/api?page=1',
            first: 'https://example.com/api?page=1',
            last: 'https://example.com/api?page=10',
        };
        const result = buildLinkHeader(paginationLinks);

        assert.ok(result.includes('rel="self"'));
        assert.ok(result.includes('rel="first"'));
        assert.ok(result.includes('rel="last"'));
        assert.ok(!result.includes('rel="prev"'));
        assert.ok(!result.includes('rel="next"'));
    });

    it('conditionally includes prev when provided', () => {
        const paginationLinks = {
            self: 'https://example.com/api?page=2',
            first: 'https://example.com/api?page=1',
            last: 'https://example.com/api?page=5',
            prev: 'https://example.com/api?page=1',
        };
        const result = buildLinkHeader(paginationLinks);

        assert.ok(result.includes('rel="prev"'));
        assert.ok(!result.includes('rel="next"'));
    });

    it('conditionally includes next when provided', () => {
        const paginationLinks = {
            self: 'https://example.com/api?page=1',
            first: 'https://example.com/api?page=1',
            last: 'https://example.com/api?page=5',
            next: 'https://example.com/api?page=2',
        };
        const result = buildLinkHeader(paginationLinks);

        assert.ok(!result.includes('rel="prev"'));
        assert.ok(result.includes('rel="next"'));
    });

    it('omits prev and next when not provided', () => {
        const paginationLinks = {
            self: 'https://example.com/api',
            first: 'https://example.com/api',
            last: 'https://example.com/api',
        };
        const result = buildLinkHeader(paginationLinks);

        assert.ok(!result.includes('rel="prev"'));
        assert.ok(!result.includes('rel="next"'));
    });
});

// RFC 8288 §3, §3.1, §3.2, §3.3: Link header parsing.
describe('parseLinkHeader', () => {
    describe('basic parsing', () => {
        it('parses single link with rel', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"');
            assert.equal(result.length, 1);
            assert.equal(result[0].href, 'https://example.com');
            assert.equal(result[0].rel, 'next');
        });

        // RFC 8288 Section 3.3: multiple relation types create multiple links.
        it('splits multiple rel values into separate links', () => {
            const result = parseLinkHeader(
                '<https://example.com/>; rel="start http://example.net/relation/other"'
            );
            assert.equal(result.length, 2);
            assert.equal(result[0].rel, 'start');
            assert.equal(result[1].rel, 'http://example.net/relation/other');
        });

        // RFC 8288 Section 3.3: rel MUST NOT appear more than once; ignore later.
        it('ignores duplicate rel parameters after the first', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; rel="prev"');
            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'next');
        });

        // RFC 8288 Section 3.2: anchor parameter overrides context.
        it('parses anchor parameter value', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; anchor="#section"');
            assert.equal(result.length, 1);
            assert.equal(result[0].anchor, '#section');
        });

        it('parses multiple links', () => {
            const result = parseLinkHeader(
                '<https://example.com/1>; rel="self", <https://example.com/2>; rel="next"'
            );
            assert.equal(result.length, 2);
            assert.equal(result[0].href, 'https://example.com/1');
            assert.equal(result[0].rel, 'self');
            assert.equal(result[1].href, 'https://example.com/2');
            assert.equal(result[1].rel, 'next');
        });

        it('parses link with unquoted rel value', () => {
            const result = parseLinkHeader('<https://example.com>; rel=next');
            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'next');
        });
    });

    describe('commas in quoted values (CRITICAL)', () => {
        it('handles comma in title attribute', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; title="Hello, World"');
            assert.equal(result.length, 1);
            assert.equal(result[0].href, 'https://example.com');
            assert.equal(result[0].rel, 'next');
            assert.equal(result[0].title, 'Hello, World');
        });

        it('handles multiple commas in quoted value', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; title="One, Two, Three"');
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'One, Two, Three');
        });

        it('distinguishes comma in quotes from link separator', () => {
            const result = parseLinkHeader(
                '<https://example.com/1>; rel="next"; title="A, B", <https://example.com/2>; rel="prev"'
            );
            assert.equal(result.length, 2);
            assert.equal(result[0].title, 'A, B');
            assert.equal(result[1].rel, 'prev');
        });

        // RFC 8288 §3.2: malformed unterminated quoted-string must not be salvaged.
        it('drops only the malformed current link-value at EOF and preserves prior valid links', () => {
            const result = parseLinkHeader(
                '<https://example.com/ok>; rel="self", <https://example.com/bad>; rel="next"; title="unterminated'
            );
            assert.equal(result.length, 1);
            assert.equal(result[0].href, 'https://example.com/ok');
            assert.equal(result[0].rel, 'self');
        });

        // RFC 8288 §3.2: do not fail-open on a lone malformed link-value.
        it('returns no link-values for a single unterminated quoted-string link', () => {
            const result = parseLinkHeader('<https://example.com/bad>; rel="next"; title="unterminated');
            assert.deepEqual(result, []);
        });
    });

    describe('escaped characters', () => {
        it('handles escaped quotes in title', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; title="Say \\"Hi\\""');
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'Say "Hi"');
        });

        it('handles escaped backslash', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; title="Back\\\\slash"');
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'Back\\slash');
        });

        it('handles multiple escape sequences', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; title="A\\"B\\\\C\\"D"');
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'A"B\\C"D');
        });
    });

    describe('multiple attributes', () => {
        it('parses all standard attributes', () => {
            const result = parseLinkHeader(
                '<https://example.com>; rel="alternate"; type="text/html"; hreflang="en"'
            );
            assert.equal(result.length, 1);
            assert.equal(result[0].href, 'https://example.com');
            assert.equal(result[0].rel, 'alternate');
            assert.equal(result[0].type, 'text/html');
            assert.equal(result[0].hreflang, 'en');
        });

        it('parses link with title and type', () => {
            const result = parseLinkHeader(
                '<https://example.com>; rel="alternate"; type="application/pdf"; title="PDF Version"'
            );
            assert.equal(result.length, 1);
            assert.equal(result[0].type, 'application/pdf');
            assert.equal(result[0].title, 'PDF Version');
        });

        it('handles attributes in any order', () => {
            const result = parseLinkHeader(
                '<https://example.com>; title="Test"; rel="next"; type="text/html"'
            );
            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'next');
            assert.equal(result[0].title, 'Test');
            assert.equal(result[0].type, 'text/html');
        });
    });

    describe('whitespace tolerance', () => {
        it('handles leading whitespace', () => {
            const result = parseLinkHeader('  <https://example.com>; rel="next"');
            assert.equal(result.length, 1);
            assert.equal(result[0].href, 'https://example.com');
        });

        it('handles trailing whitespace', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"  ');
            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'next');
        });

        it('handles whitespace around semicolons', () => {
            const result = parseLinkHeader('<https://example.com>  ;  rel="next"');
            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'next');
        });

        it('handles whitespace around equals sign', () => {
            const result = parseLinkHeader('<https://example.com>; rel = "next"');
            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'next');
        });

        it('handles whitespace around commas between links', () => {
            const result = parseLinkHeader(
                '<https://example.com/1>; rel="self"  ,  <https://example.com/2>; rel="next"'
            );
            assert.equal(result.length, 2);
        });

        it('handles extensive whitespace', () => {
            const result = parseLinkHeader('  <https://example.com>  ;  rel  =  "next"  ');
            assert.equal(result.length, 1);
            assert.equal(result[0].href, 'https://example.com');
            assert.equal(result[0].rel, 'next');
        });
    });

    describe('boolean parameters', () => {
        it('parses parameter without value as boolean', () => {
            const result = parseLinkHeader('<https://example.com>; rel="prefetch"; crossorigin');
            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'prefetch');
            assert.ok('crossorigin' in result[0]);
        });

        it('parses multiple boolean parameters', () => {
            const result = parseLinkHeader('<https://example.com>; rel="preload"; crossorigin; defer');
            assert.equal(result.length, 1);
            assert.ok('crossorigin' in result[0]);
            assert.ok('defer' in result[0]);
        });
    });

    describe('empty and edge cases', () => {
        it('returns empty array for empty string', () => {
            const result = parseLinkHeader('');
            assert.deepEqual(result, []);
        });

        it('returns empty array for whitespace-only string', () => {
            const result = parseLinkHeader('   ');
            assert.deepEqual(result, []);
        });

        it('handles URL with query parameters', () => {
            const result = parseLinkHeader('<https://example.com/api?page=2&limit=10>; rel="next"');
            assert.equal(result.length, 1);
            assert.equal(result[0].href, 'https://example.com/api?page=2&limit=10');
        });

        it('handles URL with fragment', () => {
            const result = parseLinkHeader('<https://example.com/page#section>; rel="self"');
            assert.equal(result.length, 1);
            assert.equal(result[0].href, 'https://example.com/page#section');
        });

        it('handles relative URLs', () => {
            const result = parseLinkHeader('</api/next>; rel="next"');
            assert.equal(result.length, 1);
            assert.equal(result[0].href, '/api/next');
        });
    });

    describe('real-world examples', () => {
        it('parses GitHub-style pagination header', () => {
            const header =
                '<https://api.github.com/repos/foo/bar/issues?page=2>; rel="next", ' +
                '<https://api.github.com/repos/foo/bar/issues?page=5>; rel="last"';
            const result = parseLinkHeader(header);

            assert.equal(result.length, 2);
            assert.equal(result[0].href, 'https://api.github.com/repos/foo/bar/issues?page=2');
            assert.equal(result[0].rel, 'next');
            assert.equal(result[1].href, 'https://api.github.com/repos/foo/bar/issues?page=5');
            assert.equal(result[1].rel, 'last');
        });

        it('parses full GitHub pagination header', () => {
            const header =
                '<https://api.github.com/repos/foo/bar/issues?page=1>; rel="first", ' +
                '<https://api.github.com/repos/foo/bar/issues?page=2>; rel="prev", ' +
                '<https://api.github.com/repos/foo/bar/issues?page=4>; rel="next", ' +
                '<https://api.github.com/repos/foo/bar/issues?page=10>; rel="last"';
            const result = parseLinkHeader(header);

            assert.equal(result.length, 4);
            assert.equal(result[0].rel, 'first');
            assert.equal(result[1].rel, 'prev');
            assert.equal(result[2].rel, 'next');
            assert.equal(result[3].rel, 'last');
        });

        it('parses preload link with attributes', () => {
            const header = '<https://example.com/style.css>; rel="preload"; as="style"; crossorigin';
            const result = parseLinkHeader(header);

            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'preload');
            assert.ok('crossorigin' in result[0]);
        });

        it('parses alternate language links', () => {
            const header =
                '<https://example.com/en>; rel="alternate"; hreflang="en", ' +
                '<https://example.com/de>; rel="alternate"; hreflang="de", ' +
                '<https://example.com/fr>; rel="alternate"; hreflang="fr"';
            const result = parseLinkHeader(header);

            assert.equal(result.length, 3);
            assert.equal(result[0].hreflang, 'en');
            assert.equal(result[1].hreflang, 'de');
            assert.equal(result[2].hreflang, 'fr');
        });
    });

    describe('round-trip tests', () => {
        it('parseLinkHeader(formatLinkHeader(links)) produces equivalent links', () => {
            const originalLinks = [
                { href: 'https://example.com/1', rel: 'self' },
                { href: 'https://example.com/2', rel: 'next' },
                { href: 'https://example.com/3', rel: 'prev' },
            ];

            const formatted = formatLinkHeader(originalLinks);
            const parsed = parseLinkHeader(formatted);

            assert.equal(parsed.length, originalLinks.length);
            for (let i = 0; i < originalLinks.length; i++) {
                assert.equal(parsed[i].href, originalLinks[i].href);
                assert.equal(parsed[i].rel, originalLinks[i].rel);
            }
        });

        it('round-trips links with all attributes', () => {
            const originalLinks = [
                {
                    href: 'https://example.com',
                    rel: 'alternate',
                    type: 'text/html',
                    title: 'HTML Version',
                    hreflang: 'en',
                },
            ];

            const formatted = formatLinkHeader(originalLinks);
            const parsed = parseLinkHeader(formatted);

            assert.equal(parsed.length, 1);
            assert.equal(parsed[0].href, originalLinks[0].href);
            assert.equal(parsed[0].rel, originalLinks[0].rel);
            assert.equal(parsed[0].type, originalLinks[0].type);
            assert.equal(parsed[0].title, originalLinks[0].title);
            assert.equal(parsed[0].hreflang, originalLinks[0].hreflang);
        });

        it('round-trips links with special characters in title', () => {
            const originalLinks = [
                {
                    href: 'https://example.com',
                    rel: 'next',
                    title: 'Hello, World! Say "Hi"',
                },
            ];

            const formatted = formatLinkHeader(originalLinks);
            const parsed = parseLinkHeader(formatted);

            assert.equal(parsed.length, 1);
            assert.equal(parsed[0].title, originalLinks[0].title);
        });

        it('round-trips multiple links with various attributes', () => {
            const originalLinks = [
                { href: 'https://example.com/page/1', rel: 'first' },
                { href: 'https://example.com/page/4', rel: 'prev', title: 'Previous' },
                { href: 'https://example.com/page/5', rel: 'self' },
                { href: 'https://example.com/page/6', rel: 'next', title: 'Next' },
                { href: 'https://example.com/page/100', rel: 'last' },
            ];

            const formatted = formatLinkHeader(originalLinks);
            const parsed = parseLinkHeader(formatted);

            assert.equal(parsed.length, originalLinks.length);
            for (let i = 0; i < originalLinks.length; i++) {
                assert.equal(parsed[i].href, originalLinks[i].href);
                assert.equal(parsed[i].rel, originalLinks[i].rel);
                if (originalLinks[i].title) {
                    assert.equal(parsed[i].title, originalLinks[i].title);
                }
            }
        });
    });

    describe('complex edge cases', () => {
        it('handles semicolon in quoted value', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; title="A; B; C"');
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'A; B; C');
        });

        it('handles equals sign in quoted value', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; title="a=b"');
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'a=b');
        });

        it('handles angle brackets in quoted value', () => {
            const result = parseLinkHeader('<https://example.com>; rel="next"; title="<tag>"');
            assert.equal(result.length, 1);
            assert.equal(result[0].title, '<tag>');
        });

        it('handles complex URL with all special chars', () => {
            const complexUrl = 'https://example.com/path?a=1&b=2#fragment';
            const result = parseLinkHeader(`<${complexUrl}>; rel="self"`);
            assert.equal(result.length, 1);
            assert.equal(result[0].href, complexUrl);
        });

        it('handles mixed quoted and unquoted attribute values', () => {
            const result = parseLinkHeader('<https://example.com>; rel=next; title="Quoted Title"');
            assert.equal(result.length, 1);
            assert.equal(result[0].rel, 'next');
            assert.equal(result[0].title, 'Quoted Title');
        });
    });

    // RFC 8288 §3.4.1: title* takes precedence over title.
    describe('title* handling (RFC 8288 §3.4.1)', () => {
        it('prefers title* over title', () => {
            const header = '<http://example.com>; rel="next"; title="EURO"; title*=utf-8\'\'%e2%82%ac';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].title, '€');
        });

        it('decodes title* with language tag', () => {
            // RFC 8288 §3.5 Example: German chapter titles
            const header = '</TheBook/chapter2>; rel="previous"; title*=UTF-8\'de\'letztes%20Kapitel';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'letztes Kapitel');
            assert.equal(result[0].titleLang, 'de');
        });

        it('uses title when title* decoding fails', () => {
            const header = '<http://example.com>; rel="next"; title="fallback"; title*=invalid';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            // title* is stored but can't be decoded, title is not overwritten
            assert.equal(result[0]['title*'], 'invalid');
        });

        it('ignores title when title* is present first', () => {
            const header = '<http://example.com>; rel="next"; title*=utf-8\'\'test; title="ignored"';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'test');
        });

        it('ignores duplicate title* params', () => {
            const header = '<http://example.com>; rel="next"; title*=utf-8\'\'first; title*=utf-8\'\'second';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].title, 'first');
        });
    });

    // RFC 8288 §3.4.1: hreflang may appear multiple times.
    describe('multiple hreflang (RFC 8288 §3.4.1)', () => {
        it('accumulates multiple hreflang values', () => {
            const header = '<http://example.com>; rel="alternate"; hreflang="en"; hreflang="de"';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.deepEqual(result[0].hreflang, ['en', 'de']);
        });

        it('returns single hreflang as string', () => {
            const header = '<http://example.com>; rel="alternate"; hreflang="en"';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].hreflang, 'en');
        });

        it('handles three hreflang values', () => {
            const header = '<http://example.com>; rel="alternate"; hreflang="en"; hreflang="de"; hreflang="fr"';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.deepEqual(result[0].hreflang, ['en', 'de', 'fr']);
        });

        it('formats multiple hreflang values', () => {
            const link = {
                href: 'http://example.com',
                rel: 'alternate',
                hreflang: ['en', 'de'],
            };
            const result = formatLink(link);
            assert.ok(result.includes('hreflang="en"'));
            assert.ok(result.includes('hreflang="de"'));
        });
    });

    // RFC 8288 §3.3: rev is deprecated but should parse.
    describe('rev parameter (RFC 8288 §3.3)', () => {
        it('parses rev parameter', () => {
            const header = '<http://example.com>; rel="next"; rev="prev"';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].rev, 'prev');
        });

        it('ignores duplicate rev parameters', () => {
            const header = '<http://example.com>; rel="next"; rev="first"; rev="second"';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].rev, 'first');
        });

        it('formats rev parameter', () => {
            const link = {
                href: 'http://example.com',
                rel: 'next',
                rev: 'prev',
            };
            const result = formatLink(link);
            assert.ok(result.includes('rev="prev"'));
        });
    });

    // RFC 8288 §3.4.2: Extension attributes with *.
    describe('extension attributes (RFC 8288 §3.4.2)', () => {
        it('decodes extension*= parameters', () => {
            const header = '<http://example.com>; rel="next"; custom*=utf-8\'\'%C2%A3';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].custom, '£');
        });

        it('prefers extension* over extension', () => {
            const header = '<http://example.com>; rel="next"; foo="ASCII"; foo*=utf-8\'\'%c2%a3';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            assert.equal(result[0].foo, '£');
        });

        it('uses extension when extension* fails to decode', () => {
            const header = '<http://example.com>; rel="next"; bar="fallback"; bar*=invalid';
            const result = parseLinkHeader(header);
            assert.equal(result.length, 1);
            // bar* stored raw since decoding failed, bar not overwritten by failed decode
            assert.equal(result[0]['bar*'], 'invalid');
        });
    });
});
