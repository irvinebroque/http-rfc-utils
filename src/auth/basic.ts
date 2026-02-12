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
import {
    AUTH_PARAM_SCHEMA_SKIP,
    buildAuthParamsBySchema,
    createAuthParamSchemaEntry,
    parseAuthParamsBySchema,
} from './internal-auth-param-schema.js';

const CANONICAL_BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

interface BasicChallengeParamsSchema {
    realm?: string;
    charset?: 'UTF-8';
}

const BASIC_CHALLENGE_SCHEMA = [
    createAuthParamSchemaEntry<BasicChallengeParamsSchema>({
        key: 'realm',
        property: 'realm',
    }),
    createAuthParamSchemaEntry<BasicChallengeParamsSchema>({
        key: 'charset',
        property: 'charset',
        parse: (value) => value.toLowerCase() === 'utf-8' ? 'UTF-8' : AUTH_PARAM_SCHEMA_SKIP,
    }),
] as const;

function isCanonicalBasicBase64(token68: string): boolean {
    if (!CANONICAL_BASE64_RE.test(token68)) {
        return false;
    }

    try {
        return Buffer.from(token68, 'base64').toString('base64') === token68;
    } catch {
        return false;
    }
}
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

    // RFC 7617 §2 and RFC 4648 §4: Basic credentials use canonical base64.
    // Reject permissive/non-canonical token68 forms accepted by some decoders.
    if (!isCanonicalBasicBase64(parsed.token68)) {
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
): string {
    if (username.includes(':')) {
        throw new Error(`Basic username must not contain ":"; received ${JSON.stringify(username)}`);
    }

    if (hasCtl(username) || hasCtl(password)) {
        throw new Error('Basic username and password must not contain control characters');
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

    const parsed = parseAuthParamsBySchema<BasicChallengeParamsSchema>(
        challenge.params,
        BASIC_CHALLENGE_SCHEMA,
        {
            validate: (params) => Boolean(params.realm),
        }
    );
    if (!parsed || !parsed.realm) {
        return null;
    }

    const basicChallenge: BasicChallenge = { scheme: 'Basic', realm: parsed.realm };
    if (parsed.charset !== undefined) {
        basicChallenge.charset = parsed.charset;
    }

    return basicChallenge;
}

/**
 * Format Basic WWW-Authenticate challenge.
 */
// RFC 7617 §2, §2.1: Basic challenge formatting.
export function formatBasicChallenge(realm: string, options: { charset?: 'UTF-8' } = {}): string {
    const schemaInput: BasicChallengeParamsSchema = { realm };
    if (options.charset !== undefined) {
        schemaInput.charset = options.charset;
    }

    const params: AuthParam[] = buildAuthParamsBySchema<BasicChallengeParamsSchema>(
        schemaInput,
        BASIC_CHALLENGE_SCHEMA
    );
    return `Basic ${formatAuthParams(params)}`;
}
