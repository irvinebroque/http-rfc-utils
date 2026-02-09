import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSfInteger, mergeSfExtensions } from '../src/structured-field-params.js';

// RFC 8941 §3.3.1: integer item constraints and extension parameter handling.
describe('structured-field-params helpers', () => {
    it('isSfInteger accepts only finite integers', () => {
        assert.equal(isSfInteger(1), true);
        assert.equal(isSfInteger(-2), true);
        assert.equal(isSfInteger(1.5), false);
        assert.equal(isSfInteger(Number.NaN), false);
        assert.equal(isSfInteger(Number.POSITIVE_INFINITY), false);
    });

    it('mergeSfExtensions appends extension keys without overriding existing members', () => {
        const target = { hit: true, ttl: 120 };
        mergeSfExtensions(target, {
            ttl: 999,
            ext: 'value',
        });

        assert.deepEqual(target, {
            hit: true,
            ttl: 120,
            ext: 'value',
        });
    });

    it('mergeSfExtensions is a no-op for undefined extensions', () => {
        const target = { stored: true };
        mergeSfExtensions(target, undefined);
        assert.deepEqual(target, { stored: true });
    });
});
