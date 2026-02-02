/**
 * Authorization and WWW-Authenticate utilities for Basic, Bearer, and Digest.
 * RFC 7617 §2, §2.1; RFC 6750 §2.1, §3; RFC 7616 §3.3-3.5.
 * @see https://www.rfc-editor.org/rfc/rfc7617.html#section-2
 * @see https://www.rfc-editor.org/rfc/rfc7616.html
 */

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import type {
    AuthChallenge,
    AuthCredentials,
    AuthParam,
    BasicChallenge,
    BasicCredentials,
    BearerChallenge,
    BearerError,
    DigestAuthAlgorithm,
    DigestAuthenticationInfo,
    DigestAuthQop,
    DigestChallenge,
    DigestComputeOptions,
    DigestCredentials,
} from './types.js';
import { decodeExtValue, encodeExtValue } from './ext-value.js';
import { TOKEN_CHARS } from './header-utils.js';
const TOKEN68_RE = /^[A-Za-z0-9\-._~+\/]+={0,}$/;
const B64TOKEN_RE = /^[A-Za-z0-9\-._~+\/]+={0,}$/;

const BEARER_ERRORS: BearerError[] = ['invalid_request', 'invalid_token', 'insufficient_scope'];

function isToken(value: string): boolean {
    return TOKEN_CHARS.test(value);
}

function isToken68(value: string): boolean {
    return TOKEN68_RE.test(value);
}

function isB64Token(value: string): boolean {
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

function parseAuthParamsList(input: string): AuthParam[] | null {
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

function quoteAuthParamValue(value: string): string {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function formatAuthParams(params: AuthParam[]): string {
    return params.map(param => `${param.name}=${quoteAuthParamValue(param.value)}`).join(', ');
}

function hasCtl(value: string): boolean {
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
            continue;
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

    return { scheme: 'Basic', realm, charset };
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
    const extensions: Record<string, string> = {};
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

// =============================================================================
// Digest Authentication (RFC 7616)
// =============================================================================

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
 * Get the Web Crypto algorithm name for a Digest algorithm.
 * RFC 7616 §3.3.
 */
function getHashAlgorithm(algorithm: DigestAuthAlgorithm): string {
    const base = algorithm.replace(/-sess$/, '');
    switch (base) {
        case 'MD5':
            return 'MD5';
        case 'SHA-256':
            return 'SHA-256';
        case 'SHA-512-256':
            return 'SHA-512';
        default:
            return 'SHA-256';
    }
}

/**
 * Compute a hash using Web Crypto.
 * Returns lowercase hex string.
 */
async function computeHash(algorithm: string, data: string | Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;

    // MD5 is not available in Web Crypto, use a simple implementation
    if (algorithm === 'MD5') {
        return computeMD5(bytes);
    }

    // Create a copy to ensure a plain ArrayBuffer
    const buffer = new Uint8Array(bytes).buffer;
    const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
    const hashArray = new Uint8Array(hashBuffer);

    // For SHA-512-256, truncate to 256 bits (32 bytes)
    const truncated = algorithm === 'SHA-512' ? hashArray.slice(0, 32) : hashArray;

    return Array.from(truncated)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Simple MD5 implementation using Node.js crypto.
 * Note: MD5 is deprecated and only included for backward compatibility.
 */
function computeMD5(data: Uint8Array): string {
    return createHash('md5').update(data).digest('hex');
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
    algorithm: DigestAuthAlgorithm = 'MD5',
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
        algorithm = 'MD5',
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
