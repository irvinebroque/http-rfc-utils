/**
 * Tests for WebAuthn clientDataJSON helpers.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    formatWebauthnClientDataJson,
    parseWebauthnClientDataJson,
    validateWebauthnClientData,
} from '../src/auth.js';

describe('WebAuthn clientDataJSON parse/format/validate (WebAuthn Level 3)', () => {
    it('parses UTF-8 JSON bytes into clientData fields', () => {
        // WebAuthn dictionary-client-data: required type/challenge/origin members.
        const bytes = new TextEncoder().encode(JSON.stringify({
            type: 'webauthn.get',
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            origin: 'https://example.com',
            crossOrigin: false,
        }));

        const parsed = parseWebauthnClientDataJson(bytes);
        assert.deepEqual(parsed, {
            type: 'webauthn.get',
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            origin: 'https://example.com',
            crossOrigin: false,
        });
    });

    it('returns null for malformed UTF-8 or JSON payloads', () => {
        assert.equal(parseWebauthnClientDataJson(new Uint8Array([0xff])), null);
        assert.equal(parseWebauthnClientDataJson('{"type":'), null);
        assert.equal(parseWebauthnClientDataJson('{"challenge":"AAECAwQFBgcICQoLDA0ODw"}'), null);
    });

    it('validates expected type/challenge/origin with conservative HTTPS defaults', () => {
        // WebAuthn clientDataJSON verification and validating-origin sections.
        const parsed = parseWebauthnClientDataJson(JSON.stringify({
            type: 'webauthn.get',
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            origin: 'https://example.com',
        }));
        assert(parsed);

        assert.doesNotThrow(() => {
            validateWebauthnClientData(parsed, {
                expectedType: 'webauthn.get',
                expectedChallenge: 'AAECAwQFBgcICQoLDA0ODw',
                expectedOrigin: 'https://example.com',
            });
        });

        assert.throws(() => {
            validateWebauthnClientData(parsed, {
                expectedChallenge: 'AQIDBAUGBwgJCgsMDQ4PEA',
            });
        }, /does not match expected challenge/);
    });

    it('rejects non-HTTPS origins by default and allows loopback only by explicit opt-in', () => {
        const parsed = parseWebauthnClientDataJson(JSON.stringify({
            type: 'webauthn.create',
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            origin: 'http://localhost:3000',
        }));
        assert(parsed);

        assert.throws(() => validateWebauthnClientData(parsed), /must use HTTPS/);
        assert.doesNotThrow(() => {
            validateWebauthnClientData(parsed, {
                allowHttpLoopbackOrigin: true,
            });
        });
    });

    it('formats clientData to UTF-8 JSON and round-trips parse', () => {
        const clientData = {
            type: 'webauthn.get',
            challenge: 'AAECAwQFBgcICQoLDA0ODw',
            origin: 'https://example.com',
            crossOrigin: false,
        };

        const encoded = formatWebauthnClientDataJson(clientData);
        const parsed = parseWebauthnClientDataJson(encoded);
        assert.deepEqual(parsed, clientData);
    });

    it('uses HTTPS origin checks by default when formatting', () => {
        assert.throws(() => {
            formatWebauthnClientDataJson({
                type: 'webauthn.get',
                challenge: 'AAECAwQFBgcICQoLDA0ODw',
                origin: 'http://example.com',
            });
        }, /must use HTTPS/);

        assert.doesNotThrow(() => {
            formatWebauthnClientDataJson({
                type: 'webauthn.get',
                challenge: 'AAECAwQFBgcICQoLDA0ODw',
                origin: 'http://localhost:3000',
            }, {
                allowHttpLoopbackOrigin: true,
            });
        });

        assert.doesNotThrow(() => {
            formatWebauthnClientDataJson({
                type: 'webauthn.get',
                challenge: 'AAECAwQFBgcICQoLDA0ODw',
                origin: 'http://example.com',
            }, {
                requireHttpsOrigin: false,
            });
        });
    });
});
