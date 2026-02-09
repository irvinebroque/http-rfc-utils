/**
 * Shared authorization parsing and formatting utilities.
 * RFC 7235 §2.1.
 */

import type {
    AuthChallenge,
    AuthCredentials,
    AuthParam,
} from '../types/auth.js';
import { TOKEN_CHARS } from '../header-utils.js';
const TOKEN68_RE = /^[A-Za-z0-9\-._~+\/]+={0,}$/;
const B64TOKEN_RE = /^[A-Za-z0-9\-._~+\/]+={0,}$/;

function isToken(value: string): boolean {
    return TOKEN_CHARS.test(value);
}

export function isToken68(value: string): boolean {
    return TOKEN68_RE.test(value);
}

export function isB64Token(value: string): boolean {
    return B64TOKEN_RE.test(value);
}

function skipOWS(input: string, index: number): number {
    let i = index;
    while (i < input.length) {
        const char = input[i];
        if (char === ' ' || char === '\t') {
            i++;
        } else {
            break;
        }
    }
    return i;
}

function parseToken(input: string, index: number): { token: string; index: number } | null {
    let i = index;
    let token = '';
    while (i < input.length) {
        const char = input[i];
        if (!char || !isToken(char)) {
            break;
        }
        token += char;
        i++;
    }
    if (!token) {
        return null;
    }
    return { token, index: i };
}

function parseQuotedString(input: string, index: number): { value: string; index: number } | null {
    if (input[index] !== '"') {
        return null;
    }

    let i = index + 1;
    let value = '';
    while (i < input.length) {
        const char = input[i];
        if (char === '"') {
            return { value, index: i + 1 };
        }
        if (char === '\\' && i + 1 < input.length) {
            value += input[i + 1];
            i += 2;
            continue;
        }
        value += char;
        i++;
    }

    return null;
}

function parseTokenOrQuoted(input: string, index: number): { value: string; index: number } | null {
    if (input[index] === '"') {
        return parseQuotedString(input, index);
    }

    const tokenResult = parseToken(input, index);
    if (!tokenResult) {
        return null;
    }
    return { value: tokenResult.token, index: tokenResult.index };
}

function parseToken68(input: string, index: number): { token: string; index: number } | null {
    let i = index;
    let token = '';
    while (i < input.length) {
        const char = input[i];
        if (char === ' ' || char === '\t' || char === ',') {
            break;
        }
        token += char;
        i++;
    }

    if (!token || !isToken68(token)) {
        return null;
    }

    return { token, index: i };
}

function isNextParam(input: string, index: number): boolean {
    let i = skipOWS(input, index);
    const tokenResult = parseToken(input, i);
    if (!tokenResult) {
        return false;
    }
    i = skipOWS(input, tokenResult.index);
    return input[i] === '=';
}

export function parseAuthParamsList(input: string): AuthParam[] | null {
    const params: AuthParam[] = [];
    let index = 0;

    while (index < input.length) {
        index = skipOWS(input, index);
        if (index >= input.length) {
            break;
        }

        const nameResult = parseToken(input, index);
        if (!nameResult) {
            return null;
        }
        const name = nameResult.token.toLowerCase();
        index = skipOWS(input, nameResult.index);
        if (input[index] !== '=') {
            return null;
        }
        index++;
        index = skipOWS(input, index);

        const valueResult = parseTokenOrQuoted(input, index);
        if (!valueResult) {
            return null;
        }
        params.push({ name, value: valueResult.value });
        index = skipOWS(input, valueResult.index);

        if (input[index] === ',') {
            index++;
            continue;
        }
        if (index < input.length) {
            return null;
        }
    }

    return params;
}

