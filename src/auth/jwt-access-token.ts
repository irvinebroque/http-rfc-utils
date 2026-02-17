/**
 * JWT access token profile helpers per RFC 9068.
 * RFC 9068 Sections 2, 2.1, 2.2, 2.2.1, 2.2.3, and 4.
 * @see https://www.rfc-editor.org/rfc/rfc9068.html
 */

import type {
    JwtAccessToken,
    JwtAccessTokenClaims,
    JwtAccessTokenHeader,
    JwtAccessTokenParseOptions,
    JwtAccessTokenValidationOptions,
} from '../types.js';

export type {
    JwtAccessToken,
    JwtAccessTokenClaims,
    JwtAccessTokenHeader,
    JwtAccessTokenParseOptions,
    JwtAccessTokenValidationOptions,
} from '../types.js';

const JWT_ACCESS_TOKEN_TYP_VALUES = new Set(['at+jwt', 'application/at+jwt']);
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

const HEADER_FIELD_ORDER = ['typ', 'alg', 'kid'] as const;
const CLAIM_FIELD_ORDER = [
    'iss',
    'sub',
    'aud',
    'exp',
    'iat',
    'jti',
    'client_id',
    'auth_time',
    'acr',
    'amr',
    'scope',
    'groups',
    'roles',
    'entitlements',
] as const;

/**
 * Parse a compact JWT access token (JWS) into structured header/claims.
 * Returns null for malformed inputs or semantic violations.
 */
export function parseJwtAccessToken(
    token: string,
    options: JwtAccessTokenParseOptions = {},
): JwtAccessToken | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
        return null;
    }

    const [headerSegment, payloadSegment, signatureSegment] = parts;
    const requireSignature = options.requireSignature ?? true;
    if (requireSignature) {
        if (signatureSegment.length === 0) {
            return null;
        }
        if (!isBase64Url(signatureSegment) || signatureSegment.length % 4 === 1) {
            return null;
        }
    }

    const headerValue = parseBase64UrlJson(headerSegment);
    if (!isRecord(headerValue) || !isJsonValue(headerValue)) {
        return null;
    }

    const claimsValue = parseBase64UrlJson(payloadSegment);
    if (!isRecord(claimsValue) || !isJsonValue(claimsValue)) {
        return null;
    }

    const parsed: JwtAccessToken = {
        header: headerValue as JwtAccessTokenHeader,
        claims: claimsValue as JwtAccessTokenClaims,
        signature: signatureSegment,
    };

    try {
        validateJwtAccessToken(parsed, options);
    } catch {
        return null;
    }

    return parsed;
}

/**
 * Validate a parsed JWT access token and throw on semantic violations.
 */
export function validateJwtAccessToken(
    token: JwtAccessToken,
    options: JwtAccessTokenValidationOptions = {},
): void {
    if (!isRecord(token)) {
        throw new Error('JWT access token must be an object with header/claims/signature');
    }

    const requireSignature = options.requireSignature ?? true;
    if (requireSignature) {
        if (typeof token.signature !== 'string' || token.signature.length === 0) {
            throw new Error('JWT access token must include a signature segment');
        }
        if (!isBase64Url(token.signature) || token.signature.length % 4 === 1) {
            throw new Error('JWT access token signature must be a valid base64url segment');
        }
    }

    validateJwtAccessTokenHeader(token.header, options);
    validateJwtAccessTokenClaims(token.claims, options);
}

/**
 * Validate a JWT access token header (JOSE header).
 */
export function validateJwtAccessTokenHeader(
    header: JwtAccessTokenHeader,
    options: JwtAccessTokenValidationOptions = {},
): void {
    if (!isRecord(header) || !isJsonValue(header)) {
        throw new Error('JWT access token header must be a JSON object');
    }

    const requireTyp = options.requireTyp ?? true;
    if (header.typ === undefined) {
        if (requireTyp) {
            throw new Error('JWT access token header must include typ="at+jwt"');
        }
    } else if (typeof header.typ !== 'string' || !JWT_ACCESS_TOKEN_TYP_VALUES.has(header.typ)) {
        throw new Error('JWT access token header typ must be "at+jwt" or "application/at+jwt"');
    }

    if (typeof header.alg !== 'string' || header.alg.length === 0) {
        throw new Error('JWT access token header alg must be a non-empty string');
    }

    if (header.alg === 'none') {
        throw new Error('JWT access token header alg must not be "none"');
    }

    if (header.kid !== undefined && typeof header.kid !== 'string') {
        throw new Error('JWT access token header kid must be a string when present');
    }
}

