/**
 * Linkset utilities per RFC 9264.
 * API catalog support per RFC 9727.
 * RFC 9264 §4.1, §4.2, §5, §6.
 * RFC 9727 §§2-4, §7.
 * @see https://www.rfc-editor.org/rfc/rfc9264.html
 * @see https://www.rfc-editor.org/rfc/rfc9727.html
 */

import type {
    LinkDefinition,
    Linkset,
    LinksetContext,
    LinksetTarget,
    LinksetJsonOptions,
    InternationalizedValue,
    ApiCatalog,
    ApiCatalogOptions,
    ApiCatalogLink,
    ApiCatalogApi,
} from './types.js';
import { parseLinkHeader, formatLink } from './link.js';

// RFC 9264 §4.2: Linkset JSON media type.
export const LINKSET_MEDIA_TYPE = 'application/linkset+json';

// RFC 9727 §7.3: API catalog profile URI.
export const API_CATALOG_PROFILE = 'https://www.rfc-editor.org/info/rfc9727';

// RFC 9727 §2: Well-known URI path for API catalog.
export const API_CATALOG_PATH = '/.well-known/api-catalog';

/**
 * Parse an application/linkset document into link definitions.
 * RFC 9264 §4.1: Same as HTTP Link header format but allows newlines as separators.
 *
 * @param document - The linkset document content
 * @returns Array of parsed link definitions, or null if parsing fails
 */
// RFC 9264 §4.1: application/linkset uses RFC 8288 Link format with newlines allowed.
export function parseLinkset(document: string): LinkDefinition[] | null {
    if (!document || document.trim() === '') {
        return [];
    }

    // RFC 9264 §4.1: Newlines are valid separators in addition to commas.
    // Normalize CR/LF to LF, then replace newlines outside quotes with commas.
    const normalized = normalizeNewlines(document);

    return parseLinkHeader(normalized);
}

/**
 * Normalize newlines in linkset format for parsing.
 * RFC 9264 §4.1: Newlines allowed as separators between link-values.
 *
 * Handles two patterns:
 * 1. Continuation lines: newline + whitespace + `;` - these continue parameters
 * 2. Link separators: newline followed by `<` or end of document
 */
function normalizeNewlines(document: string): string {
    // Replace CR/LF with LF
    let result = document.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // RFC 9264 §4.1: Newlines with continuation (whitespace + ;) should become spaces
    // This handles the indented parameter continuation pattern from RFC examples
    result = result.replace(/\n[ \t]+;/g, ' ;');

    // Track quote state for remaining newline handling
    let inQuote = false;
    let escaped = false;
    let output = '';

    for (let i = 0; i < result.length; i++) {
        const char = result[i];

        if (escaped) {
            output += char;
            escaped = false;
            continue;
        }

        if (char === '\\') {
            output += char;
            escaped = true;
            continue;
        }

        if (char === '"') {
            inQuote = !inQuote;
            output += char;
            continue;
        }

        if (char === '\n' && !inQuote) {
            // RFC 9264 §4.1: Newlines between links act as separators
            // Look ahead to determine if this is a link separator
            let j = i + 1;
            while (j < result.length && (result[j] === ' ' || result[j] === '\t')) {
                j++;
            }
            const nextNonWs = result[j];

            // If next non-whitespace is '<', this newline separates links
            if (nextNonWs === '<') {
                const trimmed = output.trimEnd();
                if (trimmed.length > 0 && !trimmed.endsWith(',')) {
                    output = trimmed + ', ';
                } else {
                    output = trimmed + ' ';
                }
            } else {
                // Otherwise treat as continuation (just whitespace)
                output += ' ';
            }
            continue;
        }

        output += char;
    }

    return output;
}

/**
 * Parse an application/linkset+json document.
 * RFC 9264 §4.2: JSON format for link sets.
 *
 * @param json - The JSON string or object
 * @returns Parsed Linkset object, or null if invalid
 */
// RFC 9264 §4.2: application/linkset+json parsing.
export function parseLinksetJson(json: string | object): Linkset | null {
    let obj: unknown;

    if (typeof json === 'string') {
        try {
            obj = JSON.parse(json);
        } catch {
            return null;
        }
    } else {
        obj = json;
    }

    if (!isValidLinkset(obj)) {
        return null;
    }

    return obj;
}

