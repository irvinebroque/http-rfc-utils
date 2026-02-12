/**
 * Referrer-Policy header utilities.
 * W3C Referrer Policy Section 3, Section 4.1, Section 8.1, and Section 8.2.
 * @see https://www.w3.org/TR/referrer-policy/
 */

import { TOKEN_CHARS, isEmptyHeader } from './header-utils.js';
import type { ReferrerPolicy, ReferrerPolicyToken } from './types.js';

const REFERRER_POLICY_TOKENS: readonly ReferrerPolicyToken[] = [
    'no-referrer',
    'no-referrer-when-downgrade',
    'same-origin',
    'origin',
    'strict-origin',
    'origin-when-cross-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url',
];

const REFERRER_POLICY_TOKEN_SET = new Set<ReferrerPolicyToken>(REFERRER_POLICY_TOKENS);

function parseTokenList(value: string, current: ReferrerPolicy): ReferrerPolicy | null {
    if (isEmptyHeader(value)) {
        return null;
    }

    let selected = current;
    const members = value.split(',');

    for (const member of members) {
        const token = member.trim();
        if (!token) {
            return null;
        }

        if (!TOKEN_CHARS.test(token)) {
            return null;
        }

        if (REFERRER_POLICY_TOKEN_SET.has(token as ReferrerPolicyToken)) {
            selected = token as ReferrerPolicyToken;
        }
    }

    return selected;
}

/**
 * Parse one Referrer-Policy field-value.
 */
// W3C Referrer Policy Section 8.1: parse policy tokens and keep the last recognized policy.
export function parseReferrerPolicy(value: string | null | undefined): ReferrerPolicy | null {
    if (value == null) {
        return '';
    }

    return parseTokenList(value, '');
}

/**
 * Parse one or more Referrer-Policy header field-values.
 */
// W3C Referrer Policy Section 4.1 + Section 8.1: process header values in wire order; unknown tokens are ignored.
export function parseReferrerPolicyHeader(value: string | string[] | null | undefined): ReferrerPolicy | null {
    if (value == null) {
        return '';
    }

    const values = Array.isArray(value) ? value : [value];
    let selected: ReferrerPolicy = '';

    for (const headerValue of values) {
        const parsed = parseTokenList(headerValue, selected);
        if (parsed === null) {
            return null;
        }
        selected = parsed;
    }

    return selected;
}

/**
 * Validate a referrer policy token for strict use/formatting.
 */
export function validateReferrerPolicy(value: string): ReferrerPolicyToken {
    if (typeof value !== 'string') {
        throw new Error('Referrer policy must be a string');
    }

    const token = value.trim();
    if (!token) {
        throw new Error('Referrer policy token must be non-empty');
    }

    if (!TOKEN_CHARS.test(token)) {
        throw new Error('Referrer policy token must be a valid RFC 9110 token');
    }

    if (!REFERRER_POLICY_TOKEN_SET.has(token as ReferrerPolicyToken)) {
        throw new Error(`Invalid Referrer-Policy token: ${value}`);
    }

    return token as ReferrerPolicyToken;
}

/**
 * Format a strict Referrer-Policy header field-value.
 */
// W3C Referrer Policy Section 4.1: the header field-value is a policy-token list.
export function formatReferrerPolicy(value: string): string {
    return validateReferrerPolicy(value);
}

/**
 * Select effective policy after processing a new Referrer-Policy header.
 */
// W3C Referrer Policy Section 8.2: only replace current policy when parsed policy is non-empty.
export function selectEffectiveReferrerPolicy(
    current: ReferrerPolicyToken,
    next: string | string[] | null | undefined,
): ReferrerPolicyToken {
    const nextPolicy = parseReferrerPolicyHeader(next);
    if (nextPolicy === null || nextPolicy === '') {
        return current;
    }
    return nextPolicy;
}
