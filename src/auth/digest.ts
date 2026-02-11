/**
 * Digest authentication utilities.
 * RFC 7616 §3.3-§3.5.
 * @see https://www.rfc-editor.org/rfc/rfc7616.html
 */

import { createHash } from 'node:crypto';
import type {
    AuthChallenge,
    AuthCredentials,
    DigestAuthAlgorithm,
    DigestAuthenticationInfo,
    DigestAuthQop,
    DigestChallenge,
    DigestComputeOptions,
    DigestCredentials,
} from '../types/auth.js';
import { decodeExtValue, encodeExtValue } from '../ext-value.js';
import { assertHeaderToken } from '../header-utils.js';
import {
    formatAuthParamsWithBareValues,
    parseAuthParamsList,
} from './shared.js';
import {
    AUTH_PARAM_SCHEMA_INVALID,
    AUTH_PARAM_SCHEMA_SKIP,
    buildAuthParamsBySchema,
    createAuthParamSchemaEntry,
    parseAuthParamsBySchema,
} from './internal-auth-param-schema.js';
/**
 * Supported Digest authentication algorithms.
 * RFC 7616 §3.3: SHA-256 MUST be supported; MD5 for backward compatibility.
 */
export const DIGEST_AUTH_ALGORITHMS: DigestAuthAlgorithm[] = [
    'MD5',
    'MD5-sess',
    'SHA-256',
    'SHA-256-sess',
    'SHA-512-256',
    'SHA-512-256-sess',
];

const NC_REGEX = /^[0-9a-fA-F]{8}$/;
const DIGEST_CHALLENGE_BARE_VALUE_NAMES = new Set(['algorithm', 'charset', 'stale', 'userhash']);
const DIGEST_AUTHORIZATION_BARE_VALUE_NAMES = new Set(['algorithm', 'nc', 'qop', 'userhash', 'username*']);
const DIGEST_AUTHENTICATION_INFO_BARE_VALUE_NAMES = new Set(['nc', 'qop']);

interface DigestChallengeSchema {
    realm?: string;
    domain?: string[];
    nonce?: string;
    opaque?: string;
    stale?: boolean;
    algorithm?: DigestAuthAlgorithm;
    qop?: DigestAuthQop[];
    charset?: 'UTF-8';
    userhash?: boolean;
}

interface DigestCredentialsSchema {
    username?: string;
    usernameEncoded?: boolean;
    realm?: string;
    uri?: string;
    response?: string;
    algorithm?: DigestAuthAlgorithm;
    cnonce?: string;
    opaque?: string;
    qop?: DigestAuthQop;
    nc?: string;
    userhash?: boolean;
}

interface DigestAuthenticationInfoSchema {
    nextnonce?: string;
    qop?: DigestAuthQop;
    rspauth?: string;
    cnonce?: string;
    nc?: string;
}

function assertDigestNc(value: string, context: string): void {
    if (!NC_REGEX.test(value)) {
        throw new Error(`${context} must be exactly 8 hexadecimal digits; received ${JSON.stringify(value)}`);
    }
}

function assertDigestBareAuthParamValue(param: Readonly<{ name: string; value: string }>): void {
    const name = param.name.toLowerCase();
    if (name === 'nc') {
        assertDigestNc(param.value, 'Digest nc');
        return;
    }

    assertHeaderToken(param.value, `Digest ${param.name} value`);
}

