/**
 * Cache-Status utilities per RFC 9211.
 * RFC 9211 §2-§2.8.
 * @see https://www.rfc-editor.org/rfc/rfc9211.html#section-2
 */

import type { CacheStatusEntry, CacheStatusParams, SfBareItem, SfItem, SfList } from './types.js';
import { SfToken } from './types.js';
import { parseSfList, serializeSfList } from './structured-fields.js';

const SF_TOKEN = /^[a-z*][a-z0-9_\-\.\*]*$/;

function isInteger(value: number): boolean {
    return Number.isInteger(value) && Number.isFinite(value);
}

function parseCacheStatusParams(params?: Record<string, SfBareItem>): CacheStatusParams {
    const result: CacheStatusParams = {};
    if (!params) {
        return result;
    }

    const extensions: Record<string, SfBareItem> = {};

    for (const [key, value] of Object.entries(params)) {
        switch (key) {
            case 'hit':
                if (typeof value === 'boolean') {
                    result.hit = value;
                }
                break;
            case 'fwd':
                if (value instanceof SfToken) {
                    result.fwd = value.value;
                }
                break;
            case 'fwd-status':
                if (typeof value === 'number' && isInteger(value)) {
                    result.fwdStatus = value;
                }
                break;
            case 'ttl':
                if (typeof value === 'number' && isInteger(value)) {
                    result.ttl = value;
                }
                break;
            case 'stored':
                if (typeof value === 'boolean') {
                    result.stored = value;
                }
                break;
            case 'collapsed':
                if (typeof value === 'boolean') {
                    result.collapsed = value;
                }
                break;
            case 'key':
                if (typeof value === 'string') {
                    result.key = value;
                }
                break;
            case 'detail':
                if (typeof value === 'string') {
                    result.detail = value;
                }
                break;
            default:
                extensions[key] = value;
                break;
        }
    }

    if (Object.keys(extensions).length > 0) {
        result.extensions = extensions;
    }

    return result;
}

function buildCacheStatusParams(params: CacheStatusParams): Record<string, SfBareItem> | undefined {
    const result: Record<string, SfBareItem> = {};

    if (params.hit !== undefined) {
        result.hit = params.hit;
    }
    if (params.fwd !== undefined) {
        if (!SF_TOKEN.test(params.fwd)) {
            throw new Error('Invalid Cache-Status fwd token');
        }
        result.fwd = new SfToken(params.fwd);
    }
    if (params.fwdStatus !== undefined) {
        if (!isInteger(params.fwdStatus)) {
            throw new Error('Invalid Cache-Status fwd-status value');
        }
        result['fwd-status'] = params.fwdStatus;
    }
    if (params.ttl !== undefined) {
        if (!isInteger(params.ttl)) {
            throw new Error('Invalid Cache-Status ttl value');
        }
        result.ttl = params.ttl;
    }
    if (params.stored !== undefined) {
        result.stored = params.stored;
    }
    if (params.collapsed !== undefined) {
        result.collapsed = params.collapsed;
    }
    if (params.key !== undefined) {
        result.key = params.key;
    }
    if (params.detail !== undefined) {
        result.detail = params.detail;
    }

    if (params.extensions) {
        for (const [key, value] of Object.entries(params.extensions)) {
            if (!(key in result)) {
                result[key] = value as SfBareItem;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parse Cache-Status header value into entries.
 */
// RFC 9211 §2: Cache-Status is a Structured Field List.
export function parseCacheStatus(header: string): CacheStatusEntry[] | null {
    if (!header || !header.trim()) {
        return [];
    }

    const list = parseSfList(header);
    if (!list) {
        return null;
    }

    const entries: CacheStatusEntry[] = [];
    for (const member of list) {
        if ('items' in member) {
            return null;
        }
        if (typeof member.value !== 'string') {
            if (member.value instanceof SfToken) {
                entries.push({
                    cache: member.value.value,
                    params: parseCacheStatusParams(member.params),
                });
                continue;
            }
            return null;
        }

        entries.push({
            cache: member.value,
            params: parseCacheStatusParams(member.params),
        });
    }

    return entries;
}

/**
 * Format Cache-Status header value from entries.
 */
// RFC 9211 §2: Cache-Status Structured Field serialization.
export function formatCacheStatus(entries: CacheStatusEntry[]): string {
    const list: SfList = entries.map((entry) => {
        const params = buildCacheStatusParams(entry.params ?? {});
        const cacheToken = new SfToken(entry.cache);
        const item: SfItem = params ? { value: cacheToken, params } : { value: cacheToken };
        return item;
    });

    return serializeSfList(list);
}
