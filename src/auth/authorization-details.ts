/**
 * OAuth 2.0 Rich Authorization Requests helpers.
 * RFC 9396 Sections 2, 2.1, 2.2, and 5.
 * @see https://www.rfc-editor.org/rfc/rfc9396.html
 */

import { createObjectMap } from '../object-map.js';
import type {
    AuthorizationDetails,
    AuthorizationDetailsEntry,
    AuthorizationDetailsJsonObject,
    AuthorizationDetailsJsonValue,
    AuthorizationDetailsTypeDefinition,
    AuthorizationDetailsValidationOptions,
} from '../types.js';

const COMMON_FIELDS = ['locations', 'actions', 'datatypes', 'identifier', 'privileges'] as const;
const COMMON_FIELD_SET = new Set<string>(COMMON_FIELDS);

/**
 * Parse a JSON-encoded authorization_details value.
 * Returns null for malformed JSON or invalid authorization_details shapes.
 */
export function parseAuthorizationDetails(json: string): AuthorizationDetails | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }

    return parseAuthorizationDetailsObject(parsed);
}

/**
 * Parse an already-decoded authorization_details value.
 * Returns null for invalid authorization_details shapes.
 */
export function parseAuthorizationDetailsObject(value: unknown): AuthorizationDetails | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const results: AuthorizationDetails = [];
    for (const entry of value) {
        const parsed = parseAuthorizationDetailsEntry(entry);
        if (!parsed) {
            return null;
        }
        results.push(parsed);
    }

    return results;
}

/**
 * Validate authorization_details for semantic violations.
 * Throws Error on invalid inputs.
 */
export function validateAuthorizationDetails(
    details: AuthorizationDetails,
    options: AuthorizationDetailsValidationOptions = {},
): void {
    if (!Array.isArray(details)) {
        throw new Error('Authorization details must be an array of objects');
    }

    for (let index = 0; index < details.length; index++) {
        const entry = details[index];
        if (!isRecord(entry)) {
            throw new Error(`Authorization details entry at index ${index} must be an object`);
        }

        if (!isJsonValue(entry)) {
            throw new Error(`Authorization details entry at index ${index} must contain only JSON values`);
        }

        const typeValue = entry.type;
        if (typeof typeValue !== 'string' || typeValue.length === 0) {
            throw new Error(`Authorization details entry at index ${index} must include a non-empty "type" string`);
        }

        if (options.allowedTypes && !options.allowedTypes.includes(typeValue)) {
            throw new Error(`Authorization details type "${typeValue}" is not allowed`);
        }

        validateCommonFields(entry, index);
        validateTypeDefinition(entry, typeValue, options.typeDefinitions?.[typeValue], index);
    }
}

/**
 * Serialize authorization_details to a deterministic JSON string.
 * Throws Error on semantic-invalid inputs.
 */
export function formatAuthorizationDetails(
    details: AuthorizationDetails,
    options: AuthorizationDetailsValidationOptions = {},
): string {
    validateAuthorizationDetails(details, options);

    const output = details.map((entry) => formatAuthorizationDetailsEntry(entry));
    return JSON.stringify(output);
}

function parseAuthorizationDetailsEntry(value: unknown): AuthorizationDetailsEntry | null {
    if (!isRecord(value)) {
        return null;
    }

    if (!isJsonValue(value)) {
        return null;
    }

    const typeValue = value.type;
    if (typeof typeValue !== 'string' || typeValue.length === 0) {
        return null;
    }

    const entry = createObjectMap<AuthorizationDetailsJsonValue | undefined>() as AuthorizationDetailsEntry;
    entry.type = typeValue;

    const locations = parseStringArray(value.locations);
    if (locations === null && value.locations !== undefined) {
        return null;
    }
    if (locations) {
        entry.locations = locations;
    }

    const actions = parseStringArray(value.actions);
    if (actions === null && value.actions !== undefined) {
        return null;
    }
    if (actions) {
        entry.actions = actions;
    }

    const datatypes = parseStringArray(value.datatypes);
    if (datatypes === null && value.datatypes !== undefined) {
        return null;
    }
    if (datatypes) {
        entry.datatypes = datatypes;
    }

    const identifier = value.identifier;
    if (identifier !== undefined && typeof identifier !== 'string') {
        return null;
    }
    if (typeof identifier === 'string') {
        entry.identifier = identifier;
    }

    const privileges = parseStringArray(value.privileges);
    if (privileges === null && value.privileges !== undefined) {
        return null;
    }
    if (privileges) {
        entry.privileges = privileges;
    }

    for (const [key, entryValue] of Object.entries(value)) {
        if (key === 'type' || COMMON_FIELD_SET.has(key)) {
            continue;
        }

        entry[key] = cloneJsonValue(entryValue as AuthorizationDetailsJsonValue);
    }

    return entry;
}