/**
 * Format link definitions as an application/linkset document.
 * RFC 9264 §4.1: Uses Link header format with newlines for readability.
 *
 * @param links - Array of link definitions
 * @returns Formatted linkset document
 */
// RFC 9264 §4.1: application/linkset formatting with newline separators.
export function formatLinkset(links: LinkDefinition[]): string {
    if (links.length === 0) {
        return '';
    }

    // Format each link and join with newlines for readability
    return links.map(formatLink).join(',\n');
}

/**
 * Format link definitions as an application/linkset+json object.
 * RFC 9264 §4.2: JSON format for link sets.
 *
 * @param links - Array of link definitions
 * @param options - Formatting options
 * @returns Linkset JSON object
 */
// RFC 9264 §4.2: application/linkset+json formatting.
export function formatLinksetJson(
    links: LinkDefinition[],
    options: LinksetJsonOptions = {}
): Linkset {
    const { groupByAnchor = true } = options;

    if (!groupByAnchor) {
        // Each link gets its own context object
        const contexts: LinksetContext[] = links.map((link) => {
            const target = linkDefinitionToTarget(link);
            const context: LinksetContext = {};

            if (link.anchor) {
                context.anchor = link.anchor;
            }

            context[link.rel] = [target];
            return context;
        });

        return { linkset: contexts };
    }

    // Group by anchor
    const byAnchor = new Map<string, Map<string, LinksetTarget[]>>();

    for (const link of links) {
        const anchor = link.anchor ?? '';
        if (!byAnchor.has(anchor)) {
            byAnchor.set(anchor, new Map());
        }

        const relMap = byAnchor.get(anchor)!;
        if (!relMap.has(link.rel)) {
            relMap.set(link.rel, []);
        }

        relMap.get(link.rel)!.push(linkDefinitionToTarget(link));
    }

    const contexts: LinksetContext[] = [];

    for (const [anchor, relMap] of byAnchor) {
        const context: LinksetContext = {};

        if (anchor) {
            context.anchor = anchor;
        }

        for (const [rel, targets] of relMap) {
            context[rel] = targets;
        }

        contexts.push(context);
    }

    return { linkset: contexts };
}

/**
 * Convert a LinkDefinition to a LinksetTarget.
 */
function linkDefinitionToTarget(link: LinkDefinition): LinksetTarget {
    const target: LinksetTarget = { href: link.href };

    if (link.type) {
        target.type = link.type;
    }

    if (link.title) {
        target.title = link.title;
    }

    // RFC 9264 §4.2.4.2: title* with language
    if (link.titleLang && link.title) {
        target['title*'] = [{ value: link.title, language: link.titleLang }];
    }

    if (link.hreflang) {
        // RFC 9264 §4.2.4.1: hreflang is always an array
        target.hreflang = Array.isArray(link.hreflang) ? link.hreflang : [link.hreflang];
    }

    if (link.media) {
        target.media = link.media;
    }

    // Copy extension attributes
    const standardKeys = new Set(['href', 'rel', 'type', 'title', 'titleLang', 'hreflang', 'media', 'anchor', 'rev']);
    for (const [key, value] of Object.entries(link)) {
        if (!standardKeys.has(key) && value !== undefined) {
            // RFC 9264 §4.2.4.3: Extension attributes are always arrays
            target[key] = Array.isArray(value) ? value : [value];
        }
    }

    return target;
}

/**
 * Convert an application/linkset document to JSON format.
 * RFC 9264 §4.1, §4.2: Format conversion.
 *
 * @param document - The linkset document
 * @returns Linkset JSON object, or null if parsing fails
 */
// RFC 9264 §4.1, §4.2: Convert between formats.
export function linksetToJson(document: string): Linkset | null {
    const links = parseLinkset(document);
    if (links === null) {
        return null;
    }

    return formatLinksetJson(links);
}

/**
 * Convert a JSON linkset to application/linkset format.
 * RFC 9264 §4.1, §4.2: Format conversion.
 *
 * @param linkset - The Linkset object
 * @returns Formatted linkset document
 */
// RFC 9264 §4.1, §4.2: Convert between formats.
export function jsonToLinkset(linkset: Linkset): string {
    const links = linksetJsonToDefinitions(linkset);
    return formatLinkset(links);
}

