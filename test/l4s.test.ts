/**
 * Tests for L4S ECN protocol helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseEcnCodepoint,
    formatEcnCodepoint,
    formatEcnCodepointBits,
    isL4sIdentifier,
    isL4sSenderCodepoint,
    classifyL4sTreatment,
    isL4sEcnTransitionAllowed,
    disableL4sCodepoint,
} from '../src/l4s.js';
import {
    parseEcnCodepoint as parseEcnCodepointFromIndex,
    classifyL4sTreatment as classifyL4sTreatmentFromIndex,
} from '../src/index.js';

// RFC 9331 §8 + IANA ECN field registry: binary-to-keyword mapping.
describe('parseEcnCodepoint (RFC 9331 Section 8)', () => {
    it('re-exports L4S helpers from src/index.ts', () => {
        assert.equal(parseEcnCodepointFromIndex('01'), 'ect(1)');
        assert.equal(classifyL4sTreatmentFromIndex('ECT(0)'), 'classic');
    });

    it('parses canonical textual keywords', () => {
        assert.equal(parseEcnCodepoint('Not-ECT'), 'not-ect');
        assert.equal(parseEcnCodepoint('ECT(1)'), 'ect(1)');
        assert.equal(parseEcnCodepoint('ECT(0)'), 'ect(0)');
        assert.equal(parseEcnCodepoint('CE'), 'ce');
    });

    it('parses shorthand textual forms', () => {
        assert.equal(parseEcnCodepoint('notect'), 'not-ect');
        assert.equal(parseEcnCodepoint('ect1'), 'ect(1)');
        assert.equal(parseEcnCodepoint('ect0'), 'ect(0)');
    });

    it('parses two-bit binary strings', () => {
        assert.equal(parseEcnCodepoint('00'), 'not-ect');
        assert.equal(parseEcnCodepoint('01'), 'ect(1)');
        assert.equal(parseEcnCodepoint('10'), 'ect(0)');
        assert.equal(parseEcnCodepoint('11'), 'ce');
    });

    it('parses two-bit numeric values', () => {
        assert.equal(parseEcnCodepoint(0), 'not-ect');
        assert.equal(parseEcnCodepoint(1), 'ect(1)');
        assert.equal(parseEcnCodepoint(2), 'ect(0)');
        assert.equal(parseEcnCodepoint(3), 'ce');
    });

    it('returns null for invalid inputs', () => {
        assert.equal(parseEcnCodepoint(''), null);
        assert.equal(parseEcnCodepoint('ect(2)'), null);
        assert.equal(parseEcnCodepoint('001'), null);
        assert.equal(parseEcnCodepoint(-1), null);
        assert.equal(parseEcnCodepoint(4), null);
        assert.equal(parseEcnCodepoint(1.5), null);
    });
});

describe('formatEcnCodepoint (RFC 9331 Section 8)', () => {
    it('formats canonical RFC keyword labels', () => {
        assert.equal(formatEcnCodepoint('not-ect'), 'Not-ECT');
        assert.equal(formatEcnCodepoint('ect(1)'), 'ECT(1)');
        assert.equal(formatEcnCodepoint('ect(0)'), 'ECT(0)');
        assert.equal(formatEcnCodepoint('ce'), 'CE');
    });

    it('formats two-bit binary labels', () => {
        assert.equal(formatEcnCodepointBits('not-ect'), '00');
        assert.equal(formatEcnCodepointBits('ect(1)'), '01');
        assert.equal(formatEcnCodepointBits('ect(0)'), '10');
        assert.equal(formatEcnCodepointBits('ce'), '11');
    });
});

// RFC 9331 §3 + §5.1: ECT(1) and CE are treated as part of L4S identification.
describe('isL4sIdentifier (RFC 9331 Sections 3 and 5.1)', () => {
    it('returns true for ECT(1) and CE', () => {
        assert.equal(isL4sIdentifier('ECT(1)'), true);
        assert.equal(isL4sIdentifier('CE'), true);
    });

    it('returns false for Classic ECN/non-ECN codepoints', () => {
        assert.equal(isL4sIdentifier('ECT(0)'), false);
        assert.equal(isL4sIdentifier('Not-ECT'), false);
    });
});

// RFC 9331 §4.1: sender-side L4S marking uses ECT(1).
describe('isL4sSenderCodepoint (RFC 9331 Section 4.1)', () => {
    it('returns true only for ECT(1)', () => {
        assert.equal(isL4sSenderCodepoint('ECT(1)'), true);
        assert.equal(isL4sSenderCodepoint('CE'), false);
        assert.equal(isL4sSenderCodepoint('ECT(0)'), false);
        assert.equal(isL4sSenderCodepoint('Not-ECT'), false);
    });
});

// RFC 9331 §5.1 + §5.3 classification behavior.
describe('classifyL4sTreatment (RFC 9331 Sections 5.1 and 5.3)', () => {
    it('classifies ECT(1) and CE as L4S by default', () => {
        assert.equal(classifyL4sTreatment('ECT(1)'), 'l4s');
        assert.equal(classifyL4sTreatment('CE'), 'l4s');
    });

    it('classifies Not-ECT and ECT(0) as Classic', () => {
        assert.equal(classifyL4sTreatment('Not-ECT'), 'classic');
        assert.equal(classifyL4sTreatment('ECT(0)'), 'classic');
    });

    it('supports transport-aware CE exception for ECT(0)-only flows', () => {
        const classification = classifyL4sTreatment('CE', {
            classifyCeAsClassicIfFlowEct0Only: true,
        });
        assert.equal(classification, 'classic');
    });

    it('supports explicit classifier override', () => {
        const classification = classifyL4sTreatment('ECT(1)', {
            override: 'classic',
        });
        assert.equal(classification, 'classic');
    });

    it('returns null for invalid codepoints', () => {
        assert.equal(classifyL4sTreatment('invalid'), null);
    });
});

// RFC 9331 §5.1: L4S-specific ECN transition constraints.
describe('isL4sEcnTransitionAllowed (RFC 9331 Section 5.1)', () => {
    it('allows ECT(1) to remain ECT(1) or become CE', () => {
        assert.equal(isL4sEcnTransitionAllowed('ECT(1)', 'ECT(1)'), true);
        assert.equal(isL4sEcnTransitionAllowed('ECT(1)', 'CE'), true);
    });

    it('rejects ECT(1) transitions to non-CE codepoints', () => {
        assert.equal(isL4sEcnTransitionAllowed('ECT(1)', 'ECT(0)'), false);
        assert.equal(isL4sEcnTransitionAllowed('ECT(1)', 'Not-ECT'), false);
    });

    it('requires CE to remain CE', () => {
        assert.equal(isL4sEcnTransitionAllowed('CE', 'CE'), true);
        assert.equal(isL4sEcnTransitionAllowed('CE', 'ECT(1)'), false);
    });

    it('returns false for invalid input transitions', () => {
        assert.equal(isL4sEcnTransitionAllowed('bad', 'CE'), false);
        assert.equal(isL4sEcnTransitionAllowed('ECT(1)', 'bad'), false);
    });
});

// RFC 9331 §5.1: disabled L4S treats ECT(1) as Not-ECT.
describe('disableL4sCodepoint (RFC 9331 Section 5.1)', () => {
    it('maps ECT(1) to Not-ECT', () => {
        assert.equal(disableL4sCodepoint('ECT(1)'), 'not-ect');
    });

    it('keeps other codepoints unchanged', () => {
        assert.equal(disableL4sCodepoint('Not-ECT'), 'not-ect');
        assert.equal(disableL4sCodepoint('ECT(0)'), 'ect(0)');
        assert.equal(disableL4sCodepoint('CE'), 'ce');
    });

    it('returns null for invalid codepoint input', () => {
        assert.equal(disableL4sCodepoint('not-a-codepoint'), null);
    });
});
