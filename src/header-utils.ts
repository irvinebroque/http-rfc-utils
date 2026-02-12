/**
 * Shared HTTP header parsing utilities.
 * Common patterns per RFC 9110 §5.6.2 (tokens), §5.6.4 (quoted-strings).
 * @internal - not exported from the public API
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6
 */

import {
    parseParameterizedSegment,
    splitAndParseParameterizedSegments,
} from './internal-parameterized-members.js';

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

const UNSIGNED_INTEGER_REGEX = /^\d+$/;

/**
 * Disallowed control bytes for serialized header values.
 *
 * RFC 9110 field values allow HTAB as optional whitespace, but CR/LF and
 * other control bytes are rejected here to prevent header injection.
 */
const DISALLOWED_CTL_REGEX = /[\u0000-\u0008\u000A-\u001F\u007F]/;

/**
 * Assert a value does not contain disallowed control bytes.
 *
 * @param value - The value to validate
 * @param context - Error context for debugging
 */
export function assertNoCtl(value: string, context: string): void {
    if (DISALLOWED_CTL_REGEX.test(value)) {
        throw new Error(`${context} must not contain control characters; received ${JSON.stringify(value)}`);
    }
}

/**
 * Assert a value matches RFC 9110 token syntax.
 *
 * @param value - The token value to validate
 * @param context - Error context for debugging
 */
export function assertHeaderToken(value: string, context: string): void {
    assertNoCtl(value, context);
    if (!TOKEN_CHARS.test(value)) {
        throw new Error(`${context} must be a valid RFC 9110 token; received ${JSON.stringify(value)}`);
    }
}

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

export interface ParsedKeyValueSegment {
    key: string;
    value: string | undefined;
    hasEquals: boolean;
}

export function parseKeyValueSegment(segment: string): ParsedKeyValueSegment | null {
    return parseParameterizedSegment(segment);
}

