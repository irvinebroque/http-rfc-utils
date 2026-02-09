import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseContentDisposition,
    formatContentDisposition,
    formatHeaderParam,
    parseExtValue,
    encodeExtValue,
} from '../src/content-disposition.js';

describe('Content-Disposition (RFC 6266 Section 4, RFC 8187 Section 3.2)', () => {
    it('parses basic attachment filename (RFC 6266 Section 4)', () => {
        const parsed = parseContentDisposition('attachment; filename="example.txt"');
        assert.equal(parsed?.type, 'attachment');
        assert.equal(parsed?.params.filename, 'example.txt');
    });

    it('parses filename* with RFC 8187 encoding (RFC 6266 Section 4.3)', () => {
        const parsed = parseContentDisposition('attachment; filename*=UTF-8\'\'%E2%82%AC%20rates');
        assert.equal(parsed?.params['filename*'], '\u20ac rates');
    });

    // RFC 6266 Section 4.3: filename* takes precedence over filename.
    it('prefers filename* over filename when both are present', () => {
        const parsed = parseContentDisposition(
            'attachment; filename="fallback.txt"; filename*=UTF-8\'\'preferred.txt'
        );
        assert.equal(parsed?.params.filename, 'preferred.txt');
        assert.equal(parsed?.params['filename*'], 'preferred.txt');
    });

    // RFC 6266 Section 4.3 + RFC 8187 Section 3.2.1: invalid filename* should not replace filename fallback.
    it('keeps filename fallback when filename* decoding fails', () => {
        const parsed = parseContentDisposition(
            'attachment; filename="fallback.txt"; filename*=UTF-8\'\'%ZZ'
        );
        assert.equal(parsed?.params.filename, 'fallback.txt');
        assert.equal(parsed?.params['filename*'], "UTF-8''%ZZ");
    });

    // RFC 8187 Section 3.2.1: malformed ext-value is invalid; no filename fallback exists.
    it('does not synthesize filename when only invalid filename* is present', () => {
        const parsed = parseContentDisposition('attachment; filename*=UTF-8\'\'%ZZ');
        assert.equal(parsed?.params.filename, undefined);
        assert.equal(parsed?.params['filename*'], "UTF-8''%ZZ");
    });

    it('formats filename* using RFC 8187 (RFC 8187 Section 3.2)', () => {
        const header = formatContentDisposition('attachment', {
            filenameStar: { value: '\u20ac rates' },
        });
        assert.equal(header, 'attachment; filename*=UTF-8\'\'%E2%82%AC%20rates');
    });

    it('formats header params with extended syntax when needed (RFC 8187 Section 3.2)', () => {
        const value = formatHeaderParam('\u20ac rates');
        assert.equal(value, "UTF-8''%E2%82%AC%20rates");
    });

    // RFC 9110 §5.5: reject CR/LF and CTLs in serialized header values.
    it('rejects control bytes when formatting', () => {
        assert.throws(() => {
            formatContentDisposition('attachment', { filename: 'evil\r\nname.txt' });
        }, /control characters/);
    });

    // RFC 9110 §5.6.2: disposition type and parameter names are tokens.
    it('rejects invalid token names when formatting', () => {
        assert.throws(() => {
            formatContentDisposition('bad type', { filename: 'ok.txt' });
        }, /valid header token/);

        assert.throws(() => {
            formatContentDisposition('attachment', { 'bad key': 'value' });
        }, /valid header token/);
    });
});

