/**
 * Link header utilities per RFC 8288.
 * RFC 8288 §3, §3.1, §3.2, §3.3, §3.4, §6.2.2.
 * @see https://www.rfc-editor.org/rfc/rfc8288.html
 */

import type { LinkDefinition, PaginationLinks } from './types.js';
import { decodeExtValue } from './ext-value.js';
import {
    assertHeaderToken,
    assertNoCtl,
    isEmptyHeader,
    quoteString,
    quoteIfNeeded as quoteIfNeededImpl,
    unquote as unquoteImpl,
} from './header-utils.js';
import { createObjectMap } from './object-map.js';

/**
 * Standard link relation types (RFC 8288 Section 6.2.2 + common extensions)
 */
// RFC 8288 §6.2.2: Registered relation types.
// RFC 8594 §6: sunset link relation type.
// RFC 9745 §4: deprecation link relation type.
// RFC 9264 §6: linkset link relation type.
// RFC 9727 §7.2: api-catalog link relation type.
export const LinkRelation = {
    SELF: 'self',
    FIRST: 'first',
    LAST: 'last',
    NEXT: 'next',
    PREV: 'prev',
    PREVIOUS: 'previous',  // Alias for prev
    ALTERNATE: 'alternate',
    CANONICAL: 'canonical',
    AUTHOR: 'author',
    COLLECTION: 'collection',
    ITEM: 'item',
    EDIT: 'edit',
    EDIT_FORM: 'edit-form',
    CREATE_FORM: 'create-form',
    SEARCH: 'search',
    DESCRIBEDBY: 'describedby',
    SERVICE_DESC: 'service-desc',
    SERVICE_DOC: 'service-doc',
    SERVICE_META: 'service-meta',
    STATUS: 'status',
    SUNSET: 'sunset',            // RFC 8594 §6
    DEPRECATION: 'deprecation',  // RFC 9745 §4
    LINKSET: 'linkset',          // RFC 9264 §6
    API_CATALOG: 'api-catalog',  // RFC 9727 §7.2
} as const;

const ORDERED_LINK_PARAM_KEYS = ['type', 'title', 'media', 'anchor', 'rev'] as const;
const FORMAT_LINK_SKIP_KEYS = new Set<string>([
    'href',
    'rel',
    'titleLang',
    'hreflang',
    ...ORDERED_LINK_PARAM_KEYS,
]);
const SINGLE_USE_LINK_PARAMS = new Set(['rel', 'type', 'media', 'anchor']);

function assertLinkParamName(name: string): void {
    if (name.endsWith('*')) {
        const baseName = name.slice(0, -1);
        assertHeaderToken(baseName, `Link parameter name "${name}"`);
        return;
    }
    assertHeaderToken(name, `Link parameter name "${name}"`);
}

function createLinkAccumulator(): Partial<LinkDefinition> {
    return createObjectMap<string | string[] | undefined>() as Partial<LinkDefinition>;
}

function splitRelationTokens(value: string): string[] {
    const rels: string[] = [];
    let token = '';

    for (let i = 0; i < value.length; i++) {
        const char = value[i]!;
        if (char === ' ' || char === '\t' || char === '\r' || char === '\n' || char === '\f' || char === '\v') {
            if (token) {
                rels.push(token);
                token = '';
            }
            continue;
        }
        token += char;
    }

    if (token) {
        rels.push(token);
    }

    return rels;
}

