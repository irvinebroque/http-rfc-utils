/**
 * Bearer token authentication utilities.
 * RFC 6750 §2.1, §3.
 */

import type {
    AuthParam,
    BearerChallenge,
    BearerError,
} from '../types/auth.js';
import {
    formatAuthParams,
    isB64Token,
    parseAuthorization,
    parseWWWAuthenticate,
} from './shared.js';
import { createObjectMap } from '../object-map.js';

const BEARER_ERRORS: BearerError[] = ['invalid_request', 'invalid_token', 'insufficient_scope'];
/**
 * Parse Bearer Authorization header.
 */
// RFC 6750 §2.1: Bearer Authorization parsing.
export function parseBearerAuthorization(header: string): string | null {
    const parsed = parseAuthorization(header);
    if (!parsed || parsed.scheme.toLowerCase() !== 'bearer' || !parsed.token68) {
        return null;
    }
    if (!isB64Token(parsed.token68)) {
        return null;
    }
    return parsed.token68;
}

/**
 * Format Bearer Authorization header.
 */
// RFC 6750 §2.1: Bearer Authorization formatting.
export function formatBearerAuthorization(token: string): string | null {
    if (!isB64Token(token)) {
        return null;
    }
    return `Bearer ${token}`;
}

/**
 * Parse Bearer WWW-Authenticate challenge.
 */
// RFC 6750 §3: Bearer challenge parsing.
export function parseBearerChallenge(header: string): BearerChallenge | null {
    const challenges = parseWWWAuthenticate(header);
    const challenge = challenges.find(entry => entry.scheme.toLowerCase() === 'bearer');
    if (!challenge || !challenge.params || challenge.params.length === 0) {
        return null;
    }

    const seen = new Set<string>();
    const extensions = createObjectMap<string>();
    const result: BearerChallenge = {};

    for (const param of challenge.params) {
        const name = param.name.toLowerCase();
        if (seen.has(name)) {
            return null;
        }
        seen.add(name);

        switch (name) {
            case 'realm':
                result.realm = param.value;
                break;
            case 'scope':
                result.scope = param.value;
                break;
            case 'error':
                if (BEARER_ERRORS.includes(param.value as BearerError)) {
                    result.error = param.value as BearerError;
                }
                break;
            case 'error_description':
                result.errorDescription = param.value;
                break;
            case 'error_uri':
                result.errorUri = param.value;
                break;
            default:
                extensions[name] = param.value;
                break;
        }
    }

    if (Object.keys(extensions).length > 0) {
        result.params = extensions;
    }

    return result;
}

/**
 * Format Bearer WWW-Authenticate challenge.
 */
// RFC 6750 §3: Bearer challenge formatting.
export function formatBearerChallenge(params: BearerChallenge): string {
    const parts: AuthParam[] = [];

    if (params.realm) {
        parts.push({ name: 'realm', value: params.realm });
    }
    if (params.scope) {
        parts.push({ name: 'scope', value: params.scope });
    }
    if (params.error) {
        parts.push({ name: 'error', value: params.error });
    }
    if (params.errorDescription) {
        parts.push({ name: 'error_description', value: params.errorDescription });
    }
    if (params.errorUri) {
        parts.push({ name: 'error_uri', value: params.errorUri });
    }
    if (params.params) {
        for (const [name, value] of Object.entries(params.params)) {
            parts.push({ name, value });
        }
    }

    if (parts.length === 0) {
        return 'Bearer';
    }

    return `Bearer ${formatAuthParams(parts)}`;
}
