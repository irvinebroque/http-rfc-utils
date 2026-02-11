/**
 * Forwarded header utilities per RFC 7239.
 * RFC 7239 §4.
 * @see https://www.rfc-editor.org/rfc/rfc7239.html
 */

import type { ForwardedElement } from './types.js';
import {
    assertHeaderToken,
    assertNoCtl,
    isEmptyHeader,
    splitAndParseKeyValueSegments,
    splitQuotedValue,
    unquote,
    quoteIfNeeded,
} from './header-utils.js';
import { createObjectMap, hasOwnKey } from './object-map.js';

/**
 * Parse Forwarded header into elements.
 */
// RFC 7239 §4: Forwarded field-value parsing.
export function parseForwarded(header: string): ForwardedElement[] {
    if (isEmptyHeader(header)) {
        return [];
    }

    const elements: ForwardedElement[] = [];
    const parts = splitQuotedValue(header, ',');

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const pairs = splitAndParseKeyValueSegments(trimmed, ';');
        const element: ForwardedElement = {};
        const extensions = createObjectMap<string>();
        let hasExtensions = false;

        for (const pair of pairs) {
            if (!pair.hasEquals) continue;

            const key = pair.key.trim().toLowerCase();
            if (!key) {
                continue;
            }

            const rawValue = pair.value ?? '';
            const trimmedValue = rawValue.trim();
            const value =
                trimmedValue.length >= 2 && trimmedValue.charCodeAt(0) === 34 && trimmedValue.charCodeAt(trimmedValue.length - 1) === 34
                    ? unquote(trimmedValue)
                    : trimmedValue;

            if (key === 'for') {
                if (element.for === undefined) {
                    element.for = value;
                }
            } else if (key === 'by') {
                if (element.by === undefined) {
                    element.by = value;
                }
            } else if (key === 'host') {
                if (element.host === undefined) {
                    element.host = value;
                }
            } else if (key === 'proto') {
                if (element.proto === undefined) {
                    element.proto = value;
                }
            } else if (key) {
                if (!hasOwnKey(extensions, key)) {
                    extensions[key] = value;
                    hasExtensions = true;
                }
            }
        }

        if (hasExtensions) {
            element.extensions = extensions;
        }

        elements.push(element);
    }

    return elements;
}

/**
 * Format Forwarded header value from elements.
 */
// RFC 7239 §4: Forwarded field-value formatting.
export function formatForwarded(elements: ForwardedElement[]): string {
    return elements.map(element => {
        const parts: string[] = [];

        if (element.for !== undefined) {
            assertNoCtl(element.for, 'Forwarded for value');
            parts.push(`for=${quoteIfNeeded(element.for)}`);
        }
        if (element.by !== undefined) {
            assertNoCtl(element.by, 'Forwarded by value');
            parts.push(`by=${quoteIfNeeded(element.by)}`);
        }
        if (element.host !== undefined) {
            assertNoCtl(element.host, 'Forwarded host value');
            parts.push(`host=${quoteIfNeeded(element.host)}`);
        }
        if (element.proto !== undefined) {
            assertNoCtl(element.proto, 'Forwarded proto value');
            parts.push(`proto=${quoteIfNeeded(element.proto)}`);
        }

        if (element.extensions) {
            for (const key in element.extensions) {
                if (!Object.prototype.hasOwnProperty.call(element.extensions, key)) {
                    continue;
                }

                const value = element.extensions[key];
                if (value === undefined) {
                    continue;
                }

                assertHeaderToken(key, `Forwarded extension parameter name "${key}"`);
                assertNoCtl(value, `Forwarded extension parameter "${key}" value`);
                parts.push(`${key}=${quoteIfNeeded(value)}`);
            }
        }

        return parts.join(';');
    }).join(', ');
}
