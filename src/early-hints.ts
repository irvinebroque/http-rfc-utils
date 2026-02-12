/**
 * Early Hints (103) Link helpers per RFC 8297.
 * RFC 8297 Section 2.
 * @see https://www.rfc-editor.org/rfc/rfc8297.html#section-2
 */

import type { LinkDefinition } from './types.js';
import { assertHeaderToken, assertNoCtl, isEmptyHeader } from './header-utils.js';
import { formatLinkHeader, parseLinkHeader } from './link.js';

export const EARLY_HINTS_STATUS = 103;

const SKIP_VALIDATION_KEYS = new Set(['href', 'rel', 'titleLang']);
const DEDUPE_SKIP_KEYS = new Set(['href', 'rel']);

interface EarlyHintsValidationOptions {
    preloadOnly?: boolean;
}

interface ExtractPreloadLinksOptions {
    strict?: boolean;
}

function assertLinkParamName(name: string): void {
    if (name.endsWith('*')) {
        const baseName = name.slice(0, -1);
        assertHeaderToken(baseName, `Link parameter name "${name}"`);
        return;
    }

    assertHeaderToken(name, `Link parameter name "${name}"`);
}

function hasPreloadRelation(rel: string): boolean {
    const tokens = rel
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    for (const token of tokens) {
        if (token.toLowerCase() === 'preload') {
            return true;
        }
    }

    return false;
}

function cloneLink(link: LinkDefinition): LinkDefinition {
    const clone: LinkDefinition = {
        href: link.href,
        rel: link.rel,
    };

    for (const [key, value] of Object.entries(link)) {
        if (value === undefined || key === 'href' || key === 'rel') {
            continue;
        }

        clone[key] = Array.isArray(value) ? [...value] : value;
    }

    return clone;
}

function normalizeRelation(rel: string): string {
    const tokens = rel
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => token.toLowerCase());

    const unique = new Set(tokens);
    return [...unique].sort((left, right) => left.localeCompare(right)).join(' ');
}

function splitLinkFieldMembers(value: string): string[] | null {
    const members: string[] = [];
    let current = '';
    let inUri = false;
    let inQuotedValue = false;
    let escaped = false;

    for (const char of value) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (inQuotedValue) {
            current += char;
            if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inQuotedValue = false;
            }
            continue;
        }

        if (char === '"') {
            current += char;
            inQuotedValue = true;
            continue;
        }

        if (inUri) {
            current += char;
            if (char === '>') {
                inUri = false;
            }
            continue;
        }

        if (char === '<') {
            current += char;
            inUri = true;
            continue;
        }

        if (char === ',') {
            const member = current.trim();
            if (!member) {
                return null;
            }
            members.push(member);
            current = '';
            continue;
        }

        current += char;
    }

    if (escaped || inQuotedValue || inUri) {
        return null;
    }

    const lastMember = current.trim();
    if (!lastMember) {
        return null;
    }

    members.push(lastMember);
    return members;
}

function dedupeValue(value: string | string[]): string {
    return Array.isArray(value) ? value.join('\u001F') : value;
}

function createDedupeKey(link: LinkDefinition): string {
    const parts: string[] = [
        `href:${link.href}`,
        `rel:${normalizeRelation(link.rel)}`,
    ];

    const extensionParts: string[] = [];
    for (const [key, value] of Object.entries(link)) {
        if (value === undefined || DEDUPE_SKIP_KEYS.has(key)) {
            continue;
        }

        extensionParts.push(`${key.toLowerCase()}:${dedupeValue(value)}`);
    }

    extensionParts.sort((left, right) => left.localeCompare(right));
    parts.push(...extensionParts);

    return parts.join('\u001E');
}

/**
 * Parse one or more Link field values carried in 103 Early Hints responses.
 */
// RFC 8297 Section 2: Early Hints carries Link field values before final response.
export function parseEarlyHintsLinks(value: string | string[] | null | undefined): LinkDefinition[] {
    if (value == null) {
        return [];
    }

    const values = Array.isArray(value) ? value : [value];
    const links: LinkDefinition[] = [];

    for (const fieldValue of values) {
        if (isEmptyHeader(fieldValue)) {
            continue;
        }

        const members = splitLinkFieldMembers(fieldValue);
        if (members === null) {
            return [];
        }

        for (const member of members) {
            if (!member.startsWith('<')) {
                return [];
            }

            const parsedMember = parseLinkHeader(member);
            if (parsedMember.length === 0) {
                return [];
            }

            links.push(...parsedMember);
        }
    }

    return links;
}

