/**
 * OpenAPI parameter serialization and parsing helpers.
 * OpenAPI Specification v3.1.1, Parameter Object style/explode rules.
 * @see https://spec.openapis.org/oas/v3.1.1#style-values
 */

import { parseCookie } from '../cookie.js';
import {
    createAsciiAllowTable,
    decodePercentComponent,
    encodeRfc3986,
} from '../internal-uri-encoding.js';
import type {
    NormalizedOpenApiSchemaParameterSpec,
    OpenApiParameterPrimitive,
    OpenApiParameterStyle,
    OpenApiParameterValue,
    OpenApiQueryEntry,
    OpenApiSchemaParameterSpec,
} from '../types.js';

const UNRESERVED_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const STYLE_DEFAULTS: Record<NormalizedOpenApiSchemaParameterSpec['in'], OpenApiParameterStyle> = {
    query: 'form',
    cookie: 'form',
    path: 'simple',
    header: 'simple',
};

const ALLOWED_STYLES: Record<NormalizedOpenApiSchemaParameterSpec['in'], ReadonlySet<OpenApiParameterStyle>> = {
    query: new Set<OpenApiParameterStyle>(['form', 'spaceDelimited', 'pipeDelimited', 'deepObject']),
    path: new Set<OpenApiParameterStyle>(['simple', 'label', 'matrix']),
    header: new Set<OpenApiParameterStyle>(['simple']),
    cookie: new Set<OpenApiParameterStyle>(['form']),
};

const RESERVED_CHARACTERS = ':/?#[]@!$&\'()*+,;=';
const UNRESERVED_ALLOW_TABLE = createAsciiAllowTable(UNRESERVED_CHARACTERS);
const UNRESERVED_AND_RESERVED_ALLOW_TABLE = createAsciiAllowTable(UNRESERVED_CHARACTERS + RESERVED_CHARACTERS);

export function normalizeOpenApiParameterSpec(
    spec: OpenApiSchemaParameterSpec,
): NormalizedOpenApiSchemaParameterSpec {
    if (!spec.name || !spec.name.trim()) {
        throw new Error('OpenAPI parameter spec requires a non-empty "name".');
    }

    const style = spec.style ?? STYLE_DEFAULTS[spec.in];
    const explode = spec.explode ?? (style === 'form');
    const allowReserved = spec.allowReserved ?? false;

    if (!ALLOWED_STYLES[spec.in].has(style)) {
        throw new Error(
            `OpenAPI parameter "${spec.name}" uses unsupported style "${style}" for location "${spec.in}".`,
        );
    }

    if (spec.in !== 'query' && allowReserved) {
        throw new Error(`OpenAPI parameter "${spec.name}": allowReserved is only valid for query parameters.`);
    }

    if (style === 'deepObject') {
        if (spec.in !== 'query') {
            throw new Error(`OpenAPI parameter "${spec.name}": deepObject style is only valid in query.`);
        }
        if (spec.valueType !== 'object') {
            throw new Error(`OpenAPI parameter "${spec.name}": deepObject style requires valueType "object".`);
        }
        if (!explode) {
            throw new Error(`OpenAPI parameter "${spec.name}": deepObject requires explode=true.`);
        }
    }

    if (style === 'spaceDelimited' || style === 'pipeDelimited') {
        if (spec.valueType !== 'array') {
            throw new Error(
                `OpenAPI parameter "${spec.name}": style "${style}" is only supported for array values in this phase.`,
            );
        }
        if (explode) {
            throw new Error(
                `OpenAPI parameter "${spec.name}": style "${style}" with explode=true is undefined and unsupported.`,
            );
        }
    }

    if (spec.in === 'cookie' && spec.valueType !== 'primitive' && explode) {
        throw new Error(
            `OpenAPI parameter "${spec.name}": cookie form serialization with explode=true for non-primitive values is unsupported.`,
        );
    }

    return {
        name: spec.name,
        in: spec.in,
        style,
        explode,
        allowReserved,
        valueType: spec.valueType,
    };
}

