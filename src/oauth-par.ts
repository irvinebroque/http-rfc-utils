/**
 * OAuth 2.0 Pushed Authorization Requests (PAR) helpers.
 * RFC 9126 Sections 2.1-2.3 and 5-6.
 * @see https://www.rfc-editor.org/rfc/rfc9126.html
 */

import type {
    PushedAuthorizationErrorResponse,
    PushedAuthorizationRequest,
    PushedAuthorizationRequestValidationOptions,
    PushedAuthorizationResponse,
} from './types.js';

export type {
    PushedAuthorizationErrorResponse,
    PushedAuthorizationRequest,
    PushedAuthorizationRequestValidationOptions,
    PushedAuthorizationResponse,
} from './types.js';

type PushedAuthorizationRequestInput =
    | string
    | URLSearchParams
    | Record<string, string | readonly string[] | undefined>;

/**
 * Parse a pushed authorization request form payload.
 * Returns null for duplicate parameters, missing client_id, or request_uri usage.
 */
export function parsePushedAuthorizationRequest(
    input: PushedAuthorizationRequestInput,
    options: PushedAuthorizationRequestValidationOptions = {},
): PushedAuthorizationRequest | null {
    const params = normalizeParams(input);
    const parsed: Record<string, string> = {};

    for (const [key, value] of params) {
        if (key.length === 0) {
            return null;
        }
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
            return null;
        }
        parsed[key] = value;
    }

    const request: PushedAuthorizationRequest = { params: parsed };
    try {
        validatePushedAuthorizationRequest(request, options);
    } catch {
        return null;
    }

    return request;
}

/**
 * Validate a pushed authorization request payload.
 * Throws Error when request violates RFC requirements.
 */
export function validatePushedAuthorizationRequest(
    request: PushedAuthorizationRequest,
    options: PushedAuthorizationRequestValidationOptions = {},
): void {
    if (!isRecord(request) || !isRecord(request.params)) {
        throw new Error('Pushed authorization request must include a params object');
    }

    for (const [key, value] of Object.entries(request.params)) {
        if (key.length === 0) {
            throw new Error('Pushed authorization request parameter names must be non-empty');
        }
        if (typeof value !== 'string') {
            throw new Error(`Pushed authorization request parameter "${key}" must be a string`);
        }
    }

    if (Object.prototype.hasOwnProperty.call(request.params, 'request_uri')) {
        throw new Error('Pushed authorization request must not include request_uri');
    }

    const requireClientId = options.requireClientId !== false;
    if (requireClientId) {
        const clientId = request.params.client_id;
        if (typeof clientId !== 'string' || clientId.length === 0) {
            throw new Error('Pushed authorization request must include a non-empty client_id');
        }
    }
}

/**
 * Format a pushed authorization request as x-www-form-urlencoded content.
 */
export function formatPushedAuthorizationRequest(
    request: PushedAuthorizationRequest,
    options: PushedAuthorizationRequestValidationOptions = {},
): string {
    validatePushedAuthorizationRequest(request, options);

    const params = new URLSearchParams();
    const entries = Object.entries(request.params).sort(([left], [right]) => left.localeCompare(right));
    for (const [key, value] of entries) {
        params.append(key, value);
    }
    return params.toString();
}

/**
 * Parse a successful pushed authorization response JSON string.
 */
export function parsePushedAuthorizationResponse(json: string): PushedAuthorizationResponse | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parsePushedAuthorizationResponseObject(parsed);
}

/**
 * Parse a successful pushed authorization response JSON object.
 */
export function parsePushedAuthorizationResponseObject(value: unknown): PushedAuthorizationResponse | null {
    if (!isRecord(value)) {
        return null;
    }

    const requestUri = value.request_uri;
    const expiresIn = value.expires_in;
    if (typeof requestUri !== 'string' || requestUri.length === 0) {
        return null;
    }
    if (!Number.isInteger(expiresIn) || (expiresIn as number) <= 0) {
        return null;
    }

    return {
        requestUri,
        expiresIn: expiresIn as number,
    };
}

