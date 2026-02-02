import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    decodeExtValue,
    encodeExtValue,
    needsExtendedEncoding,
    isAttrChar,
} from '../src/ext-value.js';

// RFC 8187 §3.2.1: attr-char validation.
describe('isAttrChar', () => {
    it('accepts alphanumeric characters', () => {
        assert.equal(isAttrChar('a'), true);
        assert.equal(isAttrChar('Z'), true);
        assert.equal(isAttrChar('0'), true);
        assert.equal(isAttrChar('9'), true);
    });

    it('accepts special attr-char characters', () => {
        const attrChars = '!#$&+-.^_`|~';
        for (const char of attrChars) {
            assert.equal(isAttrChar(char), true, `${char} should be attr-char`);
        }
    });

    // RFC 8187 §3.2.1: attr-char excludes *, ', %
    it('rejects asterisk, single quote, percent', () => {
        assert.equal(isAttrChar('*'), false);
        assert.equal(isAttrChar("'"), false);
        assert.equal(isAttrChar('%'), false);
    });

    it('rejects space and other non-attr-char', () => {
        assert.equal(isAttrChar(' '), false);
        assert.equal(isAttrChar('"'), false);
        assert.equal(isAttrChar(';'), false);
        assert.equal(isAttrChar(','), false);
        assert.equal(isAttrChar('='), false);
    });

    it('rejects multi-character strings', () => {
        assert.equal(isAttrChar('ab'), false);
    });

    it('rejects empty string', () => {
        assert.equal(isAttrChar(''), false);
    });
});

// RFC 8187 §3.2: Determine if ext-value encoding is required.
describe('needsExtendedEncoding', () => {
    it('returns false for ASCII attr-char only', () => {
        assert.equal(needsExtendedEncoding('simple'), false);
        assert.equal(needsExtendedEncoding('file.txt'), false);
        assert.equal(needsExtendedEncoding('a-b_c'), false);
    });

    it('returns true for non-ASCII characters', () => {
        assert.equal(needsExtendedEncoding('£'), true);
        assert.equal(needsExtendedEncoding('€'), true);
        assert.equal(needsExtendedEncoding('über'), true);
        assert.equal(needsExtendedEncoding('日本語'), true);
    });

    it('returns true for spaces', () => {
        assert.equal(needsExtendedEncoding('hello world'), true);
    });

    it('returns true for special characters needing encoding', () => {
        assert.equal(needsExtendedEncoding("it's"), true); // single quote
        assert.equal(needsExtendedEncoding('100%'), true); // percent
        assert.equal(needsExtendedEncoding('a*b'), true);  // asterisk
    });

    it('returns false for empty string', () => {
        assert.equal(needsExtendedEncoding(''), false);
    });
});

// RFC 8187 §3.2.1: Extended parameter value decoding.
describe('decodeExtValue', () => {
    // RFC 8187 §3.2.3 Example 1: pound sign
    it('decodes UTF-8 pound sign (RFC 8187 §3.2.3)', () => {
        const result = decodeExtValue("utf-8'en'%C2%A3%20rates");
        assert.ok(result);
        assert.equal(result.charset, 'utf-8');
        assert.equal(result.language, 'en');
        assert.equal(result.value, '£ rates');
    });

    // RFC 8187 §3.2.3 Example 2: pound and euro with empty language
    it('decodes mixed currency symbols (RFC 8187 §3.2.3)', () => {
        const result = decodeExtValue("UTF-8''%c2%a3%20and%20%e2%82%ac%20rates");
        assert.ok(result);
        assert.equal(result.value, '£ and € rates');
        assert.equal(result.language, undefined); // Empty language becomes undefined
    });

    // RFC 8187 §3.2.1: charset is case-insensitive
    it('normalizes charset to lowercase (RFC 8187 §3.2.1)', () => {
        const result = decodeExtValue("UTF-8'de'test");
        assert.ok(result);
        assert.equal(result.charset, 'utf-8');
        assert.equal(result.language, 'de');
    });

    // RFC 8187 §3.2.3: HEXDIG allows both lowercase and uppercase
    it('handles lowercase hex digits (RFC 8187 §3.2.3)', () => {
        const result = decodeExtValue("utf-8''%c2%a3");
        assert.ok(result);
        assert.equal(result.value, '£');
    });

    it('handles uppercase hex digits', () => {
        const result = decodeExtValue("utf-8''%C2%A3");
        assert.ok(result);
        assert.equal(result.value, '£');
    });

    // RFC 8187 §3.2: charset MUST NOT be omitted
    it('returns null for missing charset', () => {
        assert.equal(decodeExtValue("'en'value"), null);
    });

    it('returns null for empty charset', () => {
        assert.equal(decodeExtValue("''value"), null);
    });

    // RFC 8187 §3.2.1: malformed percent-encoding
    it('returns null for invalid percent-encoding', () => {
        assert.equal(decodeExtValue("utf-8''%ZZ"), null);
    });

    it('returns null for incomplete percent-encoding', () => {
        assert.equal(decodeExtValue("utf-8''%C"), null);
    });

    // RFC 8187 §3.2.1: ext-value must not be a quoted-string
    it('returns null for quoted-string format', () => {
        assert.equal(decodeExtValue('"utf-8\'\'value"'), null);
    });

    it('returns null for missing first quote', () => {
        assert.equal(decodeExtValue('utf-8value'), null);
    });

    it('returns null for missing second quote', () => {
        assert.equal(decodeExtValue("utf-8'envalue"), null);
    });

    it('handles value containing single quotes', () => {
        // Value after second quote can contain quotes
        const result = decodeExtValue("utf-8''it%27s");
        assert.ok(result);
        assert.equal(result.value, "it's");
    });

    it('handles empty value', () => {
        const result = decodeExtValue("utf-8''");
        assert.ok(result);
        assert.equal(result.value, '');
    });

    it('preserves attr-char in value without decoding', () => {
        const result = decodeExtValue("utf-8''simple-file.txt");
        assert.ok(result);
        assert.equal(result.value, 'simple-file.txt');
    });
});

