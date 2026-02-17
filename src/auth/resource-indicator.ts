/**
 * OAuth 2.0 Resource Indicators helpers.
 * RFC 8707 §2, §2.1, §2.2.
 * @see https://www.rfc-editor.org/rfc/rfc8707.html
 */

import type {
    ResourceIndicatorRequestInput,
    ResourceIndicatorRequestParams,
    ResourceIndicatorValidationOptions,
} from '../types/auth.js';

type ResourceIndicatorParamInput = string | URLSearchParams | Record<string, string | string[] | undefined>;

const RESOURCE_PARAM = 'resource';

function normalizeResourceIndicatorParams(input: ResourceIndicatorParamInput): URLSearchParams {
    if (typeof input === 'string') {
        return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
    }
    if (input instanceof URLSearchParams) {
        return new URLSearchParams(input);
    }

    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(input)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                if (item !== undefined) {
                    params.append(name, item);
                }
            }
            continue;
        }
        if (value !== undefined) {
            params.append(name, value);
        }
    }
    return params;
}

function isValidResourceIndicatorUri(
    resource: string,
    options: ResourceIndicatorValidationOptions = {},
): boolean {
    if (!resource) {
        return false;
    }

    let url: URL;
    try {
        url = new URL(resource);
    } catch {
        return false;
    }

    if (url.hash.length > 0) {
        return false;
    }

    if (options.allowQuery === false && url.search.length > 0) {
        return false;
    }

    return true;
}

/**
 * Validate a resource indicator URI.
 * RFC 8707 §2, RFC 3986 §4.3.
 */
export function validateResourceIndicatorUri(
    resource: string,
    options: ResourceIndicatorValidationOptions = {},
): void {
    if (!isValidResourceIndicatorUri(resource, options)) {
        if (!resource) {
            throw new Error('Resource indicator URI must be a non-empty absolute URI.');
        }

        let url: URL | null = null;
        try {
            url = new URL(resource);
        } catch {
            throw new Error('Resource indicator URI must be an absolute URI.');
        }

        if (url.hash.length > 0) {
            throw new Error('Resource indicator URI must not include a fragment component.');
        }

        if (options.allowQuery === false && url.search.length > 0) {
            throw new Error('Resource indicator URI must not include a query component.');
        }
    }
}

function parseResourceIndicatorParams(input: ResourceIndicatorParamInput): ResourceIndicatorRequestParams | null {
    const params = normalizeResourceIndicatorParams(input);
    const resourceValues = params.getAll(RESOURCE_PARAM);
    if (resourceValues.length === 0) {
        return null;
    }

    const resources: string[] = [];
    for (const resource of resourceValues) {
        if (!isValidResourceIndicatorUri(resource)) {
            return null;
        }
        resources.push(resource);
    }

    return { resources };
}

/**
 * Parse resource indicator parameters from an OAuth authorization request.
 * RFC 8707 §2.1.
 */
export function parseResourceIndicatorAuthorizationRequestParams(
    input: ResourceIndicatorParamInput,
): ResourceIndicatorRequestParams | null {
    return parseResourceIndicatorParams(input);
}

/**
 * Parse resource indicator parameters from an OAuth token request.
 * RFC 8707 §2.2.
 */
export function parseResourceIndicatorTokenRequestParams(
    input: ResourceIndicatorParamInput,
): ResourceIndicatorRequestParams | null {
    return parseResourceIndicatorParams(input);
}

function formatResourceIndicatorParams(
    input: ResourceIndicatorRequestInput,
    options: ResourceIndicatorValidationOptions = {},
): string {
    if (!Array.isArray(input.resources) || input.resources.length === 0) {
        throw new Error('Resource indicator resources must be a non-empty array of URIs.');
    }

    const params = new URLSearchParams();
    for (const resource of input.resources) {
        validateResourceIndicatorUri(resource, options);
        params.append(RESOURCE_PARAM, resource);
    }
    return params.toString();
}

/**
 * Format resource indicator parameters for an OAuth authorization request.
 * RFC 8707 §2.1.
 */
export function formatResourceIndicatorAuthorizationRequestParams(
    input: ResourceIndicatorRequestInput,
    options: ResourceIndicatorValidationOptions = {},
): string {
    return formatResourceIndicatorParams(input, options);
}

/**
 * Format resource indicator parameters for an OAuth token request.
 * RFC 8707 §2.2.
 */
export function formatResourceIndicatorTokenRequestParams(
    input: ResourceIndicatorRequestInput,
    options: ResourceIndicatorValidationOptions = {},
): string {
    return formatResourceIndicatorParams(input, options);
}