export function formatQueryParameter(spec: OpenApiSchemaParameterSpec, value: OpenApiParameterValue): string {
    const normalized = normalizeOpenApiParameterSpec(spec);
    assertLocation(normalized, 'query');

    if (normalized.style === 'deepObject') {
        const objectValue = toObjectValue(normalized, value);
        const keys = sortedKeys(objectValue);
        const entries = keys.map((key) => {
            const encodedName = encodeQueryNameComponent(normalized.name);
            const encodedKey = encodeQueryNameComponent(key);
            const encodedValue = encodeQueryComponent(
                primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                normalized.allowReserved,
            );
            return `${encodedName}%5B${encodedKey}%5D=${encodedValue}`;
        });
        return entries.join('&');
    }

    const entries = formatQueryEntries(normalized, value);
    return entries.map(([name, entryValue]) => `${name}=${entryValue}`).join('&');
}

export function parseQueryParameter(
    spec: OpenApiSchemaParameterSpec,
    source: string | URLSearchParams | readonly OpenApiQueryEntry[],
): OpenApiParameterValue | null {
    const normalized = normalizeOpenApiParameterSpec(spec);
    assertLocation(normalized, 'query');

    const parsedSource = readQueryEntries(source);
    if (parsedSource === null) {
        return null;
    }
    const { entries, encoded } = parsedSource;

    if (normalized.style === 'deepObject') {
        return parseDeepObjectQuery(normalized, entries, encoded);
    }

    return parseQueryFromEntries(normalized, entries, encoded);
}

export function formatPathParameter(spec: OpenApiSchemaParameterSpec, value: OpenApiParameterValue): string {
    const normalized = normalizeOpenApiParameterSpec(spec);
    assertLocation(normalized, 'path');

    switch (normalized.style) {
        case 'simple':
            return formatSimpleValue(normalized, value, ',');
        case 'label':
            return `.${formatLabelValue(normalized, value)}`;
        case 'matrix':
            return formatMatrixValue(normalized, value);
        default:
            throw new Error(
                `OpenAPI parameter "${normalized.name}": unsupported path style "${normalized.style}" in formatter.`,
            );
    }
}

export function parsePathParameter(spec: OpenApiSchemaParameterSpec, raw: string): OpenApiParameterValue | null {
    const normalized = normalizeOpenApiParameterSpec(spec);
    assertLocation(normalized, 'path');

    switch (normalized.style) {
        case 'simple':
            return parseSimpleSerialized(normalized, raw, ',');
        case 'label': {
            if (!raw.startsWith('.')) {
                return null;
            }
            return parseLabelSerialized(normalized, raw.slice(1));
        }
        case 'matrix':
            return parseMatrixSerialized(normalized, raw);
        default:
            return null;
    }
}

export function formatHeaderParameter(spec: OpenApiSchemaParameterSpec, value: OpenApiParameterValue): string {
    const normalized = normalizeOpenApiParameterSpec(spec);
    assertLocation(normalized, 'header');
    return formatSimpleValue(normalized, value, ',');
}

export function parseHeaderParameter(spec: OpenApiSchemaParameterSpec, raw: string): OpenApiParameterValue | null {
    const normalized = normalizeOpenApiParameterSpec(spec);
    assertLocation(normalized, 'header');
    return parseSimpleSerialized(normalized, raw, ',');
}

export function formatCookieParameter(spec: OpenApiSchemaParameterSpec, value: OpenApiParameterValue): string {
    const normalized = normalizeOpenApiParameterSpec(spec);
    assertLocation(normalized, 'cookie');

    switch (normalized.valueType) {
        case 'primitive':
            return `${normalized.name}=${encodeCookieValue(primitiveToString(normalized, value, 'value'))}`;
        case 'array': {
            const arrayValue = toArrayValue(normalized, value);
            const serialized = arrayValue
                .map((item, index) => primitiveToString(normalized, item, `array item at index ${index}`))
                .join(',');
            return `${normalized.name}=${encodeCookieValue(serialized)}`;
        }
        case 'object': {
            const objectValue = toObjectValue(normalized, value);
            const components: string[] = [];
            for (const key of sortedKeys(objectValue)) {
                components.push(key, primitiveToString(normalized, objectValue[key], `value at key "${key}"`));
            }
            return `${normalized.name}=${encodeCookieValue(components.join(','))}`;
        }
        default:
            throw new Error(`OpenAPI parameter "${normalized.name}": unsupported cookie value type.`);
    }
}

