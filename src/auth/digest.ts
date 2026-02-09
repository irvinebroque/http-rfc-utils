/**
 * Digest authentication utilities.
 * RFC 7616 §3.3-§3.5.
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
import {
    parseAuthParamsList,
    quoteAuthParamValue,
} from './shared.js';
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

    const seen = new Map<string, string>();
    for (const param of challenge.params) {
        const name = param.name.toLowerCase();
        if (!seen.has(name)) {
            seen.set(name, param.value);
        }
    }

    const realm = seen.get('realm');
    const nonce = seen.get('nonce');

    // RFC 7616 §3.3: realm and nonce are required
    if (!realm || !nonce) {
        return null;
    }

    const result: DigestChallenge = {
        scheme: 'Digest',
        realm,
        nonce,
    };

    // domain: space-separated list of URIs
    const domain = seen.get('domain');
    if (domain) {
        result.domain = domain.split(/\s+/).filter(Boolean);
    }

    const opaque = seen.get('opaque');
    if (opaque) {
        result.opaque = opaque;
    }

    // RFC 7616 §3.3: stale is a flag (not quoted-string)
    const stale = seen.get('stale');
    if (stale && stale.toLowerCase() === 'true') {
        result.stale = true;
    }

    // RFC 7616 §3.3: algorithm is a token (not quoted-string)
    const algorithm = seen.get('algorithm');
    if (algorithm && isDigestAlgorithm(algorithm)) {
        result.algorithm = algorithm;
    }

    // RFC 7616 §3.3: qop-options is quoted-string with comma-separated values
    const qop = seen.get('qop');
    if (qop) {
        const qopValues = qop.split(',').map(v => v.trim()).filter(isDigestQop);
        if (qopValues.length > 0) {
            result.qop = qopValues;
        }
    }

    // RFC 7616 §3.3: charset is "UTF-8" (case-insensitive)
    const charset = seen.get('charset');
    if (charset && charset.toLowerCase() === 'utf-8') {
        result.charset = 'UTF-8';
    }

    // RFC 7616 §3.3: userhash is a flag
    const userhash = seen.get('userhash');
    if (userhash && userhash.toLowerCase() === 'true') {
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
    const parts: string[] = [];

    // RFC 7616 §3.3: realm MUST be quoted-string
    parts.push(`realm=${quoteAuthParamValue(challenge.realm)}`);

    // RFC 7616 §3.3: domain is quoted-string with space-separated URIs
    if (challenge.domain && challenge.domain.length > 0) {
        parts.push(`domain=${quoteAuthParamValue(challenge.domain.join(' '))}`);
    }

    // RFC 7616 §3.3: nonce MUST be quoted-string
    parts.push(`nonce=${quoteAuthParamValue(challenge.nonce)}`);

    // RFC 7616 §3.3: opaque is quoted-string
    if (challenge.opaque) {
        parts.push(`opaque=${quoteAuthParamValue(challenge.opaque)}`);
    }

    // RFC 7616 §3.3: stale is token (not quoted)
    if (challenge.stale) {
        parts.push('stale=true');
    }

    // RFC 7616 §3.3: algorithm is token (not quoted)
    if (challenge.algorithm) {
        parts.push(`algorithm=${challenge.algorithm}`);
    }

    // RFC 7616 §3.3: qop-options is quoted-string
    if (challenge.qop && challenge.qop.length > 0) {
        parts.push(`qop=${quoteAuthParamValue(challenge.qop.join(', '))}`);
    }

    // RFC 7616 §3.3: charset is token
    if (challenge.charset) {
        parts.push(`charset=${challenge.charset}`);
    }

    // RFC 7616 §3.3: userhash is token
    if (challenge.userhash) {
        parts.push('userhash=true');
    }

    return `Digest ${parts.join(', ')}`;
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

    const seen = new Map<string, string>();
    let hasUsername = false;
    let hasUsernameStar = false;

    for (const param of credentials.params) {
        const name = param.name.toLowerCase();
        if (name === 'username') {
            hasUsername = true;
        } else if (name === 'username*') {
            hasUsernameStar = true;
        }
        if (!seen.has(name)) {
            seen.set(name, param.value);
        }
    }

    // RFC 7616 §3.4: MUST NOT have both username and username*
    if (hasUsername && hasUsernameStar) {
        return null;
    }

    let username: string;
    let usernameEncoded = false;

    if (hasUsernameStar) {
        // RFC 7616 §3.4: username* uses RFC 8187 encoding
        const encoded = seen.get('username*');
        if (!encoded) {
            return null;
        }
        const decoded = decodeExtValue(encoded);
        if (!decoded) {
            return null;
        }
        username = decoded.value;
        usernameEncoded = true;
    } else {
        const u = seen.get('username');
        if (!u) {
            return null;
        }
        username = u;
    }

    const realm = seen.get('realm');
    const uri = seen.get('uri');
    const response = seen.get('response');

    // RFC 7616 §3.4: realm, uri, and response are required
    if (!realm || !uri || !response) {
        return null;
    }

    const result: DigestCredentials = {
        scheme: 'Digest',
        username,
        realm,
        uri,
        response,
    };

    if (usernameEncoded) {
        result.usernameEncoded = true;
    }

    // RFC 7616 §3.4: algorithm is token (not quoted)
    const algorithm = seen.get('algorithm');
    if (algorithm && isDigestAlgorithm(algorithm)) {
        result.algorithm = algorithm;
    }

    const cnonce = seen.get('cnonce');
    if (cnonce) {
        result.cnonce = cnonce;
    }

    const opaque = seen.get('opaque');
    if (opaque) {
        result.opaque = opaque;
    }

    // RFC 7616 §3.4: qop is token (not quoted)
    const qop = seen.get('qop');
    if (qop && isDigestQop(qop)) {
        result.qop = qop;
    }

    // RFC 7616 §3.4: nc is exactly 8 hex digits
    const nc = seen.get('nc');
    if (nc) {
        if (!NC_REGEX.test(nc)) {
            return null;
        }
        result.nc = nc;
    }

    // RFC 7616 §3.4: userhash is token
    const userhash = seen.get('userhash');
    if (userhash && userhash.toLowerCase() === 'true') {
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
    const parts: string[] = [];

    // RFC 7616 §3.4: username or username* (quoted-string)
    if (credentials.usernameEncoded) {
        // RFC 8187 encoding
        const encoded = encodeExtValue(credentials.username);
        parts.push(`username*=${encoded}`);
    } else {
        parts.push(`username=${quoteAuthParamValue(credentials.username)}`);
    }

    // RFC 7616 §3.4: realm is quoted-string
    parts.push(`realm=${quoteAuthParamValue(credentials.realm)}`);

    // RFC 7616 §3.4: uri is quoted-string
    parts.push(`uri=${quoteAuthParamValue(credentials.uri)}`);

    // RFC 7616 §3.4: response is quoted-string
    parts.push(`response=${quoteAuthParamValue(credentials.response)}`);

    // RFC 7616 §3.4: algorithm is token (not quoted)
    if (credentials.algorithm) {
        parts.push(`algorithm=${credentials.algorithm}`);
    }

    // RFC 7616 §3.4: cnonce is quoted-string
    if (credentials.cnonce) {
        parts.push(`cnonce=${quoteAuthParamValue(credentials.cnonce)}`);
    }

    // RFC 7616 §3.4: opaque is quoted-string
    if (credentials.opaque) {
        parts.push(`opaque=${quoteAuthParamValue(credentials.opaque)}`);
    }

    // RFC 7616 §3.4: qop is token (not quoted)
    if (credentials.qop) {
        parts.push(`qop=${credentials.qop}`);
    }

    // RFC 7616 §3.4: nc is exactly 8 hex digits (not quoted)
    if (credentials.nc) {
        parts.push(`nc=${credentials.nc}`);
    }

    // RFC 7616 §3.4: userhash is token
    if (credentials.userhash) {
        parts.push('userhash=true');
    }

    return `Digest ${parts.join(', ')}`;
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

    const result: DigestAuthenticationInfo = {};
    const seen = new Set<string>();

    for (const param of params) {
        const name = param.name.toLowerCase();
        if (seen.has(name)) {
            continue;
        }
        seen.add(name);

        switch (name) {
            case 'nextnonce':
                result.nextnonce = param.value;
                break;
            case 'qop':
                if (isDigestQop(param.value)) {
                    result.qop = param.value;
                }
                break;
            case 'rspauth':
                result.rspauth = param.value;
                break;
            case 'cnonce':
                result.cnonce = param.value;
                break;
            case 'nc':
                if (NC_REGEX.test(param.value)) {
                    result.nc = param.value;
                }
                break;
        }
    }

    return result;
}

/**
 * Format Authentication-Info header.
 * RFC 7616 §3.5.
 */
// RFC 7616 §3.5: Authentication-Info formatting.
export function formatDigestAuthenticationInfo(info: DigestAuthenticationInfo): string {
    const parts: string[] = [];

    // RFC 7616 §3.5: nextnonce is quoted-string
    if (info.nextnonce) {
        parts.push(`nextnonce=${quoteAuthParamValue(info.nextnonce)}`);
    }

    // RFC 7616 §3.5: qop is token
    if (info.qop) {
        parts.push(`qop=${info.qop}`);
    }

    // RFC 7616 §3.5: rspauth is quoted-string
    if (info.rspauth) {
        parts.push(`rspauth=${quoteAuthParamValue(info.rspauth)}`);
    }

    // RFC 7616 §3.5: cnonce is quoted-string
    if (info.cnonce) {
        parts.push(`cnonce=${quoteAuthParamValue(info.cnonce)}`);
    }

    // RFC 7616 §3.5: nc is token (8 hex digits)
    if (info.nc) {
        parts.push(`nc=${info.nc}`);
    }

    return parts.join(', ');
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
            throw new Error('nonce and cnonce are required for session algorithms');
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
        throw new Error('auth-int is not supported');
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
            throw new Error('cnonce and nc are required when qop is specified');
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
