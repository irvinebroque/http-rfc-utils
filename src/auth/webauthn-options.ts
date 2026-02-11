/**
 * WebAuthn creation/request options JSON codecs and validators.
 * WebAuthn Level 3 dictionaries and parse-from-JSON algorithms.
 * @see https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialcreationoptionsjson
 * @see https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrequestoptionsjson
 * @see https://www.w3.org/TR/webauthn-3/#sctn-parseCreationOptionsFromJSON
 * @see https://www.w3.org/TR/webauthn-3/#sctn-parseRequestOptionsFromJSON
 */

import type {
    WebauthnAuthenticatorAttachment,
    WebauthnAuthenticatorSelectionCriteria,
    WebauthnAttestationConveyancePreference,
    WebauthnCreationOptionsValidationOptions,
    WebauthnPublicKeyCredentialCreationOptions,
    WebauthnPublicKeyCredentialCreationOptionsJson,
    WebauthnPublicKeyCredentialDescriptor,
    WebauthnPublicKeyCredentialDescriptorJson,
    WebauthnPublicKeyCredentialParameters,
    WebauthnPublicKeyCredentialRequestOptions,
    WebauthnPublicKeyCredentialRequestOptionsJson,
    WebauthnPublicKeyCredentialRpEntity,
    WebauthnPublicKeyCredentialUserEntity,
    WebauthnRequestOptionsValidationOptions,
    WebauthnResidentKeyRequirement,
    WebauthnUserVerificationRequirement,
} from '../types/auth.js';
import { parseWebauthnBase64url, formatWebauthnBase64url } from './webauthn-base64url.js';
import { validateWebauthnCoseAlgorithm } from './webauthn-cose.js';

const DEFAULT_MIN_CHALLENGE_LENGTH = 16;
const MAX_USER_HANDLE_BYTES = 64;

const AUTHENTICATOR_ATTACHMENTS: readonly WebauthnAuthenticatorAttachment[] = ['platform', 'cross-platform'];
const RESIDENT_KEY_REQUIREMENTS: readonly WebauthnResidentKeyRequirement[] = ['discouraged', 'preferred', 'required'];
const USER_VERIFICATION_REQUIREMENTS: readonly WebauthnUserVerificationRequirement[] = ['discouraged', 'preferred', 'required'];
const ATTESTATION_PREFERENCES: readonly WebauthnAttestationConveyancePreference[] = ['none', 'indirect', 'direct', 'enterprise'];

/**
 * Parse PublicKeyCredentialCreationOptionsJSON-like input.
 * Returns null when syntax/shape is invalid.
 */
export function parseWebauthnCreationOptionsFromJson(value: unknown): WebauthnPublicKeyCredentialCreationOptions | null {
    if (!isRecord(value)) {
        return null;
    }

    const challenge = parseRequiredBase64urlField(value, 'challenge');
    if (!challenge) {
        return null;
    }

    const rp = parseRpEntity(value.rp);
    if (!rp) {
        return null;
    }

    const user = parseUserEntity(value.user);
    if (!user) {
        return null;
    }

    const pubKeyCredParams = parseCredentialParameters(value.pubKeyCredParams);
    if (!pubKeyCredParams) {
        return null;
    }

    const timeout = parseOptionalTimeout(value.timeout);
    if (value.timeout !== undefined && timeout === null) {
        return null;
    }

    const excludeCredentials = parseOptionalDescriptors(value.excludeCredentials);
    if (value.excludeCredentials !== undefined && excludeCredentials === null) {
        return null;
    }

    const authenticatorSelection = parseOptionalAuthenticatorSelection(value.authenticatorSelection);
    if (value.authenticatorSelection !== undefined && authenticatorSelection === null) {
        return null;
    }

    const attestation = parseOptionalAttestation(value.attestation);
    if (value.attestation !== undefined && attestation === null) {
        return null;
    }

    const hints = parseOptionalStringArray(value.hints);
    if (value.hints !== undefined && hints === null) {
        return null;
    }

    return {
        challenge,
        rp,
        user,
        pubKeyCredParams,
        timeout: timeout ?? undefined,
        excludeCredentials: excludeCredentials ?? undefined,
        authenticatorSelection: authenticatorSelection ?? undefined,
        attestation: attestation ?? undefined,
        hints: hints ?? undefined,
    };
}

/**
 * Format creation options into JSON-safe form with base64url members.
 * Throws Error on semantic-invalid input.
 */
