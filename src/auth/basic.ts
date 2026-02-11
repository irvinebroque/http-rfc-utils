/**
 * Basic authentication utilities.
 * RFC 7617 §2, §2.1.
 * @see https://www.rfc-editor.org/rfc/rfc7617.html
 */

import { Buffer } from 'node:buffer';
import type {
    AuthParam,
    BasicChallenge,
    BasicCredentials,
} from '../types/auth.js';
import {
    formatAuthParams,
    hasCtl,
    isToken68,
    parseAuthorization,
    parseWWWAuthenticate,
} from './shared.js';
/**
 * Parse Basic Authorization header.
 */
// RFC 7617 §2: Basic credentials parsing.
export function parseBasicAuthorization(
    header: string,
    options: { encoding?: 'utf-8' | 'latin1' } = {}
): BasicCredentials | null {
    const parsed = parseAuthorization(header);
    if (!parsed || parsed.scheme.toLowerCase() !== 'basic' || !parsed.token68) {
        return null;
    }
    if (!isToken68(parsed.token68)) {
        return null;
    }

    const encoding = options.encoding ?? 'utf-8';
    let decoded: string;
    try {
        decoded = Buffer.from(parsed.token68, 'base64').toString(encoding === 'latin1' ? 'latin1' : 'utf8');
    } catch {
        return null;
    }

    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
        return null;
    }

    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    if (hasCtl(username) || hasCtl(password)) {
        return null;
    }

    return { username, password, encoding };
}

/**
 * Format Basic Authorization header.
 */
// RFC 7617 §2: Basic credentials formatting.
export function formatBasicAuthorization(
    username: string,
    password: string,
    options: { encoding?: 'utf-8' | 'latin1' } = {}
): string | null {
    if (username.includes(':') || hasCtl(username) || hasCtl(password)) {
        return null;
    }

    const encoding = options.encoding ?? 'utf-8';
    const token = Buffer
        .from(`${username}:${password}`, encoding === 'latin1' ? 'latin1' : 'utf8')
        .toString('base64');
    return `Basic ${token}`;
}

/**
 * Parse Basic WWW-Authenticate challenge.
 */
// RFC 7617 §2, §2.1: Basic challenge parsing.
export function parseBasicChallenge(header: string): BasicChallenge | null {
    const challenges = parseWWWAuthenticate(header);
    const challenge = challenges.find(entry => entry.scheme.toLowerCase() === 'basic');
    if (!challenge || !challenge.params) {
        return null;
    }

    const seen = new Set<string>();
    let realm: string | undefined;
    let charset: 'UTF-8' | undefined;

    for (const param of challenge.params) {
        const name = param.name.toLowerCase();
        if (seen.has(name)) {
            return null;
        }
        seen.add(name);

        if (name === 'realm') {
            realm = param.value;
        } else if (name === 'charset') {
            if (param.value.toLowerCase() === 'utf-8') {
                charset = 'UTF-8';
            }
        }
    }

    if (!realm) {
        return null;
    }

    const basicChallenge: BasicChallenge = { scheme: 'Basic', realm };
    if (charset !== undefined) {
        basicChallenge.charset = charset;
    }

    return basicChallenge;
}

/**
 * Format Basic WWW-Authenticate challenge.
 */
// RFC 7617 §2, §2.1: Basic challenge formatting.
export function formatBasicChallenge(realm: string, options: { charset?: 'UTF-8' } = {}): string {
    const params: AuthParam[] = [{ name: 'realm', value: realm }];
    if (options.charset === 'UTF-8') {
        params.push({ name: 'charset', value: 'UTF-8' });
    }
    return `Basic ${formatAuthParams(params)}`;
}
