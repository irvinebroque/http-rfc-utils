/**
 * Clear-Site-Data header utilities.
 * W3C Clear Site Data Section 3.1, Section 4.1.
 * @see https://www.w3.org/TR/clear-site-data/
 */

import {
    isEmptyHeader,
    parseQuotedStringStrict,
    quoteString,
    splitQuotedValue,
} from './header-utils.js';
import type { ClearSiteDataDirective, ClearSiteDataType } from './types.js';

const CLEAR_SITE_DATA_TYPES: readonly ClearSiteDataType[] = [
    'cache',
    'cookies',
    'storage',
    'executionContexts',
];

const CLEAR_SITE_DATA_TYPE_SET = new Set<ClearSiteDataType>(CLEAR_SITE_DATA_TYPES);
const CLEAR_SITE_DATA_DIRECTIVE_SET = new Set<ClearSiteDataDirective>([
    ...CLEAR_SITE_DATA_TYPES,
    '*',
]);

function appendDirectiveValue(types: ClearSiteDataType[], directive: string): void {
    if (directive === '*') {
        types.push(...CLEAR_SITE_DATA_TYPES);
        return;
    }

    if (CLEAR_SITE_DATA_TYPE_SET.has(directive as ClearSiteDataType)) {
        types.push(directive as ClearSiteDataType);
    }
}

/**
 * Parse Clear-Site-Data header values into known data-clearing types.
 */
// W3C Clear Site Data Section 3.1 + Section 4.1: quoted-string list parsing with unknown-type ignore behavior.
export function parseClearSiteData(value: string | string[] | null | undefined): ClearSiteDataType[] {
    if (value == null) {
        return [];
    }

    const values = Array.isArray(value) ? value : [value];
    const types: ClearSiteDataType[] = [];

    for (const headerValue of values) {
        if (isEmptyHeader(headerValue)) {
            return [];
        }

        const members = splitQuotedValue(headerValue, ',');
        for (const member of members) {
            const trimmed = member.trim();
            if (!trimmed) {
                return [];
            }

            const directive = parseQuotedStringStrict(trimmed);
            if (directive === null) {
                return [];
            }

            appendDirectiveValue(types, directive);
        }
    }

    return types;
}

/**
 * Validate Clear-Site-Data directives for strict formatting/use.
 */
export function validateClearSiteData(directives: readonly string[]): ClearSiteDataType[] {
    if (!Array.isArray(directives)) {
        throw new Error('Clear-Site-Data directives must be an array');
    }

    if (directives.length === 0) {
        throw new Error('Clear-Site-Data directives must contain at least one value');
    }

    const validated: ClearSiteDataType[] = [];

    for (const [index, directive] of directives.entries()) {
        if (typeof directive !== 'string') {
            throw new Error(`Clear-Site-Data directive at index ${index} must be a string`);
        }

        const trimmed = directive.trim();
        if (!trimmed) {
            throw new Error(`Clear-Site-Data directive at index ${index} must be non-empty`);
        }

        if (!CLEAR_SITE_DATA_DIRECTIVE_SET.has(trimmed as ClearSiteDataDirective)) {
            throw new Error(`Unknown Clear-Site-Data directive: ${directive}`);
        }

        appendDirectiveValue(validated, trimmed);
    }

    if (validated.length === 0) {
        throw new Error('Clear-Site-Data directives must contain at least one known value');
    }

    return validated;
}

/**
 * Format a strict Clear-Site-Data header field-value.
 */
// W3C Clear Site Data Section 3.1: emit a comma-separated quoted-string list.
export function formatClearSiteData(directives: readonly string[]): string {
    const validated = validateClearSiteData(directives);
    return validated.map((directive) => quoteString(directive)).join(', ');
}
