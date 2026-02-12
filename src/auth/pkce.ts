/**
 * OAuth 2.0 Proof Key for Code Exchange (PKCE) utilities.
 * RFC 7636 §4.1-§4.3, §4.5-§4.6, §7.1-§7.2, Appendix A-B.
 * @see https://www.rfc-editor.org/rfc/rfc7636.html
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
    PkceAuthorizationRequestInput,
    PkceAuthorizationRequestParams,
    PkceCodeChallengeMethod,
    PkceCodeVerifierGenerationOptions,
    PkceTokenRequestParams,
} from '../types/auth.js';

const PKCE_METHODS: readonly PkceCodeChallengeMethod[] = ['plain', 'S256'];
const PKCE_VALUE_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
const MIN_PKCE_VERIFIER_BYTES = 32;
const MAX_PKCE_VERIFIER_BYTES = 96;

type PkceParamInput = string | URLSearchParams | Record<string, string | undefined>;

function isPkceCodeChallengeMethod(value: string): value is PkceCodeChallengeMethod {
    return PKCE_METHODS.includes(value as PkceCodeChallengeMethod);
}

function normalizePkceParams(input: PkceParamInput): URLSearchParams {
    if (typeof input === 'string') {
        return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
    }
    if (input instanceof URLSearchParams) {
        return new URLSearchParams(input);
    }

    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(input)) {
        if (value !== undefined) {
            params.append(name, value);
        }
    }
    return params;
}

/**
 * Validate code verifier syntax.
 * RFC 7636 §4.1, §7.1.
 */
export function validatePkceCodeVerifier(codeVerifier: string): void {
    if (!PKCE_VALUE_RE.test(codeVerifier)) {
        throw new Error(
            'PKCE code_verifier must be 43-128 characters from ALPHA / DIGIT / "-" / "." / "_" / "~".'
        );
    }
}

/**
 * Validate code challenge syntax.
 * RFC 7636 §4.2, Appendix A.
 */
export function validatePkceCodeChallenge(codeChallenge: string): void {
    if (!PKCE_VALUE_RE.test(codeChallenge)) {
        throw new Error(
            'PKCE code_challenge must be 43-128 characters from ALPHA / DIGIT / "-" / "." / "_" / "~".'
        );
    }
}

/**
 * Generate a PKCE code verifier from CSPRNG bytes.
 * RFC 7636 §4.1, §7.1.
 */
export function generatePkceCodeVerifier(options: PkceCodeVerifierGenerationOptions = {}): string {
    const byteLength = options.byteLength ?? MIN_PKCE_VERIFIER_BYTES;
    if (!Number.isInteger(byteLength)) {
        throw new Error('PKCE code verifier byteLength must be an integer.');
    }
    if (byteLength < MIN_PKCE_VERIFIER_BYTES || byteLength > MAX_PKCE_VERIFIER_BYTES) {
        throw new Error('PKCE code verifier byteLength must be between 32 and 96.');
    }

    const codeVerifier = randomBytes(byteLength).toString('base64url');
    validatePkceCodeVerifier(codeVerifier);
    return codeVerifier;
}

/**
 * Derive a PKCE code challenge from a verifier.
 * RFC 7636 §4.2, Appendix A.
 */
export function derivePkceCodeChallenge(
    codeVerifier: string,
    codeChallengeMethod: PkceCodeChallengeMethod = 'S256'
): string {
    validatePkceCodeVerifier(codeVerifier);
    if (!isPkceCodeChallengeMethod(codeChallengeMethod)) {
        throw new Error(`Unsupported PKCE code_challenge_method: ${codeChallengeMethod}`);
    }

    if (codeChallengeMethod === 'plain') {
        return codeVerifier;
    }

    const digest = createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
    validatePkceCodeChallenge(digest);
    return digest;
}

/**
 * Verify verifier+method against a stored code challenge.
 * RFC 7636 §4.6.
 */
export function verifyPkceCodeVerifier(
    codeVerifier: string,
    codeChallenge: string,
    codeChallengeMethod: PkceCodeChallengeMethod = 'S256'
): boolean {
    validatePkceCodeVerifier(codeVerifier);
    validatePkceCodeChallenge(codeChallenge);
    if (!isPkceCodeChallengeMethod(codeChallengeMethod)) {
        throw new Error(`Unsupported PKCE code_challenge_method: ${codeChallengeMethod}`);
    }

    const derived = derivePkceCodeChallenge(codeVerifier, codeChallengeMethod);
    const derivedBuffer = Buffer.from(derived, 'ascii');
    const challengeBuffer = Buffer.from(codeChallenge, 'ascii');
    if (derivedBuffer.length !== challengeBuffer.length) {
        return false;
    }
    return timingSafeEqual(derivedBuffer, challengeBuffer);
}

/**
 * Parse PKCE parameters from an OAuth authorization request.
 * RFC 7636 §4.3.
 */
export function parsePkceAuthorizationRequestParams(input: PkceParamInput): PkceAuthorizationRequestParams | null {
    const params = normalizePkceParams(input);
    const codeChallengeValues = params.getAll('code_challenge');
    if (codeChallengeValues.length !== 1) {
        return null;
    }

    const codeChallengeMethodValues = params.getAll('code_challenge_method');
    if (codeChallengeMethodValues.length > 1) {
        return null;
    }

    const codeChallenge = codeChallengeValues[0] ?? '';
    if (!PKCE_VALUE_RE.test(codeChallenge)) {
        return null;
    }

    const codeChallengeMethod = codeChallengeMethodValues[0] ?? 'plain';
    if (!isPkceCodeChallengeMethod(codeChallengeMethod)) {
        return null;
    }

    return {
        codeChallenge,
        codeChallengeMethod,
    };
}

/**
 * Format PKCE authorization request parameters.
 * RFC 7636 §4.3.
 */
export function formatPkceAuthorizationRequestParams(input: PkceAuthorizationRequestInput): string {
    const codeChallengeMethod = input.codeChallengeMethod ?? 'S256';
    if (!isPkceCodeChallengeMethod(codeChallengeMethod)) {
        throw new Error(`Unsupported PKCE code_challenge_method: ${codeChallengeMethod}`);
    }
    validatePkceCodeChallenge(input.codeChallenge);

    const params = new URLSearchParams();
    params.set('code_challenge', input.codeChallenge);
    params.set('code_challenge_method', codeChallengeMethod);
    return params.toString();
}

/**
 * Parse PKCE parameters from an OAuth token request.
 * RFC 7636 §4.5.
 */
export function parsePkceTokenRequestParams(input: PkceParamInput): PkceTokenRequestParams | null {
    const params = normalizePkceParams(input);
    const codeVerifierValues = params.getAll('code_verifier');
    if (codeVerifierValues.length !== 1) {
        return null;
    }

    const codeVerifier = codeVerifierValues[0] ?? '';
    if (!PKCE_VALUE_RE.test(codeVerifier)) {
        return null;
    }

    return { codeVerifier };
}

/**
 * Format PKCE token request parameters.
 * RFC 7636 §4.5.
 */
export function formatPkceTokenRequestParams(input: PkceTokenRequestParams): string {
    validatePkceCodeVerifier(input.codeVerifier);

    const params = new URLSearchParams();
    params.set('code_verifier', input.codeVerifier);
    return params.toString();
}