/**
 * Validate Early Hints Link definitions.
 */
// RFC 8297 Section 2 + RFC 8288 Section 3: Link values in 103 follow Link field syntax.
export function validateEarlyHintsLinks(
    links: readonly LinkDefinition[],
    options: EarlyHintsValidationOptions = {}
): void {
    if (!Array.isArray(links)) {
        throw new Error('Early Hints links must be an array');
    }

    for (const [index, link] of links.entries()) {
        if (typeof link !== 'object' || link === null) {
            throw new Error(`Early Hints link at index ${index} must be an object`);
        }

        if (typeof link.href !== 'string' || !link.href.trim()) {
            throw new Error(`Early Hints link at index ${index} must include a non-empty href`);
        }

        if (typeof link.rel !== 'string' || !link.rel.trim()) {
            throw new Error(`Early Hints link at index ${index} must include a non-empty rel`);
        }

        assertNoCtl(link.href, `Early Hints link href at index ${index}`);
        assertNoCtl(link.rel, `Early Hints link rel at index ${index}`);

        if (options.preloadOnly === true && !hasPreloadRelation(link.rel)) {
            throw new Error(`Early Hints link at index ${index} must include rel=preload`);
        }

        for (const [key, value] of Object.entries(link)) {
            if (value === undefined || SKIP_VALIDATION_KEYS.has(key)) {
                continue;
            }

            assertLinkParamName(key);

            if (Array.isArray(value)) {
                for (const entry of value) {
                    if (typeof entry !== 'string') {
                        throw new Error(`Early Hints link parameter "${key}" at index ${index} must contain string values`);
                    }
                    assertNoCtl(entry, `Early Hints link parameter "${key}" at index ${index}`);
                }
                continue;
            }

            if (typeof value !== 'string') {
                throw new Error(`Early Hints link parameter "${key}" at index ${index} must be a string or string[]`);
            }

            assertNoCtl(value, `Early Hints link parameter "${key}" at index ${index}`);
        }
    }
}

/**
 * Format Link values for use in a 103 Early Hints response.
 */
// RFC 8297 Section 2: use Link field values in 103; semantic-invalid input throws.
export function formatEarlyHintsLinks(
    links: readonly LinkDefinition[],
    options: EarlyHintsValidationOptions = {}
): string {
    if (links.length === 0) {
        throw new Error('Early Hints links must contain at least one entry');
    }

    validateEarlyHintsLinks(links, options);
    return formatLinkHeader([...links]);
}

/**
 * Extract preload links from a parsed Early Hints link set.
 */
// RFC 8297 Section 2: commonly used for rel=preload optimization hints.
export function extractPreloadLinks(
    links: readonly LinkDefinition[],
    options: ExtractPreloadLinksOptions = {}
): LinkDefinition[] {
    if (options.strict === true) {
        validateEarlyHintsLinks(links, { preloadOnly: true });
    }

    const preloads: LinkDefinition[] = [];
    for (const link of links) {
        if (typeof link.href !== 'string' || typeof link.rel !== 'string') {
            continue;
        }

        if (hasPreloadRelation(link.rel)) {
            preloads.push(cloneLink(link));
        }
    }

    return preloads;
}

/**
 * Merge one or more Early Hints link batches.
 */
// RFC 8297 Section 2: multiple 103 responses can be sent before final response.
export function mergeEarlyHintsLinks(...batches: Array<readonly LinkDefinition[] | null | undefined>): LinkDefinition[] {
    const merged: LinkDefinition[] = [];
    const seen = new Set<string>();

    for (const batch of batches) {
        if (!batch || batch.length === 0) {
            continue;
        }

        validateEarlyHintsLinks(batch);

        for (const link of batch) {
            const key = createDedupeKey(link);
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            merged.push(cloneLink(link));
        }
    }

    return merged;
}