function parseChallenges(header: string): AuthChallenge[] | null {
    const challenges: AuthChallenge[] = [];
    let index = 0;

    while (index < header.length) {
        index = skipOWS(header, index);
        while (header[index] === ',') {
            index++;
            index = skipOWS(header, index);
        }
        if (index >= header.length) {
            break;
        }

        const schemeResult = parseToken(header, index);
        if (!schemeResult) {
            return null;
        }
        const scheme = schemeResult.token;
        index = skipOWS(header, schemeResult.index);

        if (index >= header.length || header[index] === ',') {
            challenges.push({ scheme });
            if (header[index] === ',') {
                index++;
            }
            continue;
        }

        const token68Result = parseToken68(header, index);
        if (token68Result) {
            challenges.push({ scheme, token68: token68Result.token });
            index = skipOWS(header, token68Result.index);
            if (header[index] === ',') {
                index++;
            }
            continue;
        }

        const params: AuthParam[] = [];
        while (index < header.length) {
            index = skipOWS(header, index);
            const nameResult = parseToken(header, index);
            if (!nameResult) {
                break;
            }
            const name = nameResult.token.toLowerCase();
            index = skipOWS(header, nameResult.index);
            if (header[index] !== '=') {
                return null;
            }
            index++;
            index = skipOWS(header, index);

            const valueResult = parseTokenOrQuoted(header, index);
            if (!valueResult) {
                return null;
            }
            params.push({ name, value: valueResult.value });
            index = skipOWS(header, valueResult.index);

            if (header[index] === ',') {
                const commaIndex = index;
                index++;
                if (isNextParam(header, index)) {
                    continue;
                }
                index = commaIndex;
                break;
            }
            break;
        }

        challenges.push(params.length > 0 ? { scheme, params } : { scheme });
        index = skipOWS(header, index);
        if (header[index] === ',') {
            index++;
        }
    }

    return challenges;
}

export function quoteAuthParamValue(value: string): string {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

export function formatAuthParams(params: AuthParam[]): string {
    return params.map(param => `${param.name}=${quoteAuthParamValue(param.value)}`).join(', ');
}

export function hasCtl(value: string): boolean {
    for (const char of value) {
        const code = char.charCodeAt(0);
        if (code <= 0x1f || code === 0x7f) {
            return true;
        }
    }
    return false;
}

/**
 * Parse Authorization header into scheme + token68 or auth-params.
 */
// RFC 7235 §2.1: credentials are token68 or auth-params.
export function parseAuthorization(header: string): AuthCredentials | null {
    if (!header || !header.trim()) {
        return null;
    }

    const trimmed = header.trim();
    const schemeResult = parseToken(trimmed, 0);
    if (!schemeResult) {
        return null;
    }

    const scheme = schemeResult.token;
    let index = skipOWS(trimmed, schemeResult.index);
    if (index >= trimmed.length) {
        return { scheme };
    }

    const token68Result = parseToken68(trimmed, index);
    if (token68Result && skipOWS(trimmed, token68Result.index) >= trimmed.length) {
        return { scheme, token68: token68Result.token };
    }

    const params = parseAuthParamsList(trimmed.slice(index));
    if (!params) {
        return null;
    }

    return { scheme, params };
}

/**
 * Format Authorization header from credentials.
 */
// RFC 7235 §2.1: Authorization credentials formatting.
export function formatAuthorization(credentials: AuthCredentials): string {
    if (credentials.token68) {
        return `${credentials.scheme} ${credentials.token68}`;
    }
    if (credentials.params && credentials.params.length > 0) {
        return `${credentials.scheme} ${formatAuthParams(credentials.params)}`;
    }
    return credentials.scheme;
}

/**
 * Parse WWW-Authenticate header into challenges.
 */
// RFC 7235 §2.1: WWW-Authenticate challenge parsing.
export function parseWWWAuthenticate(header: string): AuthChallenge[] {
    if (!header || !header.trim()) {
        return [];
    }

    const challenges = parseChallenges(header);
    return challenges ?? [];
}

/**
 * Format WWW-Authenticate header from challenges.
 */
// RFC 7235 §2.1: WWW-Authenticate challenge formatting.
export function formatWWWAuthenticate(challenges: AuthChallenge[]): string {
    return challenges.map((challenge) => {
        if (challenge.token68) {
            return `${challenge.scheme} ${challenge.token68}`;
        }
        if (challenge.params && challenge.params.length > 0) {
            return `${challenge.scheme} ${formatAuthParams(challenge.params)}`;
        }
        return challenge.scheme;
    }).join(', ');
}
