/**
 * OAuth 2.0 Token Introspection helpers per RFC 7662.
 * RFC 7662 §2.1-§2.2.
 * @see https://www.rfc-editor.org/rfc/rfc7662.html
 */

import type {
    TokenIntrospectionRequestInput,
    TokenIntrospectionRequestParams,
    TokenIntrospectionResponse,
} from '../types/auth.js';

type IntrospectionParamInput = string | URLSearchParams | Record<string, string | undefined>;

const REQUEST_REQUIRED_FIELD = 'token';
const REQUEST_OPTIONAL_FIELD = 'token_type_hint';
const REQUEST_RESERVED_FIELDS = new Set([REQUEST_REQUIRED_FIELD, REQUEST_OPTIONAL_FIELD]);

const KNOWN_RESPONSE_STRING_FIELDS = [
    'scope',
    'client_id',
    'username',
    'token_type',
    'sub',
    'iss',
    'jti',
] as const;

const KNOWN_RESPONSE_NUMBER_FIELDS = ['exp', 'iat', 'nbf'] as const;

const KNOWN_RESPONSE_FIELDS = new Set<string>([
    'active',
    ...KNOWN_RESPONSE_STRING_FIELDS,
    ...KNOWN_RESPONSE_NUMBER_FIELDS,
    'aud',
]);

function normalizeParams(input: IntrospectionParamInput): URLSearchParams {
    if (typeof input === 'string') {
        return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
    }
    if (input instanceof URLSearchParams) {
        return new URLSearchParams(input);
    }

    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(input)) {
        if (value !== undefined) {
            params.append(name, value);
        }
    }
    return params;
}

/**
 * Parse token introspection request parameters from form-encoded input.
 * RFC 7662 §2.1.
 */
export function parseTokenIntrospectionRequestParams(
    input: IntrospectionParamInput,
): TokenIntrospectionRequestParams | null {
    const params = normalizeParams(input);
    const tokenValues = params.getAll(REQUEST_REQUIRED_FIELD);
    if (tokenValues.length !== 1) {
        return null;
    }

    const token = tokenValues[0] ?? '';
    if (token.length === 0) {
        return null;
    }

    const tokenTypeHintValues = params.getAll(REQUEST_OPTIONAL_FIELD);
    if (tokenTypeHintValues.length > 1) {
        return null;
    }

    const tokenTypeHint = tokenTypeHintValues[0];
    if (tokenTypeHint !== undefined && tokenTypeHint.length === 0) {
        return null;
    }

    const extensions: Record<string, string> = {};
    const seenExtensionKeys = new Set<string>();
    for (const [name, value] of params.entries()) {
        if (REQUEST_RESERVED_FIELDS.has(name)) {
            continue;
        }
        if (name.length === 0) {
            return null;
        }
        if (seenExtensionKeys.has(name)) {
            return null;
        }
        seenExtensionKeys.add(name);
        extensions[name] = value;
    }

    const result: TokenIntrospectionRequestParams = {
        token,
    };
    if (tokenTypeHint !== undefined) {
        result.token_type_hint = tokenTypeHint;
    }
    if (seenExtensionKeys.size > 0) {
        result.extensions = extensions;
    }

    return result;
}

/**
 * Validate token introspection request parameters.
 * RFC 7662 §2.1.
 */
export function validateTokenIntrospectionRequestParams(request: TokenIntrospectionRequestParams): void {
    if (!isRecord(request)) {
        throw new Error('Token introspection request parameters must be an object');
    }

    if (typeof request.token !== 'string' || request.token.length === 0) {
        throw new Error('Token introspection request "token" must be a non-empty string');
    }

    if (
        request.token_type_hint !== undefined
        && (typeof request.token_type_hint !== 'string' || request.token_type_hint.length === 0)
    ) {
        throw new Error('Token introspection request "token_type_hint" must be a non-empty string when present');
    }

    if (request.extensions !== undefined) {
        if (!isRecord(request.extensions)) {
            throw new Error('Token introspection request "extensions" must be an object when present');
        }
        for (const [name, value] of Object.entries(request.extensions)) {
            if (name.length === 0) {
                throw new Error('Token introspection request extension keys must be non-empty strings');
            }
            if (REQUEST_RESERVED_FIELDS.has(name)) {
                throw new Error(
                    'Token introspection request "extensions" must not include "token" or "token_type_hint"',
                );
            }
            if (typeof value !== 'string') {
                throw new Error(`Token introspection request extension "${name}" must be a string value`);
            }
        }
    }
}

