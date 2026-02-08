import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    percentEncode,
    percentDecode,
    isUnreserved,
    isReserved,
    normalizeUri,
    removeDotSegments,
    compareUris,
    UNRESERVED_CHARS,
    GEN_DELIMS,
    SUB_DELIMS,
} from '../src/uri.js';

// RFC 3986 §2.3: Unreserved Characters
describe('isUnreserved (RFC 3986 Section 2.3)', () => {
    it('returns true for ALPHA characters', () => {
        assert.strictEqual(isUnreserved('A'), true);
        assert.strictEqual(isUnreserved('Z'), true);
        assert.strictEqual(isUnreserved('a'), true);
        assert.strictEqual(isUnreserved('z'), true);
    });

    it('returns true for DIGIT characters', () => {
        assert.strictEqual(isUnreserved('0'), true);
        assert.strictEqual(isUnreserved('9'), true);
        assert.strictEqual(isUnreserved('5'), true);
    });

    it('returns true for hyphen, period, underscore, tilde', () => {
        assert.strictEqual(isUnreserved('-'), true);
        assert.strictEqual(isUnreserved('.'), true);
        assert.strictEqual(isUnreserved('_'), true);
        assert.strictEqual(isUnreserved('~'), true);
    });

    it('returns false for reserved characters', () => {
        assert.strictEqual(isUnreserved(':'), false);
        assert.strictEqual(isUnreserved('/'), false);
        assert.strictEqual(isUnreserved('?'), false);
        assert.strictEqual(isUnreserved('#'), false);
        assert.strictEqual(isUnreserved('!'), false);
        assert.strictEqual(isUnreserved('@'), false);
    });

    it('returns false for space and other characters', () => {
        assert.strictEqual(isUnreserved(' '), false);
        assert.strictEqual(isUnreserved('%'), false);
        assert.strictEqual(isUnreserved('"'), false);
    });

    it('returns false for empty string or multi-char string', () => {
        assert.strictEqual(isUnreserved(''), false);
        assert.strictEqual(isUnreserved('AB'), false);
    });
});

// RFC 3986 §2.2: Reserved Characters
describe('isReserved (RFC 3986 Section 2.2)', () => {
    it('returns true for gen-delims', () => {
        assert.strictEqual(isReserved(':'), true);
        assert.strictEqual(isReserved('/'), true);
        assert.strictEqual(isReserved('?'), true);
        assert.strictEqual(isReserved('#'), true);
        assert.strictEqual(isReserved('['), true);
        assert.strictEqual(isReserved(']'), true);
        assert.strictEqual(isReserved('@'), true);
    });

    it('returns true for sub-delims', () => {
        assert.strictEqual(isReserved('!'), true);
        assert.strictEqual(isReserved('$'), true);
        assert.strictEqual(isReserved('&'), true);
        assert.strictEqual(isReserved("'"), true);
        assert.strictEqual(isReserved('('), true);
        assert.strictEqual(isReserved(')'), true);
        assert.strictEqual(isReserved('*'), true);
        assert.strictEqual(isReserved('+'), true);
        assert.strictEqual(isReserved(','), true);
        assert.strictEqual(isReserved(';'), true);
        assert.strictEqual(isReserved('='), true);
    });

    it('returns false for unreserved characters', () => {
        assert.strictEqual(isReserved('A'), false);
        assert.strictEqual(isReserved('z'), false);
        assert.strictEqual(isReserved('0'), false);
        assert.strictEqual(isReserved('-'), false);
    });
});

