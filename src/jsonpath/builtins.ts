/**
 * JSONPath built-in function metadata.
 * RFC 9535 §2.4.
 */

import type { JsonPathFunctionName } from '../types/jsonpath.js';

export const BUILTIN_FUNCTIONS = new Set<JsonPathFunctionName>([
    'length',
    'count',
    'match',
    'search',
    'value',
]);

export function isBuiltinFunctionName(value: string): value is JsonPathFunctionName {
    return BUILTIN_FUNCTIONS.has(value as JsonPathFunctionName);
}