const DIGEST_CHALLENGE_SCHEMA = [
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'realm',
        property: 'realm',
    }),
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'domain',
        property: 'domain',
        parse: (value) => {
            if (value.length === 0) {
                return AUTH_PARAM_SCHEMA_SKIP;
            }
            const domains = value.split(/\s+/).filter(Boolean);
            return domains.length > 0 ? domains : AUTH_PARAM_SCHEMA_SKIP;
        },
        format: (value) => {
            const domain = value as string[];
            return domain.length > 0 ? domain.join(' ') : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'nonce',
        property: 'nonce',
    }),
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'opaque',
        property: 'opaque',
        format: (value) => {
            const opaque = value as string;
            return opaque.length > 0 ? opaque : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'stale',
        property: 'stale',
        parse: (value) => value.toLowerCase() === 'true' ? true : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => value ? 'true' : AUTH_PARAM_SCHEMA_SKIP,
    }),
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'algorithm',
        property: 'algorithm',
        parse: (value) => (value.length > 0 && isDigestAlgorithm(value)) ? value : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => {
            const algorithm = value as string;
            return algorithm.length > 0 ? algorithm : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'qop',
        property: 'qop',
        parse: (value) => {
            const qopValues = value.split(',').map(v => v.trim()).filter(isDigestQop);
            return qopValues.length > 0 ? qopValues : AUTH_PARAM_SCHEMA_SKIP;
        },
        format: (value) => {
            const qopValues = value as string[];
            return qopValues.length > 0 ? qopValues.join(', ') : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'charset',
        property: 'charset',
        parse: (value) => value.toLowerCase() === 'utf-8' ? 'UTF-8' : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => {
            const charset = value as string;
            return charset.length > 0 ? charset : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestChallengeSchema>({
        key: 'userhash',
        property: 'userhash',
        parse: (value) => value.toLowerCase() === 'true' ? true : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => value ? 'true' : AUTH_PARAM_SCHEMA_SKIP,
    }),
] as const;

const DIGEST_CREDENTIALS_SCHEMA = [
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'username',
        property: 'username',
        format: (value, source) => {
            const username = value as string;
            return source.usernameEncoded ? AUTH_PARAM_SCHEMA_SKIP : username;
        },
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'username*',
        property: 'username',
        parse: (value) => {
            if (value.length === 0) {
                return AUTH_PARAM_SCHEMA_INVALID;
            }
            const decoded = decodeExtValue(value);
            if (!decoded) {
                return AUTH_PARAM_SCHEMA_INVALID;
            }
            return decoded.value;
        },
        format: (value, source) => {
            const username = value as string;
            return source.usernameEncoded ? encodeExtValue(username) : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'realm',
        property: 'realm',
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'uri',
        property: 'uri',
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'response',
        property: 'response',
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'algorithm',
        property: 'algorithm',
        parse: (value) => (value.length > 0 && isDigestAlgorithm(value)) ? value : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => {
            const algorithm = value as string;
            return algorithm.length > 0 ? algorithm : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'cnonce',
        property: 'cnonce',
        parse: (value) => value.length > 0 ? value : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => {
            const cnonce = value as string;
            return cnonce.length > 0 ? cnonce : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'opaque',
        property: 'opaque',
        parse: (value) => value.length > 0 ? value : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => {
            const opaque = value as string;
            return opaque.length > 0 ? opaque : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'qop',
        property: 'qop',
        parse: (value) => {
            if (value.length === 0) {
                return AUTH_PARAM_SCHEMA_SKIP;
            }
            return isDigestQop(value) ? value : AUTH_PARAM_SCHEMA_INVALID;
        },
        format: (value) => {
            const qop = value as string;
            return qop.length > 0 ? qop : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'nc',
        property: 'nc',
        parse: (value) => value.length > 0 ? value : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => {
            const nc = value as string;
            return nc.length > 0 ? nc : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestCredentialsSchema>({
        key: 'userhash',
        property: 'userhash',
        parse: (value) => value.toLowerCase() === 'true' ? true : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => value ? 'true' : AUTH_PARAM_SCHEMA_SKIP,
    }),
] as const;

const DIGEST_AUTHENTICATION_INFO_SCHEMA = [
    createAuthParamSchemaEntry<DigestAuthenticationInfoSchema>({
        key: 'nextnonce',
        property: 'nextnonce',
        format: (value) => {
            const nextnonce = value as string;
            return nextnonce.length > 0 ? nextnonce : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestAuthenticationInfoSchema>({
        key: 'qop',
        property: 'qop',
        parse: (value) => isDigestQop(value) ? value : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => {
            const qop = value as string;
            return qop.length > 0 ? qop : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestAuthenticationInfoSchema>({
        key: 'rspauth',
        property: 'rspauth',
        format: (value) => {
            const rspauth = value as string;
            return rspauth.length > 0 ? rspauth : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestAuthenticationInfoSchema>({
        key: 'cnonce',
        property: 'cnonce',
        format: (value) => {
            const cnonce = value as string;
            return cnonce.length > 0 ? cnonce : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
    createAuthParamSchemaEntry<DigestAuthenticationInfoSchema>({
        key: 'nc',
        property: 'nc',
        parse: (value) => NC_REGEX.test(value) ? value : AUTH_PARAM_SCHEMA_SKIP,
        format: (value) => {
            const nc = value as string;
            return nc.length > 0 ? nc : AUTH_PARAM_SCHEMA_SKIP;
        },
    }),
] as const;

/**
 * Check if value is a valid Digest algorithm.
 */
function isDigestAlgorithm(value: string): value is DigestAuthAlgorithm {
    return DIGEST_AUTH_ALGORITHMS.includes(value as DigestAuthAlgorithm);
}

/**
 * Check if value is a valid qop.
 */
function isDigestQop(value: string): value is DigestAuthQop {
    return value === 'auth' || value === 'auth-int';
}

/**
 * Get the Node crypto hash algorithm name for a Digest algorithm.
 * RFC 7616 §3.3.
 */
function getHashAlgorithm(algorithm: DigestAuthAlgorithm): string {
    const base = algorithm.replace(/-sess$/, '');
    switch (base) {
        case 'MD5':
            return 'md5';
        case 'SHA-256':
            return 'sha256';
        case 'SHA-512-256':
            return 'sha512-256';
        default:
            return 'sha256';
    }
}

/**
 * Compute a hash using Node crypto.
 * Returns lowercase hex string.
 */
async function computeHash(algorithm: string, data: string | Uint8Array): Promise<string> {
    return createHash(algorithm).update(data).digest('hex');
}

/**
 * Parse Digest WWW-Authenticate challenge.
 * RFC 7616 §3.3.
 */
// RFC 7616 §3.3: Digest challenge parsing.
export function parseDigestChallenge(challenge: AuthChallenge): DigestChallenge | null {
    if (challenge.scheme.toLowerCase() !== 'digest' || !challenge.params) {
        return null;
    }

    const parsed = parseAuthParamsBySchema<DigestChallengeSchema>(
        challenge.params,
        DIGEST_CHALLENGE_SCHEMA,
        {
            validate: (params) => Boolean(params.realm && params.nonce),
        }
    );
    if (!parsed || !parsed.realm || !parsed.nonce) {
        return null;
    }

    const result: DigestChallenge = {
        scheme: 'Digest',
        realm: parsed.realm,
        nonce: parsed.nonce,
    };

    if (parsed.domain) {
        result.domain = parsed.domain;
    }
    if (parsed.opaque) {
        result.opaque = parsed.opaque;
    }
    if (parsed.stale) {
        result.stale = true;
    }
    if (parsed.algorithm) {
        result.algorithm = parsed.algorithm;
    }
    if (parsed.qop) {
        result.qop = parsed.qop;
    }
    if (parsed.charset) {
        result.charset = parsed.charset;
    }
    if (parsed.userhash) {
        result.userhash = true;
    }

    return result;
}

/**
 * Format Digest WWW-Authenticate challenge.
 * RFC 7616 §3.3.
 */
// RFC 7616 §3.3: Digest challenge formatting.
export function formatDigestChallenge(challenge: DigestChallenge): string {
    const params = buildAuthParamsBySchema<DigestChallengeSchema>(
        challenge,
        DIGEST_CHALLENGE_SCHEMA
    );
    return `Digest ${formatAuthParamsWithBareValues(
        params,
        DIGEST_CHALLENGE_BARE_VALUE_NAMES,
        assertDigestBareAuthParamValue
    )}`;
}

/**
 * Parse Digest Authorization credentials.
 * RFC 7616 §3.4.
 */
// RFC 7616 §3.4: Digest credentials parsing.
export function parseDigestAuthorization(credentials: AuthCredentials): DigestCredentials | null {
    if (credentials.scheme.toLowerCase() !== 'digest' || !credentials.params) {
        return null;
    }

    const parsed = parseAuthParamsBySchema<DigestCredentialsSchema>(
        credentials.params,
        DIGEST_CREDENTIALS_SCHEMA,
        {
            validate: (params, context) => {
                const hasUsername = context.has('username');
                const hasUsernameStar = context.has('username*');
                if (hasUsername && hasUsernameStar) {
                    return false;
                }

                const username = params.username;
                const realm = params.realm;
                const uri = params.uri;
                const response = params.response;
                if (!username || !realm || !uri || !response) {
                    return false;
                }

                const qop = params.qop;
                const cnonce = params.cnonce;
                const nc = params.nc;

                if (qop) {
                    if (!cnonce || cnonce.length === 0) {
                        return false;
                    }
                    if (!nc || !NC_REGEX.test(nc)) {
                        return false;
                    }
                    return true;
                }

                if (nc && !NC_REGEX.test(nc)) {
                    return false;
                }

                return true;
            },
        }
    );
    if (!parsed || !parsed.username || !parsed.realm || !parsed.uri || !parsed.response) {
        return null;
    }

    const result: DigestCredentials = {
        scheme: 'Digest',
        username: parsed.username,
        realm: parsed.realm,
        uri: parsed.uri,
        response: parsed.response,
    };

    if (credentials.params.some((param) => param.name.toLowerCase() === 'username*')) {
        result.usernameEncoded = true;
    }

    if (parsed.algorithm) {
        result.algorithm = parsed.algorithm;
    }
    if (parsed.cnonce) {
        result.cnonce = parsed.cnonce;
    }
    if (parsed.opaque) {
        result.opaque = parsed.opaque;
    }
    if (parsed.qop) {
        result.qop = parsed.qop;
    }
    if (parsed.nc) {
        result.nc = parsed.nc;
    }
    if (parsed.userhash) {
        result.userhash = true;
    }

    return result;
}

/**
 * Format Digest Authorization credentials.
 * RFC 7616 §3.4.
 */
// RFC 7616 §3.4: Digest credentials formatting.
export function formatDigestAuthorization(credentials: DigestCredentials): string {
    const params = buildAuthParamsBySchema<DigestCredentialsSchema>(
        credentials,
        DIGEST_CREDENTIALS_SCHEMA
    );
    return `Digest ${formatAuthParamsWithBareValues(
        params,
        DIGEST_AUTHORIZATION_BARE_VALUE_NAMES,
        assertDigestBareAuthParamValue
    )}`;
}

/**
 * Parse Authentication-Info header.
 * RFC 7616 §3.5.
 */
// RFC 7616 §3.5: Authentication-Info parsing.
export function parseDigestAuthenticationInfo(value: string): DigestAuthenticationInfo | null {
    if (!value || !value.trim()) {
        return null;
    }

    const params = parseAuthParamsList(value.trim());
    if (!params) {
        return null;
    }

    const parsed = parseAuthParamsBySchema<DigestAuthenticationInfoSchema>(
        params,
        DIGEST_AUTHENTICATION_INFO_SCHEMA
    );
    if (!parsed) {
        return null;
    }

    const result: DigestAuthenticationInfo = {};
    if (parsed.nextnonce !== undefined) {
        result.nextnonce = parsed.nextnonce;
    }
    if (parsed.qop) {
        result.qop = parsed.qop;
    }
    if (parsed.rspauth !== undefined) {
        result.rspauth = parsed.rspauth;
    }
    if (parsed.cnonce !== undefined) {
        result.cnonce = parsed.cnonce;
    }
    if (parsed.nc) {
        result.nc = parsed.nc;
    }

    return result;
}

/**
 * Format Authentication-Info header.
 * RFC 7616 §3.5.
 */
// RFC 7616 §3.5: Authentication-Info formatting.
export function formatDigestAuthenticationInfo(info: DigestAuthenticationInfo): string {
    const params = buildAuthParamsBySchema<DigestAuthenticationInfoSchema>(
        info,
        DIGEST_AUTHENTICATION_INFO_SCHEMA
    );
    return formatAuthParamsWithBareValues(
        params,
        DIGEST_AUTHENTICATION_INFO_BARE_VALUE_NAMES,
        assertDigestBareAuthParamValue
    );
}

/**
 * Compute A1 value for Digest authentication.
 * RFC 7616 §3.4.2.
 *
 * @param username - Username
 * @param realm - Realm
 * @param password - Password
 * @param algorithm - Algorithm (session algorithms require nonce and cnonce)
 * @param nonce - Server nonce (required for -sess algorithms)
 * @param cnonce - Client nonce (required for -sess algorithms)
 * @returns A1 hash value (hex string)
 */
// RFC 7616 §3.4.2: A1 computation.
export async function computeA1(
    username: string,
    realm: string,
    password: string,
    algorithm: DigestAuthAlgorithm = 'SHA-256',
    nonce?: string,
    cnonce?: string
): Promise<string> {
    const hashAlg = getHashAlgorithm(algorithm);
    const isSession = algorithm.endsWith('-sess');

    // RFC 7616 §3.4.2: A1 = username ":" realm ":" passwd
    const a1Base = `${username}:${realm}:${password}`;

    if (isSession) {
        // RFC 7616 §3.4.2: For -sess algorithms:
        // A1 = H(username ":" realm ":" passwd) ":" nonce ":" cnonce
        if (!nonce || !cnonce) {
            throw new Error(
                `Digest algorithm "${algorithm}" requires both nonce and cnonce; received nonce=${String(nonce)} cnonce=${String(cnonce)}`,
            );
        }
        const h = await computeHash(hashAlg, a1Base);
        return `${h}:${nonce}:${cnonce}`;
    }

    return a1Base;
}

/**
 * Compute A2 value for Digest authentication.
 * RFC 7616 §3.4.3.
 *
 * @param method - HTTP method
 * @param uri - Request URI
 * @param qop - Quality of protection (optional)
 * @param entityBody - Entity body for auth-int (optional)
 * @returns A2 string value
 */
// RFC 7616 §3.4.3: A2 computation.
export function computeA2(
    method: string,
    uri: string,
    qop?: DigestAuthQop,
    _entityBody?: Uint8Array
): string {
    // RFC 7616 §3.4.3: qop=auth: A2 = Method ":" request-uri
    // RFC 7616 §3.4.3: qop=auth-int: A2 = Method ":" request-uri ":" H(entity-body)
    // Note: auth-int is out of scope for this implementation
    if (qop === 'auth-int') {
        throw new Error('Digest qop "auth-int" is not supported; use qop "auth" or omit qop');
    }
    return `${method}:${uri}`;
}

/**
 * Compute the Digest response value.
 * RFC 7616 §3.4.1.
 *
 * @param options - Computation options
 * @returns Response hash value (hex string)
 */
// RFC 7616 §3.4.1: Response computation.
export async function computeDigestResponse(options: DigestComputeOptions): Promise<string> {
    const {
        username,
        password,
        realm,
        method,
        uri,
        nonce,
        cnonce,
        nc,
        qop,
        algorithm = 'SHA-256',
    } = options;

    const hashAlg = getHashAlgorithm(algorithm);

    // Compute A1
    const a1 = await computeA1(username, realm, password, algorithm, nonce, cnonce);
    const ha1 = await computeHash(hashAlg, a1);

    // Compute A2
    const a2 = computeA2(method, uri, qop);
    const ha2 = await computeHash(hashAlg, a2);

    // RFC 7616 §3.4.1: response computation
    let responseData: string;
    if (qop) {
        // RFC 7616 §3.4.1: With qop:
        // response = KD(H(A1), unq(nonce) ":" nc ":" unq(cnonce) ":" unq(qop) ":" H(A2))
        // KD(secret, data) = H(secret ":" data)
        if (!cnonce || !nc) {
            throw new Error(
                `Digest response with qop "${qop}" requires both cnonce and nc; received cnonce=${String(cnonce)} nc=${String(nc)}`,
            );
        }
        responseData = `${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`;
    } else {
        // RFC 7616 §3.4.1: Without qop (legacy):
        // response = KD(H(A1), unq(nonce) ":" H(A2))
        responseData = `${ha1}:${nonce}:${ha2}`;
    }

    return computeHash(hashAlg, responseData);
}

/**
 * Hash a username for userhash support.
 * RFC 7616 §3.4.4.
 *
 * @param username - Username to hash
 * @param realm - Realm
 * @param algorithm - Algorithm to use
 * @returns Hashed username (hex string)
 */
// RFC 7616 §3.4.4: Username hashing.
export async function hashDigestUsername(
    username: string,
    realm: string,
    algorithm: DigestAuthAlgorithm = 'SHA-256'
): Promise<string> {
    const hashAlg = getHashAlgorithm(algorithm);
    const data = `${username}:${realm}`;
    return computeHash(hashAlg, data);
}