function formatAuthorizationDetailsEntry(entry: AuthorizationDetailsEntry): AuthorizationDetailsJsonObject {
    const formatted = createObjectMap<AuthorizationDetailsJsonValue>();
    formatted.type = entry.type;

    if (entry.locations !== undefined) {
        formatted.locations = [...entry.locations];
    }
    if (entry.actions !== undefined) {
        formatted.actions = [...entry.actions];
    }
    if (entry.datatypes !== undefined) {
        formatted.datatypes = [...entry.datatypes];
    }
    if (entry.identifier !== undefined) {
        formatted.identifier = entry.identifier;
    }
    if (entry.privileges !== undefined) {
        formatted.privileges = [...entry.privileges];
    }

    const extensionKeys = Object.keys(entry)
        .filter((key) => key !== 'type' && !COMMON_FIELD_SET.has(key))
        .filter((key) => entry[key] !== undefined)
        .sort((left, right) => left.localeCompare(right));

    for (const key of extensionKeys) {
        formatted[key] = cloneJsonValue(entry[key] as AuthorizationDetailsJsonValue);
    }

    return formatted;
}

function validateCommonFields(entry: AuthorizationDetailsEntry, index: number): void {
    validateStringArrayField(entry.locations, 'locations', index);
    validateStringArrayField(entry.actions, 'actions', index);
    validateStringArrayField(entry.datatypes, 'datatypes', index);
    validateStringArrayField(entry.privileges, 'privileges', index);

    if (entry.identifier !== undefined && typeof entry.identifier !== 'string') {
        throw new Error(`Authorization details field "identifier" at index ${index} must be a string`);
    }
}

function validateStringArrayField(value: unknown, fieldName: string, index: number): void {
    if (value === undefined) {
        return;
    }

    if (!Array.isArray(value)) {
        throw new Error(`Authorization details field "${fieldName}" at index ${index} must be an array of strings`);
    }

    for (let itemIndex = 0; itemIndex < value.length; itemIndex++) {
        const item = value[itemIndex];
        if (typeof item !== 'string') {
            throw new Error(
                `Authorization details field "${fieldName}" at index ${index} contains a non-string value at index ${itemIndex}`,
            );
        }
    }
}

function validateTypeDefinition(
    entry: AuthorizationDetailsEntry,
    typeValue: string,
    definition: AuthorizationDetailsTypeDefinition | undefined,
    index: number,
): void {
    if (!definition) {
        return;
    }

    if (definition.requiredFields) {
        for (const requiredField of definition.requiredFields) {
            if (!Object.hasOwn(entry, requiredField) || entry[requiredField] === undefined) {
                throw new Error(
                    `Authorization details entry type "${typeValue}" at index ${index} is missing required field "${requiredField}"`,
                );
            }
        }
    }

    const allowUnknownFields = definition.allowUnknownFields ?? (definition.allowedFields ? false : true);
    if (!allowUnknownFields) {
        if (!definition.allowedFields) {
            throw new Error(
                `Authorization details entry type "${typeValue}" at index ${index} cannot enforce unknown-field checks without allowedFields`,
            );
        }

        const allowedFields = new Set(['type', ...definition.allowedFields]);
        for (const fieldName of Object.keys(entry)) {
            if (!allowedFields.has(fieldName)) {
                throw new Error(
                    `Authorization details entry type "${typeValue}" at index ${index} includes unknown field "${fieldName}"`,
                );
            }
        }
    }
}

function parseStringArray(value: unknown): string[] | null {
    if (value === undefined) {
        return null;
    }

    if (!Array.isArray(value)) {
        return null;
    }

    const result: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string') {
            return null;
        }
        result.push(item);
    }

    return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function isJsonValue(value: unknown): value is AuthorizationDetailsJsonValue {
    return isJsonValueInternal(value, new WeakSet<object>());
}

function isJsonValueInternal(value: unknown, visiting: WeakSet<object>): value is AuthorizationDetailsJsonValue {
    if (value === null) {
        return true;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
        return true;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
        if (visiting.has(value)) {
            return false;
        }

        visiting.add(value);
        for (const entry of value) {
            if (!isJsonValueInternal(entry, visiting)) {
                visiting.delete(value);
                return false;
            }
        }
        visiting.delete(value);
        return true;
    }

    if (!isRecord(value)) {
        return false;
    }

    if (visiting.has(value)) {
        return false;
    }

    visiting.add(value);
    for (const entry of Object.values(value)) {
        if (!isJsonValueInternal(entry, visiting)) {
            visiting.delete(value);
            return false;
        }
    }
    visiting.delete(value);
    return true;
}

function cloneJsonValue(value: AuthorizationDetailsJsonValue): AuthorizationDetailsJsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => cloneJsonValue(entry));
    }

    const clone = createObjectMap<AuthorizationDetailsJsonValue>();
    for (const [key, entry] of Object.entries(value)) {
        clone[key] = cloneJsonValue(entry);
    }
    return clone;
}
