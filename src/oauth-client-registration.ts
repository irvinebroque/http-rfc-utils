/**
 * OAuth 2.0 Dynamic Client Registration Protocol helpers per RFC 7591.
 * RFC 7591 Sections 2, 2.1, 2.2, 2.3, 3.1, 3.1.1, 3.2, 3.2.1, and 3.2.2.
 * @see https://www.rfc-editor.org/rfc/rfc7591.html
 */

import type {
    OAuthClientMetadata,
    OAuthClientRegistrationErrorResponse,
    OAuthClientRegistrationFormatOptions,
    OAuthClientRegistrationParseOptions,
    OAuthClientRegistrationRequest,
    OAuthClientRegistrationResponse,
    OAuthClientRegistrationValidationOptions,
} from './types.js';

export type {
    OAuthClientMetadata,
    OAuthClientRegistrationErrorResponse,
    OAuthClientRegistrationFormatOptions,
    OAuthClientRegistrationParseOptions,
    OAuthClientRegistrationRequest,
    OAuthClientRegistrationResponse,
    OAuthClientRegistrationValidationOptions,
} from './types.js';

const DEFAULT_GRANT_TYPES = ['authorization_code'];
const DEFAULT_RESPONSE_TYPES = ['code'];

const CLIENT_METADATA_STRING_FIELDS = [
    'token_endpoint_auth_method',
    'client_name',
    'client_uri',
    'logo_uri',
    'scope',
    'tos_uri',
    'policy_uri',
    'jwks_uri',
    'software_id',
    'software_version',
] as const;

const CLIENT_METADATA_ARRAY_FIELDS = [
    'redirect_uris',
    'grant_types',
    'response_types',
    'contacts',
] as const;

const CLIENT_METADATA_OBJECT_FIELDS = ['jwks'] as const;

const CLIENT_METADATA_URL_FIELDS = new Set([
    'client_uri',
    'logo_uri',
    'tos_uri',
    'policy_uri',
    'jwks_uri',
]);

const LOCALIZED_METADATA_FIELDS = new Set([
    'client_name',
    'client_uri',
    'logo_uri',
    'tos_uri',
    'policy_uri',
]);

const JWT_REGISTERED_CLAIMS = new Set(['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']);

/**
 * Parse an OAuth client registration request JSON document.
 * Returns null on malformed JSON or invalid metadata structure.
 */
export function parseOAuthClientRegistrationRequest(
    json: string,
    options: OAuthClientRegistrationParseOptions = {},
): OAuthClientRegistrationRequest | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseOAuthClientRegistrationRequestObject(parsed, options);
}

/**
 * Parse a decoded OAuth client registration request object.
 * Returns null for invalid shapes or semantic violations.
 */
export function parseOAuthClientRegistrationRequestObject(
    value: unknown,
    options: OAuthClientRegistrationParseOptions = {},
): OAuthClientRegistrationRequest | null {
    if (!isRecord(value)) {
        return null;
    }

    if (!hasValidRequestMemberShapes(value)) {
        return null;
    }

    if (!isJsonValue(value)) {
        return null;
    }

    const parsed = cloneJsonObject(value as JsonObject) as OAuthClientRegistrationRequest;

    try {
        validateOAuthClientRegistrationRequest(parsed, options);
    } catch {
        return null;
    }

    return parsed;
}

/**
 * Validate OAuth client registration request metadata.
 * Throws Error when semantic requirements are violated.
 */
export function validateOAuthClientRegistrationRequest(
    request: OAuthClientRegistrationRequest,
    options: OAuthClientRegistrationValidationOptions = {},
): void {
    validateClientMetadata(request, options);

    if (request.software_statement !== undefined) {
        validateNonEmptyString('software_statement', request.software_statement);
    }
}

/**
 * Serialize OAuth client registration request metadata as JSON.
 * Throws Error when semantic validation fails.
 */
