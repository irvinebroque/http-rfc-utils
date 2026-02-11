/**
 * Cookie and Set-Cookie utilities per RFC 6265.
 * RFC 6265 §4.1.1, §4.2.1, §5.1.1, §5.1.3, §5.1.4, §5.2, §5.3, §5.4.
 * @see https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.1
 */

import type { CookieAttributes, CookieHeaderOptions, SetCookie, StoredCookie } from './types.js';
import { formatHTTPDate } from './datetime.js';
import { assertHeaderToken, assertNoCtl, quoteString, unquoteLenient } from './header-utils.js';
import { createObjectMap } from './object-map.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function formatCookieValue(value: string): string {
    assertNoCtl(value, 'Cookie value');
    if (!/[\s;,"]/.test(value) && !value.includes('\\')) {
        return value;
    }
    return quoteString(value);
}

function assertNoSetCookieAttributeDelimiter(value: string, context: string): void {
    if (value.includes(';')) {
        throw new Error(`${context} must not contain ';' delimiter`);
    }
}

function isDelimiter(char: string): boolean {
    const code = char.charCodeAt(0);
    return code === 0x09
        || (code >= 0x20 && code <= 0x2f)
        || (code >= 0x3b && code <= 0x40)
        || (code >= 0x5b && code <= 0x60)
        || (code >= 0x7b && code <= 0x7e);
}

function tokenizeCookieDate(value: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (const char of value) {
        if (isDelimiter(char)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        tokens.push(current);
    }

    return tokens;
}

function parseDayOfMonth(token: string): number | null {
    if (/^\d{3,}$/.test(token)) {
        return null;
    }
    const match = token.match(/^(\d{1,2})/);
    if (!match) {
        return null;
    }
    return Number(match[1]);
}

function parseYear(token: string): number | null {
    const match = token.match(/^(\d{2,4})/);
    if (!match) {
        return null;
    }
    let year = Number(match[1]);
    if (match[1]!.length === 2) {
        year = year >= 70 ? year + 1900 : year + 2000;
    }
    return year;
}

function parseMonth(token: string): number | null {
    const lower = token.toLowerCase();
    for (let i = 0; i < MONTHS.length; i++) {
        if (lower.startsWith(MONTHS[i]!)) {
            return i + 1;
        }
    }
    return null;
}

function parseTime(token: string): { hour: number; minute: number; second: number } | null {
    const match = token.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (!match) {
        return null;
    }
    return {
        hour: Number(match[1]),
        minute: Number(match[2]),
        second: Number(match[3]),
    };
}

function parseMaxAge(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (!/^-?\d+$/.test(trimmed)) {
        return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return parsed;
}

function isIpAddress(host: string): boolean {
    if (host.includes(':')) {
        return true;
    }

    const parts = host.split('.');
    if (parts.length !== 4) {
        return false;
    }

    for (const part of parts) {
        if (!/^\d+$/.test(part)) {
            return false;
        }
        const value = Number(part);
        if (!Number.isFinite(value) || value < 0 || value > 255) {
            return false;
        }
    }

    return true;
}

/**
 * Parse Cookie header value into name/value pairs.
 */
// RFC 6265 §4.2.1: Cookie header parsing.
export function parseCookie(header: string): Map<string, string> {
    const cookies = new Map<string, string>();
    if (!header || !header.trim()) {
        return cookies;
    }

    const parts = header.split(';');
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) {
            continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) {
            continue;
        }

        const name = trimmed.slice(0, eqIndex).trim();
        if (!name) {
            continue;
        }

        const value = unquoteLenient(trimmed.slice(eqIndex + 1));
        if (!cookies.has(name)) {
            cookies.set(name, value);
        }
    }

    return cookies;
}

/**
 * Format Cookie header value from pairs.
 */
// RFC 6265 §4.2.1: Cookie header formatting.
export function formatCookie(cookies: Map<string, string> | Record<string, string>): string {
    const entries = cookies instanceof Map ? Array.from(cookies.entries()) : Object.entries(cookies);
    return entries.map(([name, value]) => {
        assertHeaderToken(name, `Cookie name "${name}"`);
        return `${name}=${formatCookieValue(value)}`;
    }).join('; ');
}

/**
 * Parse Set-Cookie header value into a cookie definition.
 */
