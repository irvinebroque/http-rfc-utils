/**
 * Shared schema-driven auth-param mapping helpers.
 * RFC 7235 auth-param handling for Basic, Bearer, and Digest utilities.
 * @see https://www.rfc-editor.org/rfc/rfc7235.html
 * @internal
 */

import type { AuthParam } from '../types/auth.js';

type SchemaObject = object;
type SchemaProperty<T extends SchemaObject> = Extract<keyof T, string>;

export const AUTH_PARAM_SCHEMA_SKIP = Symbol('AUTH_PARAM_SCHEMA_SKIP');
export const AUTH_PARAM_SCHEMA_INVALID = Symbol('AUTH_PARAM_SCHEMA_INVALID');

export type AuthParamSchemaParseValue =
    | string
    | boolean
    | number
    | readonly string[]
    | AUTH_PARAM_SCHEMA_SKIP_TYPE
    | AUTH_PARAM_SCHEMA_INVALID_TYPE;

type AUTH_PARAM_SCHEMA_SKIP_TYPE = typeof AUTH_PARAM_SCHEMA_SKIP;
type AUTH_PARAM_SCHEMA_INVALID_TYPE = typeof AUTH_PARAM_SCHEMA_INVALID;

export interface AuthParamSchemaContext {
    has(name: string): boolean;
    get(name: string): string | undefined;
}

export interface AuthParamSchemaEntry<T extends SchemaObject, K extends SchemaProperty<T> = SchemaProperty<T>> {
    readonly key: string;
    readonly property: K;
    parse?(value: string, context: AuthParamSchemaContext): AuthParamSchemaParseValue;
    format?(value: unknown, source: T): string | AUTH_PARAM_SCHEMA_SKIP_TYPE;
}

export function createAuthParamSchemaEntry<T extends SchemaObject, K extends SchemaProperty<T> = SchemaProperty<T>>(
    entry: AuthParamSchemaEntry<T, K>
): AuthParamSchemaEntry<T, K> {
    return entry;
}

interface AuthParamSchemaLookup<T extends SchemaObject> {
    readonly map: Map<string, AuthParamSchemaEntry<T, SchemaProperty<T>>>;
}

const AUTH_PARAM_SCHEMA_LOOKUP_CACHE = new WeakMap<object, AuthParamSchemaLookup<SchemaObject>>();

function getAuthParamSchemaLookup<T extends SchemaObject>(
    schema: readonly AuthParamSchemaEntry<T>[]
): AuthParamSchemaLookup<T> {
    const schemaKey = schema as object;
    const cached = AUTH_PARAM_SCHEMA_LOOKUP_CACHE.get(schemaKey);
    if (cached) {
        return cached as unknown as AuthParamSchemaLookup<T>;
    }

    const map = new Map<string, AuthParamSchemaEntry<T, SchemaProperty<T>>>();
    for (const entry of schema) {
        map.set(entry.key, entry);
    }

    const created: AuthParamSchemaLookup<T> = { map };
    AUTH_PARAM_SCHEMA_LOOKUP_CACHE.set(
        schemaKey,
        created as unknown as AuthParamSchemaLookup<SchemaObject>
    );
    return created;
}

function buildAuthParamSchemaContext(values: ReadonlyMap<string, string>): AuthParamSchemaContext {
    return {
        has: (name: string) => values.has(name.toLowerCase()),
        get: (name: string) => values.get(name.toLowerCase()),
    };
}

interface ParseAuthParamsBySchemaOptions<T extends SchemaObject> {
    assignUnknown?: (target: Partial<T>, name: string, value: string) => void;
    validate?: (target: Partial<T>, context: AuthParamSchemaContext) => boolean;
}

export function parseAuthParamsBySchema<T extends SchemaObject>(
    params: readonly AuthParam[],
    schema: readonly AuthParamSchemaEntry<T>[],
    options: ParseAuthParamsBySchemaOptions<T> = {}
): Partial<T> | null {
    const values = new Map<string, string>();
    for (const param of params) {
        const name = param.name.toLowerCase();
        if (values.has(name)) {
            return null;
        }
        values.set(name, param.value);
    }

    const context = buildAuthParamSchemaContext(values);
    const schemaMap = getAuthParamSchemaLookup(schema).map;
    const parsed: Partial<T> = {};
    const parsedRecord = parsed as Record<string, unknown>;

    for (const [name, value] of values) {
        const entry = schemaMap.get(name);
        if (!entry) {
            options.assignUnknown?.(parsed, name, value);
            continue;
        }

        const parsedValue = entry.parse ? entry.parse(value, context) : value;
        if (parsedValue === AUTH_PARAM_SCHEMA_INVALID) {
            return null;
        }
        if (parsedValue === AUTH_PARAM_SCHEMA_SKIP) {
            continue;
        }

        parsedRecord[entry.property] = parsedValue;
    }

    if (options.validate && !options.validate(parsed, context)) {
        return null;
    }

    return parsed;
}

interface BuildAuthParamsBySchemaOptions<T extends SchemaObject> {
    appendUnknown?: (source: T, append: (param: AuthParam) => void) => void;
}

export function buildAuthParamsBySchema<T extends SchemaObject>(
    source: T,
    schema: readonly AuthParamSchemaEntry<T>[],
    options: BuildAuthParamsBySchemaOptions<T> = {}
): AuthParam[] {
    const params: AuthParam[] = [];

    for (const entry of schema) {
        const value = source[entry.property];
        if (value === undefined) {
            continue;
        }

        const formatted = entry.format
            ? entry.format(value, source)
            : typeof value === 'string'
                ? value
                : String(value);
        if (formatted === AUTH_PARAM_SCHEMA_SKIP) {
            continue;
        }

        params.push({
            name: entry.key,
            value: formatted,
        });
    }

    options.appendUnknown?.(source, (param: AuthParam) => {
        params.push(param);
    });

    return params;
}
