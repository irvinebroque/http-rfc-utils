/**
 * Strict-Transport-Security utilities per RFC 6797.
 * RFC 6797 §6.1, §6.1.1, §6.1.2, §8.1.
 * @see https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1
 */

import type { StrictTransportSecurityOptions } from './types.js';
import {
    TOKEN_CHARS,
    isEmptyHeader,
    parseDeltaSeconds,
    parseKeyValueSegment,
    parseQuotedStringStrict,
    splitQuotedValue,
} from './header-utils.js';

function parseDirectiveValue(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.startsWith('"')) {
        return parseQuotedStringStrict(trimmed);
    }

    if (!TOKEN_CHARS.test(trimmed)) {
        return null;
    }

    return trimmed;
}

/**
 * Parse Strict-Transport-Security header value.
 */
// RFC 6797 §6.1, §6.1.1, §6.1.2, §8.1: STS parsing and invalid header handling.
export function parseStrictTransportSecurity(header: string): StrictTransportSecurityOptions | null {
    if (isEmptyHeader(header)) {
        return null;
    }

    const directives = splitQuotedValue(header, ';');
    const seen = new Set<string>();
    let maxAge: number | null = null;
    let includeSubDomains = false;

    for (const directive of directives) {
        const parsedDirective = parseKeyValueSegment(directive);
        if (!parsedDirective) {
            continue;
        }

        const name = parsedDirective.key.trim();
        if (!name || !TOKEN_CHARS.test(name)) {
            return null;
        }

        const lowerName = name.toLowerCase();
        if (seen.has(lowerName)) {
            return null;
        }
        seen.add(lowerName);

        if (!parsedDirective.hasEquals) {
            if (lowerName === 'includesubdomains') {
                includeSubDomains = true;
            } else if (lowerName === 'max-age') {
                return null;
            }
            continue;
        }

        const rawValue = (parsedDirective.value ?? '').trim();
        // RFC 6797 §6.1.1: max-age-value is delta-seconds (1*DIGIT), not a quoted-string.
        if (lowerName === 'max-age' && rawValue.startsWith('"')) {
            return null;
        }
        const value = parseDirectiveValue(rawValue);
        if (value === null) {
            return null;
        }

        if (lowerName === 'max-age') {
            const parsed = parseDeltaSeconds(value, { mode: 'reject', requireSafeInteger: false });
            if (parsed === null) {
                return null;
            }
            maxAge = parsed;
        } else if (lowerName === 'includesubdomains') {
            return null;
        }
    }

    if (maxAge === null) {
        return null;
    }

    const parsed: StrictTransportSecurityOptions = { maxAge };
    if (includeSubDomains) {
        parsed.includeSubDomains = true;
    }

    return parsed;
}

/**
 * Format Strict-Transport-Security header value.
 */
// RFC 6797 §6.1: STS field-value formatting.
export function formatStrictTransportSecurity(options: StrictTransportSecurityOptions): string {
    const maxAge = Math.max(0, Math.floor(options.maxAge));
    const parts = [`max-age=${maxAge}`];
    if (options.includeSubDomains) {
        parts.push('includeSubDomains');
    }
    return parts.join('; ');
}
