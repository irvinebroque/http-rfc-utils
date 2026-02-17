/**
 * OAuth 2.0 Demonstrating Proof of Possession (DPoP) helpers.
 * RFC 9449 §4.1-§4.3, §7.1, §8-§9.
 * @see https://www.rfc-editor.org/rfc/rfc9449.html
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type {
    AuthParam,
    DpopChallenge,
    DpopError,
    DpopJwk,
    DpopProofJwt,
    DpopProofJwtHeader,
    DpopProofJwtPayload,
    DpopProofJwtValidationOptions,
} from '../types/auth.js';
import {
    assertHeaderToken,
    assertNoCtl,
    TOKEN_CHARS,
} from '../header-utils.js';
import {
    formatAuthParams,
    isToken68,
    parseAuthorization,
    parseWWWAuthenticate,
} from './shared.js';
import { createObjectMap } from '../object-map.js';
import {
    AUTH_PARAM_SCHEMA_SKIP,
    AUTH_PARAM_SCHEMA_INVALID,
    buildAuthParamsBySchema,
    createAuthParamSchemaEntry,
    parseAuthParamsBySchema,
} from './internal-auth-param-schema.js';

const BASE64URL_SEGMENT_RE = /^[A-Za-z0-9_-]+={0,2}$/;
const BASE64URL_NOPAD_RE = /^[A-Za-z0-9_-]+$/;
const NONCE_RE = /^[\x21\x23-\x5B\x5D-\x7E]+$/;
const NON_ASCII_RE = /[^\x00-\x7F]/;
const DPOP_TYP = 'dpop+jwt';
const PRIVATE_JWK_MEMBERS = new Set(['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k']);
const DPOP_ERRORS: DpopError[] = [
    'invalid_request',
    'invalid_token',
    'insufficient_scope',
    'invalid_dpop_proof',
    'use_dpop_nonce',
];

interface DpopChallengeSchema {
    realm?: string;
    scope?: string;
    error?: DpopError;
    errorDescription?: string;
    errorUri?: string;
    algs?: string[];
    params?: Record<string, string>;
}

const DPOP_CHALLENGE_SCHEMA = [
    createAuthParamSchemaEntry<DpopChallengeSchema>({
        key: 'realm',
        property: 'realm',
    }),
    createAuthParamSchemaEntry<DpopChallengeSchema>({
        key: 'scope',
        property: 'scope',
    }),
    createAuthParamSchemaEntry<DpopChallengeSchema>({
        key: 'error',
        property: 'error',
        parse: (value) => DPOP_ERRORS.includes(value as DpopError)
            ? value as DpopError
            : AUTH_PARAM_SCHEMA_SKIP,
    }),
    createAuthParamSchemaEntry<DpopChallengeSchema>({
        key: 'error_description',
        property: 'errorDescription',
    }),
    createAuthParamSchemaEntry<DpopChallengeSchema>({
        key: 'error_uri',
        property: 'errorUri',
    }),
    createAuthParamSchemaEntry<DpopChallengeSchema>({
        key: 'algs',
        property: 'algs',
        parse: (value) => parseDpopAlgsParam(value),
        format: (value) => formatDpopAlgsParam(value),
    }),
] as const;

/**
 * Parse the DPoP header value into a decoded proof JWT.
 */
// RFC 9449 §4.1-§4.2: DPoP header carries a DPoP proof JWT.
export function parseDpopHeader(header: string): DpopProofJwt | null {
    return parseDpopProofJwt(header);
}

/**
 * Format a DPoP proof JWT for use as a DPoP header value.
 */
// RFC 9449 §4.1: DPoP header formatting.
export function formatDpopHeader(
    proof: DpopProofJwt,
    options: DpopProofJwtValidationOptions = {},
): string {
    return formatDpopProofJwt(proof, options);
}

/**
 * Parse DPoP Authorization credentials.
 */
// RFC 9449 §7.1: Authorization: DPoP token68.
export function parseDpopAuthorization(header: string): string | null {
    const parsed = parseAuthorization(header);
    if (!parsed || parsed.scheme.toLowerCase() !== 'dpop' || !parsed.token68) {
        return null;
    }
    if (!isToken68(parsed.token68)) {
        return null;
    }
    return parsed.token68;
}

/**
 * Format DPoP Authorization credentials.
 */
// RFC 9449 §7.1: Authorization: DPoP token68.
export function formatDpopAuthorization(token: string): string {
    if (!isToken68(token)) {
        throw new Error(`DPoP authorization token must match token68 syntax; received ${JSON.stringify(token)}`);
    }
    return `DPoP ${token}`;
}

