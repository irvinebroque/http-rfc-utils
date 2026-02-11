/**
 * Date/time utilities for HTTP headers.
 * RFC 3339 §5.6, RFC 9110 §5.6.7, RFC 850 §2.
 * @see https://www.rfc-editor.org/rfc/rfc3339.html
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a Date as RFC 3339 timestamp (ISO 8601 compatible)
 * Example output: "2025-02-01T12:30:45.123Z"
 *
 * This is the format used in JSON responses.
 */
// RFC 3339 §5.6: Internet Date/Time Format.
export function toRFC3339(date: Date): string {
    return date.toISOString();
}

/**
 * Parse an RFC 3339 timestamp string to Date
 * Returns null for invalid format
 *
 * Accepts:
 * - "2025-02-01T12:30:45Z"
 * - "2025-02-01T12:30:45.123Z"
 * - "2025-02-01T12:30:45+00:00"
 * - "2025-02-01T12:30:45.123+05:30"
 * - "2025-02-01t12:30:45z" (lowercase per §5.6 NOTE)
 * - "2025-02-01 12:30:45Z" (space separator per §5.6 NOTE)
 */
// RFC 3339 §5.6: Internet Date/Time Format parsing.
// RFC 3339 §5.6 NOTE: "T" and "Z" may alternatively be lowercase "t" or "z".
// RFC 3339 §5.6 NOTE: Applications may use space instead of "T" separator.
export function parseRFC3339(str: string): Date | null {
    const rfc3339Regex = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/;

    const match = str.match(rfc3339Regex);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hours = Number(match[4]);
    const minutes = Number(match[5]);
    const seconds = Number(match[6]);
    const fraction = match[7];
    const offsetSign = match[8];
    const offsetHour = match[9];
    const offsetMinute = match[10];

    if (!isValidDateParts(year, month, day)) {
        return null;
    }

    if (hours < 0 || hours > 23) {
        return null;
    }

    if (minutes < 0 || minutes > 59) {
        return null;
    }

    // RFC 3339 §5.7: leap second allows second value 60.
    if (seconds < 0 || seconds > 60) {
        return null;
    }

    let offsetTotalMinutes = 0;
    if (offsetSign) {
        const parsedOffsetHour = Number(offsetHour);
        const parsedOffsetMinute = Number(offsetMinute);

        if (parsedOffsetHour < 0 || parsedOffsetHour > 23) {
            return null;
        }

        if (parsedOffsetMinute < 0 || parsedOffsetMinute > 59) {
            return null;
        }

        offsetTotalMinutes = parsedOffsetHour * 60 + parsedOffsetMinute;
        if (offsetSign === '-') {
            offsetTotalMinutes *= -1;
        }
    }

    const milliseconds = parseFractionalMilliseconds(fraction);
    if (milliseconds === null) {
        return null;
    }

    // JavaScript Date cannot represent :60 directly, so map leap-second inputs to
    // the representable instant immediately after :59.
    const wholeSeconds = seconds === 60 ? 59 : seconds;
    const leapSecondAdjustment = seconds === 60 ? 1000 : 0;

    const utcMillis = Date.UTC(year, month - 1, day, hours, minutes, wholeSeconds, milliseconds) + leapSecondAdjustment;
    if (isNaN(utcMillis)) {
        return null;
    }

    return new Date(utcMillis - offsetTotalMinutes * 60000);
}

function isValidDateParts(year: number, month: number, day: number): boolean {
    if (year < 0 || year > 9999) {
        return false;
    }

    if (month < 1 || month > 12) {
        return false;
    }

    const daysInMonth = getDaysInMonth(year, month);
    return day >= 1 && day <= daysInMonth;
}

function getDaysInMonth(year: number, month: number): number {
    switch (month) {
        case 2:
            return isLeapYear(year) ? 29 : 28;
        case 4:
        case 6:
        case 9:
        case 11:
            return 30;
        default:
            return 31;
    }
}

function isLeapYear(year: number): boolean {
    if (year % 4 !== 0) {
        return false;
    }
    if (year % 100 !== 0) {
        return true;
    }
    return year % 400 === 0;
}

