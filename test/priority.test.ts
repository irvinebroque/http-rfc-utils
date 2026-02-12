/**
 * Tests for priority behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parsePriority,
    formatPriority,
    applyPriorityDefaults,
    mergePriority,
} from '../src/priority.js';

// RFC 9218 §5: Priority is a Structured Field Dictionary.
describe('parsePriority (RFC 9218 Section 5)', () => {
    it('parses known members u and i (RFC 9218 Section 4)', () => {
        const parsed = parsePriority('u=0, i');
        assert.deepEqual(parsed, { u: 0, i: true });
    });

    it('parses explicit false i value (RFC 9218 Section 4.2)', () => {
        const parsed = parsePriority('i=?0');
        assert.deepEqual(parsed, { i: false });
    });

    // RFC 9218 §4: unknown parameters are ignored.
    it('ignores unknown dictionary members (RFC 9218 Section 4)', () => {
        const parsed = parsePriority('foo=1, bar=?1');
        assert.deepEqual(parsed, {});
    });

    // RFC 9218 §4.1: out-of-range urgency is ignored.
    it('ignores out-of-range urgency values (RFC 9218 Section 4.1)', () => {
        const parsed = parsePriority('u=9, i');
        assert.deepEqual(parsed, { i: true });
    });

    // RFC 9218 §4.1 and §4.2: unexpected member types are ignored.
    it('ignores invalid member types (RFC 9218 Section 4)', () => {
        const parsed = parsePriority('u="1", i=1');
        assert.deepEqual(parsed, {});
    });

    // RFC 9218 §4: invalid member values are ignored after successful SF parse.
    it('ignores inner-list member values (RFC 9218 Section 4)', () => {
        const parsed = parsePriority('u=(1 2), i=(?1)');
        assert.deepEqual(parsed, {});
    });

    // RFC 9218 §5 + RFC 8941 §3.2: invalid SF dictionary fails parsing.
    it('returns null when structured field dictionary parsing fails', () => {
        assert.equal(parsePriority('u=1,,'), null);
    });
});

// RFC 9218 §4.1 and §4.2: defaults are u=3 and i=false.
describe('applyPriorityDefaults (RFC 9218 Section 4)', () => {
    it('applies default values when members are omitted', () => {
        assert.deepEqual(applyPriorityDefaults({}), { u: 3, i: false });
    });

    it('keeps provided values and fills the rest', () => {
        assert.deepEqual(applyPriorityDefaults({ i: true }), { u: 3, i: true });
    });
});

// RFC 9218 §8: merge client and server signals.
describe('mergePriority (RFC 9218 Section 8)', () => {
    it('returns request defaults when both inputs are absent', () => {
        assert.deepEqual(mergePriority(), { u: 3, i: false });
    });

    it('starts from client defaults and overlays server members', () => {
        const merged = mergePriority({ u: 5 }, { i: true });
        assert.deepEqual(merged, { u: 5, i: true });
    });

    it('server values override corresponding client values', () => {
        const merged = mergePriority({ u: 5, i: false }, { u: 1 });
        assert.deepEqual(merged, { u: 1, i: false });
    });
});

describe('formatPriority (RFC 9218 Section 5)', () => {
    it('serializes explicit members as SF dictionary', () => {
        assert.equal(formatPriority({ u: 0, i: true }), 'u=0, i');
    });

    it('serializes explicit i=false value (RFC 9218 Section 4.2)', () => {
        assert.equal(formatPriority({ i: false }), 'i=?0');
    });

    it('allows empty explicit set for omission semantics', () => {
        assert.equal(formatPriority({}), '');
    });

    it('throws on invalid urgency (RFC 9218 Section 4.1)', () => {
        assert.throws(() => formatPriority({ u: 10 }), /urgency/);
    });
});
