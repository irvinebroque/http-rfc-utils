/**
 * JSON Patch utilities per RFC 6902.
 * RFC 6902 §3-6.
 * Implementation note: JSON values are depth-limited to 512 levels for validation,
 * cloning, and deep comparison to prevent runaway recursion.
 * @see https://www.rfc-editor.org/rfc/rfc6902.html
 */

import type {
    JsonPatchAddOperation,
    JsonPatchCopyOperation,
    JsonPatchDocument,
    JsonPatchMoveOperation,
    JsonPatchObject,
    JsonPatchOperation,
    JsonPatchRemoveOperation,
    JsonPatchReplaceOperation,
    JsonPatchTestOperation,
    JsonPatchValue,
} from './types.js';
import { hasOwnKey } from './object-map.js';
import { parseJsonPointer } from './json-pointer.js';

export type {
    JsonPatchPrimitive,
    JsonPatchArray,
    JsonPatchValue,
    JsonPatchObject,
    JsonPatchOperationType,
    JsonPatchBaseOperation,
    JsonPatchAddOperation,
    JsonPatchRemoveOperation,
    JsonPatchReplaceOperation,
    JsonPatchMoveOperation,
    JsonPatchCopyOperation,
    JsonPatchTestOperation,
    JsonPatchOperation,
    JsonPatchDocument,
} from './types.js';

export const JSON_PATCH_MEDIA_TYPE = 'application/json-patch+json';

const ARRAY_INDEX_PATTERN = /^(0|[1-9][0-9]*)$/;
const ALLOWED_OPS = new Set(['add', 'remove', 'replace', 'move', 'copy', 'test']);
const MAX_JSON_PATCH_VALUE_DEPTH = 512;
const JSON_PATCH_VALUE_DEPTH_ERROR = `JSON Patch value exceeds maximum depth of ${MAX_JSON_PATCH_VALUE_DEPTH}`;
const JSON_PATCH_VALUE_CYCLE_ERROR = 'JSON Patch value contains circular references';
const JSON_PATCH_COMPARE_DEPTH_ERROR = `JSON Patch comparison exceeds maximum depth of ${MAX_JSON_PATCH_VALUE_DEPTH}`;

/**
 * Parse a JSON Patch document object with tolerant syntax validation.
 * Returns null when the patch structure is syntactically invalid.
 */
// RFC 6902 §3: document is an array of operation objects.
export function parseJsonPatch(value: unknown): JsonPatchDocument | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const operations: JsonPatchOperation[] = [];
    for (let index = 0; index < value.length; index++) {
        const parsedOperation = parseOperation(value[index]);
        if (!parsedOperation) {
            return null;
        }
        operations.push(parsedOperation);
    }

    return operations;
}

/**
 * Parse a JSON Patch JSON string without throwing.
 * Returns null for malformed JSON or invalid patch structures.
 */
export function tryParseJsonPatch(json: string): JsonPatchDocument | null {
    try {
        return parseJsonPatch(JSON.parse(json));
    } catch {
        return null;
    }
}

/**
 * Validate semantic requirements for JSON Patch.
 * Throws Error when any operation is semantically invalid.
 */
// RFC 6902 §4.4: move "from" location MUST NOT be proper prefix of "path".
export function validateJsonPatch(document: JsonPatchDocument): void {
    if (!Array.isArray(document)) {
        throw new Error('JSON Patch document must be an array of operations');
    }

    for (let index = 0; index < document.length; index++) {
        validateOperation(document[index], index);
    }
}

/**
 * Serialize a JSON Patch document.
 * Throws Error if semantic validation fails.
 */
export function formatJsonPatch(document: JsonPatchDocument): string {
    validateJsonPatch(document);
    return JSON.stringify(document, null, 2);
}

/**
 * Apply JSON Patch sequentially with fail-fast behavior.
 * Returns a new JSON value and does not mutate caller inputs.
 */
// RFC 6902 §3 and §5: operations are applied in order and stop on first error.
export function applyJsonPatch(target: unknown, document: JsonPatchDocument): JsonPatchValue {
    if (!isJsonValue(target)) {
        throw new Error('Target document must be a valid JSON value');
    }

    validateJsonPatch(document);

    let working = cloneJsonValue(target);
    for (let index = 0; index < document.length; index++) {
        working = applyOperation(working, document[index], index);
    }

    return working;
}

