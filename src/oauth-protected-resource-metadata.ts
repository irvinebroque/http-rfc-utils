/**
 * OAuth 2.0 Protected Resource Metadata helpers per RFC 9728.
 * RFC 9728 Sections 2, 2.1, 2.2, 3, 3.1, 3.2, 3.3, 4, and 5.1.
 * @see https://www.rfc-editor.org/rfc/rfc9728.html
 */

import type {
    ProtectedResourceMetadata,
    ProtectedResourceMetadataFormatOptions,
    ProtectedResourceMetadataParseOptions,
    ProtectedResourceMetadataValidationOptions,
} from './types.js';
import { validateWellKnownSuffix } from './well-known.js';

export type {
    ProtectedResourceMetadata,
    ProtectedResourceMetadataParseOptions,
    ProtectedResourceMetadataValidationOptions,
    ProtectedResourceMetadataFormatOptions,
} from './types.js';

/**
 * RFC 9728 Section 3: default registered suffix.
 */
export const OAUTH_PROTECTED_RESOURCE_WELL_KNOWN_SUFFIX = 'oauth-protected-resource';

const KNOWN_STRING_FIELDS = [
    'resource',
    'jwks_uri',
    'resource_name',
    'resource_documentation',
    'resource_policy_uri',
    'resource_tos_uri',
    'signed_metadata',
] as const;

const KNOWN_ARRAY_FIELDS = [
    'authorization_servers',
    'scopes_supported',
    'bearer_methods_supported',
    'resource_signing_alg_values_supported',
    'authorization_details_types_supported',
    'dpop_signing_alg_values_supported',
] as const;

const KNOWN_BOOLEAN_FIELDS = [
    'tls_client_certificate_bound_access_tokens',
    'dpop_bound_access_tokens_required',
] as const;

const URL_FIELDS = [
    'resource_documentation',
    'resource_policy_uri',
    'resource_tos_uri',
] as const;

const LANGUAGE_TAGGABLE_FIELDS = [
    'resource_name',
    'resource_documentation',
    'resource_policy_uri',
    'resource_tos_uri',
] as const;

const BEARER_METHODS = new Set(['header', 'body', 'query']);
const JWT_REGISTERED_CLAIMS = new Set(['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']);

/**
 * Parse protected resource metadata JSON with tolerant behavior.
 * Returns null on malformed JSON or invalid metadata structure.
 */
export function parseProtectedResourceMetadata(
    json: string,
    options: ProtectedResourceMetadataParseOptions = {},
): ProtectedResourceMetadata | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseProtectedResourceMetadataObject(parsed, options);
}

/**
 * Parse an already-decoded metadata object with tolerant behavior.
 * Returns null for invalid object shapes or semantic violations.
 */
export function parseProtectedResourceMetadataObject(
    value: unknown,
    options: ProtectedResourceMetadataParseOptions = {},
): ProtectedResourceMetadata | null {
    if (!isRecord(value)) {
        return null;
    }

    if (!hasValidKnownMemberShapes(value)) {
        return null;
    }

    if (!isJsonValue(value)) {
        return null;
    }

    const parsed = cloneJsonObject(value as JsonObject) as ProtectedResourceMetadata;

    try {
        validateProtectedResourceMetadata(parsed, options);
    } catch {
        return null;
    }

    return parsed;
}

/**
 * Validate semantic requirements for protected resource metadata.
 * Throws Error when metadata violates RFC requirements.
 */
export function validateProtectedResourceMetadata(
    metadata: ProtectedResourceMetadata,
    options: ProtectedResourceMetadataValidationOptions = {},
): void {
    if (!isRecord(metadata)) {
        throw new Error('Protected resource metadata must be a JSON object');
    }

    if (!isJsonValue(metadata)) {
        throw new Error('Protected resource metadata must contain only valid JSON values');
    }

    validateResourceIdentifier(metadata.resource, options.expectedResource);

    if (metadata.authorization_servers !== undefined) {
        validateIssuerArray(metadata.authorization_servers);
    }

    if (metadata.jwks_uri !== undefined) {
        validateHttpsUrl('jwks_uri', metadata.jwks_uri);
    }

    for (const field of URL_FIELDS) {
        const fieldValue = metadata[field];
        if (fieldValue !== undefined) {
            validateAbsoluteUrl(field, fieldValue);
        }
    }

    validateStringArrayClaim(metadata.scopes_supported, 'scopes_supported');
    validateStringArrayClaim(metadata.authorization_details_types_supported, 'authorization_details_types_supported');
    validateStringArrayClaim(metadata.dpop_signing_alg_values_supported, 'dpop_signing_alg_values_supported');
    validateStringArrayClaim(metadata.resource_signing_alg_values_supported, 'resource_signing_alg_values_supported');

    if (metadata.resource_signing_alg_values_supported?.includes('none')) {
        throw new Error('Metadata field "resource_signing_alg_values_supported" must not include "none"');
    }

    validateBearerMethods(metadata.bearer_methods_supported);

    if (metadata.tls_client_certificate_bound_access_tokens !== undefined
        && typeof metadata.tls_client_certificate_bound_access_tokens !== 'boolean') {
        throw new Error('Metadata field "tls_client_certificate_bound_access_tokens" must be a boolean');
    }

    if (metadata.dpop_bound_access_tokens_required !== undefined
        && typeof metadata.dpop_bound_access_tokens_required !== 'boolean') {
        throw new Error('Metadata field "dpop_bound_access_tokens_required" must be a boolean');
    }

    if (metadata.signed_metadata !== undefined && typeof metadata.signed_metadata !== 'string') {
        throw new Error('Metadata field "signed_metadata" must be a string JWT value when present');
    }

    validateHumanReadableFields(metadata);
}

