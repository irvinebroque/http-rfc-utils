import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseSfItem,
    parseSfList,
    parseSfDict,
    serializeSfItem,
    serializeSfList,
    serializeSfDict,
} from '../src/structured-fields.js';

describe('Structured Fields (RFC 8941 Section 3)', () => {
    it('parses bare item types (RFC 8941 Section 3.3)', () => {
        assert.deepEqual(parseSfItem('42'), { value: 42 });
        assert.deepEqual(parseSfItem('?1'), { value: true });
        assert.deepEqual(parseSfItem('"hello"'), { value: 'hello' });
    });

    // RFC 8941 Section 3.2: dictionary keys are lowercase (lcalpha).
    it('rejects dictionary keys with uppercase letters', () => {
        const parsed = parseSfDict('A=1');
        assert.equal(parsed, null);
    });

    // RFC 8941 Section 3.3: integers are limited to 15 digits.
    it('rejects integers longer than 15 digits', () => {
        const parsed = parseSfItem('1234567890123456');
        assert.equal(parsed, null);
    });

    // RFC 8941 Section 3.3: decimals are limited to 12 digits before and 3 after the dot.
    it('rejects decimals with too many digits', () => {
        assert.equal(parseSfItem('1234567890123.1'), null);
        assert.equal(parseSfItem('1.1234'), null);
    });

    it('parses byte sequence (RFC 8941 Section 3.4)', () => {
        const parsed = parseSfItem(':aGVsbG8=:');
        assert.ok(parsed?.value instanceof Uint8Array);
        assert.equal(Buffer.from(parsed?.value ?? new Uint8Array()).toString('utf8'), 'hello');
    });

    // RFC 8941 Section 4.2.7: invalid base64 must fail parsing.
    it('rejects invalid base64 byte sequence', () => {
        const parsed = parseSfItem(':!!!:');
        assert.equal(parsed, null);
    });

    it('parses list with inner lists (RFC 8941 Section 3.1)', () => {
        const parsed = parseSfList('(a b);q=1.0, c');
        assert.equal(parsed?.length, 2);
    });

    it('parses dictionary values and parameters (RFC 8941 Section 3.2)', () => {
        const parsed = parseSfDict('a=1;foo=bar, b');
        assert.ok(parsed?.a);
        assert.ok(parsed?.b);
    });

    it('serializes list and dictionary (RFC 8941 Section 4)', () => {
        const list = serializeSfList([{ value: 'token' }, { items: [{ value: 1 }] }]);
        assert.equal(list, 'token, (1)');

        const dict = serializeSfDict({
            a: { value: true },
            b: { value: 10 },
        });
        assert.equal(dict, 'a, b=10');
    });

    it('serializes items with parameters (RFC 8941 Section 3.1.2)', () => {
        const item = serializeSfItem({ value: 'token', params: { foo: 'bar' } });
        assert.equal(item, 'token;foo=bar');
    });

    // RFC 8941 §3.3.4: Tokens can contain uppercase and special chars.
    it('parses token with uppercase letters', () => {
        const parsed = parseSfItem('FooBar');
        assert.deepEqual(parsed, { value: 'FooBar' });
    });

    // RFC 8941 §3.3.4: Tokens can contain colon and slash.
    it('parses token with colon and slash', () => {
        const parsed = parseSfItem('text/html');
        assert.deepEqual(parsed, { value: 'text/html' });
    });

    // RFC 8941 §3.3.4: Tokens can contain various tchar characters.
    it('parses token with tchar special characters', () => {
        const parsed = parseSfItem("foo!#$%&'*+^_`|~bar");
        assert.deepEqual(parsed, { value: "foo!#$%&'*+^_`|~bar" });
    });

    // RFC 8941 §3.3.3: Only \" and \\ are valid escapes.
    it('rejects invalid escape sequences', () => {
        assert.equal(parseSfItem('"foo\\nbar"'), null);
        assert.equal(parseSfItem('"foo\\tbar"'), null);
        assert.equal(parseSfItem('"foo\\abar"'), null);
    });

    // RFC 8941 §3.3.3: Valid escape sequences.
    it('accepts valid escape sequences', () => {
        assert.deepEqual(parseSfItem('"foo\\"bar"'), { value: 'foo"bar' });
        assert.deepEqual(parseSfItem('"foo\\\\bar"'), { value: 'foo\\bar' });
    });

    // RFC 8941 §3.3.3: String character range.
    it('rejects strings with control characters', () => {
        assert.equal(parseSfItem('"foo\x00bar"'), null);
        assert.equal(parseSfItem('"foo\x1Fbar"'), null);
    });

    // RFC 8941 §3.3.3: Reject high bytes.
    it('rejects strings with high bytes', () => {
        assert.equal(parseSfItem('"foo\x80bar"'), null);
        assert.equal(parseSfItem('"foo\xFFbar"'), null);
    });

    // RFC 8941 §4.1.4: Integer range.
    it('rejects integers outside RFC range during serialization', () => {
        assert.throws(() => serializeSfItem({ value: 9_999_999_999_999_999 }));
        assert.throws(() => serializeSfItem({ value: -9_999_999_999_999_999 }));
    });

    // RFC 8941 §4.1.4: Integer range boundaries.
    it('accepts integers at range boundaries', () => {
        assert.equal(serializeSfItem({ value: 999_999_999_999_999 }), '999999999999999');
        assert.equal(serializeSfItem({ value: -999_999_999_999_999 }), '-999999999999999');
    });
});
