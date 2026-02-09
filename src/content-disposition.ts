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
import {
    assertHeaderToken,
    assertNoCtl,
    isEmptyHeader,
    parseKeyValueSegment,
    splitQuotedValue,
    unquote,
    quoteIfNeeded,
} from './header-utils.js';
import {
    decodeExtValue,
    encodeExtValue,
    needsExtendedEncoding,
} from './ext-value.js';
import { createObjectMap } from './object-map.js';

// Re-export ext-value functions for backward compatibility.
// These were previously defined locally but are duplicates of ext-value.ts.
// parseExtValue is an alias for decodeExtValue (same behavior).
export { decodeExtValue as parseExtValue, encodeExtValue } from './ext-value.js';

function assertDispositionParamName(name: string): void {
    if (name.endsWith('*')) {
        assertHeaderToken(name.slice(0, -1), `Content-Disposition parameter name "${name}"`);
        return;
    }
    assertHeaderToken(name, `Content-Disposition parameter name "${name}"`);
}

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

    const params = createObjectMap<string>();
    let hasValidFilenameStar = false;

    for (let i = 1; i < parts.length; i++) {
        const item = parseKeyValueSegment(parts[i] ?? '');
        if (!item) {
            continue;
        }

        if (!item.hasEquals) {
            continue;
        }

        const key = item.key.trim().toLowerCase();
        const rawValue = item.value ?? '';
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
                hasValidFilenameStar = true;
                params.filename = value;
            }
            params['filename*'] = value;
            continue;
        }

        if (key.endsWith('*')) {
            const decoded = decodeExtValue(value);
            if (decoded !== null) {
                value = decoded.value;
            }
        }

        if (key === 'filename') {
            if (hasValidFilenameStar || params.filename !== undefined) {
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
    assertNoCtl(value, 'Content-Disposition parameter value');
    const shouldExtend = options.extended || needsExtendedEncoding(value);
    if (!shouldExtend) {
        return quoteIfNeeded(value);
    }

    if (options.language === undefined) {
        return encodeExtValue(value);
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
    assertHeaderToken(type, 'Content-Disposition type');
    const parts: string[] = [type];

    const filename = params.filename;
    const filenameStar = params.filenameStar;

    if (filename) {
        assertNoCtl(filename, 'Content-Disposition filename');
        parts.push(`filename=${quoteIfNeeded(filename)}`);
    }

    if (filenameStar) {
        assertNoCtl(filenameStar.value, 'Content-Disposition filename* value');
        const encoded = formatHeaderParam(filenameStar.value, {
            extended: true,
            ...(filenameStar.language !== undefined ? { language: filenameStar.language } : {}),
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

        assertDispositionParamName(key);

        if (typeof rawValue === 'string') {
            assertNoCtl(rawValue, `Content-Disposition parameter "${key}" value`);
            parts.push(`${key}=${quoteIfNeeded(rawValue)}`);
            continue;
        }

        const keyWithStar = key.endsWith('*') ? key : `${key}*`;
        assertNoCtl(rawValue.value, `Content-Disposition parameter "${keyWithStar}" value`);
        const encoded = formatHeaderParam(rawValue.value, {
            extended: true,
            ...(rawValue.language !== undefined ? { language: rawValue.language } : {}),
        });
        parts.push(`${keyWithStar}=${encoded}`);
    }

    return parts.join('; ');
}
