/**
 * Bearer token authentication utilities.
 * RFC 6750 §2.1, §3.
 * @see https://www.rfc-editor.org/rfc/rfc6750.html
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
import {
    AUTH_PARAM_SCHEMA_SKIP,
    buildAuthParamsBySchema,
    createAuthParamSchemaEntry,
    parseAuthParamsBySchema,
} from './internal-auth-param-schema.js';

const BEARER_ERRORS: BearerError[] = ['invalid_request', 'invalid_token', 'insufficient_scope'];

interface BearerChallengeSchema {
    realm?: string;
    scope?: string;
    error?: BearerError;
    errorDescription?: string;
    errorUri?: string;
    params?: Record<string, string>;
}

const BEARER_CHALLENGE_SCHEMA = [
    createAuthParamSchemaEntry<BearerChallengeSchema>({
        key: 'realm',
        property: 'realm',
    }),
    createAuthParamSchemaEntry<BearerChallengeSchema>({
        key: 'scope',
        property: 'scope',
    }),
    createAuthParamSchemaEntry<BearerChallengeSchema>({
        key: 'error',
        property: 'error',
        parse: (value) => BEARER_ERRORS.includes(value as BearerError)
            ? value as BearerError
            : AUTH_PARAM_SCHEMA_SKIP,
    }),
    createAuthParamSchemaEntry<BearerChallengeSchema>({
        key: 'error_description',
        property: 'errorDescription',
    }),
    createAuthParamSchemaEntry<BearerChallengeSchema>({
        key: 'error_uri',
        property: 'errorUri',
    }),
] as const;
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
export function formatBearerAuthorization(token: string): string {
    if (!isB64Token(token)) {
        throw new Error(`Bearer token must match RFC 6750 b64token syntax; received ${JSON.stringify(token)}`);
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

    const parsed = parseAuthParamsBySchema<BearerChallengeSchema>(
        challenge.params,
        BEARER_CHALLENGE_SCHEMA,
        {
            assignUnknown: (target, name, value) => {
                if (!target.params) {
                    target.params = createObjectMap<string>();
                }
                target.params[name] = value;
            },
        }
    );

    return parsed as BearerChallenge | null;
}

/**
 * Format Bearer WWW-Authenticate challenge.
 */
// RFC 6750 §3: Bearer challenge formatting.
export function formatBearerChallenge(params: BearerChallenge): string {
    if (params.error !== undefined && !BEARER_ERRORS.includes(params.error)) {
        throw new Error(
            `Bearer challenge params.error must be one of ${BEARER_ERRORS.join(', ')}; received ${JSON.stringify(params.error)}`
        );
    }

    const parts: AuthParam[] = buildAuthParamsBySchema<BearerChallengeSchema>(
        params,
        BEARER_CHALLENGE_SCHEMA,
        {
            appendUnknown: (source, append) => {
                if (!source.params) {
                    return;
                }
                for (const [name, value] of Object.entries(source.params)) {
                    append({ name, value });
                }
            },
        }
    );

    if (parts.length === 0) {
        return 'Bearer';
    }

    return `Bearer ${formatAuthParams(parts)}`;
}