export function formatWebauthnCreationOptionsToJson(
    value: WebauthnPublicKeyCredentialCreationOptions,
): WebauthnPublicKeyCredentialCreationOptionsJson {
    validateWebauthnCreationOptions(value);

    return {
        challenge: formatWebauthnBase64url(value.challenge),
        rp: {
            id: value.rp.id,
            name: value.rp.name,
        },
        user: {
            id: formatWebauthnBase64url(value.user.id),
            name: value.user.name,
            displayName: value.user.displayName,
        },
        pubKeyCredParams: value.pubKeyCredParams.map((param) => ({
            type: param.type,
            alg: param.alg,
        })),
        timeout: value.timeout,
        excludeCredentials: value.excludeCredentials?.map(formatDescriptorToJson),
        authenticatorSelection: value.authenticatorSelection
            ? { ...value.authenticatorSelection }
            : undefined,
        attestation: value.attestation,
        hints: value.hints ? [...value.hints] : undefined,
    };
}

/**
 * Validate semantic constraints for creation options.
 * Throws Error on invalid input.
 */
export function validateWebauthnCreationOptions(
    value: WebauthnPublicKeyCredentialCreationOptions,
    options: WebauthnCreationOptionsValidationOptions = {},
): void {
    validateMinChallengeLength(value.challenge, options.minChallengeLength ?? DEFAULT_MIN_CHALLENGE_LENGTH, 'creation challenge');

    validateRpEntity(value.rp);
    validateUserEntity(value.user);

    if (!Array.isArray(value.pubKeyCredParams) || value.pubKeyCredParams.length === 0) {
        throw new Error('WebAuthn creation options pubKeyCredParams must include at least one credential parameter.');
    }

    for (let index = 0; index < value.pubKeyCredParams.length; index++) {
        const param = value.pubKeyCredParams[index];
        if (!param || param.type !== 'public-key') {
            throw new Error(`WebAuthn creation options pubKeyCredParams[${index}] type must be "public-key".`);
        }
        validateWebauthnCoseAlgorithm(param.alg, options.allowedCoseAlgorithms);
    }

    if (value.timeout !== undefined) {
        validateTimeout(value.timeout, 'creation timeout');
    }

    if (value.excludeCredentials !== undefined) {
        if (!Array.isArray(value.excludeCredentials)) {
            throw new Error('WebAuthn creation options excludeCredentials must be an array when present.');
        }
        for (let index = 0; index < value.excludeCredentials.length; index++) {
            validateDescriptor(value.excludeCredentials[index], `excludeCredentials[${index}]`);
        }
    }

    if (value.authenticatorSelection !== undefined) {
        validateAuthenticatorSelection(value.authenticatorSelection);
    }

    if (value.attestation !== undefined && !ATTESTATION_PREFERENCES.includes(value.attestation)) {
        throw new Error(`Unsupported WebAuthn attestation value: ${value.attestation}`);
    }

    if (value.hints !== undefined) {
        validateStringArray(value.hints, 'hints');
    }
}

/**
 * Parse PublicKeyCredentialRequestOptionsJSON-like input.
 * Returns null when syntax/shape is invalid.
 */
export function parseWebauthnRequestOptionsFromJson(value: unknown): WebauthnPublicKeyCredentialRequestOptions | null {
    if (!isRecord(value)) {
        return null;
    }

    const challenge = parseRequiredBase64urlField(value, 'challenge');
    if (!challenge) {
        return null;
    }

    const timeout = parseOptionalTimeout(value.timeout);
    if (value.timeout !== undefined && timeout === null) {
        return null;
    }

    if (value.rpId !== undefined && typeof value.rpId !== 'string') {
        return null;
    }

    const allowCredentials = parseOptionalDescriptors(value.allowCredentials);
    if (value.allowCredentials !== undefined && allowCredentials === null) {
        return null;
    }

    const userVerification = parseOptionalUserVerification(value.userVerification);
    if (value.userVerification !== undefined && userVerification === null) {
        return null;
    }

    const hints = parseOptionalStringArray(value.hints);
    if (value.hints !== undefined && hints === null) {
        return null;
    }

    return {
        challenge,
        timeout: timeout ?? undefined,
        rpId: value.rpId,
        allowCredentials: allowCredentials ?? undefined,
        userVerification: userVerification ?? undefined,
        hints: hints ?? undefined,
    };
}

/**
 * Format request options into JSON-safe form with base64url members.
 * Throws Error on semantic-invalid input.
 */
export function formatWebauthnRequestOptionsToJson(
    value: WebauthnPublicKeyCredentialRequestOptions,
): WebauthnPublicKeyCredentialRequestOptionsJson {
    validateWebauthnRequestOptions(value);

    return {
        challenge: formatWebauthnBase64url(value.challenge),
        timeout: value.timeout,
        rpId: value.rpId,
        allowCredentials: value.allowCredentials?.map(formatDescriptorToJson),
        userVerification: value.userVerification,
        hints: value.hints ? [...value.hints] : undefined,
    };
}

/**
 * Validate semantic constraints for request options.
 * Throws Error on invalid input.
 */