function parseOperation(value: unknown): JsonPatchOperation | null {
    if (!isRecord(value)) {
        return null;
    }

    const op = value.op;
    const path = value.path;
    if (typeof op !== 'string' || !ALLOWED_OPS.has(op)) {
        return null;
    }
    if (typeof path !== 'string' || parseJsonPointer(path) === null) {
        return null;
    }

    switch (op) {
        case 'add':
        case 'replace':
        case 'test': {
            if (!hasOwnKey(value, 'value') || !isJsonValue(value.value)) {
                return null;
            }
            return {
                op,
                path,
                value: cloneJsonValue(value.value),
            };
        }
        case 'remove':
            return { op, path };
        case 'move':
        case 'copy': {
            if (typeof value.from !== 'string' || parseJsonPointer(value.from) === null) {
                return null;
            }
            return {
                op,
                path,
                from: value.from,
            };
        }
        default:
            return null;
    }
}

function validateOperation(operation: JsonPatchOperation, index: number): void {
    if (!isRecord(operation)) {
        throw new Error(`Operation at index ${index} must be an object`);
    }

    if (typeof operation.op !== 'string' || !ALLOWED_OPS.has(operation.op)) {
        throw new Error(`Operation at index ${index} has invalid "op" value`);
    }

    if (typeof operation.path !== 'string' || parseJsonPointer(operation.path) === null) {
        throw new Error(`Operation at index ${index} has invalid "path" JSON Pointer`);
    }

    switch (operation.op) {
        case 'add':
        case 'replace':
        case 'test':
            if (!hasOwnKey(operation, 'value') || !isJsonValue(operation.value)) {
                throw new Error(`Operation at index ${index} must include a valid JSON "value" member`);
            }
            return;
        case 'remove':
            return;
        case 'move':
        case 'copy': {
            if (typeof operation.from !== 'string' || parseJsonPointer(operation.from) === null) {
                throw new Error(`Operation at index ${index} must include a valid "from" JSON Pointer`);
            }
            if (operation.op === 'move' && isProperPrefixPointer(operation.from, operation.path)) {
                throw new Error(
                    `Operation at index ${index} is invalid: "from" must not be a proper prefix of "path"`
                );
            }
            return;
        }
    }
}

function applyOperation(target: JsonPatchValue, operation: JsonPatchOperation, index: number): JsonPatchValue {
    switch (operation.op) {
        case 'add':
            return applyAdd(target, operation, index);
        case 'remove':
            return applyRemove(target, operation, index);
        case 'replace':
            return applyReplace(target, operation, index);
        case 'move':
            return applyMove(target, operation, index);
        case 'copy':
            return applyCopy(target, operation, index);
        case 'test':
            return applyTest(target, operation, index);
    }
}

function applyAdd(target: JsonPatchValue, operation: JsonPatchAddOperation, index: number): JsonPatchValue {
    const pathTokens = parsePointerTokens(operation.path, 'path', index);
    const value = cloneJsonValue(operation.value);

    if (pathTokens.length === 0) {
        return value;
    }

    const parent = resolveParent(target, pathTokens, index, 'add');
    const token = pathTokens[pathTokens.length - 1];

    if (Array.isArray(parent)) {
        if (token === '-') {
            parent.push(value);
            return target;
        }

        const position = parseArrayIndex(token);
        if (position === null || position > parent.length) {
            throw new Error(`Operation at index ${index} cannot add at array index "${token}"`);
        }

        parent.splice(position, 0, value);
        return target;
    }

    setObjectKey(parent, token, value);
    return target;
}

function applyRemove(target: JsonPatchValue, operation: JsonPatchRemoveOperation, index: number): JsonPatchValue {
    const pathTokens = parsePointerTokens(operation.path, 'path', index);
    if (pathTokens.length === 0) {
        throw new Error(`Operation at index ${index} cannot remove the document root`);
    }

    const parent = resolveParent(target, pathTokens, index, 'remove');
    const token = pathTokens[pathTokens.length - 1];

    if (Array.isArray(parent)) {
        const position = parseArrayIndex(token);
        if (position === null || position >= parent.length) {
            throw new Error(`Operation at index ${index} cannot remove array index "${token}"`);
        }
        parent.splice(position, 1);
        return target;
    }

    if (!hasOwnKey(parent, token)) {
        throw new Error(`Operation at index ${index} cannot remove missing object member "${token}"`);
    }
    delete parent[token];
    return target;
}

