/**
 * OAuth 2.0 Token Revocation request helpers.
 * RFC 7009 §2.1, §4.1.2.
 * @see https://www.rfc-editor.org/rfc/rfc7009.html
 */

import type {
    TokenRevocationRequestInput,
    TokenRevocationRequestParams,
    TokenTypeHint,
} from '../types/auth.js';

const TOKEN_TYPE_HINT_RE = /^[A-Za-z0-9._~-]+$/;

type TokenRevocationParamInput = string | URLSearchParams | Record<string, string | undefined>;

function normalizeTokenRevocationParams(input: TokenRevocationParamInput): URLSearchParams {
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

function validateTokenTypeHint(tokenTypeHint: string): void {
    if (!TOKEN_TYPE_HINT_RE.test(tokenTypeHint)) {
        throw new Error('token_type_hint must contain only ALPHA / DIGIT / "-" / "." / "_" / "~" characters.');
    }
}

/**
 * Validate token revocation request parameters.
 * RFC 7009 §2.1.
 */
export function validateTokenRevocationRequestParams(input: TokenRevocationRequestInput): void {
    if (typeof input.token !== 'string' || input.token.length === 0) {
        throw new Error('token must be a non-empty string.');
    }
    if (input.tokenTypeHint !== undefined) {
        validateTokenTypeHint(input.tokenTypeHint);
    }
}

/**
 * Parse token revocation request parameters.
 * RFC 7009 §2.1.
 */
export function parseTokenRevocationRequestParams(
    input: TokenRevocationParamInput
): TokenRevocationRequestParams | null {
    const params = normalizeTokenRevocationParams(input);
    const tokenValues = params.getAll('token');
    if (tokenValues.length !== 1) {
        return null;
    }

    const token = tokenValues[0] ?? '';
    if (token.length === 0) {
        return null;
    }

    const tokenTypeHintValues = params.getAll('token_type_hint');
    if (tokenTypeHintValues.length > 1) {
        return null;
    }

    const tokenTypeHint = tokenTypeHintValues[0];
    if (tokenTypeHint === undefined) {
        return { token };
    }
    if (tokenTypeHint.length === 0 || !TOKEN_TYPE_HINT_RE.test(tokenTypeHint)) {
        return null;
    }

    return {
        token,
        tokenTypeHint: tokenTypeHint as TokenTypeHint,
    };
}

/**
 * Format token revocation request parameters.
 * RFC 7009 §2.1.
 */
export function formatTokenRevocationRequestParams(input: TokenRevocationRequestInput): string {
    validateTokenRevocationRequestParams(input);

    const params = new URLSearchParams();
    params.set('token', input.token);
    if (input.tokenTypeHint !== undefined) {
        params.set('token_type_hint', input.tokenTypeHint);
    }
    return params.toString();
}