export function formatOAuthClientRegistrationRequest(
    request: OAuthClientRegistrationRequest,
    options: OAuthClientRegistrationFormatOptions = {},
): string {
    validateOAuthClientRegistrationRequest(request, options);

    const output: Record<string, unknown> = {};

    for (const field of CLIENT_METADATA_STRING_FIELDS) {
        const value = request[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    for (const field of CLIENT_METADATA_ARRAY_FIELDS) {
        const value = request[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    for (const field of CLIENT_METADATA_OBJECT_FIELDS) {
        const value = request[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    if (request.software_statement !== undefined) {
        output.software_statement = cloneJsonValue(request.software_statement as JsonValue);
    }

    const knownFieldSet = new Set<string>([
        ...CLIENT_METADATA_STRING_FIELDS,
        ...CLIENT_METADATA_ARRAY_FIELDS,
        ...CLIENT_METADATA_OBJECT_FIELDS,
        'software_statement',
    ]);

    const extensionKeys = Object.keys(request)
        .filter((key) => !knownFieldSet.has(key))
        .sort();
    for (const key of extensionKeys) {
        const extensionValue = request[key];
        if (extensionValue !== undefined) {
            output[key] = cloneJsonValue(extensionValue as JsonValue);
        }
    }

    return JSON.stringify(output, null, 2);
}

/**
 * Parse an OAuth client registration response JSON document.
 * Returns null on malformed JSON or invalid metadata structure.
 */
export function parseOAuthClientRegistrationResponse(
    json: string,
    options: OAuthClientRegistrationParseOptions = {},
): OAuthClientRegistrationResponse | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseOAuthClientRegistrationResponseObject(parsed, options);
}

/**
 * Parse a decoded OAuth client registration response object.
 * Returns null for invalid shapes or semantic violations.
 */
export function parseOAuthClientRegistrationResponseObject(
    value: unknown,
    options: OAuthClientRegistrationParseOptions = {},
): OAuthClientRegistrationResponse | null {
    if (!isRecord(value)) {
        return null;
    }

    if (!hasValidResponseMemberShapes(value)) {
        return null;
    }

    if (!isJsonValue(value)) {
        return null;
    }

    const parsed = cloneJsonObject(value as JsonObject) as OAuthClientRegistrationResponse;

    try {
        validateOAuthClientRegistrationResponse(parsed, options);
    } catch {
        return null;
    }

    return parsed;
}

/**
 * Validate OAuth client registration response metadata.
 * Throws Error when semantic requirements are violated.
 */
export function validateOAuthClientRegistrationResponse(
    response: OAuthClientRegistrationResponse,
    options: OAuthClientRegistrationValidationOptions = {},
): void {
    validateClientMetadata(response, options);

    validateNonEmptyString('client_id', response.client_id);

    if (response.client_secret !== undefined) {
        validateNonEmptyString('client_secret', response.client_secret);
        if (response.client_secret_expires_at === undefined) {
            throw new Error('Metadata field "client_secret_expires_at" is required when "client_secret" is issued');
        }
    }

    if (response.client_id_issued_at !== undefined) {
        validateEpochSeconds('client_id_issued_at', response.client_id_issued_at);
    }

    if (response.client_secret_expires_at !== undefined) {
        validateEpochSeconds('client_secret_expires_at', response.client_secret_expires_at);
    }

    if (response.software_statement !== undefined) {
        validateNonEmptyString('software_statement', response.software_statement);
    }
}

/**
 * Serialize OAuth client registration response metadata as JSON.
 * Throws Error when semantic validation fails.
 */
export function formatOAuthClientRegistrationResponse(
    response: OAuthClientRegistrationResponse,
    options: OAuthClientRegistrationFormatOptions = {},
): string {
    validateOAuthClientRegistrationResponse(response, options);

    const output: Record<string, unknown> = {};

    output.client_id = cloneJsonValue(response.client_id as JsonValue);

    if (response.client_secret !== undefined) {
        output.client_secret = cloneJsonValue(response.client_secret as JsonValue);
    }

    if (response.client_id_issued_at !== undefined) {
        output.client_id_issued_at = cloneJsonValue(response.client_id_issued_at as JsonValue);
    }

    if (response.client_secret_expires_at !== undefined) {
        output.client_secret_expires_at = cloneJsonValue(response.client_secret_expires_at as JsonValue);
    }

    if (response.software_statement !== undefined) {
        output.software_statement = cloneJsonValue(response.software_statement as JsonValue);
    }

    for (const field of CLIENT_METADATA_STRING_FIELDS) {
        const value = response[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    for (const field of CLIENT_METADATA_ARRAY_FIELDS) {
        const value = response[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    for (const field of CLIENT_METADATA_OBJECT_FIELDS) {
        const value = response[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    const knownFieldSet = new Set<string>([
        ...CLIENT_METADATA_STRING_FIELDS,
        ...CLIENT_METADATA_ARRAY_FIELDS,
        ...CLIENT_METADATA_OBJECT_FIELDS,
        'client_id',
        'client_secret',
        'client_id_issued_at',
        'client_secret_expires_at',
        'software_statement',
    ]);

    const extensionKeys = Object.keys(response)
        .filter((key) => !knownFieldSet.has(key))
        .sort();
    for (const key of extensionKeys) {
        const extensionValue = response[key];
        if (extensionValue !== undefined) {
            output[key] = cloneJsonValue(extensionValue as JsonValue);
        }
    }

    return JSON.stringify(output, null, 2);
}

/**
 * Parse an OAuth client registration error response JSON document.
 * Returns null on malformed JSON or invalid error structure.
 */
export function parseOAuthClientRegistrationErrorResponse(
    json: string,
): OAuthClientRegistrationErrorResponse | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseOAuthClientRegistrationErrorResponseObject(parsed);
}

/**
 * Parse a decoded OAuth client registration error response object.
 * Returns null for invalid shapes or semantic violations.
 */
export function parseOAuthClientRegistrationErrorResponseObject(
    value: unknown,
): OAuthClientRegistrationErrorResponse | null {
    if (!isRecord(value)) {
        return null;
    }

    if (!hasValidErrorMemberShapes(value)) {
        return null;
    }

    if (!isJsonValue(value)) {
        return null;
    }

    const parsed = cloneJsonObject(value as JsonObject) as OAuthClientRegistrationErrorResponse;

    try {
        validateOAuthClientRegistrationErrorResponse(parsed);
    } catch {
        return null;
    }

    return parsed;
}

/**
 * Validate OAuth client registration error response.
 * Throws Error when semantic requirements are violated.
 */
export function validateOAuthClientRegistrationErrorResponse(
    response: OAuthClientRegistrationErrorResponse,
): void {
    if (!isRecord(response)) {
        throw new Error('Client registration error response must be a JSON object');
    }

    if (!isJsonValue(response)) {
        throw new Error('Client registration error response must contain only valid JSON values');
    }

    if (typeof response.error !== 'string' || response.error.length === 0) {
        throw new Error('Client registration error response "error" must be a non-empty string');
    }

    if (!isAsciiToken(response.error)) {
        throw new Error('Client registration error response "error" must be an ASCII error code');
    }

    if (response.error_description !== undefined) {
        if (typeof response.error_description !== 'string') {
            throw new Error('Client registration error response "error_description" must be a string');
        }

        if (!isAsciiText(response.error_description)) {
            throw new Error('Client registration error response "error_description" must be ASCII text');
        }
    }
}

/**
 * Serialize OAuth client registration error response as JSON.
 * Throws Error when semantic validation fails.
 */
export function formatOAuthClientRegistrationErrorResponse(
    response: OAuthClientRegistrationErrorResponse,
): string {
    validateOAuthClientRegistrationErrorResponse(response);

    const output: Record<string, unknown> = {
        error: cloneJsonValue(response.error as JsonValue),
    };

    if (response.error_description !== undefined) {
        output.error_description = cloneJsonValue(response.error_description as JsonValue);
    }

    const knownFieldSet = new Set<string>(['error', 'error_description']);
    const extensionKeys = Object.keys(response)
        .filter((key) => !knownFieldSet.has(key))
        .sort();
    for (const key of extensionKeys) {
        const extensionValue = response[key];
        if (extensionValue !== undefined) {
            output[key] = cloneJsonValue(extensionValue as JsonValue);
        }
    }

    return JSON.stringify(output, null, 2);
}

/**
 * Merge software statement claims into client metadata, preferring statement values.
 * This helper is structural only and does not verify JWT signatures.
 */
export function mergeSoftwareStatementClientMetadata(
    metadata: OAuthClientMetadata,
    softwareStatementClaims: unknown,
    options: OAuthClientRegistrationValidationOptions = {},
): OAuthClientMetadata {
    if (!isRecord(metadata) || !isJsonValue(metadata)) {
        throw new Error('Client metadata must be a JSON object with valid JSON values');
    }

    const merged = cloneJsonObject(metadata as JsonObject) as OAuthClientMetadata;

    if (isRecord(softwareStatementClaims)) {
        for (const [claimName, claimValue] of Object.entries(softwareStatementClaims)) {
            if (claimName === 'software_statement' || JWT_REGISTERED_CLAIMS.has(claimName)) {
                continue;
            }

            if (!isJsonValue(claimValue)) {
                throw new Error(`Software statement claim "${claimName}" must be a valid JSON value`);
            }

            merged[claimName] = cloneJsonValue(claimValue);
        }
    } else if (softwareStatementClaims !== null && softwareStatementClaims !== undefined) {
        throw new Error('Software statement claims must be a JSON object when provided');
    }

    validateClientMetadata(merged, options);
    return merged;
}

function validateClientMetadata(
    metadata: OAuthClientMetadata,
    options: OAuthClientRegistrationValidationOptions,
): void {
    if (!isRecord(metadata)) {
        throw new Error('Client metadata must be a JSON object');
    }

    if (!isJsonValue(metadata)) {
        throw new Error('Client metadata must contain only valid JSON values');
    }

    if (metadata.jwks_uri !== undefined && metadata.jwks !== undefined) {
        throw new Error('Client metadata must not include both "jwks_uri" and "jwks"');
    }

    for (const field of CLIENT_METADATA_STRING_FIELDS) {
        const value = metadata[field];
        if (value !== undefined) {
            validateNonEmptyString(field, value);
            if (CLIENT_METADATA_URL_FIELDS.has(field)) {
                validateAbsoluteUrl(field, value);
            }
        }
    }

    const redirectUris = metadata.redirect_uris;
    if (redirectUris !== undefined) {
        validateStringArray('redirect_uris', redirectUris);
        for (const [index, redirectUri] of redirectUris.entries()) {
            validateAbsoluteUrl(`redirect_uris[${index}]`, redirectUri);
        }
    }

    const grantTypes = metadata.grant_types;
    if (grantTypes !== undefined) {
        validateStringArray('grant_types', grantTypes);
    }

    const responseTypes = metadata.response_types;
    if (responseTypes !== undefined) {
        validateStringArray('response_types', responseTypes);
    }

    const contacts = metadata.contacts;
    if (contacts !== undefined) {
        validateStringArray('contacts', contacts);
    }

    const jwks = metadata.jwks;
    if (jwks !== undefined) {
        validateJwks(jwks);
    }

    validateLocalizedMetadata(metadata);

    if (options.enforceGrantTypeResponseTypeConsistency ?? true) {
        validateGrantResponseConsistency(grantTypes, responseTypes);
    }
}

function validateGrantResponseConsistency(
    grantTypes: string[] | undefined,
    responseTypes: string[] | undefined,
): void {
    const effectiveGrantTypes = grantTypes ?? DEFAULT_GRANT_TYPES;
    const effectiveResponseTypes = responseTypes ?? DEFAULT_RESPONSE_TYPES;

    const grantTypeSet = new Set(effectiveGrantTypes);
    const responseTypeSet = new Set(effectiveResponseTypes);

    if (grantTypeSet.has('authorization_code') && !responseTypeSet.has('code')) {
        throw new Error('Response types must include "code" when grant types include "authorization_code"');
    }

    if (grantTypeSet.has('implicit') && !responseTypeSet.has('token')) {
        throw new Error('Response types must include "token" when grant types include "implicit"');
    }

    if (responseTypeSet.has('code') && !grantTypeSet.has('authorization_code')) {
        throw new Error('Grant types must include "authorization_code" when response types include "code"');
    }

    if (responseTypeSet.has('token') && !grantTypeSet.has('implicit')) {
        throw new Error('Grant types must include "implicit" when response types include "token"');
    }
}

function validateLocalizedMetadata(metadata: OAuthClientMetadata): void {
    for (const [key, value] of Object.entries(metadata)) {
        const hashIndex = key.indexOf('#');
        if (hashIndex <= 0) {
            continue;
        }

        const baseField = key.slice(0, hashIndex);
        if (!LOCALIZED_METADATA_FIELDS.has(baseField)) {
            continue;
        }

        if (hashIndex === key.length - 1) {
            throw new Error(`Localized metadata field "${key}" must include a language tag after "#"`);
        }

        validateNonEmptyString(key, value);
        if (CLIENT_METADATA_URL_FIELDS.has(baseField)) {
            validateAbsoluteUrl(key, value);
        }
    }
}

function validateNonEmptyString(fieldName: string, value: unknown): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Metadata field "${fieldName}" must be a non-empty string`);
    }
}

function validateStringArray(
    fieldName: string,
    value: unknown,
): void {
    if (!Array.isArray(value)) {
        throw new Error(`Metadata field "${fieldName}" must be an array of strings`);
    }

    if (value.length === 0) {
        throw new Error(`Metadata field "${fieldName}" must be omitted when empty`);
    }

    for (let index = 0; index < value.length; index++) {
        const entry = value[index];
        if (typeof entry !== 'string' || entry.length === 0) {
            throw new Error(
                `Metadata field "${fieldName}" must contain non-empty strings (invalid entry at index ${index})`,
            );
        }
    }
}

function validateAbsoluteUrl(fieldName: string, value: unknown): void {
    if (typeof value !== 'string') {
        throw new Error(`Metadata field "${fieldName}" must be a URL string`);
    }

    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error(`Metadata field "${fieldName}" must be an absolute URL string; received ${String(value)}`);
    }

    if (!parsed.protocol) {
        throw new Error(`Metadata field "${fieldName}" must include a URL scheme; received ${String(value)}`);
    }
}

function validateJwks(value: unknown): void {
    if (!isRecord(value)) {
        throw new Error('Metadata field "jwks" must be a JSON object');
    }

    if (!isJsonValue(value)) {
        throw new Error('Metadata field "jwks" must contain only valid JSON values');
    }

    const keys = (value as Record<string, unknown>).keys;
    if (!Array.isArray(keys)) {
        throw new Error('Metadata field "jwks" must contain a "keys" array');
    }

    for (const entry of keys) {
        if (!isRecord(entry)) {
            throw new Error('Metadata field "jwks" must contain a "keys" array of objects');
        }
    }
}

function validateEpochSeconds(fieldName: string, value: unknown): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new Error(`Metadata field "${fieldName}" must be a non-negative integer (seconds since epoch)`);
    }
}

function isAsciiToken(value: string): boolean {
    return /^[\x21-\x7E]+$/.test(value);
}

function isAsciiText(value: string): boolean {
    return /^[\x20-\x7E]*$/.test(value);
}

function hasValidRequestMemberShapes(value: Record<string, unknown>): boolean {
    return hasValidClientMetadataShapes(value)
        && isOptionalString(value.software_statement);
}

function hasValidResponseMemberShapes(value: Record<string, unknown>): boolean {
    return hasValidClientMetadataShapes(value)
        && isOptionalString(value.client_id)
        && isOptionalString(value.client_secret)
        && isOptionalNumber(value.client_id_issued_at)
        && isOptionalNumber(value.client_secret_expires_at)
        && isOptionalString(value.software_statement);
}

function hasValidErrorMemberShapes(value: Record<string, unknown>): boolean {
    if (typeof value.error !== 'string') {
        return false;
    }

    return isOptionalString(value.error_description);
}

function hasValidClientMetadataShapes(value: Record<string, unknown>): boolean {
    for (const field of CLIENT_METADATA_STRING_FIELDS) {
        if (!isOptionalString(value[field])) {
            return false;
        }
    }

    for (const field of CLIENT_METADATA_ARRAY_FIELDS) {
        const entry = value[field];
        if (entry === undefined) {
            continue;
        }

        if (!Array.isArray(entry)) {
            return false;
        }

        if (entry.some((item) => typeof item !== 'string')) {
            return false;
        }
    }

    const jwks = value.jwks;
    if (jwks !== undefined && !isRecord(jwks)) {
        return false;
    }

    for (const [key, entry] of Object.entries(value)) {
        const hashIndex = key.indexOf('#');
        if (hashIndex <= 0) {
            continue;
        }

        const baseField = key.slice(0, hashIndex);
        if (!LOCALIZED_METADATA_FIELDS.has(baseField)) {
            continue;
        }

        if (typeof entry !== 'string') {
            return false;
        }
    }

    return true;
}

function isOptionalString(value: unknown): boolean {
    return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
    return value === undefined || typeof value === 'number';
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
    [key: string]: JsonValue;
}

function isJsonValue(value: unknown): value is JsonValue {
    return isJsonValueInternal(value, new WeakSet<object>());
}

function isJsonValueInternal(value: unknown, visiting: WeakSet<object>): value is JsonValue {
    if (value === null) {
        return true;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
        return true;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
        if (visiting.has(value)) {
            return false;
        }

        visiting.add(value);
        for (const item of value) {
            if (!isJsonValueInternal(item, visiting)) {
                visiting.delete(value);
                return false;
            }
        }

        visiting.delete(value);
        return true;
    }

    if (!isRecord(value)) {
        return false;
    }

    if (visiting.has(value)) {
        return false;
    }

    visiting.add(value);
    for (const member of Object.values(value)) {
        if (!isJsonValueInternal(member, visiting)) {
            visiting.delete(value);
            return false;
        }
    }

    visiting.delete(value);
    return true;
}

function cloneJsonValue(value: JsonValue): JsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => cloneJsonValue(entry));
    }

    return cloneJsonObject(value);
}

function cloneJsonObject(value: JsonObject): JsonObject {
    const clone: JsonObject = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
    for (const [key, entry] of Object.entries(value)) {
        clone[key] = cloneJsonValue(entry);
    }
    return clone;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
