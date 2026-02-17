/**
 * OAuth 2.0 Authorization Server Metadata helpers per RFC 8414.
 * RFC 8414 Sections 2, 2.1, 3, 3.1, 3.2, 3.3, and 4.
 * @see https://www.rfc-editor.org/rfc/rfc8414.html
 */

import type {
    AuthorizationServerMetadata,
    AuthorizationServerMetadataFormatOptions,
    AuthorizationServerMetadataParseOptions,
    AuthorizationServerMetadataValidationOptions,
} from './types.js';
import { validateWellKnownSuffix } from './well-known.js';

export type {
    AuthorizationServerMetadata,
    AuthorizationServerMetadataParseOptions,
    AuthorizationServerMetadataValidationOptions,
    AuthorizationServerMetadataFormatOptions,
} from './types.js';

/**
 * RFC 8414 Section 3 and Section 7.3.1: default registered suffix.
 */
export const OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX = 'oauth-authorization-server';

const DEFAULT_GRANT_TYPES = ['authorization_code', 'implicit'];
const IMPLICIT_GRANT_TYPE = 'implicit';
const AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';

const KNOWN_STRING_FIELDS = [
    'issuer',
    'authorization_endpoint',
    'token_endpoint',
    'jwks_uri',
    'registration_endpoint',
    'service_documentation',
    'op_policy_uri',
    'op_tos_uri',
    'revocation_endpoint',
    'introspection_endpoint',
    'signed_metadata',
] as const;

const KNOWN_ARRAY_FIELDS = [
    'scopes_supported',
    'response_types_supported',
    'response_modes_supported',
    'grant_types_supported',
    'token_endpoint_auth_methods_supported',
    'token_endpoint_auth_signing_alg_values_supported',
    'ui_locales_supported',
    'revocation_endpoint_auth_methods_supported',
    'revocation_endpoint_auth_signing_alg_values_supported',
    'introspection_endpoint_auth_methods_supported',
    'introspection_endpoint_auth_signing_alg_values_supported',
    'code_challenge_methods_supported',
    'protected_resources',
] as const;

const URL_FIELDS = [
    'authorization_endpoint',
    'token_endpoint',
    'jwks_uri',
    'registration_endpoint',
    'service_documentation',
    'op_policy_uri',
    'op_tos_uri',
    'revocation_endpoint',
    'introspection_endpoint',
] as const;

const AUTH_METHODS_REQUIRING_SIGNED_ALGS = new Set(['private_key_jwt', 'client_secret_jwt']);
const JWT_REGISTERED_CLAIMS = new Set(['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']);

/**
 * Parse authorization server metadata JSON with tolerant behavior.
 * Returns null on malformed JSON or invalid metadata structure.
 */
export function parseAuthorizationServerMetadata(
    json: string,
    options: AuthorizationServerMetadataParseOptions = {},
): AuthorizationServerMetadata | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseAuthorizationServerMetadataObject(parsed, options);
}

/**
 * Parse an already-decoded metadata object with tolerant behavior.
 * Returns null for invalid object shapes or semantic violations.
 */
export function parseAuthorizationServerMetadataObject(
    value: unknown,
    options: AuthorizationServerMetadataParseOptions = {},
): AuthorizationServerMetadata | null {
    if (!isRecord(value)) {
        return null;
    }

    if (!hasValidKnownMemberShapes(value)) {
        return null;
    }

    if (!isJsonValue(value)) {
        return null;
    }

    const parsed = cloneJsonObject(value as JsonObject) as AuthorizationServerMetadata;

    try {
        validateAuthorizationServerMetadata(parsed, options);
    } catch {
        return null;
    }

    return parsed;
}

/**
 * Validate semantic requirements for authorization server metadata.
 * Throws Error when metadata violates RFC requirements.
 */
