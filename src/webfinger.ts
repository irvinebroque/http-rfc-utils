/**
 * WebFinger per RFC 7033.
 * RFC 7033 §4: JSON Resource Descriptor (JRD) format.
 * @see https://www.rfc-editor.org/rfc/rfc7033.html
 */

import type { WebFingerResponse, WebFingerLink } from './types.js';

export type { WebFingerResponse, WebFingerLink } from './types.js';

/**
 * The required Content-Type for WebFinger responses.
 * RFC 7033 §4.2: Response MUST be application/jrd+json.
 */
export const JRD_CONTENT_TYPE = 'application/jrd+json';

/**
 * Parse a JRD JSON string into a WebFingerResponse.
 * RFC 7033 §4.4: JRD document members.
 */
export function parseJrd(json: string): WebFingerResponse {
    const obj = JSON.parse(json);
    return parseJrdObject(obj);
}

/**
 * Parse a JRD object (already parsed from JSON) into a WebFingerResponse.
 */
function parseJrdObject(obj: Record<string, unknown>): WebFingerResponse {
    if (typeof obj.subject !== 'string') {
        throw new Error('JRD document must have a "subject" string property');
    }

    const result: WebFingerResponse = {
        subject: obj.subject,
    };

    if (Array.isArray(obj.aliases)) {
        result.aliases = obj.aliases.filter((a: unknown) => typeof a === 'string');
    }

    if (obj.properties !== null && typeof obj.properties === 'object' && !Array.isArray(obj.properties)) {
        result.properties = obj.properties as Record<string, string | null>;
    }

    if (Array.isArray(obj.links)) {
        result.links = (obj.links as Record<string, unknown>[]).map(parseJrdLink);
    }

    return result;
}

/**
 * Parse a single JRD link object.
 */
function parseJrdLink(obj: Record<string, unknown>): WebFingerLink {
    const link: WebFingerLink = {
        rel: String(obj.rel ?? ''),
    };

    if (typeof obj.type === 'string') link.type = obj.type;
    if (typeof obj.href === 'string') link.href = obj.href;

    if (obj.titles !== null && typeof obj.titles === 'object' && !Array.isArray(obj.titles)) {
        link.titles = obj.titles as Record<string, string>;
    }

    if (obj.properties !== null && typeof obj.properties === 'object' && !Array.isArray(obj.properties)) {
        link.properties = obj.properties as Record<string, string | null>;
    }

    return link;
}

/**
 * Serialize a WebFingerResponse to a JRD JSON string.
 * RFC 7033 §4.4: JRD serialization.
 */
export function formatJrd(response: WebFingerResponse): string {
    const obj: Record<string, unknown> = {
        subject: response.subject,
    };

    if (response.aliases && response.aliases.length > 0) {
        obj.aliases = response.aliases;
    }

    if (response.properties && Object.keys(response.properties).length > 0) {
        obj.properties = response.properties;
    }

    if (response.links && response.links.length > 0) {
        obj.links = response.links.map(formatJrdLink);
    }

    return JSON.stringify(obj, null, 2);
}

/**
 * Format a single JRD link object for serialization.
 */
function formatJrdLink(link: WebFingerLink): Record<string, unknown> {
    const obj: Record<string, unknown> = {
        rel: link.rel,
    };

    if (link.type !== undefined) obj.type = link.type;
    if (link.href !== undefined) obj.href = link.href;
    if (link.titles && Object.keys(link.titles).length > 0) obj.titles = link.titles;
    if (link.properties && Object.keys(link.properties).length > 0) obj.properties = link.properties;

    return obj;
}

/**
 * Validate a WebFingerResponse and return an array of issues.
 * RFC 7033 §4.4: Required members.
 */
export function validateJrd(response: WebFingerResponse): string[] {
    const issues: string[] = [];

    if (!response.subject || typeof response.subject !== 'string') {
        issues.push('JRD must have a "subject" string (RFC 7033 §4.4.1)');
    }

    if (response.links) {
        for (let i = 0; i < response.links.length; i++) {
            const link = response.links[i];
            if (!link.rel || typeof link.rel !== 'string') {
                issues.push(`Link at index ${i} must have a "rel" string (RFC 7033 §4.4.4)`);
            }
        }
    }

    return issues;
}

/**
 * Match a resource query against a set of WebFinger resources.
 * RFC 7033 §4.3: resource parameter matching.
 *
 * @param query - The resource query string (e.g. "acct:user@example.com")
 * @param resources - Map of resource identifiers to their JRD responses
 * @returns The matching WebFingerResponse or null
 */
export function matchResource(
    query: string,
    resources: Map<string, WebFingerResponse>,
): WebFingerResponse | null {
    // Direct lookup.
    const direct = resources.get(query);
    if (direct) return direct;

    // Normalize: strip trailing slash for URI resources.
    const normalized = query.endsWith('/') ? query.slice(0, -1) : query + '/';
    const alt = resources.get(normalized);
    if (alt) return alt;

    // Search aliases.
    for (const response of resources.values()) {
        if (response.subject === query) return response;
        if (response.aliases?.includes(query)) return response;
    }

    return null;
}

/**
 * Filter a WebFingerResponse's links by the `rel` query parameter.
 * RFC 7033 §4.4: The rel parameter filters which links are returned.
 *
 * @param response - The full WebFinger response
 * @param rels - Array of rel values to filter by (empty = no filtering)
 * @returns A new WebFingerResponse with only matching links
 */
export function filterByRel(response: WebFingerResponse, rels: string[]): WebFingerResponse {
    if (rels.length === 0 || !response.links) {
        return response;
    }

    const relSet = new Set(rels);
    return {
        ...response,
        links: response.links.filter(link => relSet.has(link.rel)),
    };
}
