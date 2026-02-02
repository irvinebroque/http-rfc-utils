/**
 * Shared HTTP header parsing utilities.
 * Common patterns per RFC 9110 §5.6.2 (tokens), §5.6.4 (quoted-strings).
 * @internal - not exported from the public API
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6
 */

/**
 * RFC 9110 §5.6.2: token characters.
 * token = 1*tchar
 * tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
 *         "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
 */
export const TOKEN_CHARS = /^[!#$%&'*+\-.^_`|~A-Za-z0-9]+$/;

/**
 * RFC 9110 §12.4.2: q-value grammar.
 * qvalue = ( "0" [ "." 0*3DIGIT ] ) / ( "1" [ "." 0*3("0") ] )
 */
export const QVALUE_REGEX = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

/**
 * Check if a header value is empty or whitespace-only.
 *
 * @param header - The header value to check
 * @returns True if the header is null, undefined, empty, or whitespace-only
 */
export function isEmptyHeader(header: string | null | undefined): boolean {
    return !header || !header.trim();
}

/**
 * Split a header value by delimiter, respecting quoted strings.
 * Handles escape sequences within quoted strings per RFC 9110 §5.6.4.
 *
 * RFC 9110 §5.6.4: quoted-string = DQUOTE *( qdtext / quoted-pair ) DQUOTE
 *
 * @param value - The header value to split
 * @param delimiter - The delimiter character (typically ',' or ';')
 * @returns Array of split parts (not trimmed)
 */
// RFC 9110 §5.6.4: quoted-string and quoted-pair handling.
export function splitQuotedValue(value: string, delimiter: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let escaped = false;

    for (const char of value) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\' && inQuotes) {
            current += char;
            escaped = true;
            continue;
        }

        if (char === '"') {
            inQuotes = !inQuotes;
            current += char;
            continue;
        }

        if (char === delimiter && !inQuotes) {
            parts.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    parts.push(current);
    return parts;
}

/**
 * Simple comma-split for headers that don't contain quoted values.
 * Use this for simple list headers like Accept-Language, Accept-Encoding.
 *
 * @param value - The header value to split
 * @returns Array of trimmed, non-empty parts
 */
export function splitListValue(value: string): string[] {
    return value.split(',').map(part => part.trim()).filter(Boolean);
}

/**
 * Unquote a quoted-string value, handling escape sequences.
 * If the value is not quoted, returns it trimmed.
 *
 * RFC 9110 §5.6.4: quoted-pair = "\" ( HTAB / SP / VCHAR / obs-text )
 *
 * @param value - The potentially quoted value
 * @returns Unquoted value with escapes resolved
 */
// RFC 9110 §5.6.4: quoted-string unescaping.
export function unquote(value: string): string {
    const trimmed = value.trim();
    if (!trimmed.startsWith('"') || !trimmed.endsWith('"') || trimmed.length < 2) {
        return trimmed;
    }

    const inner = trimmed.slice(1, -1);
    let result = '';
    let i = 0;

    while (i < inner.length) {
        if (inner[i] === '\\' && i + 1 < inner.length) {
            result += inner[i + 1];
            i += 2;
        } else {
            result += inner[i];
            i++;
        }
    }

    return result;
}

/**
 * Quote a value if it contains non-token characters.
 * Escapes backslashes and double quotes within the value.
 *
 * @param value - The value to potentially quote
 * @returns Token value as-is, or quoted-string if needed
 */
// RFC 9110 §5.6.2, §5.6.4: token vs quoted-string selection.
export function quoteIfNeeded(value: string): string {
    if (value === '') {
        return '""';
    }
    if (TOKEN_CHARS.test(value)) {
        return value;
    }
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

/**
 * Parse a q-value (quality value) from a string.
 * Returns null if the value is invalid per RFC 9110 §12.4.2.
 *
 * @param value - The q-value string (e.g., "0.9", "1", "0.123")
 * @returns Parsed number between 0 and 1, or null if invalid
 */
// RFC 9110 §12.4.2: qvalue parsing.
export function parseQValue(value: string): number | null {
    const trimmed = value.trim();
    if (!QVALUE_REGEX.test(trimmed)) {
        return null;
    }
    return Number(trimmed);
}
