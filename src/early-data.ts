/**
 * Early-Data and 425 helpers per RFC 8470.
 * RFC 8470 §5.1, §5.2.
 * @see https://www.rfc-editor.org/rfc/rfc8470.html#section-5.1
 */

import type { EarlyData425Options, EarlyDataValue } from './types.js';
import { getHeaderValue } from './header-utils.js';

/**
 * Parse an Early-Data header field value.
 *
 * RFC 8470 §5.1 defines `Early-Data = "1"`.
 */
// RFC 8470 §5.1: ABNF allows only literal "1".
export function parseEarlyData(value: string): EarlyDataValue | null {
    if (value.trim() === '1') {
        return 1;
    }

    return null;
}

/**
 * Format an Early-Data header field value.
 */
// RFC 8470 §5.1: only value is "1".
export function formatEarlyData(value: EarlyDataValue = 1): string {
    if (value !== 1) {
        throw new Error('Invalid Early-Data value; expected 1');
    }

    return '1';
}

/**
 * Determine whether a request carries any Early-Data signal.
 *
 * This helper intentionally treats any present field instance as a signal,
 * including invalid values and multiple instances, per RFC 8470 §5.1 server
 * behavior guidance.
 */
// RFC 8470 §5.1: multiple or invalid instances are equivalent to "1" for servers.
export function hasEarlyDataSignal(input: Request | Headers | string | string[] | null | undefined): boolean {
    if (input == null) {
        return false;
    }

    if (input instanceof Request) {
        return getHeaderValue(input, 'early-data') !== null;
    }

    if (input instanceof Headers) {
        return getHeaderValue(input, 'early-data') !== null;
    }

    if (Array.isArray(input)) {
        return input.length > 0;
    }

    return true;
}

/**
 * Determine if emitting 425 Too Early is RFC-eligible.
 *
 * This helper only enforces the RFC 8470 §5.2 emission precondition.
 * Replay-risk policy and retry strategy remain caller responsibilities.
 */
// RFC 8470 §5.2: do not emit 425 unless request was in early data or signaled.
export function canSend425(options: EarlyData425Options = {}): boolean {
    if (options.requestInEarlyData === true) {
        return true;
    }

    return hasEarlyDataSignal(options.earlyData);
}