// RFC 3986 §2.1: Percent-Encoding
describe('percentEncode (RFC 3986 Section 2.1)', () => {
    it('encodes space as %20', () => {
        assert.strictEqual(percentEncode(' '), '%20');
        assert.strictEqual(percentEncode('hello world'), 'hello%20world');
    });

    // RFC 3986 §2.1: SHOULD use uppercase hex digits
    it('uses uppercase hex digits', () => {
        assert.strictEqual(percentEncode('<'), '%3C');
        assert.strictEqual(percentEncode('>'), '%3E');
        assert.strictEqual(percentEncode('"'), '%22');
    });

    // RFC 3986 §2.3: SHOULD NOT encode unreserved characters
    it('does not encode unreserved characters', () => {
        assert.strictEqual(percentEncode('ABCxyz'), 'ABCxyz');
        assert.strictEqual(percentEncode('0123456789'), '0123456789');
        assert.strictEqual(percentEncode('-._~'), '-._~');
    });

    // RFC 3986 §2.4: MUST NOT double-encode
    it('does not double-encode already encoded sequences', () => {
        assert.strictEqual(percentEncode('%20'), '%20');
        assert.strictEqual(percentEncode('%2F'), '%2F');
        assert.strictEqual(percentEncode('hello%20world'), 'hello%20world');
    });

    it('normalizes lowercase hex to uppercase when passing through', () => {
        assert.strictEqual(percentEncode('%2f'), '%2F');
        assert.strictEqual(percentEncode('%3a'), '%3A');
    });

    it('encodes non-ASCII as UTF-8 percent-encoded', () => {
        // UTF-8 encoding of "é" is C3 A9
        assert.strictEqual(percentEncode('é'), '%C3%A9');
        // UTF-8 encoding of "日" is E6 97 A5
        assert.strictEqual(percentEncode('日'), '%E6%97%A5');
    });

    it('returns empty string for empty input', () => {
        assert.strictEqual(percentEncode(''), '');
    });

    // RFC 3986 §3.3: pchar allows sub-delims and : @
    it('preserves sub-delims in path component', () => {
        assert.strictEqual(percentEncode("!$&'()*+,;=", 'path'), "!$&'()*+,;=");
        assert.strictEqual(percentEncode(':@', 'path'), ':@');
    });

    // RFC 3986 §3.4: query allows pchar plus / ?
    it('preserves / and ? in query component', () => {
        assert.strictEqual(percentEncode('a/b?c', 'query'), 'a/b?c');
    });

    // RFC 3986 §3.3: path does not allow / (gen-delim)
    it('encodes / in path component', () => {
        assert.strictEqual(percentEncode('a/b', 'path'), 'a%2Fb');
    });
});

// RFC 3986 §2.1: Percent-Decoding
describe('percentDecode (RFC 3986 Section 2.1)', () => {
    it('decodes percent-encoded sequences', () => {
        assert.strictEqual(percentDecode('%20'), ' ');
        assert.strictEqual(percentDecode('%2F'), '/');
        assert.strictEqual(percentDecode('%3A'), ':');
    });

    it('handles mixed encoded and plain text', () => {
        assert.strictEqual(percentDecode('hello%20world'), 'hello world');
        assert.strictEqual(percentDecode('path%2Fto%2Ffile'), 'path/to/file');
    });

    it('decodes lowercase hex digits', () => {
        assert.strictEqual(percentDecode('%2f'), '/');
        assert.strictEqual(percentDecode('%3a'), ':');
    });

    it('decodes UTF-8 multi-byte sequences', () => {
        assert.strictEqual(percentDecode('%C3%A9'), 'é');
        assert.strictEqual(percentDecode('%E6%97%A5'), '日');
    });

    it('returns original string if no percent-encoding', () => {
        assert.strictEqual(percentDecode('hello'), 'hello');
        assert.strictEqual(percentDecode(''), '');
    });

    it('returns original for invalid percent sequences', () => {
        // Invalid hex - should keep original
        assert.strictEqual(percentDecode('%GG'), '%GG');
        assert.strictEqual(percentDecode('%2'), '%2');
    });
});

// RFC 3986 §5.2.4: Remove Dot Segments
describe('removeDotSegments (RFC 3986 Section 5.2.4)', () => {
    // Examples from RFC 3986 §5.4.1 (Normal Examples)
    it('removes single dot segment: ./g -> g', () => {
        assert.strictEqual(removeDotSegments('./g'), 'g');
    });

    it('removes mid-path single dot: /a/./b -> /a/b', () => {
        assert.strictEqual(removeDotSegments('/a/./b'), '/a/b');
    });

    it('handles double dot: /a/b/../c -> /a/c', () => {
        assert.strictEqual(removeDotSegments('/a/b/../c'), '/a/c');
    });

    it('handles complex path: /a/b/c/./../../g -> /a/g', () => {
        assert.strictEqual(removeDotSegments('/a/b/c/./../../g'), '/a/g');
    });

    // Examples from RFC 3986 §5.4.2 (Abnormal Examples)
    it('cannot traverse above root: /../g -> /g', () => {
        assert.strictEqual(removeDotSegments('/../g'), '/g');
    });

    it('handles excessive parent refs: ../../../g -> g', () => {
        assert.strictEqual(removeDotSegments('../../../g'), 'g');
    });

    it('handles trailing dot: /a/b/. -> /a/b/', () => {
        assert.strictEqual(removeDotSegments('/a/b/.'), '/a/b/');
    });

    it('handles trailing double dot: /a/b/.. -> /a/', () => {
        assert.strictEqual(removeDotSegments('/a/b/..'), '/a/');
    });

    it('handles standalone dot', () => {
        assert.strictEqual(removeDotSegments('.'), '');
    });

    it('handles standalone double dot', () => {
        assert.strictEqual(removeDotSegments('..'), '');
    });

    it('handles empty path', () => {
        assert.strictEqual(removeDotSegments(''), '');
    });

    it('preserves paths without dots', () => {
        assert.strictEqual(removeDotSegments('/a/b/c'), '/a/b/c');
        assert.strictEqual(removeDotSegments('a/b/c'), 'a/b/c');
    });

    // Additional edge cases from §5.4.2
    it('handles mid-path double dot: mid/content=5/../6 -> mid/6', () => {
        assert.strictEqual(removeDotSegments('mid/content=5/../6'), 'mid/6');
    });

    it('handles /. at end: /a/b/c/. -> /a/b/c/', () => {
        assert.strictEqual(removeDotSegments('/a/b/c/.'), '/a/b/c/');
    });
});

