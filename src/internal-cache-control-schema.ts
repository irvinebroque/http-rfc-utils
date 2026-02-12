/**
 * Shared Cache-Control directive schema for RFC 9111 and RFC 9213 paths.
 * RFC 9111 §5.2 and RFC 9213 §2.1.
 * @see https://www.rfc-editor.org/rfc/rfc9111.html
 * @see https://www.rfc-editor.org/rfc/rfc9213.html
 * @internal
 */

import type { CacheOptions, SfDictionary, TargetedCacheControl } from './types.js';
import { parseDeltaSeconds, parseKeyValueSegment, splitQuotedValue, unquote } from './header-utils.js';
import { isSfItem } from './structured-field-helpers.js';

const MAX_DELTA_SECONDS = 2147483648;

type BooleanDirectiveProperty =
    | 'public'
    | 'private'
    | 'noCache'
    | 'noStore'
    | 'mustRevalidate'
    | 'proxyRevalidate'
    | 'immutable';

type DeltaSecondsDirectiveProperty =
    | 'maxAge'
    | 'sMaxAge'
    | 'staleWhileRevalidate'
    | 'staleIfError';

type FieldNameListDirectiveProperty = 'private' | 'noCache';
type ClassicFieldListProperty = 'privateFields' | 'noCacheFields';

interface BaseCacheDirectiveDescriptor {
    wireKey: string;
    allowInClassic: boolean;
    allowInTargeted: boolean;
}

interface BooleanDirectiveDescriptor extends BaseCacheDirectiveDescriptor {
    kind: 'boolean';
    property: BooleanDirectiveProperty;
}

interface DeltaSecondsDirectiveDescriptor extends BaseCacheDirectiveDescriptor {
    kind: 'delta-seconds';
    property: DeltaSecondsDirectiveProperty;
}

interface FieldNameListDirectiveDescriptor extends BaseCacheDirectiveDescriptor {
    kind: 'field-name-list';
    property: FieldNameListDirectiveProperty;
    classicFieldListProperty: ClassicFieldListProperty;
}

export type CacheDirectiveDescriptor =
    | BooleanDirectiveDescriptor
    | DeltaSecondsDirectiveDescriptor
    | FieldNameListDirectiveDescriptor;

export const CACHE_DIRECTIVE_DESCRIPTORS: readonly CacheDirectiveDescriptor[] = [
    {
        wireKey: 'public',
        property: 'public',
        kind: 'boolean',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'private',
        property: 'private',
        kind: 'field-name-list',
        classicFieldListProperty: 'privateFields',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'no-cache',
        property: 'noCache',
        kind: 'field-name-list',
        classicFieldListProperty: 'noCacheFields',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'no-store',
        property: 'noStore',
        kind: 'boolean',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'max-age',
        property: 'maxAge',
        kind: 'delta-seconds',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 's-maxage',
        property: 'sMaxAge',
        kind: 'delta-seconds',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'must-revalidate',
        property: 'mustRevalidate',
        kind: 'boolean',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'proxy-revalidate',
        property: 'proxyRevalidate',
        kind: 'boolean',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'immutable',
        property: 'immutable',
        kind: 'boolean',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'stale-while-revalidate',
        property: 'staleWhileRevalidate',
        kind: 'delta-seconds',
        allowInClassic: true,
        allowInTargeted: true,
    },
    {
        wireKey: 'stale-if-error',
        property: 'staleIfError',
        kind: 'delta-seconds',
        allowInClassic: true,
        allowInTargeted: true,
    },
] as const;

const DESCRIPTOR_BY_WIRE_KEY = new Map(
    CACHE_DIRECTIVE_DESCRIPTORS.map(descriptor => [descriptor.wireKey, descriptor] as const)
);

const TARGETED_DIRECTIVE_KEYS = new Set(
    CACHE_DIRECTIVE_DESCRIPTORS
        .filter(descriptor => descriptor.allowInTargeted)
        .map(descriptor => descriptor.wireKey)
);

function parseFieldNameList(value: string): string[] {
    return splitQuotedValue(value, ',')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => item.toLowerCase());
}

function isValidNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isInteger(value)
        && Number.isFinite(value)
        && value >= 0;
}