/**
 * Convert a Linkset JSON object to LinkDefinition array.
 */
function linksetJsonToDefinitions(linkset: Linkset): LinkDefinition[] {
    const links: LinkDefinition[] = [];

    for (const context of linkset.linkset) {
        const anchor = context.anchor;

        for (const [key, value] of Object.entries(context)) {
            if (key === 'anchor') {
                continue;
            }

            // key is a relation type, value is an array of targets
            if (!Array.isArray(value)) {
                continue;
            }

            const targets = value as LinksetTarget[];
            for (const target of targets) {
                const link: LinkDefinition = {
                    href: target.href,
                    rel: key,
                };

                if (anchor) {
                    link.anchor = anchor;
                }

                if (target.type) {
                    link.type = target.type;
                }

                if (target.title) {
                    link.title = target.title;
                }

                // RFC 9264 §4.2.4.2: title* with language
                if (target['title*'] && target['title*'].length > 0) {
                    const titleStar = target['title*'][0];
                    link.title = titleStar.value;
                    if (titleStar.language) {
                        link.titleLang = titleStar.language;
                    }
                }

                if (target.hreflang) {
                    // Flatten to single value if only one, otherwise keep array
                    link.hreflang = target.hreflang.length === 1 ? target.hreflang[0] : target.hreflang;
                }

                if (target.media) {
                    link.media = target.media;
                }

                // Copy extension attributes
                const standardKeys = new Set(['href', 'type', 'title', 'title*', 'hreflang', 'media']);
                for (const [attrKey, attrValue] of Object.entries(target)) {
                    if (!standardKeys.has(attrKey) && attrValue !== undefined) {
                        // Flatten single-element arrays
                        if (Array.isArray(attrValue) && attrValue.length === 1) {
                            const first = attrValue[0];
                            if (typeof first === 'string') {
                                link[attrKey] = first;
                            } else if (typeof first === 'object' && 'value' in first) {
                                // Internationalized value
                                link[attrKey] = (first as InternationalizedValue).value;
                            }
                        } else if (Array.isArray(attrValue)) {
                            // Keep as array for multi-value extensions
                            link[attrKey] = attrValue.map((v) =>
                                typeof v === 'object' && 'value' in v ? (v as InternationalizedValue).value : v
                            ) as string[];
                        }
                    }
                }

                links.push(link);
            }
        }
    }

    return links;
}

/**
 * Type guard to validate a Linkset object.
 * RFC 9264 §4.2.1: linkset must be the sole top-level member.
 *
 * @param obj - Object to validate
 * @returns True if valid Linkset
 */
// RFC 9264 §4.2.1: Validate linkset structure.
export function isValidLinkset(obj: unknown): obj is Linkset {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const record = obj as Record<string, unknown>;

    // RFC 9264 §4.2.1: linkset MUST be the sole member (profile is allowed for api-catalog)
    const keys = Object.keys(record);
    if (!keys.includes('linkset')) {
        return false;
    }

    // Allow 'profile' as additional key for API catalogs
    for (const key of keys) {
        if (key !== 'linkset' && key !== 'profile') {
            return false;
        }
    }

    if (!Array.isArray(record.linkset)) {
        return false;
    }

    // Validate each context object
    for (const context of record.linkset) {
        if (typeof context !== 'object' || context === null) {
            return false;
        }

        // Validate each relation type's targets
        for (const [key, value] of Object.entries(context as Record<string, unknown>)) {
            if (key === 'anchor') {
                if (typeof value !== 'string') {
                    return false;
                }
                continue;
            }

            // Value must be an array of target objects
            if (!Array.isArray(value)) {
                return false;
            }

            for (const target of value) {
                if (typeof target !== 'object' || target === null) {
                    return false;
                }

                // RFC 9264 §4.2.3: href is required
                if (!('href' in target) || typeof (target as Record<string, unknown>).href !== 'string') {
                    return false;
                }
            }
        }
    }

    return true;
}

// =============================================================================
// API Catalog (RFC 9727)
// =============================================================================

/**
 * Create an API catalog document.
 * RFC 9727 §4: API catalog document structure.
 *
 * @param options - API catalog configuration
 * @returns API catalog Linkset document
 */