export function validateWebauthnRequestOptions(
    value: WebauthnPublicKeyCredentialRequestOptions,
    options: WebauthnRequestOptionsValidationOptions = {},
): void {
    validateMinChallengeLength(value.challenge, options.minChallengeLength ?? DEFAULT_MIN_CHALLENGE_LENGTH, 'request challenge');

    if (value.timeout !== undefined) {
        validateTimeout(value.timeout, 'request timeout');
    }

    if (value.rpId !== undefined) {
        validateRpId(value.rpId, 'request rpId');
    }

    if (value.allowCredentials !== undefined) {
        if (!Array.isArray(value.allowCredentials)) {
            throw new Error('WebAuthn request options allowCredentials must be an array when present.');
        }
        for (let index = 0; index < value.allowCredentials.length; index++) {
            validateDescriptor(value.allowCredentials[index], `allowCredentials[${index}]`);
        }
    }

    if (value.userVerification !== undefined && !USER_VERIFICATION_REQUIREMENTS.includes(value.userVerification)) {
        throw new Error(`Unsupported WebAuthn userVerification value: ${value.userVerification}`);
    }

    if (value.hints !== undefined) {
        validateStringArray(value.hints, 'hints');
    }
}

function parseRequiredBase64urlField(record: Record<string, unknown>, fieldName: string): Uint8Array | null {
    const value = record[fieldName];
    if (typeof value !== 'string') {
        return null;
    }
    return parseWebauthnBase64url(value);
}

function parseRpEntity(value: unknown): WebauthnPublicKeyCredentialRpEntity | null {
    if (!isRecord(value)) {
        return null;
    }
    if (typeof value.name !== 'string') {
        return null;
    }
    if (value.id !== undefined && typeof value.id !== 'string') {
        return null;
    }

    return {
        id: value.id,
        name: value.name,
    };
}

function parseUserEntity(value: unknown): WebauthnPublicKeyCredentialUserEntity | null {
    if (!isRecord(value)) {
        return null;
    }
    if (typeof value.name !== 'string' || typeof value.displayName !== 'string' || typeof value.id !== 'string') {
        return null;
    }

    const id = parseWebauthnBase64url(value.id);
    if (!id) {
        return null;
    }

    return {
        id,
        name: value.name,
        displayName: value.displayName,
    };
}

function parseCredentialParameters(value: unknown): WebauthnPublicKeyCredentialParameters[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const params: WebauthnPublicKeyCredentialParameters[] = [];
    for (const item of value) {
        if (!isRecord(item)) {
            return null;
        }
        if (item.type !== 'public-key' || !Number.isInteger(item.alg)) {
            return null;
        }
        params.push({ type: 'public-key', alg: item.alg as number });
    }

    return params;
}

function parseOptionalDescriptors(value: unknown): WebauthnPublicKeyCredentialDescriptor[] | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        return null;
    }

    const descriptors: WebauthnPublicKeyCredentialDescriptor[] = [];
    for (const item of value) {
        const descriptor = parseDescriptor(item);
        if (!descriptor) {
            return null;
        }
        descriptors.push(descriptor);
    }

    return descriptors;
}

function parseDescriptor(value: unknown): WebauthnPublicKeyCredentialDescriptor | null {
    if (!isRecord(value) || value.type !== 'public-key' || typeof value.id !== 'string') {
        return null;
    }

    const id = parseWebauthnBase64url(value.id);
    if (!id) {
        return null;
    }

    const transports = parseOptionalStringArray(value.transports);
    if (value.transports !== undefined && transports === null) {
        return null;
    }

    return {
        type: 'public-key',
        id,
        transports: transports ?? undefined,
    };
}

function parseOptionalAuthenticatorSelection(value: unknown): WebauthnAuthenticatorSelectionCriteria | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!isRecord(value)) {
        return null;
    }

    const selection: WebauthnAuthenticatorSelectionCriteria = {};

    if (value.authenticatorAttachment !== undefined) {
        if (!isStringInSet(value.authenticatorAttachment, AUTHENTICATOR_ATTACHMENTS)) {
            return null;
        }
        selection.authenticatorAttachment = value.authenticatorAttachment;
    }

    if (value.residentKey !== undefined) {
        if (!isStringInSet(value.residentKey, RESIDENT_KEY_REQUIREMENTS)) {
            return null;
        }
        selection.residentKey = value.residentKey;
    }

    if (value.requireResidentKey !== undefined) {
        if (typeof value.requireResidentKey !== 'boolean') {
            return null;
        }
        selection.requireResidentKey = value.requireResidentKey;
    }

    if (value.userVerification !== undefined) {
        if (!isStringInSet(value.userVerification, USER_VERIFICATION_REQUIREMENTS)) {
            return null;
        }
        selection.userVerification = value.userVerification;
    }

    return selection;
}