// RFC 3986 §6.2.2: Syntax-Based Normalization
describe('normalizeUri (RFC 3986 Section 6.2.2)', () => {
    // §6.2.2.1: Case Normalization
    describe('Case Normalization (Section 6.2.2.1)', () => {
        it('lowercases scheme: HTTP -> http', () => {
            assert.strictEqual(normalizeUri('HTTP://example.com/'), 'http://example.com/');
        });

        it('lowercases mixed case scheme: HtTp -> http', () => {
            assert.strictEqual(normalizeUri('HtTp://example.com/'), 'http://example.com/');
        });

        it('lowercases host: Example.COM -> example.com', () => {
            assert.strictEqual(normalizeUri('http://Example.COM/'), 'http://example.com/');
        });

        it('uppercases percent-encoding hex: %2f -> %2F', () => {
            assert.strictEqual(normalizeUri('http://example.com/a%2fb'), 'http://example.com/a%2Fb');
        });
    });

    // §6.2.2.2: Percent-Encoding Normalization
    describe('Percent-Encoding Normalization (Section 6.2.2.2)', () => {
        it('decodes unreserved characters: %41 -> A', () => {
            assert.strictEqual(normalizeUri('http://example.com/%41'), 'http://example.com/A');
        });

        it('decodes unreserved: %7E -> ~', () => {
            assert.strictEqual(normalizeUri('http://example.com/%7E'), 'http://example.com/~');
        });

        it('preserves reserved encoding: %2F stays %2F', () => {
            assert.strictEqual(normalizeUri('http://example.com/a%2Fb'), 'http://example.com/a%2Fb');
        });

        it('decodes multiple unreserved chars', () => {
            // %41%42%43 = ABC
            assert.strictEqual(normalizeUri('http://example.com/%41%42%43'), 'http://example.com/ABC');
        });
    });

    // §6.2.2.3: Path Segment Normalization
    describe('Path Segment Normalization (Section 6.2.2.3)', () => {
        it('removes dot segments from path', () => {
            assert.strictEqual(normalizeUri('http://example.com/a/./b/../c'), 'http://example.com/a/c');
        });

        it('handles trailing dot segment', () => {
            assert.strictEqual(normalizeUri('http://example.com/a/b/.'), 'http://example.com/a/b/');
        });
    });

    // §6.2.3: Scheme-Based Normalization
    describe('Scheme-Based Normalization (Section 6.2.3)', () => {
        it('removes default port 80 for http', () => {
            assert.strictEqual(normalizeUri('http://example.com:80/'), 'http://example.com/');
        });

        it('removes default port 443 for https', () => {
            assert.strictEqual(normalizeUri('https://example.com:443/'), 'https://example.com/');
        });

        it('preserves non-default ports', () => {
            assert.strictEqual(normalizeUri('http://example.com:8080/'), 'http://example.com:8080/');
            assert.strictEqual(normalizeUri('https://example.com:8443/'), 'https://example.com:8443/');
        });

        it('adds empty path / when authority present', () => {
            assert.strictEqual(normalizeUri('http://example.com'), 'http://example.com/');
        });

        // RFC 3986 §3: Non-authority schemes use "scheme:path" (no "//").
        it('does not force authority form for mailto URIs', () => {
            assert.strictEqual(
                normalizeUri('MAILTO:User%2EName@Example.COM'),
                'mailto:User.Name@Example.COM'
            );
        });

        // RFC 3986 §3: URN syntax is "urn:NID:NSS" without authority.
        it('does not force authority form for URN URIs', () => {
            assert.strictEqual(
                normalizeUri('URN:example:A%2Db%2Fc'),
                'urn:example:A-b%2Fc'
            );
        });
    });

    // Combined normalization
    describe('Combined normalization', () => {
        it('normalizes complex URI', () => {
            const input = 'HTTP://Example.COM:80/a/./b/../c/%41?query';
            const expected = 'http://example.com/a/c/A?query';
            assert.strictEqual(normalizeUri(input), expected);
        });

        it('preserves query string', () => {
            assert.strictEqual(
                normalizeUri('http://example.com/path?foo=bar&baz=qux'),
                'http://example.com/path?foo=bar&baz=qux'
            );
        });

        it('preserves fragment', () => {
            assert.strictEqual(
                normalizeUri('http://example.com/path#section'),
                'http://example.com/path#section'
            );
        });

        it('handles empty input', () => {
            assert.strictEqual(normalizeUri(''), '');
        });
    });
});

