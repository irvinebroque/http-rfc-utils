/**
 * Named Information (ni) URIs per RFC 6920.
 * RFC 6920 §2, §3, §3.1, §4, §5.
 * @see https://www.rfc-editor.org/rfc/rfc6920.html
 */

import { generateDigest } from './digest.js';
import { percentDecode, percentEncode } from './uri.js';
import type { NiComparisonResult, NiHashAlgorithm, NiQueryParams, NiUri } from './types.js';

export type { NiComparisonResult, NiHashAlgorithm, NiQueryParams, NiUri } from './types.js';

type HashSuite = {
    baseAlgorithm: 'sha-256';
    bits: number;
};

const NI_HASH_SUITES: Record<string, HashSuite> = {
    'sha-256': { baseAlgorithm: 'sha-256', bits: 256 },
    'sha-256-128': { baseAlgorithm: 'sha-256', bits: 128 },
    'sha-256-120': { baseAlgorithm: 'sha-256', bits: 120 },
    'sha-256-96': { baseAlgorithm: 'sha-256', bits: 96 },
    'sha-256-64': { baseAlgorithm: 'sha-256', bits: 64 },
    'sha-256-32': { baseAlgorithm: 'sha-256', bits: 32 },
};

const UNRESERVED_PATTERN = /^[A-Za-z0-9._~-]+$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const REG_NAME_PATTERN = /^[A-Za-z0-9.-]+$/;
const IPV6_REFERENCE_PATTERN = /^[0-9A-Fa-f:.]+$/;

function isValidPort(portText: string): boolean {
    if (!/^\d+$/.test(portText)) {
        return false;
    }

    const port = Number(portText);
    return Number.isInteger(port) && port >= 0 && port <= 65535;
}

function isValidNiAuthority(authority: string): boolean {
    if (!authority) {
        return false;
    }

    for (const char of authority) {
        const code = char.charCodeAt(0);
        if (code <= 0x20 || code === 0x7f) {
            return false;
        }
    }

    if (authority.includes('@') || authority.includes('/') || authority.includes('?') || authority.includes('#') || authority.includes('\\')) {
        return false;
    }

    if (authority.startsWith('[')) {
        const closingBracketIndex = authority.indexOf(']');
        if (closingBracketIndex <= 1) {
            return false;
        }

        const host = authority.slice(1, closingBracketIndex);
        if (!IPV6_REFERENCE_PATTERN.test(host)) {
            return false;
        }

        const remainder = authority.slice(closingBracketIndex + 1);
        if (!remainder) {
            return true;
        }

        if (!remainder.startsWith(':')) {
            return false;
        }

        return isValidPort(remainder.slice(1));
    }

    const separatorIndex = authority.indexOf(':');
    const hasPort = separatorIndex !== -1;
    const host = hasPort ? authority.slice(0, separatorIndex) : authority;
    const portText = hasPort ? authority.slice(separatorIndex + 1) : '';

    if (!host || !REG_NAME_PATTERN.test(host) || host.includes('..')) {
        return false;
    }

    if (!hasPort) {
        return true;
    }

    if (portText.includes(':')) {
        return false;
    }

    return isValidPort(portText);
}

/**
 * RFC 6920 §3 and §5: Parse the `alg;val` production.
 */
export function parseNiUrlSegment(segment: string): NiUri | null {
    const separator = segment.indexOf(';');
    if (separator <= 0 || separator !== segment.lastIndexOf(';') || separator === segment.length - 1) {
        return null;
    }

    const algorithm = segment.slice(0, separator).toLowerCase();
    const value = segment.slice(separator + 1);

    if (!UNRESERVED_PATTERN.test(algorithm)) {
        return null;
    }

    const digest = decodeBase64UrlDigest(value);
    if (!digest) {
        return null;
    }

    // RFC 6920 §2: if algorithm suite indicates truncation, length is part of identity.
    if (!isValidDigestLengthForKnownAlgorithm(algorithm, digest)) {
        return null;
    }

    return {
        algorithm,
        value,
        digest,
    };
}

/**
 * RFC 6920 §5: Format the `alg;val` URL segment.
 */
export function formatNiUrlSegment(uri: Pick<NiUri, 'algorithm' | 'value' | 'digest'>): string {
    const algorithm = uri.algorithm.toLowerCase();
    const value = uri.value || encodeBase64Url(uri.digest);

    if (!UNRESERVED_PATTERN.test(algorithm)) {
        throw new Error(`Invalid NI algorithm token: ${uri.algorithm}`);
    }

    const digest = decodeBase64UrlDigest(value);
    if (!digest) {
        throw new Error('Invalid NI digest value: expected base64url without padding');
    }

    if (!isValidDigestLengthForKnownAlgorithm(algorithm, digest)) {
        throw new Error(`NI digest length does not match algorithm suite: ${algorithm}`);
    }

    return `${algorithm};${value}`;
}