/**
 * Validate JWT access token claims per RFC 9068 profile.
 */
export function validateJwtAccessTokenClaims(
    claims: JwtAccessTokenClaims,
    options: JwtAccessTokenValidationOptions = {},
): void {
    if (!isRecord(claims) || !isJsonValue(claims)) {
        throw new Error('JWT access token claims must be a JSON object');
    }

    validateRequiredStringClaim(claims.iss, 'iss');
    validateRequiredStringClaim(claims.sub, 'sub');
    validateRequiredStringClaim(claims.jti, 'jti');
    validateRequiredStringClaim(claims.client_id, 'client_id');

    const aud = validateAudienceClaim(claims.aud);
    const expectedIssuer = options.expectedIssuer;
    if (expectedIssuer !== undefined && claims.iss !== expectedIssuer) {
        throw new Error(
            `JWT access token claim "iss" must match expected issuer "${expectedIssuer}"; received "${claims.iss}"`,
        );
    }

    const expectedAudience = normalizeAudience(options.expectedAudience);
    if (expectedAudience && !aud.some((value) => expectedAudience.has(value))) {
        throw new Error('JWT access token claim "aud" must include an expected audience value');
    }

    const exp = validateNumericDateClaim(claims.exp, 'exp');
    validateNumericDateClaim(claims.iat, 'iat');
    if (claims.auth_time !== undefined) {
        validateNumericDateClaim(claims.auth_time, 'auth_time');
    }

    if (claims.acr !== undefined) {
        validateNonEmptyString(claims.acr, 'acr');
    }

    if (claims.amr !== undefined) {
        validateStringArrayClaim(claims.amr, 'amr');
    }

    if (claims.scope !== undefined) {
        validateNonEmptyString(claims.scope, 'scope');
    }

    if (claims.groups !== undefined) {
        validateStringArrayClaim(claims.groups, 'groups');
    }

    if (claims.roles !== undefined) {
        validateStringArrayClaim(claims.roles, 'roles');
    }

    if (claims.entitlements !== undefined) {
        validateStringArrayClaim(claims.entitlements, 'entitlements');
    }

    const nowSeconds = resolveNowSeconds(options.now);
    if (nowSeconds !== null) {
        const skew = resolveClockSkewSeconds(options.clockSkewSeconds);
        if (nowSeconds >= exp + skew) {
            throw new Error('JWT access token is expired');
        }
    }
}

/**
 * Format a JWT access token header JSON payload in deterministic order.
 */
export function formatJwtAccessTokenHeader(
    header: JwtAccessTokenHeader,
    options: JwtAccessTokenValidationOptions = {},
): string {
    validateJwtAccessTokenHeader(header, options);

    const output: JsonObject = createJsonObject(header);
    return JSON.stringify(output, null, 2);
}

/**
 * Format a JWT access token claims JSON payload in deterministic order.
 */
export function formatJwtAccessTokenClaims(
    claims: JwtAccessTokenClaims,
    options: JwtAccessTokenValidationOptions = {},
): string {
    validateJwtAccessTokenClaims(claims, options);

    const output: JsonObject = createJsonObject(claims, CLAIM_FIELD_ORDER);
    return JSON.stringify(output, null, 2);
}

function parseBase64UrlJson(segment: string): unknown | null {
    if (!isBase64Url(segment)) {
        return null;
    }

    if (segment.length % 4 === 1) {
        return null;
    }

    let decoded: Buffer;
    try {
        decoded = Buffer.from(segment, 'base64url');
    } catch {
        return null;
    }

    if (decoded.toString('base64url') !== segment) {
        return null;
    }

    try {
        return JSON.parse(decoded.toString('utf8'));
    } catch {
        return null;
    }
}