// RFC 6265 §5.2: Set-Cookie parsing algorithm.
export function parseSetCookie(header: string): SetCookie | null {
    if (!header || !header.trim()) {
        return null;
    }

    const parts = header.split(';');
    const cookiePair = parts.shift();
    if (!cookiePair) {
        return null;
    }

    const eqIndex = cookiePair.indexOf('=');
    if (eqIndex === -1) {
        return null;
    }

    const name = cookiePair.slice(0, eqIndex).trim();
    if (!name) {
        return null;
    }

    const value = unquoteLenient(cookiePair.slice(eqIndex + 1).trim());
    const attributes: CookieAttributes = {};

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) {
            continue;
        }

        const attrEq = trimmed.indexOf('=');
        const rawName = (attrEq === -1 ? trimmed : trimmed.slice(0, attrEq)).trim();
        if (!rawName) {
            continue;
        }

        const nameLower = rawName.toLowerCase();
        const rawValue = attrEq === -1 ? undefined : trimmed.slice(attrEq + 1).trim();

        switch (nameLower) {
            case 'expires': {
                if (rawValue) {
                    const parsed = parseCookieDate(rawValue);
                    if (parsed) {
                        attributes.expires = parsed;
                    }
                }
                break;
            }
            case 'max-age': {
                if (rawValue) {
                    const parsed = parseMaxAge(rawValue);
                    if (parsed !== null) {
                        attributes.maxAge = parsed;
                    }
                }
                break;
            }
            case 'domain': {
                if (rawValue) {
                    let domain = rawValue.trim().toLowerCase();
                    if (domain.startsWith('.')) {
                        domain = domain.slice(1);
                    }
                    if (domain) {
                        attributes.domain = domain;
                    }
                }
                break;
            }
            case 'path': {
                if (rawValue) {
                    attributes.path = rawValue;
                }
                break;
            }
            case 'secure':
                attributes.secure = true;
                break;
            case 'httponly':
                attributes.httpOnly = true;
                break;
            default: {
                if (!attributes.extensions) {
                    attributes.extensions = createObjectMap<string | undefined>();
                }
                attributes.extensions[nameLower] = rawValue;
                break;
            }
        }
    }

    return { name, value, attributes };
}

/**
 * Format Set-Cookie header value from a cookie definition.
 */
// RFC 6265 §4.1.1: Set-Cookie formatting.
export function formatSetCookie(value: SetCookie): string {
    assertHeaderToken(value.name, `Set-Cookie name "${value.name}"`);
    const parts: string[] = [`${value.name}=${formatCookieValue(value.value)}`];
    const attributes = value.attributes ?? {};

    if (attributes.expires) {
        parts.push(`Expires=${formatHTTPDate(attributes.expires)}`);
    }
    if (attributes.maxAge !== undefined) {
        parts.push(`Max-Age=${Math.floor(attributes.maxAge)}`);
    }
    if (attributes.domain) {
        assertNoCtl(attributes.domain, 'Set-Cookie Domain attribute');
        assertNoSetCookieAttributeDelimiter(attributes.domain, 'Set-Cookie Domain attribute');
        parts.push(`Domain=${attributes.domain}`);
    }
    if (attributes.path) {
        assertNoCtl(attributes.path, 'Set-Cookie Path attribute');
        assertNoSetCookieAttributeDelimiter(attributes.path, 'Set-Cookie Path attribute');
        parts.push(`Path=${attributes.path}`);
    }
    if (attributes.secure) {
        parts.push('Secure');
    }
    if (attributes.httpOnly) {
        parts.push('HttpOnly');
    }
    if (attributes.extensions) {
        for (const [key, extValue] of Object.entries(attributes.extensions)) {
            assertHeaderToken(key, `Set-Cookie extension attribute name "${key}"`);
            if (extValue === undefined || extValue === '') {
                parts.push(key);
            } else {
                assertNoCtl(extValue, `Set-Cookie extension attribute "${key}" value`);
                assertNoSetCookieAttributeDelimiter(extValue, `Set-Cookie extension attribute "${key}" value`);
                parts.push(`${key}=${extValue}`);
            }
        }
    }

    return parts.join('; ');
}

/**
 * Parse cookie-date into a Date.
 */
