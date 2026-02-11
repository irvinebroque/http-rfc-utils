/**
 * WebAuthn authenticatorData parse/validate helpers.
 * WebAuthn Level 3 authenticator data, attested credential data, and sign counter sections.
 * @see https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data
 * @see https://www.w3.org/TR/webauthn-3/#sctn-attested-credential-data
 * @see https://www.w3.org/TR/webauthn-3/#sctn-sign-counter
 */

import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type {
    WebauthnAuthenticatorData,
    WebauthnAuthenticatorDataValidationOptions,
    WebauthnAuthenticatorFlags,
    WebauthnAttestedCredentialData,
} from '../types/auth.js';

const AUTHENTICATOR_DATA_MIN_LENGTH = 37;
const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_BE = 0x08;
const FLAG_BS = 0x10;
const FLAG_AT = 0x40;
const FLAG_ED = 0x80;
const CBOR_BREAK = 0xff;
const CBOR_MAX_NESTING_DEPTH = 64;
const CBOR_MAX_ITEM_COUNT = 10_000;

interface CborReadGuardState {
    depth: number;
    itemCount: number;
}

/**
 * Parse authenticatorData bytes into structured fields.
 * Returns null on malformed/truncated input.
 */
export function parseWebauthnAuthenticatorData(
    value: Uint8Array | ArrayBuffer | ArrayBufferView,
): WebauthnAuthenticatorData | null {
    const bytes = toUint8Array(value);
    if (bytes.length < AUTHENTICATOR_DATA_MIN_LENGTH) {
        return null;
    }

    const rpIdHash = bytes.slice(0, 32);
    const flagsByte = bytes[32] ?? 0;
    const signCount = readUint32(bytes, 33);
    const flags = parseFlags(flagsByte);

    let offset = AUTHENTICATOR_DATA_MIN_LENGTH;
    let attestedCredentialData: WebauthnAttestedCredentialData | undefined;
    let extensions: Uint8Array | undefined;

    if (flags.attestedCredentialData) {
        if (bytes.length < offset + 18) {
            return null;
        }

        const aaguid = bytes.slice(offset, offset + 16);
        offset += 16;

        const credentialIdLength = readUint16(bytes, offset);
        offset += 2;

        if (bytes.length < offset + credentialIdLength) {
            return null;
        }

        const credentialId = bytes.slice(offset, offset + credentialIdLength);
        offset += credentialIdLength;

        if (bytes.length <= offset) {
            return null;
        }

        const credentialPublicKeyEnd = readRequiredCborMapItemEnd(bytes, offset);
        if (credentialPublicKeyEnd === null) {
            return null;
        }

        const credentialPublicKey = bytes.slice(offset, credentialPublicKeyEnd);
        offset = credentialPublicKeyEnd;

        attestedCredentialData = {
            aaguid,
            credentialId,
            credentialPublicKey,
        };
    }

    if (flags.extensionData) {
        if (bytes.length <= offset) {
            return null;
        }

        const extensionEnd = readRequiredCborMapItemEnd(bytes, offset);
        if (extensionEnd === null || extensionEnd !== bytes.length) {
            return null;
        }

        extensions = bytes.slice(offset, extensionEnd);
        offset = extensionEnd;
    }

    if (!flags.extensionData && offset !== bytes.length) {
        return null;
    }

    if (flags.extensionData && offset !== bytes.length) {
        return null;
    }

    const parsed: WebauthnAuthenticatorData = {
        rpIdHash,
        flagsByte,
        flags,
        signCount,
    };

    if (attestedCredentialData !== undefined) {
        parsed.attestedCredentialData = attestedCredentialData;
    }
    if (extensions !== undefined) {
        parsed.extensions = extensions;
    }

    return parsed;
}

/**
 * Validate parsed authenticator data against policy checks.
 * Throws Error on semantic-invalid input.
 */
