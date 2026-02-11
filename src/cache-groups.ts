/**
 * Cache group utilities per RFC 9875.
 * RFC 9875 §2, §2.1, §3.
 * @see https://www.rfc-editor.org/rfc/rfc9875.html#section-2
 */

import { parseSfList, serializeSfList } from './structured-fields.js';
import { expectSfItem } from './structured-field-helpers.js';
import type { SfItem } from './types.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function isSafeMethod(method: string): boolean {
    return SAFE_METHODS.has(method.trim().toUpperCase());
}

function parseCacheGroupList(value: string): string[] | null {
    const list = parseSfList(value);
    if (!list) {
        return null;
    }

    const groups: string[] = [];
    for (const member of list) {
        const item = expectSfItem(member);
        if (!item) {
            return null;
        }
        if (typeof item.value !== 'string') {
            return null;
        }

        // RFC 9875 §2 / §3: unrecognized parameters are ignored for semantics.
        groups.push(item.value);
    }

    return groups;
}

function formatCacheGroupList(groups: readonly string[]): string {
    const list = groups.map((group, index): SfItem => {
        if (typeof group !== 'string') {
            throw new Error(`Cache group member at index ${index} must be a string; received ${String(group)}`);
        }

        return { value: group };
    });

    return serializeSfList(list);
}

function toOriginString(origin: string | URL): string | null {
    if (origin instanceof URL) {
        return origin.origin;
    }

    try {
        return new URL(origin).origin;
    } catch {
        return null;
    }
}

/**
 * Parse a Cache-Groups field value.
 */
// RFC 9875 §2: Cache-Groups is an SF List of Strings.
export function parseCacheGroups(value: string): string[] | null {
    return parseCacheGroupList(value);
}

/**
 * Format a Cache-Groups field value.
 */
// RFC 9875 §2: Cache-Groups serializes as an SF List of Strings.
export function formatCacheGroups(groups: readonly string[]): string {
    return formatCacheGroupList(groups);
}

/**
 * Parse a Cache-Group-Invalidation field value.
 */
// RFC 9875 §3: Cache-Group-Invalidation is an SF List of Strings.
// RFC 9875 §3: field MUST be ignored on responses to safe methods.
export function parseCacheGroupInvalidation(
    value: string,
    requestMethod?: string | null,
): string[] | null {
    if (typeof requestMethod === 'string' && isSafeMethod(requestMethod)) {
        return [];
    }

    return parseCacheGroupList(value);
}

/**
 * Format a Cache-Group-Invalidation field value.
 */
// RFC 9875 §3: Cache-Group-Invalidation serializes as an SF List of Strings.
export function formatCacheGroupInvalidation(groups: readonly string[]): string {
    return formatCacheGroupList(groups);
}

/**
 * Determine whether two stored responses share a cache group.
 */
// RFC 9875 §2.1: match requires same-origin and case-sensitive string equality.
export function sharesCacheGroup(
    leftGroups: readonly string[],
    leftOrigin: string | URL,
    rightGroups: readonly string[],
    rightOrigin: string | URL,
): boolean {
    const normalizedLeftOrigin = toOriginString(leftOrigin);
    const normalizedRightOrigin = toOriginString(rightOrigin);

    if (!normalizedLeftOrigin || !normalizedRightOrigin) {
        return false;
    }

    if (normalizedLeftOrigin !== normalizedRightOrigin) {
        return false;
    }

    const rightSet = new Set(rightGroups);
    for (const group of leftGroups) {
        if (rightSet.has(group)) {
            return true;
        }
    }

    return false;
}
