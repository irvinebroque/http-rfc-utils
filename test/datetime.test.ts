/**
 * Tests for datetime behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTTPDate, parseRFC3339 } from '../src/datetime.js';

const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// RFC 3339 §5.6: Internet Date/Time Format parsing.
describe('parseRFC3339', () => {
    it('parses basic UTC timestamps', () => {
        const result = parseRFC3339('2026-02-01T00:00:00Z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-01T00:00:00.000Z');
    });

    it('parses timestamps with offsets', () => {
        const result = parseRFC3339('2026-02-01T01:00:00+01:00');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-01T00:00:00.000Z');
    });

    it('parses leap day in leap year', () => {
        const result = parseRFC3339('2024-02-29T12:00:00Z');
        assert.ok(result instanceof Date);
    });

    it('rejects invalid calendar dates', () => {
        const result = parseRFC3339('2026-02-30T00:00:00Z');
        assert.equal(result, null);
    });

    it('rejects invalid time values', () => {
        const result = parseRFC3339('2026-02-01T24:00:00Z');
        assert.equal(result, null);
    });

    // RFC 3339 §5.7: second value 60 is allowed for leap seconds.
    it('accepts leap seconds and maps to the instant after :59', () => {
        const result = parseRFC3339('2026-02-01T23:59:60Z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-02T00:00:00.000Z');
    });

    it('rejects invalid offsets', () => {
        const result = parseRFC3339('2026-02-01T00:00:00+24:00');
        assert.equal(result, null);
    });

    it('truncates fractional seconds to milliseconds', () => {
        const result = parseRFC3339('2026-02-01T00:00:00.1234Z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-01T00:00:00.123Z');
    });

    // RFC 3339 §5.6 NOTE: "T" and "Z" may alternatively be lowercase.
    it('accepts lowercase t separator', () => {
        const result = parseRFC3339('2026-02-01t00:00:00Z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-01T00:00:00.000Z');
    });

    it('accepts lowercase z for UTC', () => {
        const result = parseRFC3339('2026-02-01T00:00:00z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-01T00:00:00.000Z');
    });

    it('accepts both lowercase t and z', () => {
        const result = parseRFC3339('2026-02-01t00:00:00z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-01T00:00:00.000Z');
    });

    // RFC 3339 §5.6 NOTE: Applications may use space instead of "T".
    it('accepts space instead of T separator', () => {
        const result = parseRFC3339('2026-02-01 00:00:00Z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-01T00:00:00.000Z');
    });

    it('accepts space separator with offset', () => {
        const result = parseRFC3339('2026-02-01 01:00:00+01:00');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '2026-02-01T00:00:00.000Z');
    });
});

// RFC 3339 §5.8: Normative examples from the RFC.
describe('parseRFC3339 RFC examples', () => {
    it('parses §5.8 example 1: UTC with fractional seconds', () => {
        const result = parseRFC3339('1985-04-12T23:20:50.52Z');
        assert.ok(result instanceof Date);
        assert.equal(result!.getUTCFullYear(), 1985);
        assert.equal(result!.getUTCMonth(), 3); // April = 3
        assert.equal(result!.getUTCDate(), 12);
        assert.equal(result!.getUTCHours(), 23);
        assert.equal(result!.getUTCMinutes(), 20);
        assert.equal(result!.getUTCSeconds(), 50);
        assert.equal(result!.getUTCMilliseconds(), 520);
    });

    it('parses §5.8 example 2: negative offset (PST)', () => {
        const result = parseRFC3339('1996-12-19T16:39:57-08:00');
        assert.ok(result instanceof Date);
        // Equivalent to 1996-12-20T00:39:57Z
        assert.equal(result!.toISOString(), '1996-12-20T00:39:57.000Z');
    });

    // RFC 3339 §5.7: leap second is accepted and mapped to next representable instant.
    it('parses §5.8 example 3: leap second at end of 1990', () => {
        const result = parseRFC3339('1990-12-31T23:59:60Z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '1991-01-01T00:00:00.000Z');
    });

    it('parses §5.8 example 4: leap second in PST', () => {
        const result = parseRFC3339('1990-12-31T15:59:60-08:00');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '1991-01-01T00:00:00.000Z');
    });

    // RFC 3339 §5.7: secfrac remains valid when leap second is used.
    it('maps leap second fractional part after :59 boundary', () => {
        const result = parseRFC3339('1990-12-31T23:59:60.250Z');
        assert.ok(result instanceof Date);
        assert.equal(result!.toISOString(), '1991-01-01T00:00:00.250Z');
    });

    it('parses §5.8 example 5: historical offset (Netherlands)', () => {
        const result = parseRFC3339('1937-01-01T12:00:27.87+00:20');
        assert.ok(result instanceof Date);
        // +00:20 offset means UTC is 20 minutes earlier
        assert.equal(result!.getUTCHours(), 11);
        assert.equal(result!.getUTCMinutes(), 40);
        assert.equal(result!.getUTCSeconds(), 27);
        assert.equal(result!.getUTCMilliseconds(), 870);
    });
});

describe('parseHTTPDate', () => {
    // RFC 9110 §5.6.7: IMF-fixdate parsing.
    it('parses IMF-fixdate', () => {
        const parsed = parseHTTPDate('Sun, 06 Nov 1994 08:49:37 GMT');
        assert.ok(parsed instanceof Date);
        assert.equal(parsed!.toUTCString(), 'Sun, 06 Nov 1994 08:49:37 GMT');
    });

    // RFC 9110 §5.6.7: asctime-date parsing.
    it('parses asctime-date', () => {
        const parsed = parseHTTPDate('Sun Nov  6 08:49:37 1994');
        assert.ok(parsed instanceof Date);
        assert.equal(parsed!.toUTCString(), 'Sun, 06 Nov 1994 08:49:37 GMT');
    });

    // RFC 9110 §5.6.7, RFC 850 §2: rfc850-date two-digit year.
    it('parses RFC 850 dates using a sliding 50-year window', () => {
        const nowYear = new Date().getUTCFullYear();
        const currentCentury = Math.floor(nowYear / 100) * 100;
        const twoDigit = (nowYear + 51) % 100;
        const candidate = currentCentury + twoDigit;
        const expectedYear = candidate > nowYear + 50 ? candidate - 100 : candidate;
        const twoDigitStr = String(twoDigit).padStart(2, '0');
        const weekday = FULL_DAY_NAMES[new Date(Date.UTC(expectedYear, 10, 6)).getUTCDay()];
        const parsed = parseHTTPDate(`${weekday}, 06-Nov-${twoDigitStr} 08:49:37 GMT`);

        assert.ok(parsed instanceof Date);
        assert.equal(parsed!.getUTCFullYear(), expectedYear);
    });

    // RFC 9110 §5.6.7, RFC 850 §2: rfc850-date two-digit year.
    it('parses RFC 850 dates for current two-digit year', () => {
        const nowYear = new Date().getUTCFullYear();
        const twoDigitStr = String(nowYear % 100).padStart(2, '0');
        const weekday = FULL_DAY_NAMES[new Date(Date.UTC(nowYear, 10, 6)).getUTCDay()];
        const parsed = parseHTTPDate(`${weekday}, 06-Nov-${twoDigitStr} 08:49:37 GMT`);

        assert.ok(parsed instanceof Date);
        assert.equal(parsed!.getUTCFullYear(), nowYear);
    });

    // RFC 9110 §5.6.7: senders MUST generate a weekday matching the calendar date.
    it('rejects IMF-fixdate weekday/date mismatch', () => {
        const parsed = parseHTTPDate('Sat, 31 Dec 2018 23:59:59 GMT');
        assert.equal(parsed, null);
    });

    it('rejects impossible IMF-fixdate calendar day', () => {
        const parsed = parseHTTPDate('Mon, 31 Apr 2026 08:49:37 GMT');
        assert.equal(parsed, null);
    });

    it('rejects impossible asctime calendar day', () => {
        const parsed = parseHTTPDate('Tue Feb 30 08:49:37 1994');
        assert.equal(parsed, null);
    });

    it('rejects invalid RFC 850 time values', () => {
        const parsed = parseHTTPDate('Sunday, 06-Nov-94 08:49:60 GMT');
        assert.equal(parsed, null);
    });
});