export function validateWebauthnAuthenticatorData(
    value: WebauthnAuthenticatorData,
    options: WebauthnAuthenticatorDataValidationOptions = {},
): void {
    if (!isRecord(value)) {
        throw new Error('WebAuthn authenticatorData must be an object.');
    }

    if (!(value.rpIdHash instanceof Uint8Array) || value.rpIdHash.length !== 32) {
        throw new Error('WebAuthn authenticatorData.rpIdHash must be a 32-byte Uint8Array.');
    }

    if (!Number.isInteger(value.flagsByte) || value.flagsByte < 0 || value.flagsByte > 0xff) {
        throw new Error('WebAuthn authenticatorData.flagsByte must be an unsigned byte.');
    }

    validateFlags(value.flags);
    const effectiveFlags = parseFlags(value.flagsByte);

    if (!flagsEqual(value.flags, effectiveFlags)) {
        throw new Error('WebAuthn authenticatorData flagsByte/flags inconsistent.');
    }

    if (!Number.isInteger(value.signCount) || value.signCount < 0 || value.signCount > 0xffffffff) {
        throw new Error('WebAuthn authenticatorData.signCount must be a uint32.');
    }

    if (options.expectedRpId !== undefined) {
        validateRpId(options.expectedRpId, 'expectedRpId', options.allowIpRpId ?? false);
        const expectedRpIdHash = createHash('sha256').update(options.expectedRpId, 'utf8').digest();
        if (!bytesEqual(value.rpIdHash, new Uint8Array(expectedRpIdHash))) {
            throw new Error('WebAuthn authenticatorData rpIdHash does not match expectedRpId.');
        }
    }

    if (options.requireUserPresence ?? true) {
        if (!effectiveFlags.userPresent) {
            throw new Error('WebAuthn authenticatorData requires user presence (UP=true).');
        }
    }

    if (options.requireUserVerification ?? false) {
        if (!effectiveFlags.userVerified) {
            throw new Error('WebAuthn authenticatorData requires user verification (UV=true).');
        }
    }

    if (effectiveFlags.backupState && !effectiveFlags.backupEligible) {
        throw new Error('WebAuthn authenticatorData has invalid backup flags: BS=true requires BE=true.');
    }

    if (effectiveFlags.attestedCredentialData) {
        if (!value.attestedCredentialData) {
            throw new Error('WebAuthn authenticatorData flag AT=true requires attestedCredentialData.');
        }
        validateAttestedCredentialData(value.attestedCredentialData);
    } else if (value.attestedCredentialData !== undefined) {
        throw new Error('WebAuthn authenticatorData attestedCredentialData must be absent when AT=false.');
    }

    if (effectiveFlags.extensionData) {
        if (!(value.extensions instanceof Uint8Array) || value.extensions.length === 0) {
            throw new Error('WebAuthn authenticatorData flag ED=true requires non-empty extension bytes.');
        }
        const extensionEnd = readRequiredCborMapItemEnd(value.extensions, 0);
        if (extensionEnd === null || extensionEnd !== value.extensions.length) {
            throw new Error('WebAuthn authenticatorData.extensions must contain a single CBOR map item.');
        }
    } else if (value.extensions !== undefined) {
        throw new Error('WebAuthn authenticatorData extensions must be absent when ED=false.');
    }

    if (options.previousSignCount !== undefined) {
        if (!Number.isInteger(options.previousSignCount) || options.previousSignCount < 0) {
            throw new Error('WebAuthn previousSignCount must be a non-negative integer when provided.');
        }

        if (options.previousSignCount !== 0 && value.signCount !== 0 && value.signCount <= options.previousSignCount) {
            throw new Error('WebAuthn signCount must increase when both previous and current counters are non-zero.');
        }
    }
}

function parseFlags(flagsByte: number): WebauthnAuthenticatorFlags {
    return {
        userPresent: (flagsByte & FLAG_UP) !== 0,
        userVerified: (flagsByte & FLAG_UV) !== 0,
        backupEligible: (flagsByte & FLAG_BE) !== 0,
        backupState: (flagsByte & FLAG_BS) !== 0,
        attestedCredentialData: (flagsByte & FLAG_AT) !== 0,
        extensionData: (flagsByte & FLAG_ED) !== 0,
    };
}

function validateFlags(flags: WebauthnAuthenticatorFlags): void {
    if (!isRecord(flags)) {
        throw new Error('WebAuthn authenticatorData.flags must be an object.');
    }

    if (
        typeof flags.userPresent !== 'boolean'
        || typeof flags.userVerified !== 'boolean'
        || typeof flags.backupEligible !== 'boolean'
        || typeof flags.backupState !== 'boolean'
        || typeof flags.attestedCredentialData !== 'boolean'
        || typeof flags.extensionData !== 'boolean'
    ) {
        throw new Error('WebAuthn authenticatorData.flags fields must be booleans.');
    }
}