// RFC 6265 §5.1.1: cookie-date parsing.
export function parseCookieDate(value: string): Date | null {
    const tokens = tokenizeCookieDate(value);
    let day: number | null = null;
    let month: number | null = null;
    let year: number | null = null;
    let hour: number | null = null;
    let minute: number | null = null;
    let second: number | null = null;

    for (const token of tokens) {
        if (hour === null) {
            const time = parseTime(token);
            if (time) {
                hour = time.hour;
                minute = time.minute;
                second = time.second;
                continue;
            }
        }

        if (day === null) {
            const parsedDay = parseDayOfMonth(token);
            if (parsedDay !== null) {
                day = parsedDay;
                continue;
            }
        }

        if (month === null) {
            const parsedMonth = parseMonth(token);
            if (parsedMonth !== null) {
                month = parsedMonth;
                continue;
            }
        }

        if (year === null) {
            const parsedYear = parseYear(token);
            if (parsedYear !== null) {
                year = parsedYear;
            }
        }
    }

    if (day === null || month === null || year === null || hour === null || minute === null || second === null) {
        return null;
    }

    if (year < 1601 || year > 9999) {
        return null;
    }
    if (day < 1 || day > 31) {
        return null;
    }
    if (hour > 23 || minute > 59 || second > 59) {
        return null;
    }

    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

/**
 * Determine whether a domain matches a host per RFC 6265.
 */
// RFC 6265 §5.1.3: domain-match algorithm.
export function domainMatches(host: string, domain: string): boolean {
    const normalizedHost = host.toLowerCase();
    const normalizedDomain = domain.toLowerCase();

    if (!normalizedDomain) {
        return false;
    }

    if (normalizedHost === normalizedDomain) {
        return true;
    }

    if (isIpAddress(normalizedHost)) {
        return false;
    }

    return normalizedHost.endsWith(`.${normalizedDomain}`);
}

/**
 * Compute default-path for a request URL.
 */
// RFC 6265 §5.1.4: default-path algorithm.
export function defaultPath(requestUrl: string): string {
    let path = '/';

    try {
        path = new URL(requestUrl).pathname;
    } catch {
        return '/';
    }

    if (!path.startsWith('/')) {
        return '/';
    }

    if (path === '/') {
        return '/';
    }

    const lastSlash = path.lastIndexOf('/');
    if (lastSlash <= 0) {
        return '/';
    }

    return path.slice(0, lastSlash);
}

/**
 * Determine whether a cookie path matches the request path.
 */
// RFC 6265 §5.1.4: path-match rules.
export function pathMatches(requestPath: string, cookiePath: string): boolean {
    if (requestPath === cookiePath) {
        return true;
    }

    if (!requestPath.startsWith(cookiePath)) {
        return false;
    }

    if (cookiePath.endsWith('/')) {
        return true;
    }

    const nextChar = requestPath[cookiePath.length];
    return nextChar === '/';
}

/**
 * Build Cookie header from stored cookies for a request URL.
 */
// RFC 6265 §5.4: Cookie header generation order.
export function buildCookieHeader(
    cookies: StoredCookie[],
    requestUrl: string,
    options: CookieHeaderOptions = {}
): string | null {
    if (!cookies || cookies.length === 0) {
        return null;
    }

    const url = new URL(requestUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname || '/';
    const now = options.now ?? new Date();
    const isSecure = options.isSecure ?? url.protocol === 'https:';
    const includeHttpOnly = options.includeHttpOnly ?? true;

    const filtered = cookies.filter((cookie) => {
        if (cookie.expires && cookie.expires.getTime() <= now.getTime()) {
            return false;
        }

        const domain = cookie.domain.toLowerCase();
        if (cookie.hostOnly) {
            if (host !== domain) {
                return false;
            }
        } else if (!domainMatches(host, domain)) {
            return false;
        }

        if (!pathMatches(path, cookie.path)) {
            return false;
        }

        if (cookie.secureOnly && !isSecure) {
            return false;
        }

        if (cookie.httpOnly && !includeHttpOnly) {
            return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        return null;
    }

    filtered.sort((a, b) => {
        const pathDiff = b.path.length - a.path.length;
        if (pathDiff !== 0) {
            return pathDiff;
        }
        return a.creationTime.getTime() - b.creationTime.getTime();
    });

    return filtered
        .map((cookie) => {
            assertHeaderToken(cookie.name, `Cookie name "${cookie.name}"`);
            return `${cookie.name}=${formatCookieValue(cookie.value)}`;
        })
        .join('; ');
}
