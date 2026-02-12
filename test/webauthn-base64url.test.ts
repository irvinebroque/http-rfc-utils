/**
 * Tests for strict WebAuthn base64url helpers.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    formatWebauthnBase64url,
    parseWebauthnBase64url,
    validateWebauthnBase64url,
} from '../src/auth.js';

describe('WebAuthn base64url helpers (RFC 4648 Section 5)', () => {
    it('parses and formats canonical base64url values', () => {
        // RFC 4648 Section 5: URL-safe alphabet replaces '+' and '/'.
        const decoded = parseWebauthnBase64url('--__');
        assert.deepEqual(decoded, new Uint8Array([251, 239, 255]));

        const encoded = formatWebauthnBase64url(new Uint8Array([251, 239, 255]));
        assert.equal(encoded, '--__');
    });

    it('rejects padding, whitespace, and invalid symbols in parse', () => {
        // RFC 4648 Section 5 + strict WebAuthn parse behavior: no padding and no whitespace normalization.
        assert.equal(parseWebauthnBase64url('AQID='), null);
        assert.equal(parseWebauthnBase64url('AQ ID'), null);
        assert.equal(parseWebauthnBase64url('AQID+'), null);
        assert.equal(parseWebauthnBase64url('A'), null);
    });

    it('throws for semantic-invalid base64url values in validator', () => {
        assert.throws(() => validateWebauthnBase64url('AQID='), /without padding/);
        assert.throws(() => validateWebauthnBase64url('AQ ID'), /without padding/);
        assert.throws(() => validateWebauthnBase64url('A'), /invalid length/);
    });
});