function validateAttestedCredentialData(value: WebauthnAttestedCredentialData): void {
    if (!(value.aaguid instanceof Uint8Array) || value.aaguid.length !== 16) {
        throw new Error('WebAuthn attestedCredentialData.aaguid must be 16 bytes.');
    }
    if (!(value.credentialId instanceof Uint8Array) || value.credentialId.length === 0) {
        throw new Error('WebAuthn attestedCredentialData.credentialId must be non-empty bytes.');
    }
    if (!(value.credentialPublicKey instanceof Uint8Array) || value.credentialPublicKey.length === 0) {
        throw new Error('WebAuthn attestedCredentialData.credentialPublicKey must be non-empty bytes.');
    }

    const credentialPublicKeyEnd = readRequiredCborMapItemEnd(value.credentialPublicKey, 0);
    if (credentialPublicKeyEnd === null || credentialPublicKeyEnd !== value.credentialPublicKey.length) {
        throw new Error('WebAuthn attestedCredentialData.credentialPublicKey must contain a single CBOR map item.');
    }
}

function readRequiredCborMapItemEnd(bytes: Uint8Array, offset: number): number | null {
    if (offset >= bytes.length) {
        return null;
    }
    const initial = bytes[offset] ?? 0;
    const majorType = initial >> 5;
    if (majorType !== 5) {
        return null;
    }
    return readCborItemEnd(bytes, offset, { depth: 0, itemCount: 0 });
}

function readCborItemEnd(bytes: Uint8Array, offset: number, guard: CborReadGuardState): number | null {
    if (offset >= bytes.length) {
        return null;
    }

    if (guard.itemCount >= CBOR_MAX_ITEM_COUNT) {
        return null;
    }
    guard.itemCount += 1;

    if (guard.depth >= CBOR_MAX_NESTING_DEPTH) {
        return null;
    }
    guard.depth += 1;

    try {
        const initial = bytes[offset] ?? 0;
        const majorType = initial >> 5;
        const additionalInfo = initial & 0x1f;

        const header = readCborLengthArgument(bytes, offset, majorType, additionalInfo);
        if (!header) {
            return null;
        }

        if (majorType === 0 || majorType === 1) {
            return header.nextOffset;
        }

        if (majorType === 2 || majorType === 3) {
            if (header.indefinite) {
                return readIndefiniteStringLike(bytes, header.nextOffset, majorType, guard);
            }
            const end = header.nextOffset + header.length;
            return end <= bytes.length ? end : null;
        }

        if (majorType === 4) {
            if (header.indefinite) {
                return readIndefiniteArray(bytes, header.nextOffset, guard);
            }
            let cursor = header.nextOffset;
            for (let index = 0; index < header.length; index++) {
                const itemEnd = readCborItemEnd(bytes, cursor, guard);
                if (itemEnd === null) {
                    return null;
                }
                cursor = itemEnd;
            }
            return cursor;
        }

        if (majorType === 5) {
            if (header.indefinite) {
                return readIndefiniteMap(bytes, header.nextOffset, guard);
            }
            let cursor = header.nextOffset;
            for (let index = 0; index < header.length; index++) {
                const keyEnd = readCborItemEnd(bytes, cursor, guard);
                if (keyEnd === null) {
                    return null;
                }
                const valueEnd = readCborItemEnd(bytes, keyEnd, guard);
                if (valueEnd === null) {
                    return null;
                }
                cursor = valueEnd;
            }
            return cursor;
        }

        if (majorType === 6) {
            return readCborItemEnd(bytes, header.nextOffset, guard);
        }

        if (majorType === 7) {
            if (additionalInfo === 24 || additionalInfo === 25 || additionalInfo === 26 || additionalInfo === 27) {
                return header.nextOffset;
            }
            if (additionalInfo < 24) {
                return header.nextOffset;
            }
            return null;
        }

        return null;
    } finally {
        guard.depth -= 1;
    }
}

function readCborLengthArgument(
    bytes: Uint8Array,
    offset: number,
    majorType: number,
    additionalInfo: number,
): { length: number; nextOffset: number; indefinite: boolean } | null {
    if (additionalInfo < 24) {
        return { length: additionalInfo, nextOffset: offset + 1, indefinite: false };
    }

    if (additionalInfo === 24) {
        if (offset + 2 > bytes.length) {
            return null;
        }
        return { length: bytes[offset + 1] ?? 0, nextOffset: offset + 2, indefinite: false };
    }

    if (additionalInfo === 25) {
        if (offset + 3 > bytes.length) {
            return null;
        }
        return {
            length: ((bytes[offset + 1] ?? 0) << 8) | (bytes[offset + 2] ?? 0),
            nextOffset: offset + 3,
            indefinite: false,
        };
    }

    if (additionalInfo === 26) {
        if (offset + 5 > bytes.length) {
            return null;
        }
        return {
            length: readUint32(bytes, offset + 1),
            nextOffset: offset + 5,
            indefinite: false,
        };
    }

    if (additionalInfo === 27) {
        if (offset + 9 > bytes.length) {
            return null;
        }

        const high = readUint32(bytes, offset + 1);
        const low = readUint32(bytes, offset + 5);
        const combined = high * 0x1_0000_0000 + low;
        if (!Number.isSafeInteger(combined)) {
            return null;
        }

        return {
            length: combined,
            nextOffset: offset + 9,
            indefinite: false,
        };
    }

    if (additionalInfo === 31) {
        if (majorType === 0 || majorType === 1 || majorType === 6 || majorType === 7) {
            return null;
        }
        return {
            length: 0,
            nextOffset: offset + 1,
            indefinite: true,
        };
    }

    return null;
}