export function parseCookieParameter(
    spec: OpenApiSchemaParameterSpec,
    cookieHeader: string,
): OpenApiParameterValue | null {
    const normalized = normalizeOpenApiParameterSpec(spec);
    assertLocation(normalized, 'cookie');

    if (typeof cookieHeader !== 'string') {
        return null;
    }

    const cookies = parseCookie(cookieHeader);
    const rawValue = cookies.get(normalized.name);
    if (rawValue === undefined) {
        return null;
    }

    const decodedValue = decodeComponent(rawValue);
    if (decodedValue === null) {
        return null;
    }

    return parseDelimitedValue(normalized, decodedValue, ',');
}

function formatQueryEntries(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    value: OpenApiParameterValue,
): Array<readonly [string, string]> {
    const encodedName = encodeQueryNameComponent(normalized.name);

    switch (normalized.style) {
        case 'form':
            return formatFormQueryEntries(normalized, value, encodedName);
        case 'spaceDelimited': {
            const arrayValue = toArrayValue(normalized, value);
            const encoded = arrayValue
                .map((item, index) => encodeQueryComponent(
                    primitiveToString(normalized, item, `array item at index ${index}`),
                    normalized.allowReserved,
                ))
                .join('%20');
            return [[encodedName, encoded]];
        }
        case 'pipeDelimited': {
            const arrayValue = toArrayValue(normalized, value);
            const encoded = arrayValue
                .map((item, index) => encodeQueryComponent(
                    primitiveToString(normalized, item, `array item at index ${index}`),
                    normalized.allowReserved,
                ))
                .join('|');
            return [[encodedName, encoded]];
        }
        default:
            throw new Error(
                `OpenAPI parameter "${normalized.name}": style "${normalized.style}" is not supported for query formatting.`,
            );
    }
}

function formatFormQueryEntries(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    value: OpenApiParameterValue,
    encodedName: string,
): Array<readonly [string, string]> {
    switch (normalized.valueType) {
        case 'primitive':
            return [[
                encodedName,
                encodeQueryComponent(primitiveToString(normalized, value, 'value'), normalized.allowReserved),
            ]];
        case 'array': {
            const arrayValue = toArrayValue(normalized, value);
            if (normalized.explode) {
                return arrayValue.map((item, index) => [
                    encodedName,
                    encodeQueryComponent(
                        primitiveToString(normalized, item, `array item at index ${index}`),
                        normalized.allowReserved,
                    ),
                ]);
            }
            const serialized = arrayValue
                .map((item, index) => encodeQueryComponent(
                    primitiveToString(normalized, item, `array item at index ${index}`),
                    normalized.allowReserved,
                ))
                .join(',');
            return [[encodedName, serialized]];
        }
        case 'object': {
            const objectValue = toObjectValue(normalized, value);
            const keys = sortedKeys(objectValue);
            if (normalized.explode) {
                return keys.map((key) => [
                    encodeQueryNameComponent(key),
                    encodeQueryComponent(
                        primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                        normalized.allowReserved,
                    ),
                ]);
            }
            const serializedParts: string[] = [];
            for (const key of keys) {
                serializedParts.push(
                    encodeQueryNameComponent(key),
                    encodeQueryComponent(
                        primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                        normalized.allowReserved,
                    ),
                );
            }
            return [[encodedName, serializedParts.join(',')]];
        }
        default:
            throw new Error(`OpenAPI parameter "${normalized.name}": unsupported query value type.`);
    }
}

function parseQueryFromEntries(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    entries: readonly OpenApiQueryEntry[],
    encoded: boolean,
): OpenApiParameterValue | null {
    if (encoded) {
        switch (normalized.style) {
            case 'form':
                return parseFormQueryEncoded(normalized, entries);
            case 'spaceDelimited':
                return parseNamedDelimitedQueryEncoded(normalized, entries, ' ');
            case 'pipeDelimited':
                return parseNamedDelimitedQueryEncoded(normalized, entries, '|');
            default:
                return null;
        }
    }

    const decodedEntries: OpenApiQueryEntry[] = [];
    for (const entry of entries) {
        decodedEntries.push(entry);
    }

    switch (normalized.style) {
        case 'form':
            return parseFormQuery(normalized, decodedEntries);
        case 'spaceDelimited':
            return parseNamedDelimitedQuery(normalized, decodedEntries, ' ');
        case 'pipeDelimited':
            return parseNamedDelimitedQuery(normalized, decodedEntries, '|');
        default:
            return null;
    }
}

