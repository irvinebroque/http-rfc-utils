import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseEarlyData,
    formatEarlyData,
    hasEarlyDataSignal,
    canSend425,
} from '../src/early-data.js';

// RFC 8470 §5.1: Early-Data = "1".
describe('parseEarlyData (RFC 8470 Section 5.1)', () => {
    it('parses the only valid value', () => {
        assert.equal(parseEarlyData('1'), 1);
    });

    it('accepts optional surrounding whitespace', () => {
        assert.equal(parseEarlyData('  1  '), 1);
    });

    it('returns null for invalid values', () => {
        assert.equal(parseEarlyData('0'), null);
        assert.equal(parseEarlyData('1, 1'), null);
        assert.equal(parseEarlyData(''), null);
    });
});

describe('formatEarlyData (RFC 8470 Section 5.1)', () => {
    it('formats the Early-Data signal value', () => {
        assert.equal(formatEarlyData(), '1');
        assert.equal(formatEarlyData(1), '1');
    });
});

// RFC 8470 §5.1: servers treat multiple or invalid instances as equivalent to 1.
describe('hasEarlyDataSignal (RFC 8470 Section 5.1)', () => {
    it('returns false when no field is present', () => {
        assert.equal(hasEarlyDataSignal(null), false);
        assert.equal(hasEarlyDataSignal(undefined), false);
        assert.equal(hasEarlyDataSignal([]), false);
    });

    it('returns true for valid single field value', () => {
        assert.equal(hasEarlyDataSignal('1'), true);
    });

    it('returns true for invalid field values', () => {
        assert.equal(hasEarlyDataSignal('0'), true);
        assert.equal(hasEarlyDataSignal('invalid'), true);
        assert.equal(hasEarlyDataSignal(''), true);
    });

    it('returns true for multiple field instances', () => {
        assert.equal(hasEarlyDataSignal(['1', '1']), true);
        assert.equal(hasEarlyDataSignal(['1', 'invalid']), true);
    });

    it('detects signal from Headers and Request', () => {
        const headers = new Headers();
        assert.equal(hasEarlyDataSignal(headers), false);

        headers.append('Early-Data', '1');
        assert.equal(hasEarlyDataSignal(headers), true);

        const request = new Request('https://example.test', {
            headers: {
                'Early-Data': 'bogus',
            },
        });
        assert.equal(hasEarlyDataSignal(request), true);
    });
});

// RFC 8470 §5.2: 425 should not be sent unless early data was used or signaled.
describe('canSend425 (RFC 8470 Section 5.2)', () => {
    it('returns true when request was received in early data', () => {
        assert.equal(canSend425({ requestInEarlyData: true }), true);
    });

    it('returns true when Early-Data was signaled', () => {
        assert.equal(canSend425({ requestInEarlyData: false, earlyData: '1' }), true);
        assert.equal(canSend425({ requestInEarlyData: false, earlyData: 'invalid' }), true);
    });

    it('returns false when no early-data signal exists', () => {
        assert.equal(canSend425(), false);
        assert.equal(canSend425({}), false);
        assert.equal(canSend425({ requestInEarlyData: false, earlyData: null }), false);
    });
});
