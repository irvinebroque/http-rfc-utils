import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseDeprecation,
    formatDeprecation,
    isDeprecated,
    validateDeprecationSunsetOrder,
    buildDeprecationHeaders,
} from '../src/deprecation.js';

describe('parseDeprecation (RFC 9745 §2.1)', () => {
    it('parses a valid Deprecation date', () => {
        const date = parseDeprecation('@1688169599');
        assert.ok(date);
        assert.strictEqual(date.toISOString(), '2023-06-30T23:59:59.000Z');
    });

    it('parses a date with leading/trailing whitespace', () => {
        const date = parseDeprecation('  @1688169599  ');
        assert.ok(date);
        assert.strictEqual(date.toISOString(), '2023-06-30T23:59:59.000Z');
    });

    it('parses Unix epoch', () => {
        const date = parseDeprecation('@0');
        assert.ok(date);
        assert.strictEqual(date.toISOString(), '1970-01-01T00:00:00.000Z');
    });

    it('parses negative timestamp', () => {
        const date = parseDeprecation('@-86400');
        assert.ok(date);
        assert.strictEqual(date.toISOString(), '1969-12-31T00:00:00.000Z');
    });

    it('returns null for empty string', () => {
        assert.strictEqual(parseDeprecation(''), null);
    });

    it('returns null for whitespace-only', () => {
        assert.strictEqual(parseDeprecation('  '), null);
    });

    it('returns null for non-date structured field (integer)', () => {
        assert.strictEqual(parseDeprecation('1688169599'), null);
    });

    it('returns null for non-date structured field (string)', () => {
        assert.strictEqual(parseDeprecation('"2023-06-30"'), null);
    });

    it('returns null for non-date structured field (boolean)', () => {
        assert.strictEqual(parseDeprecation('?1'), null);
    });

    it('returns null for HTTP-date format (not RFC 9651 Date)', () => {
        assert.strictEqual(parseDeprecation('Fri, 30 Jun 2023 23:59:59 GMT'), null);
    });

    it('returns null for decimal after @', () => {
        assert.strictEqual(parseDeprecation('@1688169599.5'), null);
    });
});

describe('formatDeprecation (RFC 9745 §2.1)', () => {
    it('formats a date as RFC 9651 Date item', () => {
        const result = formatDeprecation(new Date('2023-06-30T23:59:59Z'));
        assert.strictEqual(result, '@1688169599');
    });

    it('formats Unix epoch', () => {
        const result = formatDeprecation(new Date('1970-01-01T00:00:00Z'));
        assert.strictEqual(result, '@0');
    });

    it('truncates sub-second precision', () => {
        const result = formatDeprecation(new Date('2023-06-30T23:59:59.999Z'));
        assert.strictEqual(result, '@1688169599');
    });
});

describe('isDeprecated (RFC 9745 §2.1)', () => {
    it('returns false for null', () => {
        assert.strictEqual(isDeprecated(null), false);
    });

    it('returns true for past date', () => {
        const past = new Date('2020-01-01T00:00:00Z');
        assert.strictEqual(isDeprecated(past), true);
    });

    it('returns false for future date', () => {
        const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        assert.strictEqual(isDeprecated(future), false);
    });
});

describe('validateDeprecationSunsetOrder (RFC 9745 §3)', () => {
    it('returns true when sunset is after deprecation', () => {
        const deprecation = new Date('2025-01-01T00:00:00Z');
        const sunset = new Date('2025-07-01T00:00:00Z');
        assert.strictEqual(validateDeprecationSunsetOrder(deprecation, sunset), true);
    });

    it('returns true when sunset equals deprecation', () => {
        const date = new Date('2025-01-01T00:00:00Z');
        assert.strictEqual(validateDeprecationSunsetOrder(date, date), true);
    });

    it('returns false when sunset is before deprecation', () => {
        const deprecation = new Date('2025-07-01T00:00:00Z');
        const sunset = new Date('2025-01-01T00:00:00Z');
        assert.strictEqual(validateDeprecationSunsetOrder(deprecation, sunset), false);
    });
});

describe('buildDeprecationHeaders (RFC 9745 §2.1 + RFC 8594 §3)', () => {
    it('builds Deprecation header only', () => {
        const headers = buildDeprecationHeaders(new Date('2023-06-30T23:59:59Z'));
        assert.strictEqual(headers['Deprecation'], '@1688169599');
        assert.strictEqual(headers['Sunset'], undefined);
    });

    it('builds both Deprecation and Sunset headers', () => {
        const headers = buildDeprecationHeaders(
            new Date('2023-06-30T23:59:59Z'),
            new Date('2024-06-30T23:59:59Z'),
        );
        assert.strictEqual(headers['Deprecation'], '@1688169599');
        // Sunset uses HTTP-date format (IMF-fixdate)
        assert.ok(headers['Sunset']?.includes('GMT'));
        assert.ok(headers['Sunset']?.includes('2024'));
    });
});

describe('parseDeprecation + formatDeprecation round-trip', () => {
    it('round-trips a deprecation date', () => {
        const original = new Date('2025-03-15T12:00:00Z');
        const formatted = formatDeprecation(original);
        const parsed = parseDeprecation(formatted);
        assert.ok(parsed);
        assert.strictEqual(parsed.toISOString(), original.toISOString());
    });
});