export function validateAuthorizationServerMetadata(
    metadata: AuthorizationServerMetadata,
    options: AuthorizationServerMetadataValidationOptions = {},
): void {
    if (!isRecord(metadata)) {
        throw new Error('Authorization server metadata must be a JSON object');
    }

    if (!isJsonValue(metadata)) {
        throw new Error('Authorization server metadata must contain only valid JSON values');
    }

    validateIssuer(metadata.issuer, options.expectedIssuer);

    for (const field of URL_FIELDS) {
        const fieldValue = metadata[field];
        if (fieldValue !== undefined) {
            validateAbsoluteUrl(field, fieldValue);
        }
    }

    if (metadata.jwks_uri !== undefined) {
        validateHttpsUrl('jwks_uri', metadata.jwks_uri);
    }

    validateStringArrayClaim(metadata.response_types_supported, 'response_types_supported', true);
    validateStringArrayClaim(metadata.scopes_supported, 'scopes_supported');
    validateStringArrayClaim(metadata.response_modes_supported, 'response_modes_supported');
    validateStringArrayClaim(metadata.grant_types_supported, 'grant_types_supported');
    validateStringArrayClaim(metadata.token_endpoint_auth_methods_supported, 'token_endpoint_auth_methods_supported');
    validateStringArrayClaim(
        metadata.token_endpoint_auth_signing_alg_values_supported,
        'token_endpoint_auth_signing_alg_values_supported',
    );
    validateStringArrayClaim(metadata.ui_locales_supported, 'ui_locales_supported');
    validateStringArrayClaim(
        metadata.revocation_endpoint_auth_methods_supported,
        'revocation_endpoint_auth_methods_supported',
    );
    validateStringArrayClaim(
        metadata.revocation_endpoint_auth_signing_alg_values_supported,
        'revocation_endpoint_auth_signing_alg_values_supported',
    );
    validateStringArrayClaim(
        metadata.introspection_endpoint_auth_methods_supported,
        'introspection_endpoint_auth_methods_supported',
    );
    validateStringArrayClaim(
        metadata.introspection_endpoint_auth_signing_alg_values_supported,
        'introspection_endpoint_auth_signing_alg_values_supported',
    );
    validateStringArrayClaim(metadata.code_challenge_methods_supported, 'code_challenge_methods_supported');
    validateStringArrayClaim(metadata.protected_resources, 'protected_resources');

    if (metadata.signed_metadata !== undefined && typeof metadata.signed_metadata !== 'string') {
        throw new Error('Metadata field "signed_metadata" must be a string JWT value when present');
    }

    const effectiveGrantTypes = metadata.grant_types_supported ?? DEFAULT_GRANT_TYPES;

    if (requiresAuthorizationEndpoint(effectiveGrantTypes) && !metadata.authorization_endpoint) {
        throw new Error('Metadata field "authorization_endpoint" is required for supported grant types');
    }

    if (requiresTokenEndpoint(effectiveGrantTypes) && !metadata.token_endpoint) {
        throw new Error('Metadata field "token_endpoint" is required unless only implicit grant is supported');
    }

    validateSigningAlgorithmRequirements(
        metadata.token_endpoint_auth_methods_supported,
        metadata.token_endpoint_auth_signing_alg_values_supported,
        'token_endpoint_auth_methods_supported',
        'token_endpoint_auth_signing_alg_values_supported',
    );

    validateSigningAlgorithmRequirements(
        metadata.revocation_endpoint_auth_methods_supported,
        metadata.revocation_endpoint_auth_signing_alg_values_supported,
        'revocation_endpoint_auth_methods_supported',
        'revocation_endpoint_auth_signing_alg_values_supported',
    );

    validateSigningAlgorithmRequirements(
        metadata.introspection_endpoint_auth_methods_supported,
        metadata.introspection_endpoint_auth_signing_alg_values_supported,
        'introspection_endpoint_auth_methods_supported',
        'introspection_endpoint_auth_signing_alg_values_supported',
    );
}

/**
 * Serialize authorization server metadata as JSON.
 * Throws Error for semantic-invalid metadata values.
 */