function applyReplace(target: JsonPatchValue, operation: JsonPatchReplaceOperation, index: number): JsonPatchValue {
    const pathTokens = parsePointerTokens(operation.path, 'path', index);
    const replacement = cloneJsonValue(operation.value);

    if (pathTokens.length === 0) {
        return replacement;
    }

    const parent = resolveParent(target, pathTokens, index, 'replace');
    const token = pathTokens[pathTokens.length - 1];

    if (Array.isArray(parent)) {
        const position = parseArrayIndex(token);
        if (position === null || position >= parent.length) {
            throw new Error(`Operation at index ${index} cannot replace array index "${token}"`);
        }
        parent[position] = replacement;
        return target;
    }

    if (!hasOwnKey(parent, token)) {
        throw new Error(`Operation at index ${index} cannot replace missing object member "${token}"`);
    }
    setObjectKey(parent, token, replacement);
    return target;
}

function applyMove(target: JsonPatchValue, operation: JsonPatchMoveOperation, index: number): JsonPatchValue {
    if (operation.from === operation.path) {
        getAtPath(target, operation.from, index, 'from');
        return target;
    }

    const { value, nextTarget } = removeAtPath(target, operation.from, index, 'from');
    return addAtPath(nextTarget, operation.path, value, index);
}

function applyCopy(target: JsonPatchValue, operation: JsonPatchCopyOperation, index: number): JsonPatchValue {
    const sourceValue = getAtPath(target, operation.from, index, 'from');
    return addAtPath(target, operation.path, cloneJsonValue(sourceValue), index);
}

function applyTest(target: JsonPatchValue, operation: JsonPatchTestOperation, index: number): JsonPatchValue {
    const actual = getAtPath(target, operation.path, index, 'path');
    if (!deepEqual(actual, operation.value)) {
        throw new Error(`Operation at index ${index} failed "test" comparison`);
    }
    return target;
}

function addAtPath(target: JsonPatchValue, path: string, value: JsonPatchValue, index: number): JsonPatchValue {
    const pathTokens = parsePointerTokens(path, 'path', index);
    if (pathTokens.length === 0) {
        return value;
    }

    const parent = resolveParent(target, pathTokens, index, 'add');
    const token = pathTokens[pathTokens.length - 1];

    if (Array.isArray(parent)) {
        if (token === '-') {
            parent.push(value);
            return target;
        }

        const position = parseArrayIndex(token);
        if (position === null || position > parent.length) {
            throw new Error(`Operation at index ${index} cannot add at array index "${token}"`);
        }

        parent.splice(position, 0, value);
        return target;
    }

    setObjectKey(parent, token, value);
    return target;
}

function removeAtPath(
    target: JsonPatchValue,
    pointer: string,
    index: number,
    pointerMember: 'from' | 'path'
): { value: JsonPatchValue; nextTarget: JsonPatchValue } {
    const tokens = parsePointerTokens(pointer, pointerMember, index);
    if (tokens.length === 0) {
        throw new Error(`Operation at index ${index} cannot remove the document root`);
    }

    const parent = resolveParent(target, tokens, index, 'remove');
    const token = tokens[tokens.length - 1];

    if (Array.isArray(parent)) {
        const position = parseArrayIndex(token);
        if (position === null || position >= parent.length) {
            throw new Error(`Operation at index ${index} has missing ${pointerMember} array index "${token}"`);
        }

        const [removed] = parent.splice(position, 1);
        if (removed === undefined) {
            throw new Error(`Operation at index ${index} has missing ${pointerMember} value`);
        }
        return { value: removed, nextTarget: target };
    }

    if (!hasOwnKey(parent, token)) {
        throw new Error(`Operation at index ${index} has missing ${pointerMember} object member "${token}"`);
    }

    const removed = parent[token];
    delete parent[token];
    return { value: removed, nextTarget: target };
}