/**
 * Serialize protected resource metadata as JSON.
 * Throws Error for semantic-invalid metadata values.
 */
export function formatProtectedResourceMetadata(
    metadata: ProtectedResourceMetadata,
    options: ProtectedResourceMetadataFormatOptions = {},
): string {
    validateProtectedResourceMetadata(metadata, options);

    const output: Record<string, unknown> = {};

    for (const field of KNOWN_STRING_FIELDS) {
        const value = metadata[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    for (const field of KNOWN_ARRAY_FIELDS) {
        const value = metadata[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    for (const field of KNOWN_BOOLEAN_FIELDS) {
        const value = metadata[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    const knownFieldSet = new Set<string>([
        ...KNOWN_STRING_FIELDS,
        ...KNOWN_ARRAY_FIELDS,
        ...KNOWN_BOOLEAN_FIELDS,
    ]);
    const extensionKeys = Object.keys(metadata)
        .filter((key) => !knownFieldSet.has(key))
        .sort();
    for (const key of extensionKeys) {
        const extensionValue = metadata[key];
        if (extensionValue !== undefined) {
            output[key] = cloneJsonValue(extensionValue as JsonValue);
        }
    }

    return JSON.stringify(output, null, 2);
}

/**
 * Build a metadata URL using RFC 9728 Section 3.1 insertion rules.
 */
export function buildProtectedResourceMetadataUrl(
    resourceIdentifier: string | URL,
    wellKnownSuffix: string = OAUTH_PROTECTED_RESOURCE_WELL_KNOWN_SUFFIX,
): string {
    const resourceUrl = parseResourceUrl(resourceIdentifier);

    if (!validateWellKnownSuffix(wellKnownSuffix)) {
        throw new Error(
            `Invalid well-known suffix "${wellKnownSuffix}": expected a single non-empty RFC 3986 segment`,
        );
    }

    const normalizedResourcePath = normalizeResourcePath(resourceUrl.pathname);
    const wellKnownPath = `/.well-known/${wellKnownSuffix}`;
    const metadataPath = normalizedResourcePath === ''
        ? wellKnownPath
        : `${wellKnownPath}${normalizedResourcePath}`;

    return `${resourceUrl.origin}${metadataPath}${resourceUrl.search}`;
}

/**
 * Merge plain and signed metadata claims, preferring signed claim values.
 * This helper is structural only and does not verify JOSE signatures.
 */
export function mergeSignedProtectedResourceMetadata(
    metadata: ProtectedResourceMetadata,
    signedMetadataClaims: unknown,
    options: ProtectedResourceMetadataValidationOptions = {},
): ProtectedResourceMetadata {
    if (!isRecord(metadata) || !isJsonValue(metadata)) {
        throw new Error('Protected resource metadata must be a JSON object with valid JSON values');
    }

    const merged = cloneJsonObject(metadata as JsonObject) as ProtectedResourceMetadata;

    if (isRecord(signedMetadataClaims)) {
        for (const [claimName, claimValue] of Object.entries(signedMetadataClaims)) {
            if (claimName === 'signed_metadata' || JWT_REGISTERED_CLAIMS.has(claimName)) {
                continue;
            }

            if (!isJsonValue(claimValue)) {
                throw new Error(`Signed metadata claim "${claimName}" must be a valid JSON value`);
            }

            merged[claimName] = cloneJsonValue(claimValue);
        }
    } else if (signedMetadataClaims !== null && signedMetadataClaims !== undefined) {
        throw new Error('Signed metadata claims must be a JSON object when provided');
    }

    validateProtectedResourceMetadata(merged, options);
    return merged;
}

function hasValidKnownMemberShapes(value: Record<string, unknown>): boolean {
    for (const field of KNOWN_STRING_FIELDS) {
        const fieldValue = value[field];
        if (fieldValue !== undefined && typeof fieldValue !== 'string') {
            return false;
        }
    }

    for (const field of KNOWN_ARRAY_FIELDS) {
        const fieldValue = value[field];
        if (fieldValue === undefined) {
            continue;
        }

        if (!Array.isArray(fieldValue)) {
            return false;
        }

        if (fieldValue.some((item) => typeof item !== 'string')) {
            return false;
        }
    }

    for (const field of KNOWN_BOOLEAN_FIELDS) {
        const fieldValue = value[field];
        if (fieldValue !== undefined && typeof fieldValue !== 'boolean') {
            return false;
        }
    }

    return true;
}

function validateStringArrayClaim(value: unknown, fieldName: string): void {
    if (value === undefined) {
        return;
    }

    if (!Array.isArray(value)) {
        throw new Error(`Metadata field "${fieldName}" must be an array of strings`);
    }

    if (value.length === 0) {
        throw new Error(`Metadata field "${fieldName}" must be omitted when empty`);
    }

    for (let index = 0; index < value.length; index++) {
        const item = value[index];
        if (typeof item !== 'string' || item.length === 0) {
            throw new Error(
                `Metadata field "${fieldName}" must contain non-empty strings (invalid entry at index ${index})`,
            );
        }
    }
}

function validateBearerMethods(value: unknown): void {
    if (value === undefined) {
        return;
    }

    if (!Array.isArray(value)) {
        throw new Error('Metadata field "bearer_methods_supported" must be an array of strings');
    }

    for (let index = 0; index < value.length; index++) {
        const item = value[index];
        if (typeof item !== 'string' || item.length === 0) {
            throw new Error(
                `Metadata field "bearer_methods_supported" must contain non-empty strings (invalid entry at index ${index})`,
            );
        }

        if (!BEARER_METHODS.has(item)) {
            throw new Error(`Metadata field "bearer_methods_supported" includes invalid value "${item}"`);
        }
    }
}

function validateHumanReadableFields(metadata: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(metadata)) {
        const baseName = getLanguageTaggedBaseName(key);
        if (!baseName) {
            continue;
        }

        if (typeof value !== 'string') {
            throw new Error(`Metadata field "${key}" must be a string`);
        }

        if (baseName === 'resource_documentation'
            || baseName === 'resource_policy_uri'
            || baseName === 'resource_tos_uri') {
            validateAbsoluteUrl(key, value);
        }
    }
}

function getLanguageTaggedBaseName(fieldName: string): string | null {
    const hashIndex = fieldName.indexOf('#');
    if (hashIndex === -1) {
        return null;
    }

    const baseName = fieldName.slice(0, hashIndex);
    if ((LANGUAGE_TAGGABLE_FIELDS as readonly string[]).includes(baseName)) {
        return baseName;
    }

    return null;
}

function validateResourceIdentifier(value: unknown, expectedResource: string | undefined): void {
    if (typeof value !== 'string') {
        throw new Error('Metadata field "resource" is required and must be a string');
    }

    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error('Metadata field "resource" must be an absolute https URL');
    }

    if (parsed.protocol !== 'https:') {
        throw new Error('Metadata field "resource" must use the https scheme');
    }

    if (parsed.hash !== '') {
        throw new Error('Metadata field "resource" must not include a fragment component');
    }

    if (expectedResource !== undefined && value !== expectedResource) {
        throw new Error(
            `Metadata field "resource" must exactly match expected resource "${expectedResource}"; received "${value}"`,
        );
    }
}

function validateIssuerArray(value: unknown): void {
    if (!Array.isArray(value)) {
        throw new Error('Metadata field "authorization_servers" must be an array of strings');
    }

    if (value.length === 0) {
        throw new Error('Metadata field "authorization_servers" must be omitted when empty');
    }

    for (let index = 0; index < value.length; index++) {
        const item = value[index];
        if (typeof item !== 'string' || item.length === 0) {
            throw new Error(
                `Metadata field "authorization_servers" must contain non-empty strings (invalid entry at index ${index})`,
            );
        }

        validateIssuerIdentifier(item, index);
    }
}

function validateIssuerIdentifier(value: string, index: number): void {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error(
            `Metadata field "authorization_servers" must contain absolute URLs (invalid entry at index ${index})`,
        );
    }

    if (parsed.protocol !== 'https:') {
        throw new Error(
            `Metadata field "authorization_servers" must use https URLs (invalid entry at index ${index})`,
        );
    }

    if (parsed.search !== '' || parsed.hash !== '') {
        throw new Error(
            `Metadata field "authorization_servers" must not include query or fragment components (invalid entry at index ${index})`,
        );
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

function validateHttpsUrl(fieldName: string, value: unknown): void {
    validateAbsoluteUrl(fieldName, value);

    if (typeof value !== 'string') {
        return;
    }

    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return;
    }

    if (parsed.protocol !== 'https:') {
        throw new Error(`Metadata field "${fieldName}" must use the https scheme`);
    }
}

function parseResourceUrl(resourceIdentifier: string | URL): URL {
    const parsed = resourceIdentifier instanceof URL
        ? new URL(resourceIdentifier.toString())
        : new URL(resourceIdentifier);

    if (parsed.protocol !== 'https:') {
        throw new Error('Resource identifier must use the https scheme');
    }

    if (parsed.hash !== '') {
        throw new Error('Resource identifier must not include fragment components');
    }

    return parsed;
}

function normalizeResourcePath(pathname: string): string {
    if (pathname === '/') {
        return '';
    }

    return pathname;
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