export function formatAuthorizationServerMetadata(
    metadata: AuthorizationServerMetadata,
    options: AuthorizationServerMetadataFormatOptions = {},
): string {
    validateAuthorizationServerMetadata(metadata, options);

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

    const knownFieldSet = new Set<string>([...KNOWN_STRING_FIELDS, ...KNOWN_ARRAY_FIELDS]);
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
 * Build a metadata URL using RFC 8414 Section 3.1 insertion rules.
 */
export function buildAuthorizationServerMetadataUrl(
    issuer: string | URL,
    wellKnownSuffix: string = OAUTH_AUTHORIZATION_SERVER_WELL_KNOWN_SUFFIX,
): string {
    const issuerUrl = parseIssuerUrl(issuer);

    if (!validateWellKnownSuffix(wellKnownSuffix)) {
        throw new Error(
            `Invalid well-known suffix "${wellKnownSuffix}": expected a single non-empty RFC 3986 segment`,
        );
    }

    const normalizedIssuerPath = normalizeIssuerPath(issuerUrl.pathname);
    const wellKnownPath = `/.well-known/${wellKnownSuffix}`;
    const metadataPath = normalizedIssuerPath === ''
        ? wellKnownPath
        : `${wellKnownPath}${normalizedIssuerPath}`;

    return `${issuerUrl.origin}${metadataPath}`;
}

/**
 * Merge plain and signed metadata claims, preferring signed claim values.
 * This helper is structural only and does not verify JOSE signatures.
 */
export function mergeSignedAuthorizationServerMetadata(
    metadata: AuthorizationServerMetadata,
    signedMetadataClaims: unknown,
    options: AuthorizationServerMetadataValidationOptions = {},
): AuthorizationServerMetadata {
    if (!isRecord(metadata) || !isJsonValue(metadata)) {
        throw new Error('Authorization server metadata must be a JSON object with valid JSON values');
    }

    const merged = cloneJsonObject(metadata as JsonObject) as AuthorizationServerMetadata;

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

    validateAuthorizationServerMetadata(merged, options);
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

    return true;
}

function requiresAuthorizationEndpoint(grantTypesSupported: string[]): boolean {
    const grantTypeSet = new Set(grantTypesSupported);
    return grantTypeSet.has(AUTHORIZATION_CODE_GRANT_TYPE) || grantTypeSet.has(IMPLICIT_GRANT_TYPE);
}

function requiresTokenEndpoint(grantTypesSupported: string[]): boolean {
    const grantTypeSet = new Set(grantTypesSupported);
    return !(grantTypeSet.size === 1 && grantTypeSet.has(IMPLICIT_GRANT_TYPE));
}

function validateSigningAlgorithmRequirements(
    authMethods: string[] | undefined,
    algValues: string[] | undefined,
    authMethodsFieldName: string,
    algValuesFieldName: string,
): void {
    if (algValues?.includes('none')) {
        throw new Error(`Metadata field "${algValuesFieldName}" must not include "none"`);
    }

    if (!authMethods) {
        return;
    }

    const hasJwtMethod = authMethods.some((method) => AUTH_METHODS_REQUIRING_SIGNED_ALGS.has(method));
    if (hasJwtMethod && !algValues) {
        throw new Error(
            `Metadata field "${algValuesFieldName}" is required when "${authMethodsFieldName}" includes JWT auth methods`,
        );
    }
}

function validateStringArrayClaim(value: unknown, fieldName: string, required: boolean = false): void {
    if (value === undefined) {
        if (required) {
            throw new Error(`Metadata field "${fieldName}" is required`);
        }
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

function validateIssuer(issuer: unknown, expectedIssuer: string | undefined): void {
    if (typeof issuer !== 'string') {
        throw new Error('Metadata field "issuer" is required and must be a string');
    }

    const parsed = parseIssuerUrl(issuer);

    if (parsed.search !== '' || parsed.hash !== '') {
        throw new Error('Metadata field "issuer" must not include query or fragment components');
    }

    if (expectedIssuer !== undefined && issuer !== expectedIssuer) {
        throw new Error(
            `Metadata field "issuer" must exactly match expected issuer "${expectedIssuer}"; received "${issuer}"`,
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

function parseIssuerUrl(issuer: string | URL): URL {
    const parsed = issuer instanceof URL ? new URL(issuer.toString()) : new URL(issuer);

    if (parsed.protocol !== 'https:') {
        throw new Error('Issuer must use the https scheme');
    }

    if (parsed.search !== '' || parsed.hash !== '') {
        throw new Error('Issuer must not include query or fragment components');
    }

    return parsed;
}

function normalizeIssuerPath(pathname: string): string {
    if (pathname === '/') {
        return '';
    }

    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
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