function parseFormQuery(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    entries: readonly OpenApiQueryEntry[],
): OpenApiParameterValue | null {
    if (normalized.valueType === 'object' && normalized.explode) {
        const objectValue: Record<string, OpenApiParameterPrimitive> = {};
        for (const entry of entries) {
            if (!entry.name) {
                return null;
            }
            if (Object.hasOwn(objectValue, entry.name)) {
                return null;
            }
            objectValue[entry.name] = entry.value;
        }
        return Object.keys(objectValue).length === 0 ? null : objectValue;
    }

    const namedValues = entries.filter((entry) => entry.name === normalized.name).map((entry) => entry.value);
    if (namedValues.length === 0) {
        return null;
    }

    if (normalized.valueType === 'primitive') {
        return namedValues[0] ?? null;
    }

    if (normalized.valueType === 'array') {
        if (normalized.explode) {
            return namedValues;
        }
        return splitDelimited(namedValues[0] ?? '', ',');
    }

    const first = namedValues[0];
    if (first === undefined) {
        return null;
    }
    return parseObjectFromPairs(first.split(','));
}

function parseFormQueryEncoded(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    entries: readonly OpenApiQueryEntry[],
): OpenApiParameterValue | null {
    if (normalized.valueType === 'object' && normalized.explode) {
        const decodedEntries: OpenApiQueryEntry[] = [];
        for (const entry of entries) {
            const decodedName = decodeComponent(entry.name);
            const decodedValue = decodeComponent(entry.value);
            if (decodedName === null || decodedValue === null) {
                return null;
            }
            decodedEntries.push({ name: decodedName, value: decodedValue });
        }
        return parseFormQuery(normalized, decodedEntries);
    }

    const namedRawValues = collectEncodedNamedRawValues(normalized, entries);
    if (namedRawValues.length === 0) {
        return null;
    }

    if (normalized.valueType === 'primitive') {
        const firstRawValue = namedRawValues[0];
        if (firstRawValue === undefined) {
            return null;
        }
        return decodeComponent(firstRawValue);
    }

    if (normalized.valueType === 'array') {
        if (normalized.explode) {
            const decodedValues: string[] = [];
            for (const rawValue of namedRawValues) {
                const decodedValue = decodeComponent(rawValue);
                if (decodedValue === null) {
                    return null;
                }
                decodedValues.push(decodedValue);
            }
            return decodedValues;
        }
        const firstRawValue = namedRawValues[0];
        if (firstRawValue === undefined) {
            return null;
        }
        const decodedParts = decodeSplitDelimited(firstRawValue, ',');
        if (decodedParts === null) {
            return null;
        }
        return decodedParts;
    }

    const firstRawValue = namedRawValues[0];
    if (firstRawValue === undefined) {
        return null;
    }
    const decodedPairs = decodeSplitDelimited(firstRawValue, ',');
    if (decodedPairs === null) {
        return null;
    }
    return parseObjectFromPairs(decodedPairs);
}

function parseNamedDelimitedQuery(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    entries: readonly OpenApiQueryEntry[],
    delimiter: string,
): OpenApiParameterValue | null {
    const value = entries.find((entry) => entry.name === normalized.name)?.value;
    if (value === undefined) {
        return null;
    }
    return parseDelimitedValue(normalized, value, delimiter);
}

function parseNamedDelimitedQueryEncoded(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    entries: readonly OpenApiQueryEntry[],
    delimiter: string,
): OpenApiParameterValue | null {
    const namedRawValues = collectEncodedNamedRawValues(normalized, entries);
    const rawValue = namedRawValues[0];
    if (rawValue === undefined) {
        return null;
    }

    if (normalized.valueType === 'primitive') {
        return decodeComponent(rawValue);
    }

    const decodedParts = decodeSplitDelimited(rawValue, delimiter);
    if (decodedParts === null) {
        return null;
    }

    if (normalized.valueType === 'array') {
        return decodedParts;
    }

    return parseObjectFromPairs(decodedParts);
}

