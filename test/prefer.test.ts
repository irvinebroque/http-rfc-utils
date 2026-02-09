import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parsePrefer,
    formatPrefer,
    formatPreferenceApplied,
} from '../src/prefer.js';

describe('Prefer Headers (RFC 7240 Sections 2-3)', () => {
    it('parses Prefer with parameters (RFC 7240 Section 2)', () => {
        const parsed = parsePrefer('return=representation; handling=strict');
        const token = parsed.get('return');
        assert.equal(token?.token, 'return');
        assert.equal(token?.value, 'representation');
        assert.deepEqual(token?.params, [{ key: 'handling', value: 'strict' }]);
    });

    it('keeps the first occurrence of a preference (RFC 7240 Section 2)', () => {
        const parsed = parsePrefer('return=minimal, return=representation');
        const token = parsed.get('return');
        assert.equal(token?.value, 'minimal');
    });

    it('formats Prefer with quoted values (RFC 7240 Section 2)', () => {
        const formatted = formatPrefer([
            { token: 'respond-async', params: [] },
            { token: 'wait', value: '5', params: [] },
        ]);
        assert.equal(formatted, 'respond-async, wait=5');
    });

    it('formats Preference-Applied (RFC 7240 Section 3)', () => {
        const formatted = formatPreferenceApplied(['return=representation', 'respond-async']);
        assert.equal(formatted, 'return=representation, respond-async');
    });

    // RFC 7240 §2: Token names are case-insensitive.
    it('normalizes token names to lowercase', () => {
        const parsed = parsePrefer('RETURN=minimal');
        assert.ok(parsed.has('return'));
        assert.equal(parsed.get('return')?.value, 'minimal');
    });

    // RFC 7240 §2: First wins for case-insensitive duplicates.
    it('deduplicates case-insensitive tokens (first wins)', () => {
        const parsed = parsePrefer('RETURN=minimal, return=representation');
        assert.equal(parsed.size, 1);
        assert.equal(parsed.get('return')?.value, 'minimal');
    });

    // RFC 7240 §2: Empty values equivalent to no value.
    it('treats empty token value as absent', () => {
        const parsed = parsePrefer('foo=""');
        assert.equal(parsed.get('foo')?.value, undefined);
    });

    // RFC 7240 §2: Empty parameter values equivalent to no value.
    it('treats empty param value as absent', () => {
        const parsed = parsePrefer('foo; bar=""');
        const param = parsed.get('foo')?.params.find(p => p.key === 'bar');
        assert.equal(param?.value, undefined);
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
        }, /valid header token/);
    });
});