/**
 * Parse a DPoP WWW-Authenticate challenge.
 */
// RFC 9449 §7.1: WWW-Authenticate: DPoP challenge parameters.
export function parseDpopChallenge(header: string): DpopChallenge | null {
    const challenges = parseWWWAuthenticate(header);
    const challenge = challenges.find((entry) => entry.scheme.toLowerCase() === 'dpop');
    if (!challenge || !challenge.params || challenge.params.length === 0) {
        return null;
    }

    const parsed = parseAuthParamsBySchema<DpopChallengeSchema>(
        challenge.params,
        DPOP_CHALLENGE_SCHEMA,
        {
            assignUnknown: (target, name, value) => {
                if (!target.params) {
                    target.params = createObjectMap<string>();
                }
                target.params[name] = value;
            },
        }
    );

    return parsed as DpopChallenge | null;
}

/**
 * Format a DPoP WWW-Authenticate challenge.
 */
// RFC 9449 §7.1: WWW-Authenticate: DPoP challenge formatting.
export function formatDpopChallenge(params: DpopChallenge): string {
    if (params.error !== undefined && !DPOP_ERRORS.includes(params.error)) {
        throw new Error(
            `DPoP challenge params.error must be one of ${DPOP_ERRORS.join(', ')}; received ${JSON.stringify(params.error)}`
        );
    }

    const parts: AuthParam[] = buildAuthParamsBySchema<DpopChallengeSchema>(
        params,
        DPOP_CHALLENGE_SCHEMA,
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
        return 'DPoP';
    }

    return `DPoP ${formatAuthParams(parts)}`;
}

/**
 * Parse a DPoP proof JWT.
 */
// RFC 9449 §4.1-§4.2: DPoP proof JWT parsing (no JOSE verification).
export function parseDpopProofJwt(
    jwt: string,
    options: DpopProofJwtValidationOptions = {},
): DpopProofJwt | null {
    if (!jwt || !jwt.trim()) {
        return null;
    }

    const trimmed = jwt.trim();
    if (!isToken68(trimmed)) {
        return null;
    }

    const segments = trimmed.split('.');
    if (segments.length !== 3) {
        return null;
    }

    const [encodedHeader, encodedPayload, signature] = segments;
    const header = decodeJwtSegment(encodedHeader);
    const payload = decodeJwtSegment(encodedPayload);
    if (!isRecord(header) || !isRecord(payload)) {
        return null;
    }

    const parsed: DpopProofJwt = {
        header: header as DpopProofJwtHeader,
        payload: payload as DpopProofJwtPayload,
        signature,
    };

    try {
        validateDpopProofJwt(parsed, options);
    } catch {
        return null;
    }

    return parsed;
}

/**
 * Format a DPoP proof JWT.
 */
// RFC 9449 §4.2: DPoP proof JWT formatting (no JOSE signing).
export function formatDpopProofJwt(
    proof: DpopProofJwt,
    options: DpopProofJwtValidationOptions = {},
): string {
    validateDpopProofJwt(proof, options);

    const headerJson = JSON.stringify(proof.header);
    const payloadJson = JSON.stringify(proof.payload);
    const encodedHeader = Buffer.from(headerJson, 'utf8').toString('base64url');
    const encodedPayload = Buffer.from(payloadJson, 'utf8').toString('base64url');

    return `${encodedHeader}.${encodedPayload}.${proof.signature}`;
}

/**
 * Validate a DPoP proof JWT payload and header.
 */
// RFC 9449 §4.2-§4.3: DPoP proof validation (no JOSE verification).
export function validateDpopProofJwt(
    proof: DpopProofJwt,
    options: DpopProofJwtValidationOptions = {},
): void {
    if (!proof || typeof proof !== 'object') {
        throw new Error('DPoP proof must be an object');
    }

    if (!isRecord(proof.header)) {
        throw new Error('DPoP proof header must be a JSON object');
    }
    if (!isRecord(proof.payload)) {
        throw new Error('DPoP proof payload must be a JSON object');
    }

    if (typeof proof.signature !== 'string' || proof.signature.length === 0) {
        throw new Error('DPoP proof signature must be a non-empty base64url string');
    }
    if (!BASE64URL_SEGMENT_RE.test(proof.signature)) {
        throw new Error('DPoP proof signature must be a base64url string');
    }

    validateDpopHeader(proof.header, options.allowedAlgorithms);
    validateDpopPayload(proof.payload, options);
}

/**
 * Compute a DPoP `ath` value for an access token.
 */
