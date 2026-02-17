/**
 * Webmention helpers per W3C Webmention Recommendation.
 * W3C Webmention Section 3.1.2, 3.1.3, 3.2.1, 3.2.3, and 6.
 * @see https://www.w3.org/TR/webmention/
 */

import type {
    WebmentionEndpointDiscoveryInput,
    WebmentionEndpointDiscoveryResult,
    WebmentionRequest,
    WebmentionValidationOptions,
} from './types.js';
import { parseLinkHeader } from './link.js';
import { compareUris } from './uri.js';

export type {
    WebmentionEndpointDiscoveryInput,
    WebmentionEndpointDiscoveryResult,
    WebmentionRequest,
    WebmentionValidationOptions,
    WebmentionDiscoverySource,
} from './types.js';

/**
 * IANA-registered relation type used for Webmention endpoint discovery.
 * W3C Webmention Section 6.
 */
export const WEBMENTION_REL = 'webmention';

/**
 * Request media type for Webmention source/target payloads.
 * W3C Webmention Section 3.1.3.
 */
export const WEBMENTION_CONTENT_TYPE = 'application/x-www-form-urlencoded';

const LEGACY_WEBMENTION_REL = 'http://webmention.org/';
const DEFAULT_SUPPORTED_SCHEMES = ['http', 'https'] as const;

const HTML_TAG_RE = /<(link|a)\b([^>]*)>/gi;
const HTML_ATTR_RE = /([^\t\n\f\r "'=<>`\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\t\n\f\r "'=<>`]+)))?/g;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

type WebmentionRequestInput =
    | string
    | URLSearchParams
    | Record<string, string | readonly string[] | undefined>;

/**
 * Discover a Webmention endpoint from HTTP Link headers and optional HTML.
 *
 * Discovery precedence follows the specification:
 * 1) first endpoint from HTTP Link headers
 * 2) first endpoint from HTML <link>/<a> in document order
 *
 * Returns null when no valid endpoint can be discovered.
 */
export function discoverWebmentionEndpoint(
    input: WebmentionEndpointDiscoveryInput,
): WebmentionEndpointDiscoveryResult | null {
    const targetUrl = parseUrl(input.target);
    if (targetUrl === null) {
        return null;
    }

    const allowLegacyRelationUri = input.allowLegacyRelationUri === true;
    const endpointFromLinkHeader = discoverFromHttpLinkHeaders(
        input.linkHeader,
        targetUrl,
        allowLegacyRelationUri,
    );
    if (endpointFromLinkHeader !== null) {
        return {
            endpoint: endpointFromLinkHeader,
            source: 'http-link',
        };
    }

    if (typeof input.html !== 'string' || input.html.length === 0) {
        return null;
    }

    if (typeof input.contentType === 'string' && !isHtmlContentType(input.contentType)) {
        return null;
    }

    return discoverFromHtml(input.html, targetUrl, allowLegacyRelationUri);
}

/**
 * Parse an x-www-form-urlencoded Webmention request payload.
 * Returns null when required fields are missing, duplicated, or invalid.
 */
export function parseWebmentionRequest(
    input: WebmentionRequestInput,
    options: WebmentionValidationOptions = {},
): WebmentionRequest | null {
    const params = normalizeParams(input);

    const sourceValues = params.getAll('source');
    const targetValues = params.getAll('target');
    if (sourceValues.length !== 1 || targetValues.length !== 1) {
        return null;
    }

    const source = (sourceValues[0] ?? '').trim();
    const target = (targetValues[0] ?? '').trim();
    if (source.length === 0 || target.length === 0) {
        return null;
    }

    const request: WebmentionRequest = {
        source,
        target,
    };

    try {
        validateWebmentionRequest(request, options);
    } catch {
        return null;
    }

    return request;
}

/**
 * Validate a Webmention source/target request.
 * Throws Error for semantic-invalid request values.
 */
export function validateWebmentionRequest(
    request: WebmentionRequest,
    options: WebmentionValidationOptions = {},
): void {
    if (typeof request.source !== 'string' || request.source.trim().length === 0) {
        throw new Error('Webmention request "source" must be a non-empty absolute URL string');
    }
    if (typeof request.target !== 'string' || request.target.trim().length === 0) {
        throw new Error('Webmention request "target" must be a non-empty absolute URL string');
    }

    const sourceUrl = parseUrl(request.source);
    if (sourceUrl === null) {
        throw new Error(`Webmention request "source" is not a valid absolute URL: ${request.source}`);
    }

    const targetUrl = parseUrl(request.target);
    if (targetUrl === null) {
        throw new Error(`Webmention request "target" is not a valid absolute URL: ${request.target}`);
    }

    const supportedSchemes = normalizeSupportedSchemes(options.supportedSchemes);
    const sourceScheme = sourceUrl.protocol.slice(0, -1).toLowerCase();
    const targetScheme = targetUrl.protocol.slice(0, -1).toLowerCase();

    if (!supportedSchemes.has(sourceScheme)) {
        throw new Error(
            `Webmention request "source" must use a supported URL scheme (${[...supportedSchemes].join(', ')}): ${sourceScheme}`,
        );
    }

    if (!supportedSchemes.has(targetScheme)) {
        throw new Error(
            `Webmention request "target" must use a supported URL scheme (${[...supportedSchemes].join(', ')}): ${targetScheme}`,
        );
    }

    if (compareUris(sourceUrl.toString(), targetUrl.toString())) {
        throw new Error('Webmention request "source" and "target" must not refer to the same URL');
    }
}

/**
 * Format a Webmention request body as x-www-form-urlencoded content.
 * Throws Error when request values are invalid.
 */
export function formatWebmentionRequest(
    request: WebmentionRequest,
    options: WebmentionValidationOptions = {},
): string {
    validateWebmentionRequest(request, options);

    const params = new URLSearchParams();
    params.set('source', request.source);
    params.set('target', request.target);
    return params.toString();
}

/**
 * Returns true when an HTTP status code indicates Webmention send success.
 * Any 2xx status code is considered successful.
 */
export function isWebmentionSuccessStatus(statusCode: number): boolean {
    return Number.isInteger(statusCode) && statusCode >= 200 && statusCode <= 299;
}

function discoverFromHttpLinkHeaders(
    linkHeader: string | string[] | null | undefined,
    targetUrl: URL,
    allowLegacyRelationUri: boolean,
): string | null {
    const linkHeaderValues = toHeaderArray(linkHeader);

    for (const value of linkHeaderValues) {
        const links = parseLinkHeader(value);
        for (const link of links) {
            if (!isWebmentionRelation(link.rel, allowLegacyRelationUri)) {
                continue;
            }

            const endpoint = resolveEndpoint(link.href, targetUrl);
            if (endpoint !== null) {
                return endpoint;
            }
        }
    }

    return null;
}

function discoverFromHtml(
    html: string,
    targetUrl: URL,
    allowLegacyRelationUri: boolean,
): WebmentionEndpointDiscoveryResult | null {
    const htmlWithoutComments = html.replace(HTML_COMMENT_RE, '');
    HTML_TAG_RE.lastIndex = 0;

    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = HTML_TAG_RE.exec(htmlWithoutComments)) !== null) {
        const rawTagName = tagMatch[1];
        const rawAttributes = tagMatch[2] ?? '';
        if (rawTagName === undefined) {
            continue;
        }

        const tagName = rawTagName.toLowerCase();
        const attributes = parseHtmlAttributes(rawAttributes);
        const relValue = attributes.rel;
        if (!hasWebmentionRelToken(relValue, allowLegacyRelationUri)) {
            continue;
        }

        const endpoint = resolveEndpoint(attributes.href, targetUrl);
        if (endpoint === null) {
            continue;
        }

        return {
            endpoint,
            source: tagName === 'link' ? 'html-link' : 'html-a',
        };
    }

    return null;
}

