/**
 * Shared helpers for Structured Field parameter mapping.
 * RFC 8941 §3.3.1 (integers) and extension parameter handling patterns.
 */

import type { SfBareItem } from './types.js';

export function isSfInteger(value: number): boolean {
    return Number.isInteger(value) && Number.isFinite(value);
}

export function mergeSfExtensions(
    target: Record<string, SfBareItem>,
    extensions: Record<string, SfBareItem> | undefined
): void {
    if (!extensions) {
        return;
    }

    for (const [key, value] of Object.entries(extensions)) {
        if (!(key in target)) {
            target[key] = value;
        }
    }
}