function isBase64Url(value: string): boolean {
    return value.length > 0
        && !value.includes('=')
        && !/\s/.test(value)
        && BASE64URL_RE.test(value);
}

function normalizeAudience(
    expected: string | readonly string[] | undefined,
): Set<string> | null {
    if (expected === undefined) {
        return null;
    }

    const values = Array.isArray(expected) ? expected : [expected];
    if (values.length === 0) {
        throw new Error('Expected audience list must include at least one value');
    }

    for (const value of values) {
        if (typeof value !== 'string' || value.length === 0) {
            throw new Error('Expected audience values must be non-empty strings');
        }
    }

    return new Set(values);
}

function resolveNowSeconds(now: number | Date | undefined): number | null {
    if (now === undefined) {
        return null;
    }

    if (typeof now === 'number') {
        if (!Number.isFinite(now)) {
            throw new Error('JWT access token validation now must be a finite number');
        }
        return now;
    }

    const nowTime = now.getTime();
    if (!Number.isFinite(nowTime)) {
        throw new Error('JWT access token validation now must be a valid Date');
    }

    return nowTime / 1000;
}

function resolveClockSkewSeconds(clockSkewSeconds: number | undefined): number {
    if (clockSkewSeconds === undefined) {
        return 0;
    }

    if (!Number.isFinite(clockSkewSeconds) || clockSkewSeconds < 0) {
        throw new Error('JWT access token clockSkewSeconds must be a non-negative finite number');
    }

    return clockSkewSeconds;
}

function validateRequiredStringClaim(value: unknown, name: string): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`JWT access token claim "${name}" is required and must be a non-empty string`);
    }
}

function validateNonEmptyString(value: unknown, name: string): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`JWT access token claim "${name}" must be a non-empty string`);
    }
}

function validateNumericDateClaim(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`JWT access token claim "${name}" must be a numeric date`);
    }
    return value;
}

function validateAudienceClaim(value: unknown): string[] {
    if (typeof value === 'string') {
        if (value.length === 0) {
            throw new Error('JWT access token claim "aud" must be a non-empty string');
        }
        return [value];
    }

    if (!Array.isArray(value)) {
        throw new Error('JWT access token claim "aud" must be a string or array of strings');
    }

    if (value.length === 0) {
        throw new Error('JWT access token claim "aud" must not be empty');
    }

    for (const entry of value) {
        if (typeof entry !== 'string' || entry.length === 0) {
            throw new Error('JWT access token claim "aud" must contain non-empty strings');
        }
    }

    return value;
}

function validateStringArrayClaim(value: unknown, name: string): void {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`JWT access token claim "${name}" must be a non-empty array of strings`);
    }

    for (const entry of value) {
        if (typeof entry !== 'string' || entry.length === 0) {
            throw new Error(`JWT access token claim "${name}" must contain non-empty strings`);
        }
    }
}

function createJsonObject<T extends Record<string, unknown>>(
    source: T,
    knownFields: readonly string[] = HEADER_FIELD_ORDER,
): JsonObject {
    const output: JsonObject = Object.getPrototypeOf(source) === null ? Object.create(null) : {};

    for (const field of knownFields) {
        if (Object.prototype.hasOwnProperty.call(source, field)) {
            const value = source[field];
            if (value !== undefined) {
                output[field] = cloneJsonValue(assertJsonValue(value, field));
            }
        }
    }

    const knownFieldSet = new Set(knownFields);
    const extensionKeys = Object.keys(source)
        .filter((key) => !knownFieldSet.has(key))
        .sort();

    for (const key of extensionKeys) {
        const value = source[key];
        if (value !== undefined) {
            output[key] = cloneJsonValue(assertJsonValue(value, key));
        }
    }

    return output;
}

function assertJsonValue(value: unknown, name: string): JsonValue {
    if (!isJsonValue(value)) {
        throw new Error(`JWT access token field "${name}" must be a valid JSON value`);
    }
    return value;
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