// RFC 3986 §6.2.1: Simple String Comparison
describe('compareUris (RFC 3986 Section 6.2.1)', () => {
    it('matches identical URIs', () => {
        assert.strictEqual(compareUris('http://example.com/', 'http://example.com/'), true);
    });

    it('matches after case normalization', () => {
        assert.strictEqual(
            compareUris('HTTP://Example.COM/', 'http://example.com/'),
            true
        );
    });

    it('matches after percent-encoding normalization', () => {
        assert.strictEqual(
            compareUris('http://example.com/%41', 'http://example.com/A'),
            true
        );
    });

    it('matches after default port removal', () => {
        assert.strictEqual(
            compareUris('http://example.com:80/', 'http://example.com/'),
            true
        );
    });

    it('matches after dot segment removal', () => {
        assert.strictEqual(
            compareUris('http://example.com/a/../b', 'http://example.com/b'),
            true
        );
    });

    it('does not match different paths', () => {
        assert.strictEqual(
            compareUris('http://example.com/a', 'http://example.com/b'),
            false
        );
    });

    it('does not match different schemes', () => {
        assert.strictEqual(
            compareUris('http://example.com/', 'https://example.com/'),
            false
        );
    });

    it('does not match different hosts', () => {
        assert.strictEqual(
            compareUris('http://example.com/', 'http://example.org/'),
            false
        );
    });

    it('does not match different ports', () => {
        assert.strictEqual(
            compareUris('http://example.com:8080/', 'http://example.com:9090/'),
            false
        );
    });

    it('does not match with/without query', () => {
        assert.strictEqual(
            compareUris('http://example.com/', 'http://example.com/?foo'),
            false
        );
    });
});

// Constants
describe('URI Constants (RFC 3986 Section 2)', () => {
    it('UNRESERVED_CHARS contains all unreserved characters', () => {
        // Should contain A-Z, a-z, 0-9, -, ., _, ~
        assert.ok(UNRESERVED_CHARS.includes('A'));
        assert.ok(UNRESERVED_CHARS.includes('Z'));
        assert.ok(UNRESERVED_CHARS.includes('a'));
        assert.ok(UNRESERVED_CHARS.includes('z'));
        assert.ok(UNRESERVED_CHARS.includes('0'));
        assert.ok(UNRESERVED_CHARS.includes('9'));
        assert.ok(UNRESERVED_CHARS.includes('-'));
        assert.ok(UNRESERVED_CHARS.includes('.'));
        assert.ok(UNRESERVED_CHARS.includes('_'));
        assert.ok(UNRESERVED_CHARS.includes('~'));
    });

    it('GEN_DELIMS contains all gen-delims', () => {
        assert.ok(GEN_DELIMS.includes(':'));
        assert.ok(GEN_DELIMS.includes('/'));
        assert.ok(GEN_DELIMS.includes('?'));
        assert.ok(GEN_DELIMS.includes('#'));
        assert.ok(GEN_DELIMS.includes('['));
        assert.ok(GEN_DELIMS.includes(']'));
        assert.ok(GEN_DELIMS.includes('@'));
    });

    it('SUB_DELIMS contains all sub-delims', () => {
        assert.ok(SUB_DELIMS.includes('!'));
        assert.ok(SUB_DELIMS.includes('$'));
        assert.ok(SUB_DELIMS.includes('&'));
        assert.ok(SUB_DELIMS.includes("'"));
        assert.ok(SUB_DELIMS.includes('('));
        assert.ok(SUB_DELIMS.includes(')'));
        assert.ok(SUB_DELIMS.includes('*'));
        assert.ok(SUB_DELIMS.includes('+'));
        assert.ok(SUB_DELIMS.includes(','));
        assert.ok(SUB_DELIMS.includes(';'));
        assert.ok(SUB_DELIMS.includes('='));
    });
});