function hasRelationWhitespace(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (
            code === 0x20
            || code === 0x09
            || code === 0x0d
            || code === 0x0a
            || code === 0x0c
            || code === 0x0b
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Quote a value if needed for Link header attribute.
 * Values containing special characters must be quoted.
 * 
 * @param value - The value to potentially quote
 * @returns Quoted value if needed
 */
// RFC 8288 §3.2: Link-param quoting rules.
export function quoteIfNeeded(value: string): string {
    return quoteIfNeededImpl(value);
}

/**
 * Unquote a quoted string value, handling escapes.
 * 
 * @param value - Potentially quoted value
 * @returns Unquoted value with escapes resolved
 */
// RFC 8288 §3.2: Link-param quoted-string unescaping.
export function unquote(value: string): string {
    return unquoteImpl(value);
}

/**
 * Format a single link as a Link header value segment.
 * 
 * Output format: <href>; rel="value"; [other params]
 * 
 * @param link - Link definition
 * @returns Formatted link string
 */
// RFC 8288 §3.1, §3.2, §3.3, §3.4: Link-value formatting and parameters.
export function formatLink(link: LinkDefinition): string {
    assertNoCtl(link.href, 'Link href');
    const rel = typeof link.rel === 'string' ? link.rel.trim() : '';
    if (rel.length === 0) {
        throw new Error(`Link parameter "rel" must be a non-empty string (received: ${String(link.rel)})`);
    }

    assertNoCtl(rel, 'Link rel');
    const parts: string[] = [`<${link.href}>`];

    // rel is always first and always quoted per convention
    parts.push(`rel="${rel}"`);

    // Add other parameters in a consistent order
    // Always quote values for consistency
    for (const key of ORDERED_LINK_PARAM_KEYS) {
        if (key in link && link[key] !== undefined) {
            const value = link[key];
            if (typeof value === 'string') {
                assertNoCtl(value, `Link parameter "${key}" value`);
                parts.push(`${key}=${quoteString(value)}`);
            }
        }
    }

    // RFC 8288 §3.4.1: hreflang may appear multiple times
    if (link.hreflang !== undefined) {
        const hreflangs = Array.isArray(link.hreflang) ? link.hreflang : [link.hreflang];
        for (const lang of hreflangs) {
            assertNoCtl(lang, 'Link hreflang value');
            parts.push(`hreflang=${quoteString(lang)}`);
        }
    }

    // Add any extension attributes (skip titleLang as it's metadata)
    for (const key in link) {
        if (!Object.prototype.hasOwnProperty.call(link, key)) {
            continue;
        }
        if (FORMAT_LINK_SKIP_KEYS.has(key)) {
            continue;
        }
        assertLinkParamName(key);
        const value = (link as Record<string, unknown>)[key];
        if (value !== undefined) {
            if (typeof value === 'string') {
                assertNoCtl(value, `Link extension parameter "${key}" value`);
                parts.push(`${key}=${quoteIfNeeded(value)}`);
            } else if (Array.isArray(value)) {
                // Multiple values for extension attribute
                for (const v of value) {
                    assertNoCtl(v, `Link extension parameter "${key}" value`);
                    parts.push(`${key}=${quoteIfNeeded(v)}`);
                }
            }
        }
    }

    return parts.join('; ');
}

/**
 * Format multiple links as a complete Link header value.
 * Links are comma-separated.
 * 
 * @param links - Array of link definitions
 * @returns Complete Link header value
 */
// RFC 8288 §3: Link header field-value formatting.
export function formatLinkHeader(links: LinkDefinition[]): string {
    let serialized = '';
    for (let index = 0; index < links.length; index++) {
        if (index > 0) {
            serialized += ', ';
        }
        serialized += formatLink(links[index]!);
    }
    return serialized;
}

/**
 * Build Link header from PaginationLinks (backward-compatible).
 * 
 * @param links - Pagination links object
 * @returns Link header value
 */
// RFC 8288 §3, §3.3: Link header with relation types.
export function buildLinkHeader(links: PaginationLinks): string {
    const definitions: LinkDefinition[] = [];

    definitions.push({ href: links.self, rel: 'self' });
    definitions.push({ href: links.first, rel: 'first' });

    if (links.prev) {
        definitions.push({ href: links.prev, rel: 'prev' });
    }

    if (links.next) {
        definitions.push({ href: links.next, rel: 'next' });
    }

    definitions.push({ href: links.last, rel: 'last' });

    return formatLinkHeader(definitions);
}

/**
 * Parser state machine states
 */
const enum State {
    BETWEEN_LINKS,
    IN_URI,
    IN_PARAMS,
    IN_PARAM_NAME,
    IN_PARAM_VALUE,
    IN_QUOTED_VALUE,
}

/**
 * Parse a Link header value into link definitions.
 * 
 * **CRITICAL IMPLEMENTATION NOTES**:
 * 
 * 1. Commas INSIDE quoted strings are NOT separators:
 *    `<url1>; title="Hello, World", <url2>; rel="next"`
 *    This is TWO links, not three.
 * 
 * 2. Escaped characters in quoted values:
 *    `title="Say \"Hello\""` becomes `title = Say "Hello"`
 *    `title="Back\\slash"` becomes `title = Back\slash`
 * 
 * 3. Multiple values for same attribute (e.g., hreflang):
 *    `<url>; rel="alternate"; hreflang="en"; hreflang="de"`
 *    This should work but is rare.
 * 
 * 4. Parameters without values:
 *    `<url>; rel="prefetch"; crossorigin`
 *    crossorigin is a boolean attribute.
 * 
 * 5. Whitespace around delimiters should be trimmed:
 *    `<url> ; rel = "next"` is valid
 * 
 * @param header - Link header value
 * @returns Array of parsed link definitions
 */
// RFC 8288 §3, §3.1, §3.2, §3.3: Link header parsing.
export function parseLinkHeader(header: string): LinkDefinition[] {
    if (isEmptyHeader(header)) {
        return [];
    }

    const results: LinkDefinition[] = [];
    let state: State = State.BETWEEN_LINKS;
    let currentLink: Partial<LinkDefinition> = createLinkAccumulator();
    let currentParamName = '';
    let currentParamValue = '';
    let currentUri = '';
    let escaped = false;

    const saveParam = () => {
        const name = currentParamName.trim().toLowerCase();
        const rawValue = currentParamValue.trim();
        if (!name) {
            currentParamName = '';
            currentParamValue = '';
            return;
        }

        // Unquote the value
        const value = rawValue.startsWith('"') ? unquote(rawValue) : (rawValue || '');

        // RFC 8288 §3.4.1: These params MUST NOT appear more than once (ignore duplicates)
        if (SINGLE_USE_LINK_PARAMS.has(name) && currentLink[name] !== undefined) {
            currentParamName = '';
            currentParamValue = '';
            return;
        }

        // RFC 8288 §3.4.1: title* takes precedence over title
        // title and title* also single-use, but title* wins
        if (name === 'title*') {
            if (currentLink['title*'] !== undefined) {
                // Ignore duplicate title*
                currentParamName = '';
                currentParamValue = '';
                return;
            }
            // Decode RFC 8187 ext-value
            const decoded = decodeExtValue(value);
            if (decoded) {
                currentLink.title = decoded.value;
                if (decoded.language !== undefined) {
                    currentLink.titleLang = decoded.language;
                }
                currentLink['title*'] = value; // Store raw for round-trip
            } else {
                // Decoding failed, store raw value
                currentLink['title*'] = value;
            }
            currentParamName = '';
            currentParamValue = '';
            return;
        }

        if (name === 'title') {
            // Only use title if title* hasn't been seen
            if (currentLink['title*'] !== undefined || currentLink.title !== undefined) {
                currentParamName = '';
                currentParamValue = '';
                return;
            }
            currentLink.title = value;
            currentParamName = '';
            currentParamValue = '';
            return;
        }

        // RFC 8288 §3.4.1: hreflang may appear multiple times
        if (name === 'hreflang') {
            const existing = currentLink.hreflang;
            if (existing === undefined) {
                currentLink.hreflang = value;
            } else if (Array.isArray(existing)) {
                existing.push(value);
            } else {
                currentLink.hreflang = [existing, value];
            }
            currentParamName = '';
            currentParamValue = '';
            return;
        }

        // RFC 8288 §3.3: rev is deprecated but should be parsed
        if (name === 'rev') {
            if (currentLink.rev === undefined) {
                currentLink.rev = value;
            }
            currentParamName = '';
            currentParamValue = '';
            return;
        }

        // RFC 8288 §3.4.2: Extension attributes with * suffix
        // Prefer the *-suffixed version when both are present
        if (name.endsWith('*')) {
            const baseName = name.slice(0, -1);
            const decoded = decodeExtValue(value);
            if (decoded) {
                // Store decoded value under base name
                currentLink[baseName] = decoded.value;
                currentLink[name] = value; // Store raw for reference
            } else {
                currentLink[name] = value;
            }
            currentParamName = '';
            currentParamValue = '';
            return;
        }

        // Regular parameter - only set if not already set by *-version
        const starName = `${name}*`;
        if (currentLink[starName] !== undefined) {
            // Skip, the *-version takes precedence
            currentParamName = '';
            currentParamValue = '';
            return;
        }

        if (currentLink[name] === undefined) {
            currentLink[name] = value;
        }

        currentParamName = '';
        currentParamValue = '';
    };

    const saveLink = () => {
        if (currentLink.href) {
            if (!currentLink.rel) {
                currentLink = createLinkAccumulator();
                currentUri = '';
                return;
            }

            if (!hasRelationWhitespace(currentLink.rel)) {
                results.push({
                    ...(currentLink as LinkDefinition),
                    rel: currentLink.rel,
                });
            } else {
                const rels = splitRelationTokens(currentLink.rel);

                for (const rel of rels) {
                    results.push({
                        ...(currentLink as LinkDefinition),
                        rel,
                    });
                }
            }
        }
        currentLink = createLinkAccumulator();
        currentUri = '';
    };

    for (let i = 0; i < header.length; i++) {
        const char = header[i];

        switch (state) {
            case State.BETWEEN_LINKS:
                if (char === '<') {
                    currentUri = '';
                    state = State.IN_URI;
                }
                // Ignore whitespace and commas between links
                break;

            case State.IN_URI:
                if (char === '>') {
                    currentLink.href = currentUri.trim();
                    state = State.IN_PARAMS;
                } else {
                    currentUri += char;
                }
                break;

            case State.IN_PARAMS:
                if (char === ';') {
                    // Save any pending parameter
                    saveParam();
                    state = State.IN_PARAM_NAME;
                } else if (char === ',') {
                    // End of this link
                    saveParam();
                    saveLink();
                    state = State.BETWEEN_LINKS;
                } else if (char === '"') {
                    // Starting a quoted value directly (shouldn't happen normally)
                    currentParamValue += char;
                    state = State.IN_QUOTED_VALUE;
                } else if (char !== ' ' && char !== '\t') {
                    // Some character that's part of a param name (unusual)
                    currentParamName += char;
                    state = State.IN_PARAM_NAME;
                }
                break;

            case State.IN_PARAM_NAME:
                if (char === '=') {
                    state = State.IN_PARAM_VALUE;
                } else if (char === ';') {
                    // Boolean parameter with no value
                    saveParam();
                    // Stay in IN_PARAM_NAME for next param
                } else if (char === ',') {
                    // End of link with boolean param
                    saveParam();
                    saveLink();
                    state = State.BETWEEN_LINKS;
                } else if (char !== ' ' && char !== '\t') {
                    currentParamName += char;
                }
                break;

            case State.IN_PARAM_VALUE:
                if (char === '"') {
                    currentParamValue += char;
                    state = State.IN_QUOTED_VALUE;
                } else if (char === ';') {
                    saveParam();
                    state = State.IN_PARAM_NAME;
                } else if (char === ',') {
                    saveParam();
                    saveLink();
                    state = State.BETWEEN_LINKS;
                } else if (char !== ' ' && char !== '\t' || currentParamValue.length > 0) {
                    // Only add non-whitespace, or whitespace if we've started the value
                    // But actually, we should trim, so skip leading whitespace
                    if (char !== ' ' && char !== '\t') {
                        currentParamValue += char;
                    } else if (currentParamValue.length > 0 && !currentParamValue.startsWith('"')) {
                        // For unquoted values, stop at whitespace
                        // This handles: rel = "next" where space before quote
                        // Don't add whitespace, just continue
                    }
                }
                break;

            case State.IN_QUOTED_VALUE:
                if (escaped) {
                    currentParamValue += char;
                    escaped = false;
                } else if (char === '\\') {
                    currentParamValue += char;
                    escaped = true;
                } else if (char === '"') {
                    currentParamValue += char;
                    // End of quoted value - go back to param processing
                    state = State.IN_PARAM_VALUE;
                } else {
                    currentParamValue += char;
                }
                break;
        }
    }

    // Handle end of string
    if (state === State.IN_PARAM_NAME || state === State.IN_PARAM_VALUE || state === State.IN_PARAMS) {
        saveParam();
        saveLink();
    } else if (state === State.IN_QUOTED_VALUE) {
        // Unclosed quote - save what we have anyway
        saveParam();
        saveLink();
    }

    return results;
}