function parseFractionalMilliseconds(fraction?: string): number | null {
    if (!fraction) {
        return 0;
    }

    if (!/^\d+$/.test(fraction)) {
        return null;
    }

    const padded = fraction.length >= 3
        ? fraction.slice(0, 3)
        : fraction.padEnd(3, '0');

    return Number(padded);
}

// RFC 850 §2: Two-digit year handling.
function resolveRFC850Year(twoDigitYear: number, now: Date = new Date()): number {
    const currentYear = now.getUTCFullYear();
    const currentCentury = Math.floor(currentYear / 100) * 100;
    let year = currentCentury + twoDigitYear;

    if (year > currentYear + 50) {
        year -= 100;
    }

    return year;
}

/**
 * Format a Date as HTTP-date per RFC 9110 Section 5.6.7
 * Used for Last-Modified, Date, Expires headers.
 *
 * Format: "Sat, 01 Feb 2025 12:30:45 GMT"
 * (IMF-fixdate format - the preferred format)
 */
// RFC 9110 §5.6.7: IMF-fixdate formatting.
export function formatHTTPDate(date: Date): string {
    return date.toUTCString();
}

/**
 * Parse an HTTP-date string to Date
 *
 * RFC 9110 Section 5.6.7 requires parsing these formats:
 * 1. IMF-fixdate: "Sun, 06 Nov 1994 08:49:37 GMT" (preferred)
 * 2. RFC 850: "Sunday, 06-Nov-94 08:49:37 GMT" (obsolete)
 * 3. ANSI C asctime(): "Sun Nov  6 08:49:37 1994" (obsolete)
 *
 * Returns null for invalid format.
 */
// RFC 9110 §5.6.7, RFC 850 §2: HTTP-date parsing (including rfc850-date).
export function parseHTTPDate(str: string): Date | null {
    // Try IMF-fixdate: "Sun, 06 Nov 1994 08:49:37 GMT"
    const imfMatch = str.match(
        /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/
    );
    if (imfMatch) {
        const [, day, month, year, hours, minutes, seconds] = imfMatch;
        const monthIndex = MONTH_NAMES.indexOf(month!);
        const date = new Date(Date.UTC(
            parseInt(year!, 10),
            monthIndex,
            parseInt(day!, 10),
            parseInt(hours!, 10),
            parseInt(minutes!, 10),
            parseInt(seconds!, 10)
        ));
        return isNaN(date.getTime()) ? null : date;
    }

    // Try RFC 850: "Sunday, 06-Nov-94 08:49:37 GMT"
    const rfc850Match = str.match(
        /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/
    );
    if (rfc850Match) {
        const [, day, month, year2digit, hours, minutes, seconds] = rfc850Match;
        const monthIndex = MONTH_NAMES.indexOf(month!);
        // RFC 850 uses 2-digit years; interpret with sliding 50-year window.
        const year = resolveRFC850Year(parseInt(year2digit!, 10));
        const date = new Date(Date.UTC(
            year,
            monthIndex,
            parseInt(day!, 10),
            parseInt(hours!, 10),
            parseInt(minutes!, 10),
            parseInt(seconds!, 10)
        ));
        return isNaN(date.getTime()) ? null : date;
    }

    // Try ANSI C asctime(): "Sun Nov  6 08:49:37 1994"
    // Note: day can be space-padded (single digit has leading space)
    const asctimeMatch = str.match(
        /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([ \d]\d) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/
    );
    if (asctimeMatch) {
        const [, month, day, hours, minutes, seconds, year] = asctimeMatch;
        const monthIndex = MONTH_NAMES.indexOf(month!);
        const date = new Date(Date.UTC(
            parseInt(year!, 10),
            monthIndex,
            parseInt(day!, 10),
            parseInt(hours!, 10),
            parseInt(minutes!, 10),
            parseInt(seconds!, 10)
        ));
        return isNaN(date.getTime()) ? null : date;
    }

    return null;
}

/**
 * Check if a date is in the past (for cache expiration checks)
 */
export function isExpired(date: Date): boolean {
    return date.getTime() < Date.now();
}

/**
 * Calculate seconds until a date (for max-age calculations)
 * Returns 0 if date is in the past
 */
export function secondsUntil(date: Date): number {
    const diff = date.getTime() - Date.now();
    return diff > 0 ? Math.floor(diff / 1000) : 0;
}
