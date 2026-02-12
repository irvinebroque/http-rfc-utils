/**
 * Tests for Referrer-Policy header behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    parseReferrerPolicy,
    parseReferrerPolicyHeader,
    formatReferrerPolicy,
    validateReferrerPolicy,
    selectEffectiveReferrerPolicy,
} from '../src/referrer-policy.js';

const KNOWN_POLICY_TOKENS = [
    'no-referrer',
    'no-referrer-when-downgrade',
    'same-origin',
    'origin',
    'strict-origin',
    'origin-when-cross-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url',
] as const;

// W3C Referrer Policy Section 8.1: parse token list and choose the last recognized token.
describe('parseReferrerPolicy (W3C Referrer Policy Section 8.1)', () => {
    it('parses a recognized token', () => {
        assert.equal(parseReferrerPolicy('strict-origin-when-cross-origin'), 'strict-origin-when-cross-origin');
    });

    // W3C Referrer Policy Section 11.1: unknown tokens are ignored to allow forward-compatible fallbacks.
    it('uses the last recognized token from a comma-separated list', () => {
        assert.equal(parseReferrerPolicy('origin, future-policy, unsafe-url'), 'unsafe-url');
    });

    it('returns empty string for syntactically valid input with only unknown tokens', () => {
        assert.equal(parseReferrerPolicy('future-policy, another-policy'), '');
    });

    it('returns null for syntax-invalid field-values', () => {
        assert.equal(parseReferrerPolicy(''), null);
        assert.equal(parseReferrerPolicy('origin,'), null);
        assert.equal(parseReferrerPolicy(',origin'), null);
        assert.equal(parseReferrerPolicy('origin,,unsafe-url'), null);
        assert.equal(parseReferrerPolicy('same origin'), null);
        assert.equal(parseReferrerPolicy('"origin"'), null);
    });
});

// W3C Referrer Policy Section 4.1 + Section 8.1: process header values in wire order.
describe('parseReferrerPolicyHeader (W3C Referrer Policy Sections 4.1 and 8.1)', () => {
    it('processes multiple header field-values in wire order', () => {
        assert.equal(
            parseReferrerPolicyHeader(['origin, future-policy', 'strict-origin-when-cross-origin']),
            'strict-origin-when-cross-origin',
        );
    });

    it('preserves previous recognized token when later value has only unknown tokens', () => {
        assert.equal(parseReferrerPolicyHeader(['origin', 'future-policy']), 'origin');
    });

    it('returns empty string when input is nullish', () => {
        assert.equal(parseReferrerPolicyHeader(null), '');
        assert.equal(parseReferrerPolicyHeader(undefined), '');
    });

    it('returns null when any field-value is syntax-invalid', () => {
        assert.equal(parseReferrerPolicyHeader(['origin', 'unsafe-url,']), null);
    });
});

// W3C Referrer Policy Section 4.1: header field-value is emitted as a policy token.
describe('validateReferrerPolicy and formatReferrerPolicy (W3C Referrer Policy Section 4.1)', () => {
    it('accepts known policy tokens', () => {
        assert.equal(validateReferrerPolicy('origin'), 'origin');
        assert.equal(formatReferrerPolicy('strict-origin'), 'strict-origin');
    });

    it('throws on invalid policy values', () => {
        assert.throws(() => validateReferrerPolicy(''), /non-empty/);
        assert.throws(() => validateReferrerPolicy('same origin'), /valid RFC 9110 token/);
        assert.throws(() => validateReferrerPolicy('future-policy'), /Invalid Referrer-Policy token/);
        assert.throws(() => formatReferrerPolicy('future-policy'), /Invalid Referrer-Policy token/);
    });

    it('round-trips all known policy tokens through format and parse', () => {
        for (const token of KNOWN_POLICY_TOKENS) {
            const formatted = formatReferrerPolicy(token);
            assert.equal(formatted, token);
            assert.equal(parseReferrerPolicy(formatted), token);
        }
    });
});

// W3C Referrer Policy Section 8.2: only update when parsed policy is non-empty.
describe('selectEffectiveReferrerPolicy (W3C Referrer Policy Section 8.2)', () => {
    it('replaces current policy when new header yields a recognized token', () => {
        assert.equal(
            selectEffectiveReferrerPolicy('same-origin', 'origin, strict-origin'),
            'strict-origin',
        );
    });

    it('keeps current policy when new header parses to empty/unknown', () => {
        assert.equal(selectEffectiveReferrerPolicy('strict-origin', 'future-policy'), 'strict-origin');
        assert.equal(selectEffectiveReferrerPolicy('strict-origin', undefined), 'strict-origin');
    });

    it('keeps current policy when new header syntax is invalid', () => {
        assert.equal(selectEffectiveReferrerPolicy('strict-origin', 'origin,'), 'strict-origin');
    });
});