export function formatClassicCacheDirectives(options: CacheOptions): string {
    const directives: string[] = [];

    for (const descriptor of CACHE_DIRECTIVE_DESCRIPTORS) {
        if (!descriptor.allowInClassic) {
            continue;
        }

        switch (descriptor.kind) {
            case 'boolean': {
                if (descriptor.property === 'public' && (options.private || options.privateFields?.length)) {
                    continue;
                }

                if (options[descriptor.property]) {
                    directives.push(descriptor.wireKey);
                }
                continue;
            }
            case 'field-name-list': {
                const fields = options[descriptor.classicFieldListProperty];
                const hasFields = Boolean(fields && fields.length > 0);
                const hasDirective = Boolean(options[descriptor.property]) || hasFields;
                if (!hasDirective) {
                    continue;
                }

                if (hasFields && fields) {
                    directives.push(`${descriptor.wireKey}="${fields.join(', ')}"`);
                } else {
                    directives.push(descriptor.wireKey);
                }
                continue;
            }
            case 'delta-seconds': {
                const value = options[descriptor.property];
                if (value !== undefined && value >= 0) {
                    directives.push(`${descriptor.wireKey}=${Math.floor(value)}`);
                }
                continue;
            }
        }
    }

    return directives.join(', ');
}

export function parseClassicCacheDirectives(header: string): Partial<CacheOptions> {
    const options: Partial<CacheOptions> = {};
    const directives = splitQuotedValue(header, ',').map(directive => directive.trim()).filter(Boolean);

    for (const directive of directives) {
        const parsedDirective = parseKeyValueSegment(directive);
        if (!parsedDirective) {
            continue;
        }

        const name = parsedDirective.key.trim().toLowerCase();
        const descriptor = DESCRIPTOR_BY_WIRE_KEY.get(name);
        if (!descriptor || !descriptor.allowInClassic) {
            continue;
        }

        const rawValue = parsedDirective.hasEquals ? parsedDirective.value : undefined;
        const value = rawValue !== undefined ? unquote(rawValue) : undefined;

        switch (descriptor.kind) {
            case 'boolean':
                options[descriptor.property] = true;
                break;
            case 'field-name-list': {
                options[descriptor.property] = true;
                if (!value) {
                    break;
                }

                const fields = parseFieldNameList(value);
                if (fields.length > 0) {
                    options[descriptor.classicFieldListProperty] = fields;
                }
                break;
            }
            case 'delta-seconds': {
                const parsed = parseDeltaSeconds(value, { mode: 'clamp', max: MAX_DELTA_SECONDS });
                if (parsed !== null) {
                    options[descriptor.property] = parsed;
                }
                break;
            }
        }
    }

    return options;
}

export function parseTargetedCacheDirectives(dict: SfDictionary): Partial<TargetedCacheControl> {
    const parsed: Partial<TargetedCacheControl> = {};
    const extensions: SfDictionary = {};

    for (const [key, member] of Object.entries(dict)) {
        const descriptor = DESCRIPTOR_BY_WIRE_KEY.get(key);
        if (!descriptor || !descriptor.allowInTargeted) {
            extensions[key] = member;
            continue;
        }

        if (!isSfItem(member)) {
            continue;
        }

        switch (descriptor.kind) {
            case 'boolean':
            case 'field-name-list':
                if (member.value === true) {
                    parsed[descriptor.property] = true;
                }
                break;
            case 'delta-seconds':
                if (isValidNonNegativeInteger(member.value)) {
                    parsed[descriptor.property] = member.value;
                }
                break;
        }
    }

    if (Object.keys(extensions).length > 0) {
        parsed.extensions = extensions;
    }

    return parsed;
}

export function appendTargetedCacheDirectives(dict: SfDictionary, input: TargetedCacheControl): void {
    for (const descriptor of CACHE_DIRECTIVE_DESCRIPTORS) {
        if (!descriptor.allowInTargeted) {
            continue;
        }

        switch (descriptor.kind) {
            case 'boolean':
            case 'field-name-list':
                if (input[descriptor.property]) {
                    dict[descriptor.wireKey] = { value: true };
                }
                break;
            case 'delta-seconds': {
                const value = input[descriptor.property];
                if (value === undefined) {
                    break;
                }
                if (!isValidNonNegativeInteger(value)) {
                    throw new Error(`Invalid ${descriptor.wireKey} value; expected non-negative integer`);
                }
                dict[descriptor.wireKey] = { value };
                break;
            }
        }
    }
}

export function isKnownTargetedCacheDirective(key: string): boolean {
    return TARGETED_DIRECTIVE_KEYS.has(key);
}