// RFC 9449 §4.2: ath is base64url(SHA-256(ASCII(access-token))).
export function computeDpopAth(accessToken: string): string {
    if (NON_ASCII_RE.test(accessToken)) {
        throw new Error('DPoP access token must be ASCII for ath hashing');
    }

    return createHash('sha256')
        .update(accessToken, 'ascii')
        .digest('base64url');
}

/**
 * Parse a DPoP-Nonce header value.
 */
// RFC 9449 §8.1: nonce = 1*NQCHAR.
export function parseDpopNonce(header: string): string | null {
    if (!header || !header.trim()) {
        return null;
    }
    const value = header.trim();
    if (!NONCE_RE.test(value)) {
        return null;
    }
    return value;
}

/**
 * Format a DPoP-Nonce header value.
 */
// RFC 9449 §8.1: nonce = 1*NQCHAR.
export function formatDpopNonce(value: string): string {
    validateDpopNonce(value);
    return value;
}

/**
 * Validate a DPoP nonce value.
 */
// RFC 9449 §8.1: nonce = 1*NQCHAR.
export function validateDpopNonce(value: string): void {
    if (!NONCE_RE.test(value)) {
        throw new Error(`DPoP nonce must match NQCHAR syntax; received ${JSON.stringify(value)}`);
    }
}

function parseDpopAlgsParam(value: string): string[] | typeof AUTH_PARAM_SCHEMA_INVALID {
    const tokens = value.split(' ').filter(Boolean);
    if (tokens.length === 0) {
        return AUTH_PARAM_SCHEMA_INVALID;
    }
    for (const token of tokens) {
        if (!TOKEN_CHARS.test(token)) {
            return AUTH_PARAM_SCHEMA_INVALID;
        }
    }
    return tokens;
}

function formatDpopAlgsParam(value: unknown): string | typeof AUTH_PARAM_SCHEMA_SKIP {
    if (!Array.isArray(value)) {
        return AUTH_PARAM_SCHEMA_SKIP;
    }
    if (value.length === 0) {
        return AUTH_PARAM_SCHEMA_SKIP;
    }
    const tokens: string[] = [];
    for (const alg of value) {
        if (typeof alg !== 'string') {
            throw new Error('DPoP challenge algs must be an array of strings');
        }
        assertHeaderToken(alg, 'DPoP challenge alg');
        tokens.push(alg);
    }
    return tokens.join(' ');
}