// RFC 8187 Section 3.2.1: ext-value parsing
describe('parseExtValue (RFC 8187 Section 3.2.1)', () => {
    it('parses charset, language, and value', () => {
        const result = parseExtValue("utf-8'en'%C2%A3%20rates");
        assert.deepEqual(result, { charset: 'utf-8', language: 'en', value: '£ rates' });
    });

    // RFC 8187 Section 3.2.3: Example without language
    it('parses without language (RFC 8187 Section 3.2.3 example)', () => {
        const result = parseExtValue("UTF-8''%c2%a3%20and%20%e2%82%ac%20rates");
        assert.deepEqual(result, { charset: 'utf-8', value: '£ and € rates' });
    });

    // RFC 8187 Section 3.2.1: charset and language are case-insensitive
    it('normalizes charset to lowercase', () => {
        const result = parseExtValue("UTF-8'en'hello");
        assert.equal(result?.charset, 'utf-8');
    });

    // RFC 8187 Section 3.2: charset is REQUIRED
    it('returns null for missing charset', () => {
        assert.equal(parseExtValue("'en'value"), null);
    });

    // RFC 8187 Section 3.2.1: ext-value requires two single quotes
    it('returns null for missing second quote', () => {
        assert.equal(parseExtValue("utf-8'en"), null);
    });

    it('returns null for missing first quote', () => {
        assert.equal(parseExtValue('utf-8value'), null);
    });

    // RFC 8187 Section 3.2.1: robust error handling for malformed percent-encoding
    it('returns null for invalid percent-encoding', () => {
        assert.equal(parseExtValue("utf-8''%ZZ"), null);
    });

    it('returns null for incomplete percent-encoding', () => {
        assert.equal(parseExtValue("utf-8''%C"), null);
    });

    it('returns null for truncated percent-encoding at end', () => {
        assert.equal(parseExtValue("utf-8''hello%"), null);
    });

    // RFC 8187 Section 3.2.3: HEXDIG allows both lowercase and uppercase
    it('handles lowercase hex digits (RFC 8187 Section 3.2.3)', () => {
        const result = parseExtValue("utf-8''%c2%a3");
        assert.equal(result?.value, '£');
    });

    it('handles uppercase hex digits', () => {
        const result = parseExtValue("utf-8''%C2%A3");
        assert.equal(result?.value, '£');
    });

    it('handles mixed case hex digits', () => {
        const result = parseExtValue("utf-8''%C2%a3");
        assert.equal(result?.value, '£');
    });

    // RFC 8187 Section 3.2.1: ext-value cannot use quoted-string notation
    it('returns null if value contains double quotes', () => {
        assert.equal(parseExtValue('utf-8\'\'"quoted"'), null);
    });

    // Language can contain single quotes in its value after parsing
    it('handles single quotes in the encoded value portion', () => {
        // The value chars can contain encoded single quotes
        const result = parseExtValue("utf-8''it%27s");
        assert.equal(result?.value, "it's");
    });

    it('handles empty value', () => {
        const result = parseExtValue("utf-8''");
        assert.deepEqual(result, { charset: 'utf-8', value: '' });
    });

    it('handles plain ASCII without encoding', () => {
        const result = parseExtValue("utf-8'en'hello-world");
        assert.deepEqual(result, { charset: 'utf-8', language: 'en', value: 'hello-world' });
    });
});

// RFC 8187 Section 3.2.1: ext-value encoding
describe('encodeExtValue (RFC 8187 Section 3.2.1)', () => {
    // RFC 8187 Section 3.2.1: Producers MUST use UTF-8
    it('encodes non-ASCII with UTF-8 charset', () => {
        assert.equal(encodeExtValue('£ rates'), "UTF-8''%C2%A3%20rates");
    });

    it('includes language when provided', () => {
        assert.equal(encodeExtValue('£ rates', { language: 'en' }), "UTF-8'en'%C2%A3%20rates");
    });

    // RFC 8187 Section 3.2.1: asterisk is not in attr-char
    it('encodes asterisk as %2A (not in attr-char)', () => {
        assert.equal(encodeExtValue('file*.txt'), "UTF-8''file%2A.txt");
    });

    // RFC 8187 Section 3.2.1: attr-char characters should not be encoded
    it('preserves attr-char characters unencoded', () => {
        // attr-char includes: ALPHA / DIGIT / "!" / "#" / "$" / "&" / "+" / "-" / "."
        //                    / "^" / "_" / "`" / "|" / "~"
        assert.equal(encodeExtValue('a-b_c.d'), "UTF-8''a-b_c.d");
        assert.equal(encodeExtValue('test!#$&+'), "UTF-8''test!#$&+");
        assert.equal(encodeExtValue('^foo`bar|baz~'), "UTF-8''^foo`bar|baz~");
    });

    // RFC 8187 Section 3.2.1: single quote is not in attr-char
    it('encodes single quote as %27', () => {
        assert.equal(encodeExtValue("it's"), "UTF-8''it%27s");
    });

    // RFC 8187 Section 3.2.1: percent is not in attr-char
    it('encodes percent as %25', () => {
        assert.equal(encodeExtValue('100%'), "UTF-8''100%25");
    });

    it('encodes space as %20', () => {
        assert.equal(encodeExtValue('hello world'), "UTF-8''hello%20world");
    });

    // RFC 8187 Section 3.2.3: Euro sign example
    it('encodes Euro sign correctly (RFC 8187 Section 3.2.3)', () => {
        const result = encodeExtValue('€ exchange rates');
        assert.equal(result, "UTF-8''%E2%82%AC%20exchange%20rates");
    });

    it('handles empty string', () => {
        assert.equal(encodeExtValue(''), "UTF-8''");
    });

    it('handles empty language explicitly', () => {
        assert.equal(encodeExtValue('test', { language: '' }), "UTF-8''test");
    });

    // Round-trip test
    it('round-trips through parse and encode', () => {
        const original = '£ and € rates';
        const encoded = encodeExtValue(original, { language: 'en' });
        const parsed = parseExtValue(encoded);
        assert.equal(parsed?.value, original);
        assert.equal(parsed?.language, 'en');
        assert.equal(parsed?.charset, 'utf-8');
    });
});
