/**
 * Shared schema-driven Structured Field parameter mapping helpers.
 * RFC 8941 parameter parsing/serialization mechanics for status-like fields.
 */

import type { SfBareItem } from './types.js';

type ExtensibleSfParams = {
    extensions?: Record<string, SfBareItem>;
};

type MappableKey<T extends ExtensibleSfParams> = Exclude<keyof T, 'extensions'>;

export interface SfParamSchemaEntry<T extends ExtensibleSfParams, K extends MappableKey<T> = MappableKey<T>> {
    readonly key: string;
    readonly property: K;
    readonly parse: (value: SfBareItem) => unknown;
    readonly format: (value: unknown) => SfBareItem;
}

export function createSfParamSchemaEntry<T extends ExtensibleSfParams, K extends MappableKey<T>>(
    entry: SfParamSchemaEntry<T, K>
): SfParamSchemaEntry<T, K> {
    return entry;
}

export function parseSfParamsBySchema<T extends ExtensibleSfParams>(
    params: Record<string, SfBareItem> | undefined,
    schema: readonly SfParamSchemaEntry<T>[]
): T {
    const result = {} as T;
    if (!params) {
        return result;
    }

    const schemaMap = new Map<string, SfParamSchemaEntry<T>>();
    for (const entry of schema) {
        schemaMap.set(entry.key, entry);
    }

    const extensions: Record<string, SfBareItem> = {};
    for (const [key, value] of Object.entries(params)) {
        const entry = schemaMap.get(key);
        if (!entry) {
            extensions[key] = value;
            continue;
        }

        const parsedValue = entry.parse(value);
        if (parsedValue !== undefined) {
            (result as Record<string, unknown>)[entry.property as string] = parsedValue;
        }
    }

    if (Object.keys(extensions).length > 0) {
        result.extensions = extensions;
    }

    return result;
}

type KnownKeyProtection = 'mapped-only' | 'mapped-and-unset';

export function buildSfParamsBySchema<T extends ExtensibleSfParams>(
    params: T,
    schema: readonly SfParamSchemaEntry<T>[],
    knownKeyProtection: KnownKeyProtection = 'mapped-only'
): Record<string, SfBareItem> | undefined {
    const result: Record<string, SfBareItem> = {};
    const knownKeys = new Set<string>();

    for (const entry of schema) {
        knownKeys.add(entry.key);
        const value = params[entry.property];
        if (value !== undefined) {
            result[entry.key] = entry.format(value);
        }
    }

    if (params.extensions) {
        for (const [key, value] of Object.entries(params.extensions)) {
            if (knownKeyProtection === 'mapped-and-unset' && knownKeys.has(key)) {
                continue;
            }
            if (!(key in result)) {
                result[key] = value;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}
