/**
 * OAuth 2.0 Dynamic Client Registration Management helpers per RFC 7592.
 * RFC 7592 Sections 2, 2.1, 2.2, 2.3, and 3.
 * @see https://www.rfc-editor.org/rfc/rfc7592.html
 */

import type {
    OAuthClientConfigurationFormatOptions,
    OAuthClientConfigurationParseOptions,
    OAuthClientConfigurationResponse,
    OAuthClientConfigurationUpdateRequest,
    OAuthClientConfigurationValidationOptions,
} from './types.js';
import {
    formatOAuthClientRegistrationRequest,
    formatOAuthClientRegistrationResponse,
    parseOAuthClientRegistrationRequestObject,
    parseOAuthClientRegistrationResponseObject,
    validateOAuthClientRegistrationRequest,
    validateOAuthClientRegistrationResponse,
} from './oauth-client-registration.js';

export type {
    OAuthClientConfigurationFormatOptions,
    OAuthClientConfigurationParseOptions,
    OAuthClientConfigurationResponse,
    OAuthClientConfigurationUpdateRequest,
    OAuthClientConfigurationValidationOptions,
} from './types.js';

/**
 * Parse an OAuth client configuration response JSON document.
 * Returns null on malformed JSON or invalid response structure.
 */
export function parseOAuthClientConfigurationResponse(
    json: string,
    options: OAuthClientConfigurationParseOptions = {},
): OAuthClientConfigurationResponse | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseOAuthClientConfigurationResponseObject(parsed, options);
}

/**
 * Parse a decoded OAuth client configuration response object.
 * Returns null for invalid shapes or semantic violations.
 */
export function parseOAuthClientConfigurationResponseObject(
    value: unknown,
    options: OAuthClientConfigurationParseOptions = {},
): OAuthClientConfigurationResponse | null {
    const parsed = parseOAuthClientRegistrationResponseObject(value, options);
    if (!parsed) {
        return null;
    }

    try {
        validateOAuthClientConfigurationResponse(parsed as OAuthClientConfigurationResponse, options);
    } catch {
        return null;
    }

    return parsed as OAuthClientConfigurationResponse;
}

/**
 * Validate OAuth client configuration response metadata.
 * Throws Error when semantic requirements are violated.
 */
export function validateOAuthClientConfigurationResponse(
    response: OAuthClientConfigurationResponse,
    options: OAuthClientConfigurationValidationOptions = {},
): void {
    validateOAuthClientRegistrationResponse(response, options);

    validateNonEmptyString('registration_access_token', response.registration_access_token);
    validateNonEmptyString('registration_client_uri', response.registration_client_uri);
    validateAbsoluteUrl('registration_client_uri', response.registration_client_uri);
}

/**
 * Serialize OAuth client configuration response metadata as JSON.
 * Throws Error when semantic validation fails.
 */
export function formatOAuthClientConfigurationResponse(
    response: OAuthClientConfigurationResponse,
    options: OAuthClientConfigurationFormatOptions = {},
): string {
    validateOAuthClientConfigurationResponse(response, options);
    return formatOAuthClientRegistrationResponse(response, options);
}

/**
 * Parse an OAuth client configuration update request JSON document.
 * Returns null on malformed JSON or invalid request structure.
 */
export function parseOAuthClientConfigurationUpdateRequest(
    json: string,
    options: OAuthClientConfigurationParseOptions = {},
): OAuthClientConfigurationUpdateRequest | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseOAuthClientConfigurationUpdateRequestObject(parsed, options);
}

/**
 * Parse a decoded OAuth client configuration update request object.
 * Returns null for invalid shapes or semantic violations.
 */
export function parseOAuthClientConfigurationUpdateRequestObject(
    value: unknown,
    options: OAuthClientConfigurationParseOptions = {},
): OAuthClientConfigurationUpdateRequest | null {
    const parsed = parseOAuthClientRegistrationRequestObject(value, options);
    if (!parsed) {
        return null;
    }

    try {
        validateOAuthClientConfigurationUpdateRequest(parsed as OAuthClientConfigurationUpdateRequest, options);
    } catch {
        return null;
    }

    return parsed as OAuthClientConfigurationUpdateRequest;
}

/**
 * Validate OAuth client configuration update request metadata.
 * Throws Error when semantic requirements are violated.
 */
export function validateOAuthClientConfigurationUpdateRequest(
    request: OAuthClientConfigurationUpdateRequest,
    options: OAuthClientConfigurationValidationOptions = {},
): void {
    validateOAuthClientRegistrationRequest(request, options);

    validateNonEmptyString('client_id', request.client_id);

    if (request.client_secret !== undefined) {
        validateNonEmptyString('client_secret', request.client_secret);
    }

    const forbiddenFields = [
        'registration_access_token',
        'registration_client_uri',
        'client_id_issued_at',
        'client_secret_expires_at',
    ];

    for (const field of forbiddenFields) {
        if (Object.prototype.hasOwnProperty.call(request, field)) {
            throw new Error(`Client configuration update request must not include "${field}"`);
        }
    }
}

/**
 * Serialize OAuth client configuration update request metadata as JSON.
 * Throws Error when semantic validation fails.
 */
export function formatOAuthClientConfigurationUpdateRequest(
    request: OAuthClientConfigurationUpdateRequest,
    options: OAuthClientConfigurationFormatOptions = {},
): string {
    validateOAuthClientConfigurationUpdateRequest(request, options);
    return formatOAuthClientRegistrationRequest(request, options);
}

function validateNonEmptyString(fieldName: string, value: unknown): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Metadata field "${fieldName}" must be a non-empty string`);
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
