/**
 * Forwarded header utilities per RFC 7239.
 * RFC 7239 §4.
 */

import type { ForwardedElement } from './types.js';
import { isEmptyHeader, splitQuotedValue, unquote, quoteIfNeeded } from './header-utils.js';

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

        const pairs = splitQuotedValue(trimmed, ';');
        const element: ForwardedElement = {};
        const extensions: Record<string, string> = {};

        for (const pair of pairs) {
            const segment = pair.trim();
            if (!segment) continue;

            const eqIndex = segment.indexOf('=');
            if (eqIndex === -1) continue;

            const key = segment.slice(0, eqIndex).trim().toLowerCase();
            const rawValue = segment.slice(eqIndex + 1).trim();
            const value = unquote(rawValue);

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
                if (!(key in extensions)) {
                    extensions[key] = value;
                }
            }
        }

        if (Object.keys(extensions).length > 0) {
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
            parts.push(`for=${quoteIfNeeded(element.for)}`);
        }
        if (element.by !== undefined) {
            parts.push(`by=${quoteIfNeeded(element.by)}`);
        }
        if (element.host !== undefined) {
            parts.push(`host=${quoteIfNeeded(element.host)}`);
        }
        if (element.proto !== undefined) {
            parts.push(`proto=${quoteIfNeeded(element.proto)}`);
        }

        if (element.extensions) {
            for (const [key, value] of Object.entries(element.extensions)) {
                parts.push(`${key}=${quoteIfNeeded(value)}`);
            }
        }

        return parts.join(';');
    }).join(', ');
}