function getAtPath(
    target: JsonPatchValue,
    pointer: string,
    index: number,
    pointerMember: 'from' | 'path'
): JsonPatchValue {
    const tokens = parsePointerTokens(pointer, pointerMember, index);
    let current: JsonPatchValue = target;

    for (const token of tokens) {
        if (Array.isArray(current)) {
            const position = parseArrayIndex(token);
            if (position === null || position >= current.length) {
                throw new Error(`Operation at index ${index} has missing ${pointerMember} array index "${token}"`);
            }
            current = current[position] as JsonPatchValue;
            continue;
        }

        if (!isJsonObject(current) || !hasOwnKey(current, token)) {
            throw new Error(`Operation at index ${index} has missing ${pointerMember} object member "${token}"`);
        }
        current = current[token];
    }

    return current;
}

function resolveParent(
    target: JsonPatchValue,
    pathTokens: string[],
    index: number,
    operation: 'add' | 'remove' | 'replace'
): JsonPatchObject | JsonPatchValue[] {
    let current: JsonPatchValue = target;

    for (let tokenIndex = 0; tokenIndex < pathTokens.length - 1; tokenIndex++) {
        const token = pathTokens[tokenIndex];

        if (Array.isArray(current)) {
            const position = parseArrayIndex(token);
            if (position === null || position >= current.length) {
                throw new Error(`Operation at index ${index} cannot resolve parent path for "${operation}"`);
            }
            current = current[position] as JsonPatchValue;
            continue;
        }

        if (!isJsonObject(current) || !hasOwnKey(current, token)) {
            throw new Error(`Operation at index ${index} cannot resolve parent path for "${operation}"`);
        }

        current = current[token];
    }

    if (Array.isArray(current) || isJsonObject(current)) {
        return current;
    }

    throw new Error(`Operation at index ${index} target parent is not an object or array`);
}

function parsePointerTokens(pointer: string, member: 'path' | 'from', index: number): string[] {
    const tokens = parseJsonPointer(pointer);
    if (tokens === null) {
        throw new Error(`Operation at index ${index} has invalid "${member}" JSON Pointer`);
    }
    return tokens;
}

function parseArrayIndex(token: string): number | null {
    if (!ARRAY_INDEX_PATTERN.test(token)) {
        return null;
    }
    return Number.parseInt(token, 10);
}

function isProperPrefixPointer(from: string, path: string): boolean {
    const fromTokens = parseJsonPointer(from);
    const pathTokens = parseJsonPointer(path);
    if (!fromTokens || !pathTokens) {
        return false;
    }
    if (fromTokens.length >= pathTokens.length) {
        return false;
    }

    for (let i = 0; i < fromTokens.length; i++) {
        if (fromTokens[i] !== pathTokens[i]) {
            return false;
        }
    }

    return true;
}

