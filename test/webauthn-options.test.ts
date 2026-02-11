/**
 * Tests for WebAuthn creation/request options helpers.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    formatWebauthnCreationOptionsToJson,
    formatWebauthnRequestOptionsToJson,
    parseWebauthnCreationOptionsFromJson,
    parseWebauthnRequestOptionsFromJson,
    validateWebauthnCreationOptions,
    validateWebauthnRequestOptions,
} from '../src/auth.js';

describe('WebAuthn creation options codecs (WebAuthn Level 3 parseCreationOptionsFromJSON)', () => {
    it('parses base64url members into binary fields', () => {
        // WebAuthn Level 3 parseCreationOptionsFromJSON algorithm decodes challenge/user.id/excludeCredentials.id.
        const parsed = parseWebauthnCreationOptionsFromJson({
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            rp: { id: 'example.com', name: 'Example RP' },
            user: {
                id: 'AQIDBAUGBwgJCgsMDQ4PEA',
                name: 'ada@example.com',
                displayName: 'Ada Lovelace',
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 },
            ],
            excludeCredentials: [
                {
                    type: 'public-key',
                    id: 'AAECAwQFBgcICQ',
                    transports: ['internal'],
                },
            ],
            timeout: 60000,
        });

        assert(parsed);
        assert.equal(parsed.challenge.length, 16);
        assert.equal(parsed.user.id.length, 16);
        assert.equal(parsed.excludeCredentials?.[0]?.id.length, 10);
    });

    it('returns null on syntax-invalid JSON members', () => {
        assert.equal(
            parseWebauthnCreationOptionsFromJson({
                challenge: 'bad=',
                rp: { id: 'example.com', name: 'Example RP' },
                user: { id: 'AQIDBAUGBwgJCgsMDQ4PEA', name: 'ada@example.com', displayName: 'Ada Lovelace' },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            }),
            null,
        );

        assert.equal(
            parseWebauthnCreationOptionsFromJson({
                challenge: 'AAECAwQFBgcICQoLDA0ODw',
                rp: { id: 'example.com', name: 'Example RP' },
                user: { id: 'AQIDBAUGBwgJCgsMDQ4PEA', name: 'ada@example.com', displayName: 'Ada Lovelace' },
                pubKeyCredParams: [{ type: 'public-key', alg: -7.5 }],
            }),
            null,
        );
    });

    it('throws on semantic-invalid policy values', () => {
        const parsed = parseWebauthnCreationOptionsFromJson({
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            rp: { id: 'example.com', name: 'Example RP' },
            user: { id: 'AQIDBAUGBwgJCgsMDQ4PEA', name: 'ada@example.com', displayName: 'Ada Lovelace' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        });
        assert(parsed);

        // WebAuthn Section on AlgorithmIdentifier + conservative allowlist policy.
        assert.throws(() => validateWebauthnCreationOptions(parsed, { allowedCoseAlgorithms: [-257] }), /not allowed/);
        assert.throws(() => validateWebauthnCreationOptions({ ...parsed, rp: { ...parsed.rp, id: 'https://example.com' } }), /host name/);
    });

    it('rejects IPv4-style rp.id by default with explicit compatibility opt-in', () => {
        const parsed = parseWebauthnCreationOptionsFromJson({
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            rp: { id: '127.0.0.1', name: 'Example RP' },
            user: { id: 'AQIDBAUGBwgJCgsMDQ4PEA', name: 'ada@example.com', displayName: 'Ada Lovelace' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        });
        assert(parsed);

        assert.throws(() => validateWebauthnCreationOptions(parsed), /registrable domain name/);
        assert.doesNotThrow(() => validateWebauthnCreationOptions(parsed, { allowIpRpId: true }));
        assert.doesNotThrow(() => formatWebauthnCreationOptionsToJson(parsed, { allowIpRpId: true }));
    });

    it('formats creation options to JSON and round-trips parse', () => {
        const parsed = parseWebauthnCreationOptionsFromJson({
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            rp: { id: 'example.com', name: 'Example RP' },
            user: { id: 'AQIDBAUGBwgJCgsMDQ4PEA', name: 'ada@example.com', displayName: 'Ada Lovelace' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        });
        assert(parsed);

        const formatted = formatWebauthnCreationOptionsToJson(parsed);
        assert.equal(formatted.challenge, 'AAECAwQFBgcICQoLDA0ODw');

        const roundTrip = parseWebauthnCreationOptionsFromJson(formatted);
        assert.deepEqual(roundTrip, parsed);
    });
});

describe('WebAuthn request options codecs (WebAuthn Level 3 parseRequestOptionsFromJSON)', () => {
    it('parses and formats request options with allowCredentials decoding', () => {
        const parsed = parseWebauthnRequestOptionsFromJson({
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            rpId: 'example.com',
            userVerification: 'preferred',
            allowCredentials: [{ type: 'public-key', id: 'AAECAwQFBgcICQ' }],
        });
        assert(parsed);
        assert.equal(parsed.allowCredentials?.[0]?.id.length, 10);

        const formatted = formatWebauthnRequestOptionsToJson(parsed);
        assert.equal(formatted.challenge, 'AAECAwQFBgcICQoLDA0ODw');
        assert.equal(formatted.rpId, 'example.com');
    });

    it('rejects syntax-invalid and semantic-invalid request option members', () => {
        assert.equal(parseWebauthnRequestOptionsFromJson({ challenge: 'AA=', rpId: 'example.com' }), null);

        const parsed = parseWebauthnRequestOptionsFromJson({ challenge: 'AAECAwQFBgcICQoLDA0ODw', rpId: 'example.com' });
        assert(parsed);
        assert.throws(() => validateWebauthnRequestOptions({ ...parsed, rpId: 'Example.COM' }), /lower-case/);
    });

    it('rejects IPv4-style rpId by default with explicit compatibility opt-in', () => {
        const parsed = parseWebauthnRequestOptionsFromJson({ challenge: 'AAECAwQFBgcICQoLDA0ODw', rpId: '127.0.0.1' });
        assert(parsed);

        assert.throws(() => validateWebauthnRequestOptions(parsed), /registrable domain name/);
        assert.doesNotThrow(() => validateWebauthnRequestOptions(parsed, { allowIpRpId: true }));
        assert.doesNotThrow(() => formatWebauthnRequestOptionsToJson(parsed, { allowIpRpId: true }));
    });
});