function readIndefiniteStringLike(
    bytes: Uint8Array,
    offset: number,
    expectedMajorType: number,
    guard: CborReadGuardState,
): number | null {
    let cursor = offset;
    while (cursor < bytes.length) {
        const initial = bytes[cursor] ?? 0;
        if (initial === CBOR_BREAK) {
            return cursor + 1;
        }

        if (guard.itemCount >= CBOR_MAX_ITEM_COUNT) {
            return null;
        }
        guard.itemCount += 1;

        const majorType = initial >> 5;
        const additionalInfo = initial & 0x1f;
        if (majorType !== expectedMajorType || additionalInfo === 31) {
            return null;
        }

        const header = readCborLengthArgument(bytes, cursor, majorType, additionalInfo);
        if (!header || header.indefinite) {
            return null;
        }

        const next = header.nextOffset + header.length;
        if (next > bytes.length) {
            return null;
        }
        cursor = next;
    }

    return null;
}

function readIndefiniteArray(bytes: Uint8Array, offset: number, guard: CborReadGuardState): number | null {
    let cursor = offset;
    while (cursor < bytes.length) {
        if ((bytes[cursor] ?? 0) === CBOR_BREAK) {
            return cursor + 1;
        }

        const itemEnd = readCborItemEnd(bytes, cursor, guard);
        if (itemEnd === null) {
            return null;
        }
        cursor = itemEnd;
    }

    return null;
}

function readIndefiniteMap(bytes: Uint8Array, offset: number, guard: CborReadGuardState): number | null {
    let cursor = offset;
    while (cursor < bytes.length) {
        if ((bytes[cursor] ?? 0) === CBOR_BREAK) {
            return cursor + 1;
        }

        const keyEnd = readCborItemEnd(bytes, cursor, guard);
        if (keyEnd === null) {
            return null;
        }
        const valueEnd = readCborItemEnd(bytes, keyEnd, guard);
        if (valueEnd === null) {
            return null;
        }
        cursor = valueEnd;
    }

    return null;
}

function readUint16(value: Uint8Array, offset: number): number {
    return ((value[offset] ?? 0) << 8) | (value[offset + 1] ?? 0);
}

function readUint32(value: Uint8Array, offset: number): number {
    return (
        (((value[offset] ?? 0) << 24) >>> 0)
        + ((value[offset + 1] ?? 0) << 16)
        + ((value[offset + 2] ?? 0) << 8)
        + (value[offset + 3] ?? 0)
    ) >>> 0;
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

function validateRpId(value: string, context: string, allowIpLiteral: boolean): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`WebAuthn ${context} must be a non-empty string.`);
    }
    if (value !== value.toLowerCase()) {
        throw new Error(`WebAuthn ${context} must be lower-case.`);
    }
    if (value.includes('://') || value.includes('/') || value.includes(':') || value.includes('?') || value.includes('#')) {
        throw new Error(`WebAuthn ${context} must be a host name without scheme, port, path, query, or fragment.`);
    }
    if (value.endsWith('.')) {
        throw new Error(`WebAuthn ${context} must not end with a dot.`);
    }

    const labels = value.split('.');
    if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
        throw new Error(`WebAuthn ${context} must be a valid DNS label sequence.`);
    }

    if (!allowIpLiteral && isIP(value) !== 0) {
        throw new Error(`WebAuthn ${context} must be a registrable domain name, not an IP literal.`);
    }
}

function flagsEqual(left: WebauthnAuthenticatorFlags, right: WebauthnAuthenticatorFlags): boolean {
    return left.userPresent === right.userPresent
        && left.userVerified === right.userVerified
        && left.backupEligible === right.backupEligible
        && left.backupState === right.backupState
        && left.attestedCredentialData === right.attestedCredentialData
        && left.extensionData === right.extensionData;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) {
            return false;
        }
    }
    return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
