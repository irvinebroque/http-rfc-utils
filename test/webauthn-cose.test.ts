/**
 * Tests for WebAuthn COSE algorithm helpers.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    WEBAUTHN_COSE_ALGORITHM_IDS,
    validateWebauthnCoseAlgorithm,
} from '../src/auth.js';

describe('WebAuthn COSE algorithms (WebAuthn alg identifiers + RFC 9053 Section 2)', () => {
    it('keeps default COSE allowlist runtime-immutable', () => {
        assert.equal(Object.isFrozen(WEBAUTHN_COSE_ALGORITHM_IDS), true);
        assert.throws(() => {
            (WEBAUTHN_COSE_ALGORITHM_IDS as number[]).push(-999);
        });

        assert.throws(() => {
            validateWebauthnCoseAlgorithm(-999);
        }, /not allowed/);
    });
});
