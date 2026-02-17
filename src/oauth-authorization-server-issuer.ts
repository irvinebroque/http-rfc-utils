/**
 * OAuth 2.0 Authorization Server Issuer Identification helpers per RFC 9207.
 * RFC 9207 Sections 2, 2.4, and 3.
 * @see https://www.rfc-editor.org/rfc/rfc9207.html
 */

import type {
    AuthorizationResponseIssuerParams,
    AuthorizationResponseIssuerFormatOptions,
    AuthorizationResponseIssuerParseOptions,
    AuthorizationResponseIssuerValidationOptions,
} from './types.js';

export type {
    AuthorizationResponseIssuerParams,
    AuthorizationResponseIssuerFormatOptions,
    AuthorizationResponseIssuerParseOptions,
    AuthorizationResponseIssuerValidationOptions,
} from './types.js';

type AuthorizationResponseIssuerParamInput =
    | string
    | URLSearchParams
    | Record<string, string | readonly string[] | undefined>;

/**
 * Parse the authorization response `iss` parameter from x-www-form-urlencoded data.
 * Returns null for duplicate/invalid issuer values or when required issuer is missing.
 * Returns an empty object when `iss` is missing and not required.
 */
export function parseAuthorizationResponseIssuerParam(
    input: AuthorizationResponseIssuerParamInput,
    options: AuthorizationResponseIssuerParseOptions = {},
): AuthorizationResponseIssuerParams | null {
    const params = normalizeParams(input);
    const issuerValues = params.getAll('iss');

    if (issuerValues.length === 0) {
        return options.requireIssuer ? null : {};
    }

    if (issuerValues.length !== 1) {
        return null;
    }

    const issuer = issuerValues[0] ?? '';
    if (issuer.length === 0) {
        return null;
    }

    try {
        validateAuthorizationResponseIssuer(issuer, options);
    } catch {
        return null;
    }

    return { issuer };
}

/**
 * Validate an authorization response issuer identifier.
 * Throws Error when the issuer violates RFC 9207 requirements.
 */
export function validateAuthorizationResponseIssuer(
    issuer: string,
    options: AuthorizationResponseIssuerValidationOptions = {},
): void {
    if (typeof issuer !== 'string') {
        throw new Error('Authorization response issuer must be a string');
    }

    parseIssuerUrl(issuer, 'Authorization response issuer');

    if (options.expectedIssuer !== undefined) {
        parseIssuerUrl(options.expectedIssuer, 'Expected issuer');

        if (issuer !== options.expectedIssuer) {
            throw new Error(
                `Authorization response issuer must exactly match expected issuer "${options.expectedIssuer}"; received "${issuer}"`,
            );
        }
    }
}

/**
 * Format the authorization response `iss` parameter.
 * Throws Error when the issuer violates RFC 9207 requirements.
 */
export function formatAuthorizationResponseIssuerParam(
    issuer: string,
    options: AuthorizationResponseIssuerFormatOptions = {},
): string {
    validateAuthorizationResponseIssuer(issuer, options);

    const params = new URLSearchParams();
    params.set('iss', issuer);
    return params.toString();
}

function normalizeParams(input: AuthorizationResponseIssuerParamInput): URLSearchParams {
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
                if (typeof entry === 'string') {
                    params.append(key, entry);
                }
            }
        }
    }

    return params;
}

function parseIssuerUrl(issuer: string, label: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(issuer);
    } catch {
        throw new Error(`${label} must be an absolute URL`);
    }

    if (parsed.protocol !== 'https:') {
        throw new Error(`${label} must use the https scheme`);
    }

    if (parsed.search !== '' || parsed.hash !== '') {
        throw new Error(`${label} must not include query or fragment components`);
    }

    return parsed;
}