function parseDeepObjectQuery(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    entries: readonly OpenApiQueryEntry[],
    encoded: boolean,
): OpenApiParameterValue | null {
    const objectValue: Record<string, OpenApiParameterPrimitive> = {};
    const prefix = `${normalized.name}[`;
    const encodedName = encodeQueryNameComponent(normalized.name);

    for (const entry of entries) {
        if (encoded && !isDeepObjectNameCandidate(entry.name, normalized.name, encodedName)) {
            continue;
        }

        const decodedName = encoded ? decodeComponent(entry.name) : entry.name;
        if (decodedName === null) {
            return null;
        }
        if (!decodedName.startsWith(prefix)) {
            continue;
        }

        const decodedValue = encoded ? decodeComponent(entry.value) : entry.value;
        if (decodedValue === null) {
            return null;
        }
        if (!decodedName.endsWith(']')) {
            return null;
        }
        const key = decodedName.slice(prefix.length, decodedName.length - 1);
        if (!key || key.includes('[') || key.includes(']')) {
            return null;
        }
        if (Object.hasOwn(objectValue, key)) {
            return null;
        }
        objectValue[key] = decodedValue;
    }

    return Object.keys(objectValue).length === 0 ? null : objectValue;
}

function collectEncodedNamedRawValues(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    entries: readonly OpenApiQueryEntry[],
): string[] {
    const encodedName = encodeQueryNameComponent(normalized.name);
    const namedRawValues: string[] = [];

    for (const entry of entries) {
        if (!matchesQueryName(entry.name, normalized.name, encodedName)) {
            continue;
        }
        namedRawValues.push(entry.value);
    }

    return namedRawValues;
}

function isDeepObjectNameCandidate(rawName: string, name: string, encodedName: string): boolean {
    const decodedPrefix = `${name}[`;
    if (rawName.startsWith(decodedPrefix)) {
        return true;
    }

    const encodedBracketIndex = rawName.toLowerCase().indexOf('%5b');
    if (encodedBracketIndex >= 0) {
        const rawPrefix = rawName.slice(0, encodedBracketIndex);
        return matchesQueryName(rawPrefix, name, encodedName);
    }

    const rawBracketIndex = rawName.indexOf('[');
    if (rawBracketIndex >= 0) {
        const rawPrefix = rawName.slice(0, rawBracketIndex);
        return matchesQueryName(rawPrefix, name, encodedName);
    }

    return false;
}

function matchesQueryName(rawName: string, name: string, encodedName: string): boolean {
    if (rawName === name || rawName === encodedName) {
        return true;
    }

    if (!rawName.includes('%')) {
        return false;
    }

    const decodedName = decodeComponent(rawName);
    return decodedName === name;
}

function formatSimpleValue(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    value: OpenApiParameterValue,
    delimiter: string,
): string {
    switch (normalized.valueType) {
        case 'primitive':
            return encodePathComponent(primitiveToString(normalized, value, 'value'));
        case 'array': {
            const arrayValue = toArrayValue(normalized, value);
            return arrayValue
                .map((item, index) => encodePathComponent(
                    primitiveToString(normalized, item, `array item at index ${index}`),
                ))
                .join(delimiter);
        }
        case 'object': {
            const objectValue = toObjectValue(normalized, value);
            const keys = sortedKeys(objectValue);
            if (normalized.explode) {
                return keys
                    .map((key) => (
                        `${encodePathComponent(key)}=${encodePathComponent(
                            primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                        )}`
                    ))
                    .join(delimiter);
            }
            const parts: string[] = [];
            for (const key of keys) {
                parts.push(
                    encodePathComponent(key),
                    encodePathComponent(
                        primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                    ),
                );
            }
            return parts.join(delimiter);
        }
        default:
            throw new Error(`OpenAPI parameter "${normalized.name}": unsupported simple serialization value type.`);
    }
}

