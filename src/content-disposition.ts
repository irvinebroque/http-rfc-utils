/**
 * Content-Disposition utilities per RFC 6266 + RFC 8187.
 * RFC 6266 §4, §4.3; RFC 8187 §3.2.
 * @see https://www.rfc-editor.org/rfc/rfc6266.html
 * @see https://www.rfc-editor.org/rfc/rfc8187.html
 */

import type {
    ContentDisposition,
    DispositionParams,
    ParamOptions,
} from './types.js';
import { isEmptyHeader, splitQuotedValue, unquote, quoteIfNeeded } from './header-utils.js';
import {
    decodeExtValue,
    encodeExtValue,
    needsExtendedEncoding,
} from './ext-value.js';

// Re-export ext-value functions for backward compatibility.
// These were previously defined locally but are duplicates of ext-value.ts.
// parseExtValue is an alias for decodeExtValue (same behavior).
export { decodeExtValue as parseExtValue, encodeExtValue } from './ext-value.js';

/**
 * Parse Content-Disposition header.
 */
// RFC 6266 §4, §4.3: Content-Disposition field-value parsing.
export function parseContentDisposition(header: string): ContentDisposition | null {
    if (isEmptyHeader(header)) {
        return null;
    }

    const parts = splitQuotedValue(header, ';');
    const type = parts[0]?.trim();
    if (!type) {
        return null;
    }

    const params: Record<string, string> = {};

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i]!.trim();
        if (!part) continue;
        const eqIndex = part.indexOf('=');
        if (eqIndex === -1) continue;

        const key = part.slice(0, eqIndex).trim().toLowerCase();
        const rawValue = part.slice(eqIndex + 1).trim();
        let value = unquote(rawValue);
        if (!key) {
            continue;
        }

        if (key === 'filename*') {
            if (params['filename*'] !== undefined) {
                continue;
            }
            const decoded = decodeExtValue(value);
            if (decoded !== null) {
                value = decoded.value;
            }
            params['filename*'] = value;
            params.filename = value;
            continue;
        }

        if (key.endsWith('*')) {
            const decoded = decodeExtValue(value);
            if (decoded !== null) {
                value = decoded.value;
            }
        }

        if (key === 'filename') {
            if (params['filename*'] !== undefined || params.filename !== undefined) {
                continue;
            }
            params.filename = value;
            continue;
        }

        if (params[key] !== undefined) {
            continue;
        }

        params[key] = value;
    }

    return { type: type.toLowerCase(), params };
}

/**
 * Format a parameter value with optional RFC 8187 encoding.
 * RFC 8187 §3.2.
 * @see https://www.rfc-editor.org/rfc/rfc8187.html#section-3.2
 */
export function formatHeaderParam(value: string, options: ParamOptions = {}): string {
    const shouldExtend = options.extended || needsExtendedEncoding(value);
    if (!shouldExtend) {
        return quoteIfNeeded(value);
    }

    return encodeExtValue(value, { language: options.language });
}

/**
 * Format Content-Disposition header.
 */
// RFC 6266 §4, §4.3; RFC 8187 §3.2: Content-Disposition formatting.
export function formatContentDisposition(
    type: string,
    params: DispositionParams = {}
): string {
    const parts: string[] = [type];

    const filename = params.filename;
    const filenameStar = params.filenameStar;

    if (filename) {
        parts.push(`filename=${quoteIfNeeded(filename)}`);
    }

    if (filenameStar) {
        const encoded = formatHeaderParam(filenameStar.value, {
            extended: true,
            language: filenameStar.language,
        });
        parts.push(`filename*=${encoded}`);
    }

    for (const [key, rawValue] of Object.entries(params)) {
        if (key === 'filename' || key === 'filenameStar') {
            continue;
        }
        if (rawValue === undefined) {
            continue;
        }

        if (typeof rawValue === 'string') {
            parts.push(`${key}=${quoteIfNeeded(rawValue)}`);
            continue;
        }

        const keyWithStar = key.endsWith('*') ? key : `${key}*`;
        const encoded = formatHeaderParam(rawValue.value, {
            extended: true,
            language: rawValue.language,
        });
        parts.push(`${keyWithStar}=${encoded}`);
    }

    return parts.join('; ');
}
