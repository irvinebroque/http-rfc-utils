/**
 * Prefer / Preference-Applied utilities per RFC 7240.
 * RFC 7240 §2, §3.
 */

import type { PreferMap, PreferToken, PreferParam } from './types.js';
import {
    assertHeaderToken,
    assertNoCtl,
    isEmptyHeader,
    splitAndParseKeyValueSegments,
    splitQuotedValue,
    unquote,
    quoteIfNeeded,
} from './header-utils.js';

/**
 * Parse a Prefer header into a map of preference tokens.
 */
// RFC 7240 §2: Prefer header parsing.
export function parsePrefer(header: string): PreferMap {
    const map: PreferMap = new Map();

    if (isEmptyHeader(header)) {
        return map;
    }

    const parts = splitQuotedValue(header, ',');
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const segments = splitAndParseKeyValueSegments(trimmed, ';');
        if (segments.length === 0) {
            continue;
        }

        const [tokenPart, ...paramParts] = segments;
        if (!tokenPart) continue;

        // RFC 7240 §2: Token names are case-insensitive.
        const token = tokenPart.key.trim().toLowerCase();
        if (!token) continue;

        const rawValue = tokenPart.hasEquals ? unquote(tokenPart.value ?? '') : undefined;
        // RFC 7240 §2: Empty values are equivalent to no value.
        const value = rawValue === '' ? undefined : rawValue;
        const params: PreferParam[] = [];

        for (const paramPart of paramParts) {
            const key = paramPart.key.trim().toLowerCase();
            if (!key) {
                continue;
            }

            if (!paramPart.hasEquals) {
                params.push({ key });
            } else {
                const val = unquote(paramPart.value ?? '');
                // RFC 7240 §2: Empty values are equivalent to no value.
                if (val === '') {
                    params.push({ key });
                } else {
                    params.push({ key, value: val });
                }
            }
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
        for (const preference of preferences) {
            assertNoCtl(preference, 'Preference-Applied value');
        }
        return preferences.join(', ');
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