function parseSimpleSerialized(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    raw: string,
    delimiter: string,
): OpenApiParameterValue | null {
    if (normalized.valueType === 'primitive') {
        return decodeComponent(raw);
    }

    if (normalized.valueType === 'object' && normalized.explode) {
        const parts = splitDelimited(raw, delimiter);
        const objectValue: Record<string, OpenApiParameterPrimitive> = {};
        for (const part of parts) {
            const eqIndex = part.indexOf('=');
            if (eqIndex <= 0) {
                return null;
            }
            const key = decodeComponent(part.slice(0, eqIndex));
            const segmentValue = decodeComponent(part.slice(eqIndex + 1));
            if (key === null || segmentValue === null) {
                return null;
            }
            if (Object.hasOwn(objectValue, key)) {
                return null;
            }
            objectValue[key] = segmentValue;
        }
        return objectValue;
    }

    const decodedParts = decodeSplitDelimited(raw, delimiter);
    if (decodedParts === null) {
        return null;
    }

    if (normalized.valueType === 'array') {
        return decodedParts;
    }

    return parseObjectFromPairs(decodedParts);
}

function formatLabelValue(normalized: NormalizedOpenApiSchemaParameterSpec, value: OpenApiParameterValue): string {
    switch (normalized.valueType) {
        case 'primitive':
            return encodePathComponent(primitiveToString(normalized, value, 'value'));
        case 'array': {
            const arrayValue = toArrayValue(normalized, value);
            const delimiter = normalized.explode ? '.' : ',';
            return arrayValue
                .map((item, index) => encodePathComponent(
                    primitiveToString(normalized, item, `array item at index ${index}`),
                ))
                .join(delimiter);
        }
        case 'object': {
            const objectValue = toObjectValue(normalized, value);
            const keys = sortedKeys(objectValue);
            if (normalized.explode) {
                return keys
                    .map((key) => (
                        `${encodePathComponent(key)}=${encodePathComponent(
                            primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                        )}`
                    ))
                    .join('.');
            }

            const parts: string[] = [];
            for (const key of keys) {
                parts.push(
                    encodePathComponent(key),
                    encodePathComponent(
                        primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                    ),
                );
            }
            return parts.join(',');
        }
        default:
            throw new Error(`OpenAPI parameter "${normalized.name}": unsupported label serialization value type.`);
    }
}

function parseLabelSerialized(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    payload: string,
): OpenApiParameterValue | null {
    if (normalized.valueType === 'array' && normalized.explode) {
        const decodedParts = decodeSplitDelimited(payload, '.');
        if (decodedParts === null) {
            return null;
        }
        return decodedParts;
    }
    if (normalized.valueType === 'object' && normalized.explode) {
        const parts = splitDelimited(payload, '.');
        const objectValue: Record<string, OpenApiParameterPrimitive> = {};
        for (const part of parts) {
            const eqIndex = part.indexOf('=');
            if (eqIndex <= 0) {
                return null;
            }
            const key = decodeComponent(part.slice(0, eqIndex));
            const rawValue = decodeComponent(part.slice(eqIndex + 1));
            if (key === null || rawValue === null) {
                return null;
            }
            if (Object.hasOwn(objectValue, key)) {
                return null;
            }
            objectValue[key] = rawValue;
        }
        return objectValue;
    }

    if (normalized.valueType === 'primitive') {
        return decodeComponent(payload);
    }

    const decodedParts = decodeSplitDelimited(payload, ',');
    if (decodedParts === null) {
        return null;
    }

    if (normalized.valueType === 'array') {
        return decodedParts;
    }

    return parseObjectFromPairs(decodedParts);
}

