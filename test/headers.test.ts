import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseRetryAfter, formatRetryAfter, mergeVary, parseSunset, formatSunset, isSunsetImminent } from '../src/headers.js';
import { LinkRelation, parseLinkHeader } from '../src/link.js';

describe('Retry-After + Vary (RFC 9110 Sections 10.2.3, 12.5.5)', () => {
    it('parses Retry-After delta-seconds (RFC 9110 Section 10.2.3)', () => {
        const parsed = parseRetryAfter('120');
        assert.deepEqual(parsed, { delaySeconds: 120 });
    });

    it('parses Retry-After HTTP-date (RFC 9110 Section 10.2.3)', () => {
        const parsed = parseRetryAfter('Sun, 06 Nov 1994 08:49:37 GMT');
        assert.equal(parsed?.date?.toUTCString(), 'Sun, 06 Nov 1994 08:49:37 GMT');
    });

    it('formats Retry-After values (RFC 9110 Section 10.2.3)', () => {
        assert.equal(formatRetryAfter(60), '60');
    });

    it('merges Vary values and honors * (RFC 9110 Section 12.5.5)', () => {
        assert.equal(mergeVary('Accept-Encoding', 'Accept-Language'), 'Accept-Encoding, Accept-Language');
        assert.equal(mergeVary('*', 'Accept-Encoding'), '*');
    });
});

// RFC 8594 §3: The Sunset HTTP Response Header Field
describe('parseSunset (RFC 8594 Section 3)', () => {
    // RFC 8594 §3: Sunset = HTTP-date
    it('parses valid IMF-fixdate', () => {
        const result = parseSunset('Sat, 31 Dec 2018 23:59:59 GMT');
        assert.ok(result instanceof Date);
        assert.equal(result!.toUTCString(), 'Mon, 31 Dec 2018 23:59:59 GMT');
    });

    // RFC 8594 §9: Example from spec
    it('parses example from RFC 8594 Section 9', () => {
        const result = parseSunset('Wed, 11 Nov 2026 11:11:11 GMT');
        assert.ok(result instanceof Date);
        assert.equal(result!.getUTCFullYear(), 2026);
        assert.equal(result!.getUTCMonth(), 10); // November = 10
        assert.equal(result!.getUTCDate(), 11);
    });

    // RFC 8594 §3: Past dates are valid (mean "now")
    it('parses past dates without error', () => {
        const result = parseSunset('Sun, 06 Nov 1994 08:49:37 GMT');
        assert.ok(result instanceof Date);
        assert.equal(result!.toUTCString(), 'Sun, 06 Nov 1994 08:49:37 GMT');
    });

    it('returns null for empty string', () => {
        assert.equal(parseSunset(''), null);
    });

    it('returns null for whitespace-only string', () => {
        assert.equal(parseSunset('   '), null);
    });

    it('returns null for invalid date', () => {
        assert.equal(parseSunset('not-a-date'), null);
    });

    it('trims whitespace before parsing', () => {
        const result = parseSunset('  Wed, 11 Nov 2026 11:11:11 GMT  ');
        assert.ok(result instanceof Date);
    });
});

describe('formatSunset (RFC 8594 Section 3)', () => {
    // RFC 8594 §3: Format as HTTP-date
    it('formats Date as IMF-fixdate', () => {
        const date = new Date('2026-12-31T23:59:59Z');
        const result = formatSunset(date);
        assert.equal(result, 'Thu, 31 Dec 2026 23:59:59 GMT');
    });

    it('formats example date from RFC 8594 Section 9', () => {
        const date = new Date('2026-11-11T11:11:11Z');
        const result = formatSunset(date);
        assert.equal(result, 'Wed, 11 Nov 2026 11:11:11 GMT');
    });
});

describe('isSunsetImminent (RFC 8594 Section 3)', () => {
    // RFC 8594 §3: Past dates mean resource may become unavailable at any time
    it('returns true for past dates with default threshold', () => {
        const past = new Date(Date.now() - 86400000); // 1 day ago
        assert.equal(isSunsetImminent(past), true);
    });

    it('returns true for current time', () => {
        const now = new Date();
        assert.equal(isSunsetImminent(now), true);
    });

    it('returns false for future dates beyond threshold', () => {
        const future = new Date(Date.now() + 86400000 * 7); // 7 days from now
        assert.equal(isSunsetImminent(future, 86400000), false); // 1 day threshold
    });

    it('returns true for future dates within threshold', () => {
        const future = new Date(Date.now() + 3600000); // 1 hour from now
        assert.equal(isSunsetImminent(future, 86400000), true); // 1 day threshold
    });

    it('returns false for null sunset', () => {
        assert.equal(isSunsetImminent(null), false);
    });

    it('returns false for far future dates with zero threshold', () => {
        const farFuture = new Date(Date.now() + 86400000 * 365); // 1 year from now
        assert.equal(isSunsetImminent(farFuture, 0), false);
    });
});

// RFC 8594 §6: The Sunset Link Relation Type
describe('LinkRelation.SUNSET (RFC 8594 Section 6)', () => {
    it('includes sunset relation type', () => {
        assert.equal(LinkRelation.SUNSET, 'sunset');
    });
});

// RFC 8594 §9: Link header example
describe('parseLinkHeader with sunset (RFC 8594 Section 9)', () => {
    it('parses sunset link relation', () => {
        const links = parseLinkHeader('<http://example.net/sunset>;rel="sunset";type="text/html"');
        assert.equal(links.length, 1);
        assert.equal(links[0].rel, 'sunset');
        assert.equal(links[0].href, 'http://example.net/sunset');
        assert.equal(links[0].type, 'text/html');
    });

    it('parses sunset link without type parameter', () => {
        const links = parseLinkHeader('<http://example.net/policy>;rel="sunset"');
        assert.equal(links.length, 1);
        assert.equal(links[0].rel, 'sunset');
        assert.equal(links[0].href, 'http://example.net/policy');
    });
});