// RFC 8187 §3.2: Extended parameter encoding.
describe('encodeExtValue', () => {
    it('encodes non-ASCII as UTF-8 percent-encoded', () => {
        const result = encodeExtValue('£ rates', { language: 'en' });
        assert.equal(result, "UTF-8'en'%C2%A3%20rates");
    });

    it('encodes euro sign correctly', () => {
        const result = encodeExtValue('€');
        assert.equal(result, "UTF-8''%E2%82%AC");
    });

    it('preserves attr-char without encoding', () => {
        const result = encodeExtValue('simple');
        assert.equal(result, "UTF-8''simple");
    });

    it('encodes spaces as %20', () => {
        const result = encodeExtValue('hello world');
        assert.equal(result, "UTF-8''hello%20world");
    });

    // RFC 8187 §3.2.1: attr-char excludes *, ', %
    it('encodes asterisk (RFC 8187 §3.2.1)', () => {
        const result = encodeExtValue('a*b');
        assert.equal(result, "UTF-8''a%2Ab");
    });

    it('encodes single quote (RFC 8187 §3.2.1)', () => {
        const result = encodeExtValue("it's");
        assert.equal(result, "UTF-8''it%27s");
    });

    it('encodes percent sign (RFC 8187 §3.2.1)', () => {
        const result = encodeExtValue('100%');
        assert.equal(result, "UTF-8''100%25");
    });

    it('includes language tag when provided', () => {
        const result = encodeExtValue('test', { language: 'de' });
        assert.equal(result, "UTF-8'de'test");
    });

    it('uses empty language when not provided', () => {
        const result = encodeExtValue('test');
        assert.equal(result, "UTF-8''test");
    });

    it('handles empty string', () => {
        const result = encodeExtValue('');
        assert.equal(result, "UTF-8''");
    });

    it('handles multi-byte UTF-8 sequences', () => {
        // Japanese characters
        const result = encodeExtValue('日本語');
        assert.ok(result.startsWith("UTF-8''"));
        // Verify round-trip
        const decoded = decodeExtValue(result);
        assert.ok(decoded);
        assert.equal(decoded.value, '日本語');
    });
});

// Round-trip tests
describe('encode/decode round-trip', () => {
    const testCases = [
        'simple',
        'hello world',
        '£ rates',
        '€ and £',
        "it's complicated",
        '100% complete',
        'file*.txt',
        '日本語ファイル名.txt',
        'Ümlauts and Çedillas',
        '',
    ];

    for (const value of testCases) {
        it(`round-trips "${value}"`, () => {
            const encoded = encodeExtValue(value, { language: 'en' });
            const decoded = decodeExtValue(encoded);
            assert.ok(decoded, `Failed to decode: ${encoded}`);
            assert.equal(decoded.value, value);
            assert.equal(decoded.language, 'en');
        });
    }
});
