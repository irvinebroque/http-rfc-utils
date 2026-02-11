/**
 * Tests for structured fields behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
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
import { SfDate, SfDisplayString, SfToken } from '../src/types.js';

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

    // RFC 8941 §4.2.1.2: Inner list separators are SP only.
    it('rejects HTAB separators inside inner lists', () => {
        assert.equal(parseSfList('(a\tb)'), null);
    });

    // RFC 8941 §4.2.1.2: Adjacent inner-list members require at least one SP.
    it('rejects adjacent inner-list members without SP separator', () => {
        assert.equal(parseSfList('("a""b")'), null);
    });

    // RFC 8941 §3.1.1: Inner lists permit one or more SP between members and optional edge SP.
    it('accepts legal SP usage inside inner lists', () => {
        const parsed = parseSfList('(  "a"   "b" )');
        assert.deepEqual(parsed, [{ items: [{ value: 'a' }, { value: 'b' }] }]);
    });

    it('parses dictionary values and parameters (RFC 8941 Section 3.2)', () => {
        const parsed = parseSfDict('a=1;foo=bar, b');
        assert.ok(parsed?.a);
        assert.ok(parsed?.b);
    });

    it('serializes list and dictionary (RFC 8941 Section 4)', () => {
        const list = serializeSfList([{ value: 'token' }, { items: [{ value: 1 }] }]);
        assert.equal(list, '"token", (1)');

        const dict = serializeSfDict({
            a: { value: true },
            b: { value: 10 },
        });
        assert.equal(dict, 'a, b=10');
    });

    // RFC 8941 §4.1.2: true dictionary member with parameters omits =?1.
    it('serializes true dictionary member with parameters without explicit boolean', () => {
        const dict = serializeSfDict({
            key: { value: true, params: { foo: 'bar' } },
        });
        assert.equal(dict, 'key;foo="bar"');
    });

    // RFC 8941 §4.1.2: true member keeps canonical dictionary punctuation with others.
    it('serializes mixed dictionary members with canonical separators', () => {
        const dict = serializeSfDict({
            a: { value: true, params: { foo: 'bar' } },
            b: { value: 10 },
            c: { value: false },
        });
        assert.equal(dict, 'a;foo="bar", b=10, c=?0');
    });

    it('serializes items with parameters (RFC 8941 Section 3.1.2)', () => {
        const item = serializeSfItem({ value: 'token', params: { foo: 'bar' } });
        assert.equal(item, '"token";foo="bar"');
    });

    // RFC 8941 §3.3.4: Tokens can contain uppercase and special chars.
    it('parses token with uppercase letters', () => {
        const parsed = parseSfItem('FooBar');
        assert.ok(parsed);
        assert.ok(parsed.value instanceof SfToken);
        assert.equal(parsed.value.value, 'FooBar');
    });

    // RFC 8941 §3.3.4: Tokens can contain colon and slash.
    it('parses token with colon and slash', () => {
        const parsed = parseSfItem('text/html');
        assert.ok(parsed);
        assert.ok(parsed.value instanceof SfToken);
        assert.equal(parsed.value.value, 'text/html');
    });

    // RFC 8941 §3.3.4: Tokens can contain various tchar characters.
    it('parses token with tchar special characters', () => {
        const parsed = parseSfItem("foo!#$%&'*+^_`|~bar");
        assert.ok(parsed);
        assert.ok(parsed.value instanceof SfToken);
        assert.equal(parsed.value.value, "foo!#$%&'*+^_`|~bar");
    });

    // RFC 8941 §3.3.3 + §4: Strings and tokens are distinct bare item types.
    it('round-trips sf-string without being converted to token', () => {
        const parsed = parseSfItem('"hello"');
        assert.ok(parsed);
        assert.equal(typeof parsed.value, 'string');
        assert.equal(serializeSfItem(parsed), '"hello"');
    });

    // RFC 8941 §3.3.4 + §4: Explicit sf-token serialization.
    it('serializes SfToken values as bare tokens', () => {
        const serialized = serializeSfItem({ value: new SfToken('hello') });
        assert.equal(serialized, 'hello');
    });

    // RFC 8941 §3.1: Trailing commas are invalid in Lists.
    it('rejects list with trailing comma', () => {
        assert.equal(parseSfList('a,'), null);
        assert.equal(parseSfList('a,   '), null);
    });

    // RFC 8941 §3.2: Trailing commas are invalid in Dictionaries.
    it('rejects dictionary with trailing comma', () => {
        assert.equal(parseSfDict('a=1,'), null);
        assert.equal(parseSfDict('a=1,   '), null);
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

describe('Structured Fields Date type (RFC 9651 Section 3.3.7)', () => {
    it('parses Date bare item (@unix-seconds)', () => {
        const parsed = parseSfItem('@1688169599');
        assert.ok(parsed);
        assert.ok(parsed.value instanceof SfDate);
        assert.strictEqual((parsed.value as SfDate).timestamp, 1688169599);
    });

    it('parses Date with value 0 (epoch)', () => {
        const parsed = parseSfItem('@0');
        assert.ok(parsed);
        assert.ok(parsed.value instanceof SfDate);
        assert.strictEqual((parsed.value as SfDate).timestamp, 0);
    });

    it('parses negative Date', () => {
        const parsed = parseSfItem('@-86400');
        assert.ok(parsed);
        assert.ok(parsed.value instanceof SfDate);
        assert.strictEqual((parsed.value as SfDate).timestamp, -86400);
    });

    it('rejects Date with decimal', () => {
        const parsed = parseSfItem('@1688169599.5');
        assert.strictEqual(parsed, null);
    });

    // RFC 9651 §3.3.7: Date uses sf-integer syntax, so fractional .0 is invalid.
    it('rejects Date with fractional zero', () => {
        const parsed = parseSfItem('@1688169599.0');
        assert.strictEqual(parsed, null);
    });

    it('parses Date with parameters', () => {
        const parsed = parseSfItem('@1688169599;source=api');
        assert.ok(parsed);
        assert.ok(parsed.value instanceof SfDate);
        assert.strictEqual((parsed.value as SfDate).timestamp, 1688169599);
        assert.ok(parsed.params?.source instanceof SfToken);
        assert.equal((parsed.params?.source as SfToken).value, 'api');
    });

    it('serializes Date bare item', () => {
        const result = serializeSfItem({ value: new SfDate(1688169599) });
        assert.strictEqual(result, '@1688169599');
    });

    it('serializes Date with parameters', () => {
        const result = serializeSfItem({ value: new SfDate(1688169599), params: { source: 'api' } });
        assert.strictEqual(result, '@1688169599;source="api"');
    });

    it('serializes Date at epoch', () => {
        const result = serializeSfItem({ value: new SfDate(0) });
        assert.strictEqual(result, '@0');
    });

    it('serializes negative Date', () => {
        const result = serializeSfItem({ value: new SfDate(-86400) });
        assert.strictEqual(result, '@-86400');
    });

    it('round-trips Date through parse and serialize', () => {
        const original = '@1735689600';
        const parsed = parseSfItem(original);
        assert.ok(parsed);
        const serialized = serializeSfItem(parsed);
        assert.strictEqual(serialized, original);
    });

    it('SfDate.toDate converts to JS Date', () => {
        const sfDate = new SfDate(1688169599);
        const date = sfDate.toDate();
        assert.strictEqual(date.toISOString(), '2023-06-30T23:59:59.000Z');
    });

    it('SfDate.fromDate creates from JS Date', () => {
        const date = new Date('2023-06-30T23:59:59Z');
        const sfDate = SfDate.fromDate(date);
        assert.strictEqual(sfDate.timestamp, 1688169599);
    });

    it('SfDate.fromDate truncates sub-second precision', () => {
        const date = new Date('2023-06-30T23:59:59.999Z');
        const sfDate = SfDate.fromDate(date);
        assert.strictEqual(sfDate.timestamp, 1688169599);
    });

    it('SfDate constructor rejects non-integer', () => {
        assert.throws(() => new SfDate(1.5));
    });

    it('parses Date in dictionary value', () => {
        const parsed = parseSfDict('deprecated=@1688169599');
        assert.ok(parsed);
        const item = parsed['deprecated'] as { value: unknown };
        assert.ok(item.value instanceof SfDate);
        assert.strictEqual((item.value as SfDate).timestamp, 1688169599);
    });

    it('parses Date in list', () => {
        const parsed = parseSfList('@1688169599, @1735689600');
        assert.ok(parsed);
        assert.strictEqual(parsed.length, 2);
        assert.ok((parsed[0] as { value: unknown }).value instanceof SfDate);
        assert.ok((parsed[1] as { value: unknown }).value instanceof SfDate);
    });
});

describe('Structured Fields Display String (RFC 9651 Section 3.3.8)', () => {
    // RFC 9651 §4.2.10: Display String parses from %"..." and UTF-8 percent triplets.
    it('parses and round-trips non-ASCII Display String', () => {
        const parsed = parseSfItem('%"f%c3%bc"');
        assert.ok(parsed);
        assert.ok(parsed.value instanceof SfDisplayString);
        assert.equal(parsed.value.value, 'fü');

        const serialized = serializeSfItem(parsed);
        assert.equal(serialized, '%"f%c3%bc"');
    });

    // RFC 9651 §4.1.11: Serializer percent-encodes DQUOTE and percent octets.
    it('serializes Display String with ASCII escapes using lowercase hex', () => {
        const serialized = serializeSfItem({ value: new SfDisplayString('foo "bar" %') });
        assert.equal(serialized, '%"foo %22bar%22 %25"');
    });

    // RFC 9651 §4.2.10: pct-encoded requires lowercase hex digits.
    it('rejects Display String with uppercase pct-encoded hex', () => {
        assert.equal(parseSfItem('%"%C3%BC"'), null);
    });

    // RFC 9651 §4.2.10: Invalid UTF-8 decode fails parsing.
    it('rejects Display String with invalid UTF-8 sequence', () => {
        assert.equal(parseSfItem('%"%c3%28"'), null);
    });

    // RFC 9651 §4.2 + §4.2.10: Parse failure in one list member fails whole field.
    it('fails whole list when one member has invalid Display String', () => {
        assert.equal(parseSfList('1, %"%C3%BC", 2'), null);
    });

    // RFC 9651 §4.2 + §4.2.10: Parse failure in one dictionary member fails whole field.
    it('fails whole dictionary when one member has invalid Display String', () => {
        assert.equal(parseSfDict('a=1, b=%"%C3%BC"'), null);
    });

    // RFC 9652 §2 + RFC 9651 §3.3.8: Link-Template target attributes can use Display String.
    it('parses Display String parameter values in list members', () => {
        const parsed = parseSfList('"/author";title=%"Bj%c3%b6rn J%c3%a4rnsida"');
        assert.ok(parsed);
        const first = parsed[0] as { params?: Record<string, unknown> };
        assert.ok(first.params?.title instanceof SfDisplayString);
        assert.equal((first.params?.title as SfDisplayString).value, 'Björn Järnsida');
    });

    // RFC 9651 §4.1.11: Display String input must be valid Unicode scalar values.
    it('rejects lone surrogate Display String input during serialization', () => {
        assert.throws(
            () => serializeSfItem({ value: new SfDisplayString('bad\ud800') }),
            /Invalid display string value/
        );
    });
});

describe('Structured Fields serialization constraints (RFC 8941 Section 4)', () => {
    // RFC 8941 §4.1.5: Decimal serialization MUST include a decimal point.
    it('serializes rounded integral decimals with .0 suffix', () => {
        assert.equal(serializeSfItem({ value: 1.0004 }), '1.0');
        assert.equal(serializeSfItem({ value: -0.0004 }), '-0.0');
        assert.equal(serializeSfItem({ value: 10.0004 }), '10.0');
    });

    // RFC 8941 §4.1.5: Decimal parse/serialize stays in decimal form when non-integral.
    it('round-trips parsed decimal values in decimal form', () => {
        const parsed = parseSfItem('1.25');
        assert.ok(parsed);
        assert.equal(serializeSfItem(parsed), '1.25');
    });

    // RFC 8941 §4.1.5: Decimal range is limited to +/- 999999999999.999.
    it('rejects decimals outside the allowed range during serialization', () => {
        assert.throws(() => serializeSfItem({ value: 1_000_000_000_000.001 }));
        assert.throws(() => serializeSfItem({ value: -1_000_000_000_000.001 }));
    });

    // RFC 8941 §4.1.6: sf-string only allows visible ASCII characters.
    it('rejects non-ASCII strings during serialization', () => {
        assert.throws(() => serializeSfItem({ value: 'cafe\u00E9' }));
    });
});