function parseOptionalAttestation(value: unknown): WebauthnAttestationConveyancePreference | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!isStringInSet(value, ATTESTATION_PREFERENCES)) {
        return null;
    }
    return value;
}

function parseOptionalUserVerification(value: unknown): WebauthnUserVerificationRequirement | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!isStringInSet(value, USER_VERIFICATION_REQUIREMENTS)) {
        return null;
    }
    return value;
}

function parseOptionalStringArray(value: unknown): string[] | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        return null;
    }
    if (!value.every((entry) => typeof entry === 'string')) {
        return null;
    }
    return [...value];
}

function parseOptionalTimeout(value: unknown): number | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return value;
}

function formatDescriptorToJson(value: WebauthnPublicKeyCredentialDescriptor): WebauthnPublicKeyCredentialDescriptorJson {
    return {
        type: value.type,
        id: formatWebauthnBase64url(value.id),
        transports: value.transports ? [...value.transports] : undefined,
    };
}

function validateRpEntity(value: WebauthnPublicKeyCredentialRpEntity): void {
    if (!isRecord(value)) {
        throw new Error('WebAuthn RP entity must be an object.');
    }
    if (typeof value.name !== 'string' || value.name.length === 0) {
        throw new Error('WebAuthn RP entity name must be a non-empty string.');
    }
    if (value.id !== undefined) {
        validateRpId(value.id, 'creation rp.id');
    }
}

function validateUserEntity(value: WebauthnPublicKeyCredentialUserEntity): void {
    if (!isRecord(value)) {
        throw new Error('WebAuthn user entity must be an object.');
    }
    if (!(value.id instanceof Uint8Array)) {
        throw new Error('WebAuthn user.id must be a Uint8Array.');
    }
    if (value.id.length < 1 || value.id.length > MAX_USER_HANDLE_BYTES) {
        throw new Error(`WebAuthn user.id length must be between 1 and ${MAX_USER_HANDLE_BYTES} bytes.`);
    }
    if (typeof value.name !== 'string' || value.name.length === 0) {
        throw new Error('WebAuthn user.name must be a non-empty string.');
    }
    if (typeof value.displayName !== 'string' || value.displayName.length === 0) {
        throw new Error('WebAuthn user.displayName must be a non-empty string.');
    }
}

function validateDescriptor(value: WebauthnPublicKeyCredentialDescriptor | undefined, context: string): void {
    if (!value || value.type !== 'public-key') {
        throw new Error(`WebAuthn ${context} type must be "public-key".`);
    }
    if (!(value.id instanceof Uint8Array) || value.id.length === 0) {
        throw new Error(`WebAuthn ${context} id must be a non-empty Uint8Array.`);
    }
    if (value.transports !== undefined) {
        validateStringArray(value.transports, `${context} transports`);
    }
}

function validateAuthenticatorSelection(value: WebauthnAuthenticatorSelectionCriteria): void {
    if (value.authenticatorAttachment !== undefined && !AUTHENTICATOR_ATTACHMENTS.includes(value.authenticatorAttachment)) {
        throw new Error(`Unsupported WebAuthn authenticatorAttachment value: ${value.authenticatorAttachment}`);
    }
    if (value.residentKey !== undefined && !RESIDENT_KEY_REQUIREMENTS.includes(value.residentKey)) {
        throw new Error(`Unsupported WebAuthn residentKey value: ${value.residentKey}`);
    }
    if (value.requireResidentKey !== undefined && typeof value.requireResidentKey !== 'boolean') {
        throw new Error('WebAuthn authenticatorSelection.requireResidentKey must be boolean when present.');
    }
    if (value.userVerification !== undefined && !USER_VERIFICATION_REQUIREMENTS.includes(value.userVerification)) {
        throw new Error(`Unsupported WebAuthn userVerification value: ${value.userVerification}`);
    }
}

function validateMinChallengeLength(challenge: Uint8Array, minLength: number, context: string): void {
    if (!(challenge instanceof Uint8Array)) {
        throw new Error(`WebAuthn ${context} must be a Uint8Array.`);
    }
    if (!Number.isInteger(minLength) || minLength < 1) {
        throw new Error(`WebAuthn ${context} minimum length policy must be a positive integer.`);
    }
    if (challenge.length < minLength) {
        throw new Error(`WebAuthn ${context} must be at least ${minLength} bytes.`);
    }
}

function validateTimeout(timeout: number, context: string): void {
    if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error(`WebAuthn ${context} must be a positive finite number.`);
    }
}

function validateStringArray(value: string[], context: string): void {
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
        throw new Error(`WebAuthn ${context} must be an array of strings.`);
    }
}

function validateRpId(value: string, context: string): void {
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isStringInSet<T extends string>(value: unknown, set: readonly T[]): value is T {
    return typeof value === 'string' && set.includes(value as T);
}
