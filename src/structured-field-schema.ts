/**
 * Shared schema-driven Structured Field parameter mapping helpers.
 * RFC 8941 parameter parsing/serialization mechanics for status-like fields.
 * @see https://www.rfc-editor.org/rfc/rfc8941.html
 */

import type { SfBareItem } from './types.js';

type ExtensibleSfParams = {
    extensions?: Record<string, SfBareItem>;
};

type MappableKey<T extends ExtensibleSfParams> = Extract<Exclude<keyof T, 'extensions'>, string>;

export interface SfParamSchemaEntry<T extends ExtensibleSfParams, K extends MappableKey<T> = MappableKey<T>> {
    readonly key: string;
    readonly property: K;
    parse(value: SfBareItem): unknown;
    format(value: unknown): SfBareItem;
}

export function createSfParamSchemaEntry<T extends ExtensibleSfParams, K extends MappableKey<T>>(
    entry: SfParamSchemaEntry<T, K>
): SfParamSchemaEntry<T, K> {
    return entry;
}

interface SfParamSchemaLookup<T extends ExtensibleSfParams> {
    readonly map: Map<string, SfParamSchemaEntry<T, MappableKey<T>>>;
    readonly knownKeys: Set<string>;
}

const SF_PARAM_SCHEMA_LOOKUP_CACHE = new WeakMap<object, SfParamSchemaLookup<ExtensibleSfParams>>();

function getSfParamSchemaLookup<T extends ExtensibleSfParams>(
    schema: readonly SfParamSchemaEntry<T>[]
): SfParamSchemaLookup<T> {
    const schemaKey = schema as object;
    const cached = SF_PARAM_SCHEMA_LOOKUP_CACHE.get(schemaKey);
    if (cached) {
        return cached as unknown as SfParamSchemaLookup<T>;
    }

    const map = new Map<string, SfParamSchemaEntry<T, MappableKey<T>>>();
    const knownKeys = new Set<string>();
    for (const entry of schema) {
        map.set(entry.key, entry);
        knownKeys.add(entry.key);
    }

    const created: SfParamSchemaLookup<T> = { map, knownKeys };
    SF_PARAM_SCHEMA_LOOKUP_CACHE.set(
        schemaKey,
        created as unknown as SfParamSchemaLookup<ExtensibleSfParams>
    );
    return created;
}

export function parseSfParamsBySchema<T extends ExtensibleSfParams>(
    params: Record<string, SfBareItem> | undefined,
    schema: readonly SfParamSchemaEntry<T>[]
): T {
    const result: Partial<T> = {};
    if (!params) {
        return result as T;
    }

    const schemaMap = getSfParamSchemaLookup(schema).map;
    const resultRecord = result as Record<string, unknown>;

    let extensions: Record<string, SfBareItem> | undefined;
    for (const key in params) {
        if (!Object.prototype.hasOwnProperty.call(params, key)) {
            continue;
        }

        const value = params[key];
        if (value === undefined) {
            continue;
        }

        const entry = schemaMap.get(key);
        if (!entry) {
            if (!extensions) {
                extensions = {};
            }
            extensions[key] = value;
            continue;
        }

        const parsedValue = entry.parse(value);
        if (parsedValue !== undefined) {
            resultRecord[entry.property] = parsedValue;
        }
    }

    if (extensions) {
        result.extensions = extensions;
    }

    return result as T;
}

type KnownKeyProtection = 'mapped-only' | 'mapped-and-unset';

export function buildSfParamsBySchema<T extends ExtensibleSfParams>(
    params: T,
    schema: readonly SfParamSchemaEntry<T>[],
    knownKeyProtection: KnownKeyProtection = 'mapped-only'
): Record<string, SfBareItem> | undefined {
    const lookup = getSfParamSchemaLookup(schema);
    const knownKeys = lookup.knownKeys;
    let result: Record<string, SfBareItem> | undefined;

    for (const entry of schema) {
        const value = params[entry.property];
        if (value !== undefined) {
            if (!result) {
                result = {};
            }
            result[entry.key] = entry.format(value);
        }
    }

    if (params.extensions) {
        for (const key in params.extensions) {
            if (!Object.prototype.hasOwnProperty.call(params.extensions, key)) {
                continue;
            }

            if (knownKeyProtection === 'mapped-and-unset' && knownKeys.has(key)) {
                continue;
            }
            if (!result) {
                result = {};
            }

            if (!(key in result)) {
                const value = params.extensions[key];
                if (value === undefined) {
                    continue;
                }
                result[key] = value;
            }
        }
    }

    return result;
}
