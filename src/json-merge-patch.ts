/**
 * JSON Merge Patch utilities per RFC 7396.
 * RFC 7396 Sections 2-4.
 * @see https://www.rfc-editor.org/rfc/rfc7396.html
 */

import type {
    JsonMergePatchDocument,
    JsonMergePatchObject,
    JsonMergePatchValue,
} from './types.js';

export type {
    JsonMergePatchPrimitive,
    JsonMergePatchArray,
    JsonMergePatchObject,
    JsonMergePatchValue,
    JsonMergePatchDocument,
} from './types.js';

export const MERGE_PATCH_CONTENT_TYPE = 'application/merge-patch+json';
const JSON_MERGE_PATCH_MAX_DEPTH = 128;

type JsonMergePatchValidationError = 'invalid-json-value' | 'max-depth-exceeded' | 'cyclic-reference';

/**
 * Parse a JSON Merge Patch document with tolerant syntax validation.
 * This API validates runtime values and does not parse JSON text bytes/strings.
 * Use JSON.parse first when starting from serialized JSON.
 * Returns null when the patch is not a valid JSON value.
 */
export function parseJsonMergePatch(value: unknown): JsonMergePatchDocument | null {
    const validationError = validateJsonMergePatchValueInternal(value, 0);
    if (validationError !== null) {
        return null;
    }

    return cloneJsonMergePatchValue(value as JsonMergePatchValue);
}

/**
 * Validate semantic requirements for JSON Merge Patch.
 * Throws Error when the patch contains invalid runtime values.
 */
export function validateJsonMergePatch(patch: JsonMergePatchDocument): void {
    const validationError = validateJsonMergePatchValueInternal(patch, 0);
    if (validationError === 'cyclic-reference') {
        throw new Error('JSON Merge Patch document must not contain cyclic references');
    }
    if (validationError === 'max-depth-exceeded') {
        throw new Error(`JSON Merge Patch document exceeds maximum depth of ${JSON_MERGE_PATCH_MAX_DEPTH}`);
    }
    if (validationError === 'invalid-json-value') {
        throw new Error('JSON Merge Patch document must be a valid JSON value');
    }
}

/**
 * Serialize a JSON Merge Patch document.
 * Throws Error if semantic validation fails.
 */
export function formatJsonMergePatch(patch: JsonMergePatchDocument): string {
    validateJsonMergePatch(patch);
    return JSON.stringify(patch, null, 2);
}

/**
 * Apply JSON Merge Patch using RFC 7396 MergePatch semantics.
 * Returns a new JSON value and does not mutate caller inputs.
 */
// RFC 7396 Section 2: recursion, null deletion, and whole-value replacement.
export function applyJsonMergePatch(target: unknown, patch: JsonMergePatchDocument): JsonMergePatchValue {
    const targetValidationError = validateJsonMergePatchValueInternal(target, 0);
    if (targetValidationError === 'cyclic-reference') {
        throw new Error('Target document must not contain cyclic references');
    }
    if (targetValidationError === 'max-depth-exceeded') {
        throw new Error(`Target document exceeds maximum depth of ${JSON_MERGE_PATCH_MAX_DEPTH}`);
    }
    if (targetValidationError === 'invalid-json-value') {
        throw new Error('Target document must be a valid JSON value');
    }

    validateJsonMergePatch(patch);
    return mergePatch(target as JsonMergePatchValue, patch);
}

function mergePatch(
    target: JsonMergePatchValue | undefined,
    patch: JsonMergePatchValue,
    depth = 0
): JsonMergePatchValue {
    ensureCloneDepth(depth, 'application');

    if (isJsonMergePatchObject(patch)) {
        const nextTarget = isJsonMergePatchObject(target)
            ? cloneJsonObject(target, depth, 'application')
            : {};

        for (const [memberName, memberValue] of Object.entries(patch)) {
            if (memberValue === null) {
                if (Object.hasOwn(nextTarget, memberName)) {
                    delete nextTarget[memberName];
                }
                continue;
            }

            const currentValue = Object.hasOwn(nextTarget, memberName)
                ? (nextTarget[memberName] as JsonMergePatchValue)
                : undefined;
            defineObjectMember(nextTarget, memberName, mergePatch(currentValue, memberValue, depth + 1));
        }

        return nextTarget;
    }

    return cloneJsonMergePatchValue(patch, depth, 'application');
}

function isJsonMergePatchObject(value: unknown): value is JsonMergePatchObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function validateJsonMergePatchValueInternal(
    value: unknown,
    depth: number,
    ancestors: WeakSet<object> = new WeakSet<object>()
): JsonMergePatchValidationError | null {
    if (depth > JSON_MERGE_PATCH_MAX_DEPTH) {
        if (value !== null && typeof value === 'object' && ancestors.has(value)) {
            return 'cyclic-reference';
        }
        return 'max-depth-exceeded';
    }

    if (value === null) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
        return null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? null : 'invalid-json-value';
    }

    if (typeof value !== 'object') {
        return 'invalid-json-value';
    }

    if (Array.isArray(value)) {
        if (ancestors.has(value)) {
            return 'cyclic-reference';
        }

        ancestors.add(value);
        for (const entry of value) {
            const nestedError = validateJsonMergePatchValueInternal(entry, depth + 1, ancestors);
            if (nestedError !== null) {
                ancestors.delete(value);
                return nestedError;
            }
        }
        ancestors.delete(value);
        return null;
    }

    if (!isJsonMergePatchObject(value)) {
        return 'invalid-json-value';
    }

    if (ancestors.has(value)) {
        return 'cyclic-reference';
    }

    ancestors.add(value);

    for (const entryValue of Object.values(value)) {
        const nestedError = validateJsonMergePatchValueInternal(entryValue, depth + 1, ancestors);
        if (nestedError !== null) {
            ancestors.delete(value);
            return nestedError;
        }
    }

    ancestors.delete(value);

    return null;
}

function cloneJsonMergePatchValue(
    value: JsonMergePatchValue,
    depth = 0,
    errorContext: 'application' | 'value' = 'value'
): JsonMergePatchValue {
    ensureCloneDepth(depth, errorContext);

    if (value === null) {
        return null;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => cloneJsonMergePatchValue(entry, depth + 1, errorContext));
    }

    if (typeof value === 'object') {
        return cloneJsonObject(value, depth, errorContext);
    }

    return value;
}

function cloneJsonObject(
    value: JsonMergePatchObject,
    depth = 0,
    errorContext: 'application' | 'value' = 'value'
): JsonMergePatchObject {
    ensureCloneDepth(depth, errorContext);

    const clone: JsonMergePatchObject = Object.getPrototypeOf(value) === null ? Object.create(null) : {};

    for (const [key, entryValue] of Object.entries(value)) {
        defineObjectMember(clone, key, cloneJsonMergePatchValue(entryValue, depth + 1, errorContext));
    }

    return clone;
}

function ensureCloneDepth(depth: number, errorContext: 'application' | 'value'): void {
    if (depth <= JSON_MERGE_PATCH_MAX_DEPTH) {
        return;
    }

    if (errorContext === 'application') {
        throw new Error(`JSON Merge Patch application exceeds maximum depth of ${JSON_MERGE_PATCH_MAX_DEPTH}`);
    }

    throw new Error(`JSON Merge Patch value exceeds maximum depth of ${JSON_MERGE_PATCH_MAX_DEPTH}`);
}

function defineObjectMember(target: JsonMergePatchObject, key: string, value: JsonMergePatchValue): void {
    Object.defineProperty(target, key, {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
    });
}