function formatMatrixValue(normalized: NormalizedOpenApiSchemaParameterSpec, value: OpenApiParameterValue): string {
    switch (normalized.valueType) {
        case 'primitive':
            return `;${normalized.name}=${encodePathComponent(primitiveToString(normalized, value, 'value'))}`;
        case 'array': {
            const arrayValue = toArrayValue(normalized, value);
            if (normalized.explode) {
                return arrayValue
                    .map((item, index) => (
                        `;${normalized.name}=${encodePathComponent(
                            primitiveToString(normalized, item, `array item at index ${index}`),
                        )}`
                    ))
                    .join('');
            }
            const serialized = arrayValue
                .map((item, index) => encodePathComponent(
                    primitiveToString(normalized, item, `array item at index ${index}`),
                ))
                .join(',');
            return `;${normalized.name}=${serialized}`;
        }
        case 'object': {
            const objectValue = toObjectValue(normalized, value);
            const keys = sortedKeys(objectValue);
            if (normalized.explode) {
                return keys.map((key) => (
                    `;${encodePathComponent(key)}=${encodePathComponent(
                        primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                    )}`
                )).join('');
            }
            const components: string[] = [];
            for (const key of keys) {
                components.push(
                    encodePathComponent(key),
                    encodePathComponent(
                        primitiveToString(normalized, objectValue[key], `value at key "${key}"`),
                    ),
                );
            }
            return `;${normalized.name}=${components.join(',')}`;
        }
        default:
            throw new Error(`OpenAPI parameter "${normalized.name}": unsupported matrix serialization value type.`);
    }
}

function parseMatrixSerialized(normalized: NormalizedOpenApiSchemaParameterSpec, raw: string): OpenApiParameterValue | null {
    if (!raw.startsWith(';')) {
        return null;
    }

    const segments = raw.split(';').filter((segment) => segment.length > 0);
    if (segments.length === 0) {
        return null;
    }

    if (!normalized.explode || normalized.valueType === 'primitive') {
        if (segments.length !== 1) {
            return null;
        }
        const first = segments[0];
        if (first === undefined) {
            return null;
        }
        const prefix = `${normalized.name}=`;
        if (!first.startsWith(prefix)) {
            return null;
        }

        const payload = first.slice(prefix.length);
        if (normalized.valueType === 'primitive') {
            return decodeComponent(payload);
        }

        const decodedParts = decodeSplitDelimited(payload, ',');
        if (decodedParts === null) {
            return null;
        }

        if (normalized.valueType === 'array') {
            return decodedParts;
        }

        return parseObjectFromPairs(decodedParts);
    }

    if (normalized.valueType === 'array') {
        const values: string[] = [];
        const prefix = `${normalized.name}=`;
        for (const segment of segments) {
            if (!segment.startsWith(prefix)) {
                return null;
            }
            const decodedValue = decodeComponent(segment.slice(prefix.length));
            if (decodedValue === null) {
                return null;
            }
            values.push(decodedValue);
        }
        return values;
    }

    const objectValue: Record<string, OpenApiParameterPrimitive> = {};
    for (const segment of segments) {
        const eqIndex = segment.indexOf('=');
        if (eqIndex <= 0) {
            return null;
        }
        const key = decodeComponent(segment.slice(0, eqIndex));
        const segmentValue = decodeComponent(segment.slice(eqIndex + 1));
        if (key === null || segmentValue === null) {
            return null;
        }
        if (Object.hasOwn(objectValue, key)) {
            return null;
        }
        objectValue[key] = segmentValue;
    }
    return objectValue;
}

function parseDelimitedValue(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    raw: string,
    delimiter: string,
): OpenApiParameterValue | null {
    switch (normalized.valueType) {
        case 'primitive':
            return raw;
        case 'array':
            return splitDelimited(raw, delimiter);
        case 'object':
            return parseObjectFromPairs(splitDelimited(raw, delimiter));
        default:
            return null;
    }
}

function parseObjectFromPairs(pairs: readonly string[]): Record<string, OpenApiParameterPrimitive> | null {
    if (pairs.length % 2 !== 0) {
        return null;
    }

    const objectValue: Record<string, OpenApiParameterPrimitive> = {};
    for (let index = 0; index < pairs.length; index += 2) {
        const key = pairs[index];
        const value = pairs[index + 1];
        if (key === undefined || value === undefined || key.length === 0) {
            return null;
        }
        if (Object.hasOwn(objectValue, key)) {
            return null;
        }
        objectValue[key] = value;
    }
    return objectValue;
}

function splitDelimited(value: string, delimiter: string): string[] {
    if (!value) {
        return [];
    }
    return value.split(delimiter);
}