/**
 * RFC 6920 §3: Parse an ni URI.
 */
export function parseNiUri(uri: string): NiUri | null {
    if (!uri || uri.includes('#')) {
        return null;
    }

    const schemeIndex = uri.indexOf(':');
    if (schemeIndex <= 0 || uri.slice(0, schemeIndex).toLowerCase() !== 'ni') {
        return null;
    }

    const rest = uri.slice(schemeIndex + 1);
    if (!rest.startsWith('//')) {
        return null;
    }

    const queryIndex = rest.indexOf('?');
    const hierPart = queryIndex >= 0 ? rest.slice(0, queryIndex) : rest;
    const queryPart = queryIndex >= 0 ? rest.slice(queryIndex + 1) : '';

    const authorityAndPath = hierPart.slice(2);
    const slashIndex = authorityAndPath.indexOf('/');
    if (slashIndex < 0) {
        return null;
    }

    const authority = authorityAndPath.slice(0, slashIndex);
    const segment = authorityAndPath.slice(slashIndex + 1);

    // RFC 6920 §3: ni-hier-part has exactly one alg-val after '/'.
    if (segment.includes('/')) {
        return null;
    }

    const parsedSegment = parseNiUrlSegment(segment);
    if (!parsedSegment) {
        return null;
    }

    const result: NiUri = {
        algorithm: parsedSegment.algorithm,
        value: parsedSegment.value,
        digest: parsedSegment.digest,
    };

    if (authority) {
        result.authority = authority;
    }

    if (queryPart) {
        const query = parseNiQuery(queryPart);
        if (!query) {
            return null;
        }
        result.query = query;
    }

    return result;
}

/**
 * RFC 6920 §3: Format an ni URI.
 */
export function formatNiUri(uri: NiUri): string {
    const segment = formatNiUrlSegment(uri);
    const authority = uri.authority ?? '';
    if (authority && !isValidNiAuthority(authority)) {
        throw new Error(`Invalid NI authority: ${authority}`);
    }
    const query = formatNiQuery(uri.query);
    return `ni://${authority}/${segment}${query}`;
}

/**
 * RFC 6920 §2: Compare NI identity (algorithm + decoded digest bytes only).
 */
export function compareNiUris(a: string | NiUri, b: string | NiUri): NiComparisonResult {
    const left = typeof a === 'string' ? parseNiUri(a) : normalizeParsedNi(a);
    const right = typeof b === 'string' ? parseNiUri(b) : normalizeParsedNi(b);

    if (!left || !right) {
        return {
            matches: false,
            leftValid: left !== null,
            rightValid: right !== null,
        };
    }

    if (left.algorithm !== right.algorithm) {
        return {
            matches: false,
            leftValid: true,
            rightValid: true,
        };
    }

    if (!bytesEqual(left.digest, right.digest)) {
        return {
            matches: false,
            leftValid: true,
            rightValid: true,
        };
    }

    return {
        matches: true,
        leftValid: true,
        rightValid: true,
    };
}

/**
 * RFC 6920 §4: Map ni URI to HTTP(S) .well-known URL.
 */
export function toWellKnownNiUrl(
    uri: string | NiUri,
    options?: { scheme?: 'http' | 'https'; authority?: string }
): string | null {
    const parsed = typeof uri === 'string' ? parseNiUri(uri) : normalizeParsedNi(uri);
    if (!parsed) {
        return null;
    }

    const authority = parsed.authority || options?.authority;
    if (!authority) {
        return null;
    }
    if (!isValidNiAuthority(authority)) {
        return null;
    }

    const scheme = options?.scheme ?? 'https';
    const query = formatNiQuery(parsed.query);
    return `${scheme}://${authority}/.well-known/ni/${parsed.algorithm}/${parsed.value}${query}`;
}

/**
 * RFC 6920 §4: Reverse-map a .well-known/ni URL to ni URI.
 */
export function fromWellKnownNiUrl(url: string, includeAuthority = true): NiUri | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
    }

    const path = parsed.pathname;
    if (!path.startsWith('/.well-known/ni/')) {
        return null;
    }

    const remainder = path.slice('/.well-known/ni/'.length);
    const parts = remainder.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return null;
    }

    const algorithm = percentDecode(parts[0]);
    const value = percentDecode(parts[1]);
    const segment = parseNiUrlSegment(`${algorithm};${value}`);
    if (!segment) {
        return null;
    }

    const result: NiUri = {
        algorithm: segment.algorithm,
        value: segment.value,
        digest: segment.digest,
    };

    if (includeAuthority) {
        result.authority = parsed.host;
    }

    const query = parsed.search.length > 1 ? parseNiQuery(parsed.search.slice(1)) : null;
    if (query === null) {
        return null;
    }
    if (query && Object.keys(query).length > 0) {
        result.query = query;
    }

    return result;
}

/**
 * RFC 6920 §2, §9.4: Compute NI digest value for a supported algorithm suite.
 */
