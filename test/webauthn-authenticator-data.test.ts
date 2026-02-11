/**
 * Tests for WebAuthn authenticatorData helpers.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
    parseWebauthnAuthenticatorData,
    validateWebauthnAuthenticatorData,
} from '../src/auth.js';

function encodeUint32(value: number): Uint8Array {
    return new Uint8Array([
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
    ]);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function encodeNestedSingleEntryMap(depth: number): Uint8Array {
    let encoded: Uint8Array = new Uint8Array([0xa0]);
    for (let index = 0; index < depth; index++) {
        encoded = concatBytes(new Uint8Array([0xa1, 0x00]), encoded);
    }
    return encoded;
}

function encodeFlatMapWithZeroPairs(pairCount: number): Uint8Array {
    let header: Uint8Array;
    if (pairCount < 24) {
        header = new Uint8Array([0xa0 + pairCount]);
    } else if (pairCount <= 0xff) {
        header = new Uint8Array([0xb8, pairCount]);
    } else if (pairCount <= 0xffff) {
        header = new Uint8Array([0xb9, (pairCount >> 8) & 0xff, pairCount & 0xff]);
    } else {
        throw new Error('pairCount too large for test helper.');
    }

    const pairs = new Uint8Array(pairCount * 2);
    return concatBytes(header, pairs);
}

describe('WebAuthn authenticatorData parsing (WebAuthn Section 6.1)', () => {
    it('parses rpIdHash, flags, and signCount for minimum-length data', () => {
        // WebAuthn authenticatorData: 32-byte rpIdHash + flags + signCount.
        const rpIdHash = new Uint8Array(createHash('sha256').update('example.com', 'utf8').digest());
        const authData = concatBytes(rpIdHash, new Uint8Array([0x01]), encodeUint32(5));

        const parsed = parseWebauthnAuthenticatorData(authData);
        assert(parsed);
        assert.equal(parsed.signCount, 5);
        assert.equal(parsed.flags.userPresent, true);
        assert.equal(parsed.flags.attestedCredentialData, false);
        assert.equal(parsed.flags.extensionData, false);
    });

    it('returns null for short or structurally truncated payloads', () => {
        assert.equal(parseWebauthnAuthenticatorData(new Uint8Array(36)), null);

        const rpIdHash = new Uint8Array(32);
        const truncatedAttested = concatBytes(
            rpIdHash,
            new Uint8Array([0x41]),
            encodeUint32(1),
            new Uint8Array(16),
            new Uint8Array([0x00, 0x03]),
            new Uint8Array([0x01, 0x02, 0x03]),
        );
        // WebAuthn attested credential data requires credentialPublicKey bytes when AT is set.
        assert.equal(parseWebauthnAuthenticatorData(truncatedAttested), null);
    });

    it('parses AT and ED structures without CBOR semantic decoding', () => {
        const rpIdHash = new Uint8Array(32);
        const aaguid = new Uint8Array(16);
        const credentialId = new Uint8Array([0x01, 0x02, 0x03]);
        const credentialIdLength = new Uint8Array([0x00, credentialId.length]);
        const credentialPublicKey = new Uint8Array([0xa0]); // empty CBOR map
        const extensionData = new Uint8Array([0xa0]); // empty CBOR map

        const authData = concatBytes(
            rpIdHash,
            new Uint8Array([0xc1]), // UP + AT + ED
            encodeUint32(9),
            aaguid,
            credentialIdLength,
            credentialId,
            credentialPublicKey,
            extensionData,
        );

        const parsed = parseWebauthnAuthenticatorData(authData);
        assert(parsed);
        assert.equal(parsed.flags.attestedCredentialData, true);
        assert.equal(parsed.flags.extensionData, true);
        assert.deepEqual(parsed.attestedCredentialData?.credentialId, credentialId);
        assert.deepEqual(parsed.attestedCredentialData?.credentialPublicKey, credentialPublicKey);
        assert.deepEqual(parsed.extensions, extensionData);
    });

    it('rejects non-map CBOR for credentialPublicKey and extensions', () => {
        // WebAuthn authenticatorData: attestedCredentialData credentialPublicKey is a COSE_Key (CBOR map).
        const rpIdHash = new Uint8Array(32);
        const aaguid = new Uint8Array(16);
        const credentialId = new Uint8Array([0x01, 0x02, 0x03]);
        const credentialIdLength = new Uint8Array([0x00, credentialId.length]);

        const invalidCredentialPublicKey = concatBytes(
            rpIdHash,
            new Uint8Array([0x41]),
            encodeUint32(1),
            aaguid,
            credentialIdLength,
            credentialId,
            new Uint8Array([0x01]),
        );
        assert.equal(parseWebauthnAuthenticatorData(invalidCredentialPublicKey), null);

        const invalidExtensions = concatBytes(
            rpIdHash,
            new Uint8Array([0x81]),
            encodeUint32(1),
            new Uint8Array([0x01]),
        );
        assert.equal(parseWebauthnAuthenticatorData(invalidExtensions), null);
    });

    it('rejects forbidden CBOR indefinite-marker combinations', () => {
        // RFC 8949 CBOR: additional info 31 is forbidden for major type 0/1/6/7 item headers.
        const rpIdHash = new Uint8Array(32);
        const aaguid = new Uint8Array(16);
        const credentialId = new Uint8Array([0x01]);
        const credentialIdLength = new Uint8Array([0x00, credentialId.length]);

        const invalidCredentialPublicKey = concatBytes(
            rpIdHash,
            new Uint8Array([0x41]),
            encodeUint32(0),
            aaguid,
            credentialIdLength,
            credentialId,
            new Uint8Array([0x1f]),
        );

        assert.equal(parseWebauthnAuthenticatorData(invalidCredentialPublicKey), null);
    });

    it('accepts nested extension CBOR maps within guard limits', () => {
        const rpIdHash = new Uint8Array(32);
        const nestedExtensions = encodeNestedSingleEntryMap(20);
        const authData = concatBytes(
            rpIdHash,
            new Uint8Array([0x81]), // UP + ED
            encodeUint32(1),
            nestedExtensions,
        );

        const parsed = parseWebauthnAuthenticatorData(authData);
        assert(parsed);
        assert.deepEqual(parsed.extensions, nestedExtensions);
    });

    it('rejects extension CBOR maps that exceed recursion depth guard', () => {
        const rpIdHash = new Uint8Array(32);
        const tooDeepExtensions = encodeNestedSingleEntryMap(80);
        const authData = concatBytes(
            rpIdHash,
            new Uint8Array([0x81]), // UP + ED
            encodeUint32(1),
            tooDeepExtensions,
        );

        assert.equal(parseWebauthnAuthenticatorData(authData), null);
    });

    it('rejects extension CBOR maps that exceed item-count guard', () => {
        const rpIdHash = new Uint8Array(32);
        const tooManyItemsExtensions = encodeFlatMapWithZeroPairs(5001);
        const authData = concatBytes(
            rpIdHash,
            new Uint8Array([0x81]), // UP + ED
            encodeUint32(1),
            tooManyItemsExtensions,
        );

        assert.equal(parseWebauthnAuthenticatorData(authData), null);
    });
});

describe('WebAuthn authenticatorData validation (WebAuthn sign counter + RP ID checks)', () => {
    it('validates rpIdHash match and strict-if-known signCount policy', () => {
        const rpIdHash = new Uint8Array(createHash('sha256').update('example.com', 'utf8').digest());
        const authData = concatBytes(rpIdHash, new Uint8Array([0x01]), encodeUint32(11));
        const parsed = parseWebauthnAuthenticatorData(authData);
        assert(parsed);

        assert.doesNotThrow(() => {
            validateWebauthnAuthenticatorData(parsed, {
                expectedRpId: 'example.com',
                previousSignCount: 10,
            });
        });

        assert.throws(() => {
            validateWebauthnAuthenticatorData(parsed, {
                expectedRpId: 'example.com',
                previousSignCount: 11,
            });
        }, /must increase/);
    });

    it('requires UP by default and enforces UV only when requested', () => {
        const rpIdHash = new Uint8Array(32);
        const authData = concatBytes(rpIdHash, new Uint8Array([0x04]), encodeUint32(1));
        const parsed = parseWebauthnAuthenticatorData(authData);
        assert(parsed);

        assert.throws(() => validateWebauthnAuthenticatorData(parsed), /user presence/);
        assert.doesNotThrow(() => {
            validateWebauthnAuthenticatorData(parsed, {
                requireUserPresence: false,
                requireUserVerification: true,
            });
        });
    });

    it('rejects mismatched flagsByte and flags object values', () => {
        const rpIdHash = new Uint8Array(32);

        assert.throws(() => {
            validateWebauthnAuthenticatorData({
                rpIdHash,
                flagsByte: 0x00,
                flags: {
                    userPresent: true,
                    userVerified: false,
                    backupEligible: false,
                    backupState: false,
                    attestedCredentialData: false,
                    extensionData: false,
                },
                signCount: 0,
            }, {
                requireUserPresence: false,
            });
        }, /flagsByte\/flags inconsistent/);
    });

    it('rejects IP literal expectedRpId by default with explicit compatibility opt-in', () => {
        const rpIdHash = new Uint8Array(createHash('sha256').update('127.0.0.1', 'utf8').digest());
        const parsed = parseWebauthnAuthenticatorData(concatBytes(rpIdHash, new Uint8Array([0x01]), encodeUint32(1)));
        assert(parsed);

        assert.throws(() => {
            validateWebauthnAuthenticatorData(parsed, {
                expectedRpId: '127.0.0.1',
            });
        }, /registrable domain name/);

        assert.doesNotThrow(() => {
            validateWebauthnAuthenticatorData(parsed, {
                expectedRpId: '127.0.0.1',
                allowIpRpId: true,
            });
        });
    });

    it('requires extensions bytes to be a single CBOR map item when ED=true', () => {
        const rpIdHash = new Uint8Array(32);

        assert.throws(() => {
            validateWebauthnAuthenticatorData({
                rpIdHash,
                flagsByte: 0x81,
                flags: {
                    userPresent: true,
                    userVerified: false,
                    backupEligible: false,
                    backupState: false,
                    attestedCredentialData: false,
                    extensionData: true,
                },
                signCount: 0,
                extensions: new Uint8Array([0x01]),
            });
        }, /single CBOR map item/);
    });
});