function decodeSplitDelimited(value: string, delimiter: string): string[] | null {
    const parts = splitDelimited(value, delimiter);
    const decoded: string[] = [];
    for (const part of parts) {
        const decodedPart = decodeComponent(part);
        if (decodedPart === null) {
            return null;
        }
        decoded.push(decodedPart);
    }
    return decoded;
}

function readQueryEntries(
    source: string | URLSearchParams | readonly OpenApiQueryEntry[],
): { entries: OpenApiQueryEntry[]; encoded: boolean } | null {
    if (typeof source === 'string') {
        const entries = parseRawQueryString(source);
        return entries === null ? null : { entries, encoded: true };
    }

    if (source instanceof URLSearchParams) {
        const entries: OpenApiQueryEntry[] = [];
        for (const [name, value] of source.entries()) {
            entries.push({ name, value });
        }
        return { entries, encoded: false };
    }

    const entries: OpenApiQueryEntry[] = [];
    for (const entry of source) {
        if (typeof entry.name !== 'string' || typeof entry.value !== 'string') {
            return null;
        }
        entries.push({ name: entry.name, value: entry.value });
    }
    return { entries, encoded: false };
}

function parseRawQueryString(input: string): OpenApiQueryEntry[] | null {
    const query = input.startsWith('?') ? input.slice(1) : input;
    if (!query) {
        return [];
    }

    const entries: OpenApiQueryEntry[] = [];
    const pieces = query.split('&');
    for (const piece of pieces) {
        if (!piece) {
            continue;
        }
        const eqIndex = piece.indexOf('=');
        if (eqIndex === -1) {
            entries.push({ name: piece, value: '' });
            continue;
        }
        const name = piece.slice(0, eqIndex);
        const value = piece.slice(eqIndex + 1);
        entries.push({ name, value });
    }

    return entries;
}

function toArrayValue(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    value: OpenApiParameterValue,
): OpenApiParameterValue[] {
    if (!Array.isArray(value)) {
        throw new Error(`OpenAPI parameter "${normalized.name}" expects an array value.`);
    }
    return value;
}

function toObjectValue(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    value: OpenApiParameterValue,
): Record<string, OpenApiParameterValue> {
    if (!isRecord(value)) {
        throw new Error(`OpenAPI parameter "${normalized.name}" expects an object value.`);
    }
    return value;
}

function primitiveToString(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    value: OpenApiParameterValue,
    context: string,
): string {
    if (Array.isArray(value) || isRecord(value)) {
        throw new Error(
            `OpenAPI parameter "${normalized.name}" expected primitive ${context}, received nested value.`,
        );
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new Error(`OpenAPI parameter "${normalized.name}" contains non-finite number at ${context}.`);
    }
    return String(value);
}

function sortedKeys(value: Record<string, unknown>): string[] {
    return Object.keys(value).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: OpenApiParameterValue): value is Record<string, OpenApiParameterValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertLocation(
    normalized: NormalizedOpenApiSchemaParameterSpec,
    expected: NormalizedOpenApiSchemaParameterSpec['in'],
): void {
    if (normalized.in !== expected) {
        throw new Error(
            `OpenAPI parameter "${normalized.name}" is in "${normalized.in}" and cannot be used as ${expected} parameter.`,
        );
    }
}

function encodeCookieValue(value: string): string {
    return encodeStrict(value);
}

function encodePathComponent(value: string): string {
    return encodeStrict(value);
}

function encodeQueryComponent(value: string, allowReserved: boolean): string {
    return encodeRfc3986(value, {
        allowTable: allowReserved ? UNRESERVED_AND_RESERVED_ALLOW_TABLE : UNRESERVED_ALLOW_TABLE,
        preservePctTriplets: false,
        normalizePctHexUppercase: true,
    });
}

function encodeQueryNameComponent(value: string): string {
    return encodeStrict(value);
}

function encodeStrict(value: string): string {
    return encodeRfc3986(value, {
        allowTable: UNRESERVED_ALLOW_TABLE,
        preservePctTriplets: false,
        normalizePctHexUppercase: true,
    });
}

function decodeComponent(value: string): string | null {
    return decodePercentComponent(value);
}
