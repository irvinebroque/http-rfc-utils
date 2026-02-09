/**
 * Cache-Status utilities per RFC 9211.
 * RFC 9211 §2-§2.8.
 * @see https://www.rfc-editor.org/rfc/rfc9211.html#section-2
 */

import type { CacheStatusEntry, CacheStatusParams, SfBareItem, SfItem, SfList } from './types.js';
import { SfToken } from './types.js';
import { isEmptyHeader } from './header-utils.js';
import { parseSfList, serializeSfList } from './structured-fields.js';
import { isSfInteger } from './structured-field-params.js';
import {
    buildSfParamsBySchema,
    createSfParamSchemaEntry,
    parseSfParamsBySchema,
    type SfParamSchemaEntry,
} from './structured-field-schema.js';

const SF_TOKEN = /^[a-z*][a-z0-9_\-\.\*]*$/;

const CACHE_STATUS_PARAM_SCHEMA: readonly SfParamSchemaEntry<CacheStatusParams>[] = [
    createSfParamSchemaEntry<CacheStatusParams, 'hit'>({
        key: 'hit',
        property: 'hit',
        parse: (value) => typeof value === 'boolean' ? value : undefined,
        format: (value) => value as SfBareItem,
    }),
    createSfParamSchemaEntry<CacheStatusParams, 'fwd'>({
        key: 'fwd',
        property: 'fwd',
        parse: (value) => value instanceof SfToken ? value.value : undefined,
        format: (value) => {
            if (typeof value !== 'string') {
                throw new Error('Invalid Cache-Status fwd token');
            }
            if (!SF_TOKEN.test(value)) {
                throw new Error('Invalid Cache-Status fwd token');
            }
            return new SfToken(value);
        },
    }),
    createSfParamSchemaEntry<CacheStatusParams, 'fwdStatus'>({
        key: 'fwd-status',
        property: 'fwdStatus',
        parse: (value) => typeof value === 'number' && isSfInteger(value) ? value : undefined,
        format: (value) => {
            if (typeof value !== 'number') {
                throw new Error('Invalid Cache-Status fwd-status value');
            }
            if (!isSfInteger(value)) {
                throw new Error('Invalid Cache-Status fwd-status value');
            }
            return value;
        },
    }),
    createSfParamSchemaEntry<CacheStatusParams, 'ttl'>({
        key: 'ttl',
        property: 'ttl',
        parse: (value) => typeof value === 'number' && isSfInteger(value) ? value : undefined,
        format: (value) => {
            if (typeof value !== 'number') {
                throw new Error('Invalid Cache-Status ttl value');
            }
            if (!isSfInteger(value)) {
                throw new Error('Invalid Cache-Status ttl value');
            }
            return value;
        },
    }),
    createSfParamSchemaEntry<CacheStatusParams, 'stored'>({
        key: 'stored',
        property: 'stored',
        parse: (value) => typeof value === 'boolean' ? value : undefined,
        format: (value) => value as SfBareItem,
    }),
    createSfParamSchemaEntry<CacheStatusParams, 'collapsed'>({
        key: 'collapsed',
        property: 'collapsed',
        parse: (value) => typeof value === 'boolean' ? value : undefined,
        format: (value) => value as SfBareItem,
    }),
    createSfParamSchemaEntry<CacheStatusParams, 'key'>({
        key: 'key',
        property: 'key',
        parse: (value) => typeof value === 'string' ? value : undefined,
        format: (value) => value as SfBareItem,
    }),
    createSfParamSchemaEntry<CacheStatusParams, 'detail'>({
        key: 'detail',
        property: 'detail',
        parse: (value) => typeof value === 'string' ? value : undefined,
        format: (value) => value as SfBareItem,
    }),
];

function parseCacheStatusParams(params?: Record<string, SfBareItem>): CacheStatusParams {
    return parseSfParamsBySchema(params, CACHE_STATUS_PARAM_SCHEMA);
}

function buildCacheStatusParams(params: CacheStatusParams): Record<string, SfBareItem> | undefined {
    return buildSfParamsBySchema(params, CACHE_STATUS_PARAM_SCHEMA, 'mapped-and-unset');
}

/**
 * Parse Cache-Status header value into entries.
 */
// RFC 9211 §2: Cache-Status is a Structured Field List.
export function parseCacheStatus(header: string): CacheStatusEntry[] | null {
    if (isEmptyHeader(header)) {
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
