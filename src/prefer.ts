/**
 * Prefer / Preference-Applied utilities per RFC 7240.
 * RFC 7240 §2, §3.
 */

import type { PreferMap, PreferToken, PreferParam } from './types.js';
import { isEmptyHeader, splitQuotedValue, unquote, quoteIfNeeded } from './header-utils.js';

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

        const segments = splitQuotedValue(trimmed, ';').map(segment => segment.trim()).filter(Boolean);
        if (segments.length === 0) {
            continue;
        }

        const [tokenPart, ...paramParts] = segments;
        if (!tokenPart) continue;

        const eqIndex = tokenPart.indexOf('=');
        // RFC 7240 §2: Token names are case-insensitive.
        const token = (eqIndex === -1 ? tokenPart : tokenPart.slice(0, eqIndex)).trim().toLowerCase();
        if (!token) continue;

        const rawValue = eqIndex === -1 ? undefined : unquote(tokenPart.slice(eqIndex + 1).trim());
        // RFC 7240 §2: Empty values are equivalent to no value.
        const value = rawValue === '' ? undefined : rawValue;
        const params: PreferParam[] = [];

        for (const paramPart of paramParts) {
            const paramEq = paramPart.indexOf('=');
            if (paramEq === -1) {
                params.push({ key: paramPart.trim().toLowerCase() });
            } else {
                const key = paramPart.slice(0, paramEq).trim().toLowerCase();
                const val = unquote(paramPart.slice(paramEq + 1).trim());
                if (key) {
                    // RFC 7240 §2: Empty values are equivalent to no value.
                    params.push({ key, value: val === '' ? undefined : val });
                }
            }
        }

        if (!map.has(token)) {
            map.set(token, { token, value, params });
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
        const parts: string[] = [];
        const base = token.value !== undefined ? `${token.token}=${quoteIfNeeded(token.value)}` : token.token;
        parts.push(base);

        for (const param of token.params ?? []) {
            if (param.value === undefined) {
                parts.push(param.key);
            } else {
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
        return preferences.join(', ');
    }

    const tokens = Array.from(preferences.values());
    return tokens.map(token => {
        if (token.value !== undefined) {
            return `${token.token}=${quoteIfNeeded(token.value)}`;
        }
        return token.token;
    }).join(', ');
}
