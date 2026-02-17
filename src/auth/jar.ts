/**
 * OAuth 2.0 JWT-Secured Authorization Request (JAR) helpers.
 * RFC 9101 Sections 4, 5, and 5.2.
 * @see https://www.rfc-editor.org/rfc/rfc9101.html
 */

import type {
    JarAuthorizationRequestParams,
    JarAuthorizationRequestValidationOptions,
} from '../types/auth.js';

type JarParamInput = string | URLSearchParams | Record<string, string | undefined>;

const BASE64URL_RE = /^[A-Za-z0-9_-]*$/;
const DEFAULT_ALLOWED_REQUEST_URI_SCHEMES = ['https', 'urn'] as const;

/**
 * Parse JAR parameters from an OAuth authorization request.
 * RFC 9101 Section 5.
 */
export function parseJarAuthorizationRequestParams(input: JarParamInput): JarAuthorizationRequestParams | null {
    const params = normalizeJarParams(input);
    const clientIdValues = params.getAll('client_id');
    if (clientIdValues.length !== 1) {
        return null;
    }

    const requestValues = params.getAll('request');
    const requestUriValues = params.getAll('request_uri');
    if (requestValues.length > 1 || requestUriValues.length > 1) {
        return null;
    }

    if (requestValues.length === 1 && requestUriValues.length === 1) {
        return null;
    }

    const clientId = clientIdValues[0] ?? '';
    if (clientId.length === 0) {
        return null;
    }

    const request = requestValues[0];
    if (request !== undefined) {
        if (!isJwtCompactSerialization(request)) {
            return null;
        }
        return {
            clientId,
            request,
        };
    }

    const requestUri = requestUriValues[0];
    if (requestUri !== undefined) {
        if (!isAbsoluteUri(requestUri)) {
            return null;
        }
        return {
            clientId,
            requestUri,
        };
    }

    return null;
}

/**
 * Validate semantic requirements for JAR authorization request parameters.
 * RFC 9101 Sections 4 and 5.
 */
export function validateJarAuthorizationRequestParams(
    params: JarAuthorizationRequestParams,
    options: JarAuthorizationRequestValidationOptions = {},
): void {
    if (!params || typeof params !== 'object') {
        throw new Error('JAR authorization request parameters must be an object');
    }

    if (typeof params.clientId !== 'string' || params.clientId.length === 0) {
        throw new Error('JAR authorization request parameter "client_id" must be a non-empty string');
    }

    const hasRequest = params.request !== undefined;
    const hasRequestUri = params.requestUri !== undefined;
    if (hasRequest === hasRequestUri) {
        throw new Error('JAR authorization request must include exactly one of "request" or "request_uri"');
    }

    if (params.request !== undefined) {
        if (typeof params.request !== 'string' || !isJwtCompactSerialization(params.request)) {
            throw new Error('JAR "request" parameter must be a JWT compact serialization');
        }
    }

    if (params.requestUri !== undefined) {
        if (typeof params.requestUri !== 'string') {
            throw new Error('JAR "request_uri" parameter must be a string');
        }

        const allowedSchemes = options.allowedRequestUriSchemes ?? DEFAULT_ALLOWED_REQUEST_URI_SCHEMES;
        validateRequestUri(params.requestUri, allowedSchemes, options.maxRequestUriLength);
    }
}

/**
 * Format JAR authorization request parameters as a query string.
 * RFC 9101 Section 5.
 */
export function formatJarAuthorizationRequestParams(
    params: JarAuthorizationRequestParams,
    options: JarAuthorizationRequestValidationOptions = {},
): string {
    validateJarAuthorizationRequestParams(params, options);

    const output = new URLSearchParams();
    output.set('client_id', params.clientId);
    if (params.request !== undefined) {
        output.set('request', params.request);
    }
    if (params.requestUri !== undefined) {
        output.set('request_uri', params.requestUri);
    }

    return output.toString();
}

function normalizeJarParams(input: JarParamInput): URLSearchParams {
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

function isJwtCompactSerialization(value: string): boolean {
    const segments = value.split('.');
    if (segments.length !== 3 && segments.length !== 5) {
        return false;
    }
    return segments.every((segment) => BASE64URL_RE.test(segment));
}

function isAbsoluteUri(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol.length > 0;
    } catch {
        return false;
    }
}

function validateRequestUri(
    value: string,
    allowedSchemes: readonly string[],
    maxLength: number | undefined,
): void {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error('JAR "request_uri" parameter must be an absolute URI');
    }

    const scheme = parsed.protocol.replace(':', '');
    if (!allowedSchemes.includes(scheme)) {
        throw new Error(
            `JAR "request_uri" parameter must use one of the following schemes: ${allowedSchemes.join(', ')}`,
        );
    }

    if (maxLength !== undefined) {
        if (!Number.isInteger(maxLength) || maxLength <= 0) {
            throw new Error('JAR "maxRequestUriLength" option must be a positive integer');
        }
        if (!isAscii(value)) {
            throw new Error('JAR "request_uri" parameter must be ASCII when enforcing length limits');
        }
        if (value.length > maxLength) {
            throw new Error(`JAR "request_uri" parameter exceeds ${maxLength} ASCII characters`);
        }
    }
}

function isAscii(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
        if (value.charCodeAt(index) > 0x7f) {
            return false;
        }
    }
    return true;
}