/**
 * Validate a successful pushed authorization response payload.
 * Throws Error when response violates RFC requirements.
 */
export function validatePushedAuthorizationResponse(response: PushedAuthorizationResponse): void {
    if (!isRecord(response)) {
        throw new Error('Pushed authorization response must be an object');
    }

    if (typeof response.requestUri !== 'string' || response.requestUri.length === 0) {
        throw new Error('Pushed authorization response "requestUri" must be a non-empty string');
    }

    if (!Number.isInteger(response.expiresIn) || response.expiresIn <= 0) {
        throw new Error('Pushed authorization response "expiresIn" must be a positive integer');
    }
}

/**
 * Format a successful pushed authorization response as JSON.
 */
export function formatPushedAuthorizationResponse(response: PushedAuthorizationResponse): string {
    validatePushedAuthorizationResponse(response);

    return JSON.stringify(
        {
            request_uri: response.requestUri,
            expires_in: response.expiresIn,
        },
        null,
        2,
    );
}

/**
 * Parse a pushed authorization error response JSON string.
 */
export function parsePushedAuthorizationErrorResponse(json: string): PushedAuthorizationErrorResponse | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parsePushedAuthorizationErrorResponseObject(parsed);
}

/**
 * Parse a pushed authorization error response JSON object.
 */
export function parsePushedAuthorizationErrorResponseObject(
    value: unknown,
): PushedAuthorizationErrorResponse | null {
    if (!isRecord(value)) {
        return null;
    }

    const error = value.error;
    const errorDescription = value.error_description;
    const errorUri = value.error_uri;

    if (typeof error !== 'string' || error.length === 0) {
        return null;
    }
    if (errorDescription !== undefined && typeof errorDescription !== 'string') {
        return null;
    }
    if (errorUri !== undefined && typeof errorUri !== 'string') {
        return null;
    }

    return {
        error,
        errorDescription,
        errorUri,
    };
}

/**
 * Validate a pushed authorization error response payload.
 * Throws Error when response violates RFC requirements.
 */
export function validatePushedAuthorizationErrorResponse(response: PushedAuthorizationErrorResponse): void {
    if (!isRecord(response)) {
        throw new Error('Pushed authorization error response must be an object');
    }

    if (typeof response.error !== 'string' || response.error.length === 0) {
        throw new Error('Pushed authorization error response "error" must be a non-empty string');
    }

    if (response.errorDescription !== undefined && typeof response.errorDescription !== 'string') {
        throw new Error('Pushed authorization error response "errorDescription" must be a string when provided');
    }

    if (response.errorDescription !== undefined && response.errorDescription.length === 0) {
        throw new Error('Pushed authorization error response "errorDescription" must be non-empty when provided');
    }

    if (response.errorUri !== undefined && typeof response.errorUri !== 'string') {
        throw new Error('Pushed authorization error response "errorUri" must be a string when provided');
    }

    if (response.errorUri !== undefined && response.errorUri.length === 0) {
        throw new Error('Pushed authorization error response "errorUri" must be non-empty when provided');
    }
}

/**
 * Format a pushed authorization error response as JSON.
 */
export function formatPushedAuthorizationErrorResponse(response: PushedAuthorizationErrorResponse): string {
    validatePushedAuthorizationErrorResponse(response);

    const payload: Record<string, string> = {
        error: response.error,
    };

    if (response.errorDescription !== undefined) {
        payload.error_description = response.errorDescription;
    }

    if (response.errorUri !== undefined) {
        payload.error_uri = response.errorUri;
    }

    return JSON.stringify(payload, null, 2);
}

function normalizeParams(input: PushedAuthorizationRequestInput): URLSearchParams {
    if (typeof input === 'string') {
        return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
    }

    if (input instanceof URLSearchParams) {
        return new URLSearchParams(input);
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string') {
            params.append(key, value);
            continue;
        }

        if (Array.isArray(value)) {
            for (const entry of value) {
                params.append(key, entry);
            }
        }
    }

    return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
