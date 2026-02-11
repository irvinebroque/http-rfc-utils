/**
 * Tests for Prefer / Preference-Applied behavior.
 * RFC citations are included in each assertion group.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parsePrefer,
    formatPrefer,
    formatPreferenceApplied,
} from '../src/prefer.js';

describe('Prefer headers (RFC 7240 §2, §3)', () => {
    it('parses preference token and parameters (RFC 7240 §2)', () => {
        const parsed = parsePrefer('return=representation; handling=strict');
        const token = parsed.get('return');
        assert.equal(token?.token, 'return');
        assert.equal(token?.value, 'representation');
        assert.deepEqual(token?.params, [{ key: 'handling', value: 'strict' }]);
    });

    it('keeps first occurrence for duplicate preferences (RFC 7240 §2)', () => {
        const parsed = parsePrefer('return=minimal, return=representation');
        const token = parsed.get('return');
        assert.equal(token?.value, 'minimal');
    });

    it('formats Prefer tokens and values (RFC 7240 §2)', () => {
        const formatted = formatPrefer([
            { token: 'respond-async', params: [] },
            { token: 'wait', value: '5', params: [] },
        ]);
        assert.equal(formatted, 'respond-async, wait=5');
    });

    it('formats Preference-Applied values (RFC 7240 §3)', () => {
        const formatted = formatPreferenceApplied(['return=representation', 'respond-async']);
        assert.equal(formatted, 'return=representation, respond-async');
    });

    it('round-trips parse -> format -> parse for valid members', () => {
        const input = 'return=representation; handling=strict, wait=5';
        const reparsed = parsePrefer(formatPrefer(Array.from(parsePrefer(input).values())));
        assert.deepEqual(Array.from(reparsed.values()), Array.from(parsePrefer(input).values()));
    });

    // RFC 7240 §2: Preference names are case-insensitive tokens.
    it('normalizes preference token names to lowercase', () => {
        const parsed = parsePrefer('RETURN=minimal');
        assert.ok(parsed.has('return'));
        assert.equal(parsed.get('return')?.value, 'minimal');
    });

    // RFC 7240 §2: First wins for case-insensitive duplicates.
    it('deduplicates case-insensitive preferences with first-wins semantics', () => {
        const parsed = parsePrefer('RETURN=minimal, return=representation');
        assert.equal(parsed.size, 1);
        assert.equal(parsed.get('return')?.value, 'minimal');
    });

    // RFC 7240 §2: Empty values are treated as absent by this parser API.
    it('treats empty preference value as absent', () => {
        const parsed = parsePrefer('foo=""');
        assert.equal(parsed.get('foo')?.value, undefined);
    });

    // RFC 7240 §2: Empty parameter values are treated as absent by this parser API.
    it('treats empty preference parameter value as absent', () => {
        const parsed = parsePrefer('foo; bar=""');
        const param = parsed.get('foo')?.params.find(p => p.key === 'bar');
        assert.equal(param?.value, undefined);
    });

    // RFC 7240 §2 ABNF: preference token name is token.
    it('ignores invalid preference members with non-token token names', () => {
        const parsed = parsePrefer('bad token=minimal, return=representation');
        assert.equal(parsed.size, 1);
        assert.equal(parsed.get('return')?.value, 'representation');
    });

    // RFC 7240 §2 ABNF: value is word (token / quoted-string).
    it('ignores invalid preference members with non-word values', () => {
        const parsed = parsePrefer('return=not valid, respond-async');
        assert.equal(parsed.size, 1);
        assert.ok(parsed.has('respond-async'));
    });

    // RFC 7240 §2 ABNF: preference-parameter = token ["=" word].
    it('ignores preference members with invalid parameter token/value syntax', () => {
        const parsed = parsePrefer('return=representation; bad param=strict, respond-async');
        assert.equal(parsed.size, 1);
        assert.ok(parsed.has('respond-async'));
    });

    // RFC 7240 §2 ABNF: quoted-string must be syntactically valid.
    it('ignores preference members with malformed quoted-string values', () => {
        const parsed = parsePrefer('wait="5, respond-async');
        assert.equal(parsed.size, 0);
    });

    // RFC 7240 §2 + RFC 9110 §5.5: parser skips members with CTLs in quoted-string words.
    it('ignores members whose quoted-string value contains control bytes', () => {
        const parsed = parsePrefer('wait="\u0001", respond-async');
        assert.equal(parsed.size, 1);
        assert.ok(parsed.has('respond-async'));
    });

    // RFC 7240 §2 + RFC 9110 §5.5: invalid quoted parameter values invalidate that member.
    it('ignores members whose quoted-string parameter contains control bytes', () => {
        const parsed = parsePrefer('return=minimal; handling="\u0001", respond-async');
        assert.equal(parsed.size, 1);
        assert.ok(parsed.has('respond-async'));
    });

    // RFC 9110 §5.5: reject CR/LF and CTLs in serialized field values.
    it('rejects control bytes in formatter values', () => {
        assert.throws(() => {
            formatPrefer([{ token: 'wait', value: '1\n2', params: [] }]);
        }, /control characters/);
    });

    // RFC 9110 §5.6.2: preference tokens and parameter keys are tokens.
    it('rejects invalid token names in formatter output', () => {
        assert.throws(() => {
            formatPrefer([{ token: 'bad token', params: [] }]);
        }, /valid RFC 9110 token/);
    });

    // RFC 7240 §3 ABNF: applied-pref = token ["=" word].
    it('rejects parameters in Preference-Applied string[] entries', () => {
        assert.throws(() => {
            formatPreferenceApplied(['return=representation; handling=strict']);
        }, /must not include parameters/);
    });

    // RFC 7240 §3 ABNF: quoted-string word can include separators inside quotes.
    it('accepts quoted applied-pref values containing = and ; characters', () => {
        const formatted = formatPreferenceApplied(['return="a=b;c"']);
        assert.equal(formatted, 'return="a=b;c"');
    });

    // RFC 7240 §3 ABNF: word includes quoted-string, including empty quoted-string.
    it('accepts empty quoted applied-pref values while rejecting bare equals', () => {
        assert.equal(formatPreferenceApplied(['return=""']), 'return=""');
        assert.throws(() => {
            formatPreferenceApplied(['return=']);
        }, /token\[=word\] syntax/);
    });

    // RFC 7240 §3 ABNF: token name must be token syntax.
    it('rejects invalid applied-pref token syntax in string[] entries', () => {
        assert.throws(() => {
            formatPreferenceApplied(['bad token=representation']);
        }, /valid RFC 9110 token/);
    });

    // RFC 7240 §3 ABNF: value must be word (token / quoted-string).
    it('rejects invalid applied-pref value syntax in string[] entries', () => {
        assert.throws(() => {
            formatPreferenceApplied(['return=not valid']);
        }, /token\[=word\] syntax/);
    });

});