export function splitAndParseKeyValueSegments(value: string, delimiter: string): ParsedKeyValueSegment[] {
    return splitAndParseParameterizedSegments(value, delimiter);
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
// RFC 9110 §5.6.4: permissive quoted-string unescaping.
export function unquoteLenient(value: string): string {
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

// Backward-compatible alias for permissive unquoting.
export function unquote(value: string): string {
    return unquoteLenient(value);
}

export function parseQuotedStringStrict(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed.startsWith('"') || !trimmed.endsWith('"') || trimmed.length < 2) {
        return null;
    }

    const inner = trimmed.slice(1, -1);
    let result = '';
    let escaped = false;

    for (const char of inner) {
        if (escaped) {
            result += char;
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '"') {
            return null;
        }

        result += char;
    }

    if (escaped) {
        return null;
    }

    return result;
}

/**
 * Escape backslashes and double quotes for quoted-string emission.
 *
 * @param value - Raw string value
 * @returns Escaped value safe for quoted-string payload
 */
export function escapeQuotedString(value: string): string {
    assertNoCtl(value, 'Header value');
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Wrap a value as an RFC 9110 quoted-string.
 *
 * @param value - Raw string value
 * @returns Quoted-string with escaping applied
 */
export function quoteString(value: string): string {
    return `"${escapeQuotedString(value)}"`;
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
    assertNoCtl(value, 'Header value');
    if (value === '') {
        return quoteString('');
    }
    if (TOKEN_CHARS.test(value)) {
        return value;
    }
    return quoteString(value);
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

/**
 * Parse an optional q parameter from a semicolon-delimited segment.
 *
 * @param segment - Raw parameter segment (e.g., "q=0.8")
 * @returns
 * - number: valid q-value
 * - null: invalid q-value for a q parameter
 * - undefined: segment is not a q parameter
 */
export function parseQParameter(segment: string): number | null | undefined {
    const eqIndex = segment.indexOf('=');
    if (eqIndex === -1) {
        return undefined;
    }

    const key = segment.slice(0, eqIndex).trim().toLowerCase();
    if (key !== 'q') {
        return undefined;
    }

    return parseQValue(segment.slice(eqIndex + 1).trim());
}

export interface ParseUnsignedIntegerOptions {
    mode?: 'reject' | 'clamp';
    max?: number;
    requireSafeInteger?: boolean;
}

export function parseUnsignedInteger(
    value: string | undefined,
    options: ParseUnsignedIntegerOptions = {}
): number | null {
    if (value === undefined) {
        return null;
    }

    const trimmed = value.trim();
    if (!UNSIGNED_INTEGER_REGEX.test(trimmed)) {
        return null;
    }

    const mode = options.mode ?? 'reject';
    const max = options.max;
    const requireSafeInteger = options.requireSafeInteger ?? true;

    if (max !== undefined && mode === 'clamp') {
        const maxString = String(max);
        if (trimmed.length > maxString.length) {
            return max;
        }
        if (trimmed.length === maxString.length && trimmed > maxString) {
            return max;
        }
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        return null;
    }

    if (requireSafeInteger && !Number.isSafeInteger(parsed)) {
        if (mode === 'clamp' && max !== undefined) {
            return max;
        }
        return null;
    }

    if (max !== undefined && parsed > max) {
        if (mode === 'clamp') {
            return max;
        }
        return null;
    }

    return parsed;
}

export function parseDeltaSeconds(
    value: string | undefined,
    options: ParseUnsignedIntegerOptions = {}
): number | null {
    return parseUnsignedInteger(value, options);
}

export interface ParsedQSegments {
    q: number;
    invalidQ: boolean;
    firstQIndex: number | null;
}

export interface WeightedTokenEntry {
    token: string;
    q: number;
}

export interface ParseWeightedTokenListOptions {
    tokenNormalizer?: (token: string) => string;
    startSegmentIndex?: number;
    sort?: 'q-only' | 'q-then-specificity' | 'none';
    specificity?: (token: string) => number;
}

export function parseQSegments(segments: readonly string[], startIndex = 1): ParsedQSegments {
    let q = 1.0;
    let firstQIndex: number | null = null;

    for (let i = startIndex; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment) {
            continue;
        }

        const parsed = parseQParameter(segment);
        if (parsed === undefined) {
            continue;
        }

        if (parsed === null) {
            return {
                q,
                invalidQ: true,
                firstQIndex,
            };
        }

        if (firstQIndex === null) {
            firstQIndex = i;
        }
        q = parsed;
    }

    return {
        q,
        invalidQ: false,
        firstQIndex,
    };
}

export function parseWeightedTokenList(
    header: string,
    options: ParseWeightedTokenListOptions = {}
): WeightedTokenEntry[] {
    if (isEmptyHeader(header)) {
        return [];
    }

    const tokenNormalizer = options.tokenNormalizer ?? ((token: string) => token);
    const startSegmentIndex = options.startSegmentIndex ?? 1;
    const sort = options.sort ?? 'q-only';
    const specificity = options.specificity;

    const parsed: Array<WeightedTokenEntry & { specificity: number; index: number }> = [];
    const parts = splitListValue(header);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i] ?? '';
        const segments = part.split(';').map(segment => segment.trim());
        const baseToken = segments[0] ?? '';
        if (!baseToken) {
            continue;
        }

        const token = tokenNormalizer(baseToken);
        if (!token) {
            continue;
        }

        const qParts = parseQSegments(segments, startSegmentIndex);
        if (qParts.invalidQ) {
            continue;
        }

        parsed.push({
            token,
            q: qParts.q,
            specificity: specificity?.(token) ?? 0,
            index: i,
        });
    }

    if (sort !== 'none') {
        parsed.sort((a, b) => {
            if (a.q !== b.q) {
                return b.q - a.q;
            }

            if (sort === 'q-then-specificity' && a.specificity !== b.specificity) {
                return b.specificity - a.specificity;
            }

            return a.index - b.index;
        });
    }

    return parsed.map(({ token, q }) => ({ token, q }));
}

export interface HeaderLikeRecord {
    [name: string]: string | null | undefined;
}

export type HeaderGetterInput = Request | Headers | HeaderLikeRecord;

