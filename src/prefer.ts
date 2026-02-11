/**
 * Prefer / Preference-Applied utilities per RFC 7240.
 * RFC 7240 §2, §3.
 * @see https://www.rfc-editor.org/rfc/rfc7240.html
 */

import type { PreferMap, PreferToken, PreferParam } from './types.js';
import {
    TOKEN_CHARS,
    assertHeaderToken,
    assertNoCtl,
    isEmptyHeader,
    parseQuotedStringStrict,
    quoteIfNeeded,
} from './header-utils.js';
import {
    parseParameterizedMember,
    parseParameterizedMembers,
} from './internal-parameterized-members.js';

const DISALLOWED_CTL_REGEX = /[\u0000-\u0008\u000A-\u001F\u007F]/;

interface ParsePreferWordOptions {
    preserveQuotedEmpty?: boolean;
}

function parsePreferWord(raw: string, options?: ParsePreferWordOptions): string | undefined | null {
    const trimmed = raw.trim();
    if (trimmed === '') {
        // Preserve existing semantics for empty value equivalence.
        return undefined;
    }

    if (trimmed.startsWith('"')) {
        const parsedQuoted = parseQuotedStringStrict(trimmed);
        if (parsedQuoted === null) {
            return null;
        }
        if (DISALLOWED_CTL_REGEX.test(parsedQuoted)) {
            return null;
        }
        if (parsedQuoted === '') {
            return options?.preserveQuotedEmpty ? '' : undefined;
        }
        return parsedQuoted;
    }

    if (!TOKEN_CHARS.test(trimmed)) {
        return null;
    }

    return trimmed;
}

/**
 * Parse a Prefer header into a map of preference tokens.
 */
// RFC 7240 §2: Prefer header parsing.
export function parsePrefer(header: string): PreferMap {
    const map: PreferMap = new Map();

    if (isEmptyHeader(header)) {
        return map;
    }

    const members = parseParameterizedMembers(header, {
        memberDelimiter: ',',
        parameterDelimiter: ';',
        hasBaseSegment: true,
    });
    for (const member of members) {
        if (!member.base) {
            continue;
        }

        const tokenPart = member.base;
        const paramParts = member.parameters;

        // RFC 7240 §2: Token names are case-insensitive.
        const token = tokenPart.key.trim().toLowerCase();
        if (!token || !TOKEN_CHARS.test(token)) continue;

        const value = tokenPart.hasEquals ? parsePreferWord(tokenPart.value ?? '') : undefined;
        if (value === null) {
            continue;
        }

        const params: PreferParam[] = [];
        let invalidMember = false;

        for (const paramPart of paramParts) {
            const key = paramPart.key.trim().toLowerCase();
            if (!key || !TOKEN_CHARS.test(key)) {
                invalidMember = true;
                break;
            }

            if (!paramPart.hasEquals) {
                params.push({ key });
            } else {
                const valueOrNull = parsePreferWord(paramPart.value ?? '');
                if (valueOrNull === null) {
                    invalidMember = true;
                    break;
                }

                // RFC 7240 §2: Empty values are equivalent to no value.
                if (valueOrNull === undefined) {
                    params.push({ key });
                } else {
                    params.push({ key, value: valueOrNull });
                }
            }
        }

        if (invalidMember) {
            continue;
        }

        if (!map.has(token)) {
            const parsedToken: PreferToken = { token, params };
            if (value !== undefined) {
                parsedToken.value = value;
            }
            map.set(token, parsedToken);
        }
    }

    return map;
}

/**
 * Format Prefer header from tokens.
 */
// RFC 7240 §2: Prefer header formatting.
export function formatPrefer(preferences: PreferMap | PreferToken[]): string {
    const tokens = Array.isArray(preferences) ? preferences : Array.from(preferences.values());
    return tokens.map(token => {
        assertHeaderToken(token.token, `Prefer token "${token.token}"`);
        const parts: string[] = [];
        const base = token.value !== undefined ? `${token.token}=${quoteIfNeeded(token.value)}` : token.token;
        parts.push(base);

        for (const param of token.params ?? []) {
            assertHeaderToken(param.key, `Prefer parameter key "${param.key}"`);
            if (param.value === undefined) {
                parts.push(param.key);
            } else {
                assertNoCtl(param.value, `Prefer parameter "${param.key}" value`);
                parts.push(`${param.key}=${quoteIfNeeded(param.value)}`);
            }
        }

        return parts.join('; ');
    }).join(', ');
}

/**
 * Format Preference-Applied header.
 */
// RFC 7240 §3: Preference-Applied header formatting.
export function formatPreferenceApplied(preferences: PreferMap | string[]): string {
    if (Array.isArray(preferences)) {
        const validated: string[] = [];

        for (const preference of preferences) {
            assertNoCtl(preference, 'Preference-Applied value');

            const raw = preference.trim();
            if (!raw) {
                throw new Error('Preference-Applied value must not be empty');
            }

            const parsed = parseParameterizedMember(raw, {
                parameterDelimiter: ';',
                hasBaseSegment: true,
            });
            const tokenSegment = parsed.base;
            if (!tokenSegment || parsed.parameters.length !== 0) {
                throw new Error('Preference-Applied value must not include parameters');
            }

            const token = tokenSegment.key.trim();
            assertHeaderToken(token, `Preference-Applied token "${token}"`);

            if (!tokenSegment.hasEquals) {
                validated.push(token);
                continue;
            }

            const valueRaw = tokenSegment.value ?? '';

            if (valueRaw === '') {
                throw new Error(`Preference-Applied value "${raw}" must use token[=word] syntax`);
            }

            const value = parsePreferWord(valueRaw, { preserveQuotedEmpty: true });
            if (value === null || value === undefined) {
                throw new Error(`Preference-Applied value "${raw}" must use token[=word] syntax`);
            }

            validated.push(`${token}=${quoteIfNeeded(value)}`);
        }

        return validated.join(', ');
    }

    const tokens = Array.from(preferences.values());
    return tokens.map(token => {
        assertHeaderToken(token.token, `Preference-Applied token "${token.token}"`);
        if (token.value !== undefined) {
            return `${token.token}=${quoteIfNeeded(token.value)}`;
        }
        return token.token;
    }).join(', ');
}