/**
 * Format token introspection request parameters as form-encoded content.
 * RFC 7662 §2.1.
 */
export function formatTokenIntrospectionRequestParams(input: TokenIntrospectionRequestInput): string {
    const request: TokenIntrospectionRequestParams = {
        token: input.token,
        token_type_hint: input.token_type_hint,
        extensions: input.extensions,
    };
    validateTokenIntrospectionRequestParams(request);

    const params = new URLSearchParams();
    params.set(REQUEST_REQUIRED_FIELD, request.token);
    if (request.token_type_hint !== undefined) {
        params.set(REQUEST_OPTIONAL_FIELD, request.token_type_hint);
    }

    if (request.extensions) {
        const extensionEntries = Object.entries(request.extensions).sort((left, right) => left[0].localeCompare(right[0]));
        for (const [name, value] of extensionEntries) {
            params.set(name, value);
        }
    }

    return params.toString();
}

/**
 * Parse a token introspection response JSON payload with tolerant behavior.
 * Returns null for malformed JSON or invalid response shape.
 * RFC 7662 §2.2.
 */
export function parseTokenIntrospectionResponse(json: string): TokenIntrospectionResponse | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseTokenIntrospectionResponseObject(parsed);
}

/**
 * Parse a token introspection response object with tolerant behavior.
 * Returns null for invalid object shapes or semantic violations.
 * RFC 7662 §2.2.
 */
export function parseTokenIntrospectionResponseObject(value: unknown): TokenIntrospectionResponse | null {
    if (!isRecord(value)) {
        return null;
    }

    if (!isJsonValue(value)) {
        return null;
    }

    const parsed = cloneJsonObject(value as JsonObject) as TokenIntrospectionResponse;

    try {
        validateTokenIntrospectionResponse(parsed);
    } catch {
        return null;
    }

    return parsed;
}

/**
 * Validate token introspection response payloads.
 * Throws Error when response values violate RFC 7662 requirements.
 * RFC 7662 §2.2.
 */
export function validateTokenIntrospectionResponse(response: TokenIntrospectionResponse): void {
    if (!isRecord(response)) {
        throw new Error('Token introspection response must be a JSON object');
    }

    if (!isJsonValue(response)) {
        throw new Error('Token introspection response must contain only valid JSON values');
    }

    if (typeof response.active !== 'boolean') {
        throw new Error('Token introspection response "active" must be a boolean');
    }

    for (const field of KNOWN_RESPONSE_STRING_FIELDS) {
        const value = response[field];
        if (value !== undefined && typeof value !== 'string') {
            throw new Error(`Token introspection response "${field}" must be a string when present`);
        }
    }

    for (const field of KNOWN_RESPONSE_NUMBER_FIELDS) {
        const value = response[field];
        if (value !== undefined && !isNumericDate(value)) {
            throw new Error(`Token introspection response "${field}" must be an integer timestamp when present`);
        }
    }

    if (response.aud !== undefined && !isAudienceValue(response.aud)) {
        throw new Error('Token introspection response "aud" must be a string or array of strings when present');
    }
}

/**
 * Format token introspection response JSON.
 * Throws Error for semantic-invalid response values.
 * RFC 7662 §2.2.
 */
export function formatTokenIntrospectionResponse(response: TokenIntrospectionResponse): string {
    validateTokenIntrospectionResponse(response);

    const output: Record<string, unknown> = {
        active: response.active,
    };

    for (const field of KNOWN_RESPONSE_STRING_FIELDS) {
        const value = response[field];
        if (value !== undefined) {
            output[field] = cloneJsonValue(value as JsonValue);
        }
    }

    for (const field of KNOWN_RESPONSE_NUMBER_FIELDS) {
        const value = response[field];
        if (value !== undefined) {
            output[field] = value;
        }
    }

    if (response.aud !== undefined) {
        output.aud = cloneJsonValue(response.aud as JsonValue);
    }

    const extensionKeys = Object.keys(response)
        .filter((key) => !KNOWN_RESPONSE_FIELDS.has(key))
        .sort();
    for (const key of extensionKeys) {
        const value = response[key];
        if (value !== undefined) {
            output[key] = cloneJsonValue(value as JsonValue);
        }
    }

    return JSON.stringify(output, null, 2);
}

function isNumericDate(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

function isAudienceValue(value: unknown): value is string | string[] {
    if (typeof value === 'string') {
        return true;
    }

    if (!Array.isArray(value)) {
        return false;
    }

    return value.every((entry) => typeof entry === 'string');
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