// RFC 9727 §4.1, §4.2: Create API catalog with required structure.
export function createApiCatalog(options: ApiCatalogOptions): ApiCatalog {
    const { anchor, apis = [], items = [], nested = [], profile = true } = options;

    if (!anchor) {
        throw new Error('API catalog requires an anchor URI');
    }

    const contexts: LinksetContext[] = [];

    // RFC 9727 §4.1: Include hyperlinks to API endpoints
    if (items.length > 0 || nested.length > 0) {
        // Create a context for simple item links and nested catalogs
        const mainContext: LinksetContext = { anchor };

        // RFC 9727 §3.1: "item" relation identifies API members
        if (items.length > 0) {
            mainContext.item = items.map((item) => {
                const target: LinksetTarget = { href: item.href };
                if (item.type) target.type = item.type;
                if (item.title) target.title = item.title;
                if (item.hreflang) target.hreflang = [item.hreflang];
                return target;
            });
        }

        // RFC 9727 §4.3: Nested api-catalog links
        if (nested.length > 0) {
            mainContext['api-catalog'] = nested.map((href) => ({ href }));
        }

        contexts.push(mainContext);
    }

    // RFC 9727 Appendix A.1: Full API entries with service relations
    for (const api of apis) {
        const apiContext: LinksetContext = { anchor: api.anchor };

        if (api['service-desc']) {
            apiContext['service-desc'] = api['service-desc'];
        }

        if (api['service-doc']) {
            apiContext['service-doc'] = api['service-doc'];
        }

        if (api['service-meta']) {
            apiContext['service-meta'] = api['service-meta'];
        }

        if (api.status) {
            apiContext.status = api.status;
        }

        contexts.push(apiContext);
    }

    const catalog: ApiCatalog = { linkset: contexts };

    // RFC 9727 §4.2: SHOULD include profile parameter
    if (profile) {
        catalog.profile = API_CATALOG_PROFILE;
    }

    return catalog;
}

/**
 * Parse an API catalog document.
 * RFC 9727 §4: Validate and parse API catalog structure.
 *
 * @param json - JSON string or object
 * @returns Parsed API catalog, or null if invalid
 */
// RFC 9727 §4: Parse and validate API catalog.
export function parseApiCatalog(json: string | object): ApiCatalog | null {
    const linkset = parseLinksetJson(json);
    if (!linkset) {
        return null;
    }

    // Add profile if present in the input
    const input = typeof json === 'string' ? JSON.parse(json) : json;
    if (input && typeof input === 'object' && 'profile' in input) {
        return { ...linkset, profile: (input as { profile: string }).profile };
    }

    return linkset as ApiCatalog;
}

/**
 * Check if a Linkset is an API catalog (has the RFC 9727 profile).
 * RFC 9727 §4.2, §7.3: Profile URI indicates api-catalog semantics.
 *
 * @param linkset - Linkset to check
 * @returns True if the linkset has the api-catalog profile
 */
// RFC 9727 §7.3: Check for API catalog profile.
export function isApiCatalog(linkset: Linkset | ApiCatalog): boolean {
    if ('profile' in linkset) {
        return (linkset as ApiCatalog).profile === API_CATALOG_PROFILE;
    }
    return false;
}

/**
 * Convert a Linkset to an array of LinkDefinitions.
 * Useful for converting API catalog entries to Link header format.
 *
 * @param linkset - Linkset to convert
 * @returns Array of LinkDefinition objects
 */
// RFC 9264 §4: Convert between linkset and link definitions.
export function linksetToLinks(linkset: Linkset): LinkDefinition[] {
    return linksetJsonToDefinitions(linkset);
}

/**
 * Convert an array of LinkDefinitions to a Linkset.
 * Useful for creating API catalogs from Link header entries.
 *
 * @param links - Array of link definitions
 * @param anchor - Default anchor URI for links without one
 * @returns Linkset object
 */
// RFC 9264 §4: Convert between link definitions and linkset.
export function linksToLinkset(links: LinkDefinition[], anchor?: string): Linkset {
    // Set anchor on links that don't have one
    const linksWithAnchor = links.map((link) => ({
        ...link,
        anchor: link.anchor ?? anchor,
    }));

    return formatLinksetJson(linksWithAnchor);
}