export async function computeNiDigest(
    data: string | ArrayBuffer | ArrayBufferView,
    algorithm: NiHashAlgorithm = 'sha-256'
): Promise<string> {
    const normalizedAlgorithm = algorithm.toLowerCase();
    const suite = NI_HASH_SUITES[normalizedAlgorithm];
    if (!suite) {
        throw new Error(`Unsupported NI algorithm suite: ${algorithm}`);
    }

    const digest = await generateDigest(data, suite.baseAlgorithm);
    const truncated = truncateDigest(digest.value, suite.bits);
    return encodeBase64Url(truncated);
}

/**
 * RFC 6920 §2: Verify bytes against an NI digest value.
 */
export async function verifyNiDigest(
    data: string | ArrayBuffer | ArrayBufferView,
    algorithm: NiHashAlgorithm,
    value: string
): Promise<boolean> {
    const normalizedAlgorithm = algorithm.toLowerCase();
    const expected = decodeBase64UrlDigest(value);
    if (!expected || !isValidDigestLengthForKnownAlgorithm(normalizedAlgorithm, expected)) {
        return false;
    }

    try {
        const computed = await computeNiDigest(data, normalizedAlgorithm);
        const computedBytes = decodeBase64UrlDigest(computed);
        if (!computedBytes) {
            return false;
        }
        return bytesEqual(expected, computedBytes);
    } catch {
        return false;
    }
}

function parseNiQuery(query: string): NiQueryParams | null {
    const params: NiQueryParams = {};

    for (const pair of query.split('&')) {
        if (!pair) {
            continue;
        }

        const separator = pair.indexOf('=');
        const rawName = separator >= 0 ? pair.slice(0, separator) : pair;
        const rawValue = separator >= 0 ? pair.slice(separator + 1) : '';

        const name = percentDecode(rawName);
        const value = percentDecode(rawValue);

        if (!name) {
            return null;
        }

        params[name] = value;

        // RFC 6920 §3.1: MUST support parsing the "ct" parameter name.
        if (name === 'ct') {
            params.ct = value;
        }
    }

    return params;
}

function formatNiQuery(query?: NiQueryParams): string {
    if (!query) {
        return '';
    }

    const entries: Array<[string, string]> = Object.entries(query)
        .filter(([name, value]) => value !== undefined && name !== 'ct')
        .map(([name, value]) => [name, String(value)]);

    if (query.ct !== undefined) {
        entries.unshift(['ct', query.ct]);
    }

    if (entries.length === 0) {
        return '';
    }

    const parts = entries.map(([name, value]) => `${percentEncode(name, 'query')}=${percentEncode(value, 'query')}`);
    return `?${parts.join('&')}`;
}

function normalizeParsedNi(uri: NiUri): NiUri | null {
    const parsed = parseNiUrlSegment(`${uri.algorithm};${uri.value}`);
    if (!parsed) {
        return null;
    }

    const normalized: NiUri = {
        algorithm: parsed.algorithm,
        value: parsed.value,
        digest: parsed.digest,
    };

    if (uri.authority !== undefined) {
        normalized.authority = uri.authority;
    }
    if (uri.query !== undefined) {
        normalized.query = uri.query;
    }

    return normalized;
}

function decodeBase64UrlDigest(value: string): Uint8Array | null {
    // RFC 6920 §3: base64url with no "=" padding.
    if (!value || value.includes('=') || !BASE64URL_PATTERN.test(value)) {
        return null;
    }

    const mod = value.length % 4;
    if (mod === 1) {
        return null;
    }

    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = mod === 0 ? base64 : `${base64}${'='.repeat(4 - mod)}`;

    let decoded: Buffer;
    try {
        decoded = Buffer.from(padded, 'base64');
    } catch {
        return null;
    }

    if (decoded.length === 0) {
        return null;
    }

    const bytes = new Uint8Array(decoded);

    // Reject non-canonical representations that a permissive decoder may accept.
    if (encodeBase64Url(bytes) !== value) {
        return null;
    }

    return bytes;
}

function encodeBase64Url(value: Uint8Array): string {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function isValidDigestLengthForKnownAlgorithm(algorithm: string, digest: Uint8Array): boolean {
    const suite = NI_HASH_SUITES[algorithm];
    if (!suite) {
        return true;
    }

    return digest.length === Math.ceil(suite.bits / 8);
}

function truncateDigest(digest: Uint8Array, bits: number): Uint8Array {
    const bytes = Math.floor(bits / 8);
    const remBits = bits % 8;

    if (bytes > digest.length) {
        throw new Error('Cannot truncate digest to a longer bit length');
    }

    if (remBits === 0) {
        return digest.slice(0, bytes);
    }

    const out = digest.slice(0, bytes + 1);
    const mask = 0xff << (8 - remBits);
    out[out.length - 1] = out[out.length - 1]! & mask;
    return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