export function getHeaderValue(input: HeaderGetterInput, name: string): string | null {
    if (input instanceof Request) {
        return input.headers.get(name);
    }

    if (input instanceof Headers) {
        return input.get(name);
    }

    const expected = name.toLowerCase();
    for (const [key, value] of Object.entries(input)) {
        if (key.toLowerCase() !== expected) {
            continue;
        }

        if (typeof value === 'string' || value === null) {
            return value;
        }
        return null;
    }

    return null;
}

export interface MediaTypeParameter {
    name: string;
    value: string;
}

export interface ParsedMediaType {
    type: string;
    subtype: string;
    parameters: MediaTypeParameter[];
}

export interface ParseMediaTypeOptions {
    allowWildcard?: boolean;
}

export function parseTypeAndSubtype(
    mediaType: string | undefined,
    options: ParseMediaTypeOptions = {}
): { type: string; subtype: string } | null {
    if (!mediaType) {
        return null;
    }

    const typeSubtype = mediaType.trim();
    if (!typeSubtype) {
        return null;
    }

    const slashIndex = typeSubtype.indexOf('/');
    if (slashIndex === -1 || slashIndex !== typeSubtype.lastIndexOf('/')) {
        return null;
    }

    const type = typeSubtype.slice(0, slashIndex).trim().toLowerCase();
    const subtype = typeSubtype.slice(slashIndex + 1).trim().toLowerCase();

    if (!type || !subtype) {
        return null;
    }

    const allowWildcard = options.allowWildcard ?? false;
    const validType = allowWildcard && type === '*' ? true : TOKEN_CHARS.test(type);
    const validSubtype = allowWildcard && subtype === '*' ? true : TOKEN_CHARS.test(subtype);

    if (!validType || !validSubtype) {
        return null;
    }

    if (allowWildcard && type === '*' && subtype !== '*') {
        return null;
    }

    return { type, subtype };
}

export function parseMediaType(value: string, options: ParseMediaTypeOptions = {}): ParsedMediaType | null {
    const parts = splitQuotedValue(value, ';').map((part) => part.trim());
    const typeSubtype = parseTypeAndSubtype(parts[0], options);
    if (!typeSubtype) {
        return null;
    }

    const parameters: MediaTypeParameter[] = [];

    for (let i = 1; i < parts.length; i++) {
        const segment = parseKeyValueSegment(parts[i] ?? '');
        if (!segment || !segment.hasEquals || !segment.key || !segment.value) {
            return null;
        }

        const name = segment.key.trim().toLowerCase();
        if (!TOKEN_CHARS.test(name)) {
            return null;
        }

        const rawValue = segment.value.trim();
        if (rawValue.startsWith('"')) {
            const parsedQuoted = parseQuotedStringStrict(rawValue);
            if (parsedQuoted === null) {
                return null;
            }
            parameters.push({ name, value: parsedQuoted });
            continue;
        }

        if (!TOKEN_CHARS.test(rawValue)) {
            return null;
        }

        parameters.push({ name, value: rawValue });
    }

    return {
        type: typeSubtype.type,
        subtype: typeSubtype.subtype,
        parameters,
    };
}

export function formatMediaType(type: string, subtype: string, parameters: readonly MediaTypeParameter[] = []): string {
    const normalizedType = type.trim().toLowerCase();
    const normalizedSubtype = subtype.trim().toLowerCase();
    if (!TOKEN_CHARS.test(normalizedType) || !TOKEN_CHARS.test(normalizedSubtype)) {
        throw new Error(
            `Media type "${normalizedType}/${normalizedSubtype}" must use valid HTTP tokens for type and subtype`,
        );
    }

    const serializedParameters = parameters.map((parameter) => {
        const normalizedName = parameter.name.trim().toLowerCase();
        if (!TOKEN_CHARS.test(normalizedName)) {
            throw new Error(
                `Media type parameter name "${parameter.name}" must be a valid HTTP token`,
            );
        }
        return `${normalizedName}=${quoteIfNeeded(parameter.value)}`;
    });

    if (serializedParameters.length === 0) {
        return `${normalizedType}/${normalizedSubtype}`;
    }

    return `${normalizedType}/${normalizedSubtype};${serializedParameters.join(';')}`;
}