function parseHtmlAttributes(source: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    HTML_ATTR_RE.lastIndex = 0;

    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = HTML_ATTR_RE.exec(source)) !== null) {
        const rawName = attrMatch[1];
        if (rawName === undefined) {
            continue;
        }

        const name = rawName.toLowerCase();
        if (name in attributes) {
            continue;
        }

        const rawValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
        attributes[name] = decodeHtmlEntities(rawValue);
    }

    return attributes;
}

function decodeHtmlEntities(value: string): string {
    if (!value.includes('&')) {
        return value;
    }

    return value
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, '\'')
        .replace(/&#39;/gi, '\'');
}

function hasWebmentionRelToken(
    relValue: string | undefined,
    allowLegacyRelationUri: boolean,
): boolean {
    if (typeof relValue !== 'string') {
        return false;
    }

    const relTokens = splitHtmlRelTokens(relValue);
    for (const token of relTokens) {
        if (isWebmentionRelation(token, allowLegacyRelationUri)) {
            return true;
        }
    }
    return false;
}

function splitHtmlRelTokens(value: string): string[] {
    const tokens: string[] = [];
    let token = '';

    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (
            char === ' '
            || char === '\t'
            || char === '\r'
            || char === '\n'
            || char === '\f'
            || char === '\v'
        ) {
            if (token.length > 0) {
                tokens.push(token);
                token = '';
            }
            continue;
        }

        token += char;
    }

    if (token.length > 0) {
        tokens.push(token);
    }

    return tokens;
}

function isWebmentionRelation(value: string, allowLegacyRelationUri: boolean): boolean {
    const relation = value.trim().toLowerCase();
    if (relation === WEBMENTION_REL) {
        return true;
    }

    return allowLegacyRelationUri && relation === LEGACY_WEBMENTION_REL;
}

function resolveEndpoint(value: string | undefined, targetUrl: URL): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const endpointValue = value.trim();
    if (endpointValue.length === 0) {
        return null;
    }

    try {
        return new URL(endpointValue, targetUrl).toString();
    } catch {
        return null;
    }
}

function parseUrl(value: string | URL): URL | null {
    try {
        return value instanceof URL ? new URL(value.toString()) : new URL(value);
    } catch {
        return null;
    }
}

function toHeaderArray(value: string | string[] | null | undefined): string[] {
    if (typeof value === 'string') {
        return [value];
    }

    if (Array.isArray(value)) {
        return value.filter((entry) => typeof entry === 'string');
    }

    return [];
}

function isHtmlContentType(contentType: string): boolean {
    const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    return mediaType === 'text/html' || mediaType === 'application/xhtml+xml';
}

function normalizeParams(input: WebmentionRequestInput): URLSearchParams {
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
            for (const item of value) {
                params.append(key, item);
            }
        }
    }

    return params;
}

function normalizeSupportedSchemes(supportedSchemes: readonly string[] | undefined): Set<string> {
    const schemes = supportedSchemes ?? DEFAULT_SUPPORTED_SCHEMES;
    const normalized = new Set<string>();

    for (const scheme of schemes) {
        const value = scheme.trim().toLowerCase();
        if (!isValidSchemeToken(value)) {
            throw new Error(`Unsupported URL scheme token "${scheme}" in Webmention validation options`);
        }

        normalized.add(value);
    }

    if (normalized.size === 0) {
        throw new Error('Webmention validation options must include at least one supported URL scheme');
    }

    return normalized;
}

function isValidSchemeToken(value: string): boolean {
    return /^[a-z][a-z0-9+.-]*$/.test(value);
}
