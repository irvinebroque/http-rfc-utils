/**
 * WebFinger per RFC 7033.
 * RFC 7033 §4: JSON Resource Descriptor (JRD) format.
 * @see https://www.rfc-editor.org/rfc/rfc7033.html
 */

import type { WebFingerResponse, WebFingerLink } from './types.js';
import {
    toRecordOrEmpty,
    toStringMap,
    toStringOrNullMap,
} from './internal-json-shape.js';

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
 * Parse a JRD JSON string without throwing.
 * Returns null for malformed JSON or invalid JRD shapes.
 */
export function tryParseJrd(json: string): WebFingerResponse | null {
    try {
        return parseJrdObject(JSON.parse(json));
    } catch {
        return null;
    }
}

/**
 * Parse a JRD object (already parsed from JSON) into a WebFingerResponse.
 */
function parseJrdObject(obj: unknown): WebFingerResponse {
    const record = toRecordOrEmpty(obj);

    if (typeof record.subject !== 'string') {
        throw new Error('JRD document must have a "subject" string property');
    }

    const result: WebFingerResponse = {
        subject: record.subject,
    };

    if (Array.isArray(record.aliases)) {
        result.aliases = record.aliases.filter((a: unknown) => typeof a === 'string');
    }

    const properties = toStringOrNullMap(record.properties);
    if (properties) {
        result.properties = properties;
    }

    if (Array.isArray(record.links)) {
        result.links = (record.links as unknown[])
            .filter((linkObj) => linkObj !== null && typeof linkObj === 'object')
            .map(linkObj => parseJrdLink(linkObj as Record<string, unknown>));
    }

    return result;
}

/**
 * Parse a single JRD link object.
 */
function parseJrdLink(obj: Record<string, unknown>): WebFingerLink {
    // RFC 7033 §4.4.4.1: each link object MUST contain a rel member.
    const rel = typeof obj.rel === 'string' ? obj.rel.trim() : '';
    if (rel.length === 0) {
        throw new Error('JRD link object must include a non-empty "rel" string');
    }

    const link: WebFingerLink = {
        rel,
    };

    if (typeof obj.type === 'string') link.type = obj.type;
    if (typeof obj.href === 'string') link.href = obj.href;

    const titles = toStringMap(obj.titles);
    if (titles) {
        link.titles = titles;
    }

    const properties = toStringOrNullMap(obj.properties);
    if (properties) {
        link.properties = properties;
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
        issues.push('JRD should include a "subject" string (RFC 7033 §4.4.1)');
    }

    if (response.links) {
        for (let i = 0; i < response.links.length; i++) {
            const link = response.links[i];
            if (!link) {
                continue;
            }

            if (!link.rel || typeof link.rel !== 'string') {
                issues.push(`Link at index ${i} must include a non-empty "rel" string (RFC 7033 §4.4.4.1)`);
            }
        }
    }

    return issues;
}

/**
 * Match a resource query against a set of WebFinger resources.
 * RFC 7033 §4.3: resource parameter matching.
 *
 * @param query - The resource query string (e.g. "acct:user\@example.com")
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
