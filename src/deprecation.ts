/**
 * Deprecation HTTP Response Header Field per RFC 9745.
 * RFC 9745 §2, §2.1, §2.2, §3.
 * @see https://www.rfc-editor.org/rfc/rfc9745.html
 */

import { SfDate } from './types.js';
import { parseSfItem, serializeSfItem } from './structured-fields.js';
import { formatHTTPDate } from './datetime.js';

/**
 * Parse a Deprecation header value.
 *
 * The Deprecation field is an Item Structured Header Field whose value
 * MUST be a Date per RFC 9651 §3.3.7, expressed as `@<unix-seconds>`.
 *
 * @param value - The Deprecation header value (e.g., "\@1688169599")
 * @returns The deprecation date, or null if invalid
 *
 * @example
 * ```ts
 * const date = parseDeprecation('@1688169599');
 * // date?.toDate() => 2023-06-30T23:59:59.000Z
 * ```
 */
// RFC 9745 §2.1: Deprecation = sf-item (Date per RFC 9651 §3.3.7).
export function parseDeprecation(value: string): Date | null {
    if (!value || !value.trim()) {
        return null;
    }

    const item = parseSfItem(value.trim());
    if (!item) {
        return null;
    }

    if (!(item.value instanceof SfDate)) {
        return null;
    }

    return item.value.toDate();
}

/**
 * Format a Deprecation header value from a Date.
 *
 * Produces an RFC 9651 Date item: `@<unix-seconds>`.
 *
 * @param date - The deprecation date
 * @returns Formatted Deprecation header value
 *
 * @example
 * ```ts
 * const header = formatDeprecation(new Date('2023-06-30T23:59:59Z'));
 * // "@1688169599"
 * ```
 */
// RFC 9745 §2.1: Deprecation uses RFC 9651 Date format.
export function formatDeprecation(date: Date): string {
    const sfDate = SfDate.fromDate(date);
    return serializeSfItem({ value: sfDate });
}

/**
 * Check if a deprecation date indicates an already-deprecated resource.
 *
 * Per RFC 9745 §2.1, a deprecation date in the past means the resource
 * has already been deprecated. A date in the future means it will be
 * deprecated at that time.
 *
 * @param deprecation - Parsed deprecation date (null if no header)
 * @returns true if the resource is currently deprecated
 */
// RFC 9745 §2.1: Past dates mean already deprecated.
export function isDeprecated(deprecation: Date | null): boolean {
    if (!deprecation) {
        return false;
    }
    return deprecation.getTime() <= Date.now();
}

/**
 * Validate that a Sunset date is after the Deprecation date.
 *
 * Per RFC 9745 §3, when both Deprecation and Sunset headers are present,
 * the Sunset date SHOULD be after the Deprecation date (deprecation
 * signals intent, sunset signals removal).
 *
 * @param deprecation - The deprecation date
 * @param sunset - The sunset date
 * @returns true if sunset is after deprecation (valid ordering)
 */
// RFC 9745 §3 + RFC 8594: Sunset SHOULD follow deprecation.
export function validateDeprecationSunsetOrder(deprecation: Date, sunset: Date): boolean {
    return sunset.getTime() >= deprecation.getTime();
}

/**
 * Build Deprecation and optionally Sunset headers for a response.
 *
 * Returns an object suitable for spreading into response headers.
 *
 * @param deprecation - The deprecation date
 * @param sunset - Optional sunset date (resource removal date)
 * @returns Headers object with Deprecation and optionally Sunset
 *
 * @example
 * ```ts
 * const headers = buildDeprecationHeaders(
 *     new Date('2025-01-01'),
 *     new Date('2025-07-01')
 * );
 * // { Deprecation: '@1735689600', Sunset: 'Wed, 01 Jul 2025 00:00:00 GMT' }
 * ```
 */
// RFC 9745 §2.1, RFC 8594 §3: Build deprecation + sunset header pair.
export function buildDeprecationHeaders(
    deprecation: Date,
    sunset?: Date,
): Record<string, string> {
    const headers: Record<string, string> = {
        'Deprecation': formatDeprecation(deprecation),
    };

    if (sunset) {
        // RFC 8594 §3: Sunset uses HTTP-date (IMF-fixdate) format.
        headers['Sunset'] = formatHTTPDate(sunset);
    }

    return headers;
}
