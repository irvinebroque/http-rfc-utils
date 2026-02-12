/**
 * WebAuthn clientDataJSON parse/format/validate helpers.
 * WebAuthn Level 3 CollectedClientData requirements and verification checks.
 * @see https://www.w3.org/TR/webauthn-3/#dictionary-client-data
 * @see https://www.w3.org/TR/webauthn-3/#clientdatajson-verification
 */

import type {
    WebauthnClientData,
    WebauthnClientDataFormatOptions,
    WebauthnClientDataValidationOptions,
} from '../types/auth.js';
import {
    formatWebauthnBase64url,
    parseWebauthnBase64url,
    validateWebauthnBase64url,
} from './webauthn-base64url.js';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const UTF8_ENCODER = new TextEncoder();
const DEFAULT_MIN_CHALLENGE_LENGTH = 16;

/**
 * Parse clientDataJSON bytes/text into a typed object.
 * Returns null on malformed input.
 */
export function parseWebauthnClientDataJson(value: string | Uint8Array | ArrayBuffer | ArrayBufferView): WebauthnClientData | null {
    const jsonText = decodeJsonText(value);
    if (jsonText === null) {
        return null;
    }

    let parsedValue: unknown;
    try {
        parsedValue = JSON.parse(jsonText);
    } catch {
        return null;
    }

    if (!isRecord(parsedValue)) {
        return null;
    }

    if (typeof parsedValue.type !== 'string' || typeof parsedValue.challenge !== 'string' || typeof parsedValue.origin !== 'string') {
        return null;
    }

    if (parsedValue.crossOrigin !== undefined && typeof parsedValue.crossOrigin !== 'boolean') {
        return null;
    }

    if (parsedValue.topOrigin !== undefined && typeof parsedValue.topOrigin !== 'string') {
        return null;
    }

    const result: WebauthnClientData = {
        type: parsedValue.type,
        challenge: parsedValue.challenge,
        origin: parsedValue.origin,
    };

    if (typeof parsedValue.crossOrigin === 'boolean') {
        result.crossOrigin = parsedValue.crossOrigin;
    }
    if (typeof parsedValue.topOrigin === 'string') {
        result.topOrigin = parsedValue.topOrigin;
    }

    return result;
}

/**
 * Format a client data object as UTF-8 encoded clientDataJSON bytes.
 * Throws Error on semantic-invalid input.
 */
export function formatWebauthnClientDataJson(
    value: WebauthnClientData,
    options: WebauthnClientDataFormatOptions = {},
): Uint8Array {
    validateWebauthnClientData(value, {
        requireHttpsOrigin: options.requireHttpsOrigin ?? true,
        allowHttpLoopbackOrigin: options.allowHttpLoopbackOrigin ?? false,
    });

    return UTF8_ENCODER.encode(JSON.stringify(value));
}

/**
 * Validate semantic requirements for CollectedClientData.
 * Throws Error on invalid input.
 */
export function validateWebauthnClientData(
    value: WebauthnClientData,
    options: WebauthnClientDataValidationOptions = {},
): void {
    if (!isRecord(value)) {
        throw new Error('WebAuthn clientData must be an object.');
    }

    if (typeof value.type !== 'string' || value.type.length === 0) {
        throw new Error('WebAuthn clientData.type must be a non-empty string.');
    }
    if (typeof value.challenge !== 'string' || value.challenge.length === 0) {
        throw new Error('WebAuthn clientData.challenge must be a non-empty base64url string.');
    }
    if (typeof value.origin !== 'string' || value.origin.length === 0) {
        throw new Error('WebAuthn clientData.origin must be a non-empty origin string.');
    }

    validateWebauthnBase64url(value.challenge);
    const decodedChallenge = parseWebauthnBase64url(value.challenge);
    if (decodedChallenge === null) {
        throw new Error('WebAuthn clientData.challenge must decode as canonical base64url.');
    }

    const minChallengeLength = options.minChallengeLength ?? DEFAULT_MIN_CHALLENGE_LENGTH;
    if (!Number.isInteger(minChallengeLength) || minChallengeLength < 1) {
        throw new Error('WebAuthn clientData minChallengeLength policy must be a positive integer.');
    }
    if (decodedChallenge.length < minChallengeLength) {
        throw new Error(`WebAuthn clientData.challenge must be at least ${minChallengeLength} bytes.`);
    }

    if (value.crossOrigin !== undefined && typeof value.crossOrigin !== 'boolean') {
        throw new Error('WebAuthn clientData.crossOrigin must be boolean when present.');
    }

    if (value.topOrigin !== undefined && typeof value.topOrigin !== 'string') {
        throw new Error('WebAuthn clientData.topOrigin must be a string when present.');
    }

    validateClientOrigin(
        value.origin,
        options.requireHttpsOrigin ?? true,
        options.allowHttpLoopbackOrigin ?? false,
        'clientData.origin',
    );

    if (value.topOrigin !== undefined) {
        validateClientOrigin(
            value.topOrigin,
            options.requireHttpsOrigin ?? true,
            options.allowHttpLoopbackOrigin ?? false,
            'clientData.topOrigin',
        );
    }

    if (options.expectedType !== undefined) {
        const expectedTypes = Array.isArray(options.expectedType)
            ? options.expectedType
            : [options.expectedType];
        if (!expectedTypes.includes(value.type)) {
            throw new Error(`WebAuthn clientData.type mismatch. Expected one of: ${expectedTypes.join(', ')}`);
        }
    }

    if (options.expectedChallenge !== undefined) {
        if (typeof options.expectedChallenge === 'string') {
            validateWebauthnBase64url(options.expectedChallenge);
            if (value.challenge !== options.expectedChallenge) {
                throw new Error('WebAuthn clientData.challenge does not match expected challenge.');
            }
        } else {
            const expected = formatWebauthnBase64url(options.expectedChallenge);
            if (value.challenge !== expected) {
                throw new Error('WebAuthn clientData.challenge does not match expected challenge bytes.');
            }
        }
    }

    if (options.expectedOrigin !== undefined) {
        const expectedOrigins = Array.isArray(options.expectedOrigin)
            ? options.expectedOrigin
            : [options.expectedOrigin];
        if (!expectedOrigins.includes(value.origin)) {
            throw new Error(`WebAuthn clientData.origin mismatch. Expected one of: ${expectedOrigins.join(', ')}`);
        }
    }
}

function decodeJsonText(value: string | Uint8Array | ArrayBuffer | ArrayBufferView): string | null {
    if (typeof value === 'string') {
        return value;
    }

    const bytes = toUint8Array(value);
    try {
        return UTF8_DECODER.decode(bytes);
    } catch {
        return null;
    }
}

function toUint8Array(value: Uint8Array | ArrayBuffer | ArrayBufferView): Uint8Array {
    if (value instanceof Uint8Array) {
        return value;
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function validateClientOrigin(
    origin: string,
    requireHttpsOrigin: boolean,
    allowHttpLoopbackOrigin: boolean,
    context: string,
): void {
    let parsed: URL;
    try {
        parsed = new URL(origin);
    } catch {
        throw new Error(`WebAuthn ${context} must be a valid origin URL.`);
    }

    if (parsed.origin !== origin) {
        throw new Error(`WebAuthn ${context} must not include path, query, or fragment.`);
    }

    if (parsed.protocol === 'https:') {
        return;
    }

    if (!requireHttpsOrigin) {
        return;
    }

    if (
        parsed.protocol === 'http:'
        && allowHttpLoopbackOrigin
        && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]')
    ) {
        return;
    }

    throw new Error(`WebAuthn ${context} must use HTTPS.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