function isJsonValue(
    value: unknown,
    depth = 0,
    activeObjects: WeakSet<object> | undefined = undefined
): value is JsonPatchValue {
    if (depth > MAX_JSON_PATCH_VALUE_DEPTH) {
        return false;
    }

    if (value === null) {
        return true;
    }

    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'boolean') {
        return true;
    }
    if (valueType === 'number') {
        return Number.isFinite(value);
    }
    if (valueType !== 'object') {
        return false;
    }

    const objectValue = value as object;
    if (activeObjects?.has(objectValue)) {
        return false;
    }

    const nextActiveObjects = activeObjects ?? new WeakSet<object>();
    nextActiveObjects.add(objectValue);

    if (Array.isArray(value)) {
        try {
            for (const entry of value) {
                if (!isJsonValue(entry, depth + 1, nextActiveObjects)) {
                    return false;
                }
            }
            return true;
        } finally {
            nextActiveObjects.delete(objectValue);
        }
    }

    try {
        if (!isRecord(value) || !isJsonObject(value)) {
            return false;
        }

        for (const entryValue of Object.values(value)) {
            if (!isJsonValue(entryValue, depth + 1, nextActiveObjects)) {
                return false;
            }
        }

        return true;
    } finally {
        nextActiveObjects.delete(objectValue);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is JsonPatchObject {
    if (!isRecord(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function cloneJsonValue(
    value: JsonPatchValue,
    depth = 0,
    activeObjects: WeakSet<object> | undefined = undefined
): JsonPatchValue {
    if (depth > MAX_JSON_PATCH_VALUE_DEPTH) {
        throw new Error(JSON_PATCH_VALUE_DEPTH_ERROR);
    }

    if (value === null) {
        return null;
    }

    if (Array.isArray(value)) {
        const objectValue = value as object;
        if (activeObjects?.has(objectValue)) {
            throw new Error(JSON_PATCH_VALUE_CYCLE_ERROR);
        }

        const nextActiveObjects = activeObjects ?? new WeakSet<object>();
        nextActiveObjects.add(objectValue);
        try {
            const clone: JsonPatchValue[] = [];
            for (const entry of value) {
                clone.push(cloneJsonValue(entry, depth + 1, nextActiveObjects));
            }
            return clone;
        } finally {
            nextActiveObjects.delete(objectValue);
        }
    }

    if (typeof value === 'object') {
        const objectValue = value as object;
        if (activeObjects?.has(objectValue)) {
            throw new Error(JSON_PATCH_VALUE_CYCLE_ERROR);
        }

        const nextActiveObjects = activeObjects ?? new WeakSet<object>();
        nextActiveObjects.add(objectValue);
        try {
            const clone: JsonPatchObject = {};
            for (const [key, entryValue] of Object.entries(value)) {
                setObjectKey(clone, key, cloneJsonValue(entryValue, depth + 1, nextActiveObjects));
            }
            return clone;
        } finally {
            nextActiveObjects.delete(objectValue);
        }
    }

    return value;
}

function setObjectKey(target: JsonPatchObject, key: string, value: JsonPatchValue): void {
    Object.defineProperty(target, key, {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
    });
}

function deepEqual(
    a: JsonPatchValue,
    b: JsonPatchValue,
    depth = 0,
    activePairs: WeakMap<object, WeakSet<object>> | undefined = undefined
): boolean {
    if (depth > MAX_JSON_PATCH_VALUE_DEPTH) {
        throw new Error(JSON_PATCH_COMPARE_DEPTH_ERROR);
    }

    if (a === b) {
        return true;
    }

    if (typeof a !== typeof b) {
        return false;
    }

    if (a === null || b === null) {
        return a === b;
    }

    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b)) {
            return false;
        }

        const pairState = beginDeepEqualPair(a, b, activePairs);
        if (pairState.seenBefore) {
            return true;
        }

        const nextPairs = pairState.pairs;
        if (a.length !== b.length) {
            endDeepEqualPair(a, b, nextPairs, pairState.added);
            return false;
        }

        try {
            for (let i = 0; i < a.length; i++) {
                if (!deepEqual(a[i], b[i], depth + 1, nextPairs)) {
                    return false;
                }
            }
            return true;
        } finally {
            endDeepEqualPair(a, b, nextPairs, pairState.added);
        }
    }

    if (typeof a === 'object' && typeof b === 'object') {
        const pairState = beginDeepEqualPair(a, b, activePairs);
        if (pairState.seenBefore) {
            return true;
        }

        const nextPairs = pairState.pairs;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) {
            endDeepEqualPair(a, b, nextPairs, pairState.added);
            return false;
        }

        try {
            const keysBSet = new Set(keysB);
            for (const key of keysA) {
                if (!keysBSet.has(key)) {
                    return false;
                }
                if (!deepEqual(a[key], b[key], depth + 1, nextPairs)) {
                    return false;
                }
            }

            return true;
        } finally {
            endDeepEqualPair(a, b, nextPairs, pairState.added);
        }
    }

    return false;
}

function beginDeepEqualPair(
    a: object,
    b: object,
    activePairs: WeakMap<object, WeakSet<object>> | undefined
): { pairs: WeakMap<object, WeakSet<object>>; seenBefore: boolean; added: boolean } {
    const pairs = activePairs ?? new WeakMap<object, WeakSet<object>>();
    const existingMatches = pairs.get(a);
    if (existingMatches?.has(b)) {
        return { pairs, seenBefore: true, added: false };
    }

    if (existingMatches) {
        existingMatches.add(b);
    } else {
        pairs.set(a, new WeakSet<object>([b]));
    }

    return { pairs, seenBefore: false, added: true };
}

function endDeepEqualPair(a: object, b: object, pairs: WeakMap<object, WeakSet<object>>, added: boolean): void {
    if (!added) {
        return;
    }

    const matches = pairs.get(a);
    matches?.delete(b);
}