function decodeJwtSegment(segment: string): unknown | null {
    if (!BASE64URL_SEGMENT_RE.test(segment)) {
        return null;
    }
    let decoded: string;
    try {
        decoded = Buffer.from(segment, 'base64url').toString('utf8');
    } catch {
        return null;
    }
    try {
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

function validateDpopHeader(
    header: DpopProofJwtHeader,
    allowedAlgorithms?: readonly string[],
): void {
    if (header.typ !== DPOP_TYP) {
        throw new Error(`DPoP proof typ must be "${DPOP_TYP}"; received ${JSON.stringify(header.typ)}`);
    }
    if (typeof header.alg !== 'string') {
        throw new Error('DPoP proof alg must be a string');
    }
    assertHeaderToken(header.alg, 'DPoP proof alg');
    if (header.alg === 'none' || header.alg.startsWith('HS')) {
        throw new Error(`DPoP proof alg must be an asymmetric JWS algorithm; received ${JSON.stringify(header.alg)}`);
    }
    if (allowedAlgorithms && !allowedAlgorithms.includes(header.alg)) {
        throw new Error(
            `DPoP proof alg must be one of ${allowedAlgorithms.join(', ')}; received ${JSON.stringify(header.alg)}`
        );
    }

    validateDpopJwk(header.jwk);
}

function validateDpopPayload(payload: DpopProofJwtPayload, options: DpopProofJwtValidationOptions): void {
    if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
        throw new Error('DPoP proof jti must be a non-empty string');
    }
    assertNoCtl(payload.jti, 'DPoP proof jti');

    if (typeof payload.htm !== 'string' || payload.htm.length === 0) {
        throw new Error('DPoP proof htm must be a non-empty string');
    }
    assertHeaderToken(payload.htm, 'DPoP proof htm');

    if (typeof payload.htu !== 'string' || payload.htu.length === 0) {
        throw new Error('DPoP proof htu must be a non-empty string');
    }

    const normalizedHtu = normalizeHtu(payload.htu, options.normalizeHtu !== false, false);

    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || !Number.isInteger(payload.iat)) {
        throw new Error('DPoP proof iat must be an integer numeric date');
    }

    if (payload.nonce !== undefined) {
        if (typeof payload.nonce !== 'string') {
            throw new Error('DPoP proof nonce must be a string');
        }
        validateDpopNonce(payload.nonce);
    }

    const requireNonce = options.requireNonce || options.expectedNonce !== undefined;
    if (requireNonce) {
        if (!payload.nonce) {
            throw new Error('DPoP proof nonce is required');
        }
        if (options.expectedNonce !== undefined && payload.nonce !== options.expectedNonce) {
            throw new Error('DPoP proof nonce does not match expected nonce');
        }
    }

    const requireAth = options.requireAth || options.accessToken !== undefined;
    if (requireAth) {
        if (!payload.ath) {
            throw new Error('DPoP proof ath is required when an access token is present');
        }
        if (typeof payload.ath !== 'string' || !BASE64URL_NOPAD_RE.test(payload.ath)) {
            throw new Error('DPoP proof ath must be an unpadded base64url string');
        }
        if (options.accessToken !== undefined) {
            const expectedAth = computeDpopAth(options.accessToken);
            const expectedBuffer = Buffer.from(expectedAth, 'ascii');
            const actualBuffer = Buffer.from(payload.ath, 'ascii');
            if (expectedBuffer.length !== actualBuffer.length) {
                throw new Error('DPoP proof ath does not match the access token hash');
            }
            if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
                throw new Error('DPoP proof ath does not match the access token hash');
            }
        }
    } else if (payload.ath !== undefined) {
        if (typeof payload.ath !== 'string' || !BASE64URL_NOPAD_RE.test(payload.ath)) {
            throw new Error('DPoP proof ath must be an unpadded base64url string');
        }
    }

    if (options.expectedMethod !== undefined && payload.htm !== options.expectedMethod) {
        throw new Error('DPoP proof htm does not match expected HTTP method');
    }

    if (options.expectedHtu !== undefined) {
        const expected = normalizeHtu(
            options.expectedHtu instanceof URL ? options.expectedHtu.toString() : options.expectedHtu,
            options.normalizeHtu !== false,
            true,
        );
        if (normalizedHtu !== expected) {
            throw new Error('DPoP proof htu does not match expected HTTP URI');
        }
    }

    if (options.maxTokenAgeSeconds !== undefined || options.maxClockSkewSeconds !== undefined) {
        const now = options.now ?? Math.floor(Date.now() / 1000);
        const maxSkew = options.maxClockSkewSeconds ?? 0;
        if (!Number.isFinite(now)) {
            throw new Error('DPoP validation now must be a finite number');
        }
        if (options.maxTokenAgeSeconds !== undefined) {
            if (!Number.isFinite(options.maxTokenAgeSeconds) || options.maxTokenAgeSeconds < 0) {
                throw new Error('DPoP maxTokenAgeSeconds must be a non-negative number');
            }
            if (payload.iat < now - options.maxTokenAgeSeconds - maxSkew) {
                throw new Error('DPoP proof iat is too far in the past');
            }
        }
        if (!Number.isFinite(maxSkew) || maxSkew < 0) {
            throw new Error('DPoP maxClockSkewSeconds must be a non-negative number');
        }
        if (payload.iat > now + maxSkew) {
            throw new Error('DPoP proof iat is in the future beyond allowed skew');
        }
    }
}

function validateDpopJwk(jwk: DpopJwk | undefined): void {
    if (!isRecord(jwk)) {
        throw new Error('DPoP proof jwk must be a JSON object');
    }
    if (typeof jwk.kty !== 'string') {
        throw new Error('DPoP proof jwk.kty must be a string');
    }
    assertHeaderToken(jwk.kty, 'DPoP proof jwk.kty');
    if (jwk.kty === 'oct') {
        throw new Error('DPoP proof jwk must not be a symmetric (oct) key');
    }
    for (const member of PRIVATE_JWK_MEMBERS) {
        if (member in jwk) {
            throw new Error(`DPoP proof jwk must not include private key member "${member}"`);
        }
    }
}

function normalizeHtu(value: string, normalize: boolean, allowQuery: boolean): string {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error(`DPoP proof htu must be an absolute URL; received ${JSON.stringify(value)}`);
    }

    if (!allowQuery && (parsed.search !== '' || parsed.hash !== '')) {
        throw new Error('DPoP proof htu must not include query or fragment components');
    }

    if (!normalize) {
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    }

    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const defaultPort = protocol === 'https:'
        ? '443'
        : protocol === 'http:'
            ? '80'
            : '';
    const port = parsed.port && parsed.port !== defaultPort ? `:${parsed.port}` : '';
    const pathname = parsed.pathname || '/';
    return `${protocol}//${hostname}${port}${pathname}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
