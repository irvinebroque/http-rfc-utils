/**
 * OpenAPI runtime expression parsing and evaluation.
 * OpenAPI Specification v3.1.1, Runtime Expressions.
 * @see https://spec.openapis.org/oas/v3.1.1#runtime-expressions
 */

import { TOKEN_CHARS } from '../header-utils.js';
import { decodePercentComponent } from '../internal-uri-encoding.js';
import { evaluateJsonPointer, parseJsonPointer } from '../json-pointer.js';
import type {
    OpenApiParameterValue,
    OpenApiRuntimeEvaluationContext,
    OpenApiRuntimeExpression,
    OpenApiRuntimeExpressionEvaluationOptions,
} from '../types.js';

const REQUEST_PREFIX = '$request.';
const RESPONSE_PREFIX = '$response.';
const CASE_INSENSITIVE_HEADERS_DEFAULT = true;
const NAME_PATTERN = /^[^\s#]+$/;

export function parseOpenApiRuntimeExpression(input: string): OpenApiRuntimeExpression | null {
    if (!input) {
        return null;
    }

    switch (input) {
        case '$url':
            return { type: 'url' };
        case '$method':
            return { type: 'method' };
        case '$statusCode':
            return { type: 'statusCode' };
        default:
            break;
    }

    if (input.startsWith(REQUEST_PREFIX)) {
        return parseRequestExpression(input.slice(REQUEST_PREFIX.length));
    }

    if (input.startsWith(RESPONSE_PREFIX)) {
        return parseResponseExpression(input.slice(RESPONSE_PREFIX.length));
    }

    return null;
}

export function formatOpenApiRuntimeExpression(expression: OpenApiRuntimeExpression): string {
    switch (expression.type) {
        case 'url':
            return '$url';
        case 'method':
            return '$method';
        case 'statusCode':
            return '$statusCode';
        case 'request.header':
            return `$request.header.${formatHeaderName(expression.name, expression.type)}`;
        case 'request.query':
            return `$request.query.${formatName(expression.name, expression.type)}`;
        case 'request.path':
            return `$request.path.${formatName(expression.name, expression.type)}`;
        case 'request.body':
            return `$request.body${formatPointerSuffix(expression.pointer, expression.type)}`;
        case 'response.header':
            return `$response.header.${formatHeaderName(expression.name, expression.type)}`;
        case 'response.query':
            return `$response.query.${formatName(expression.name, expression.type)}`;
        case 'response.path':
            return `$response.path.${formatName(expression.name, expression.type)}`;
        case 'response.body':
            return `$response.body${formatPointerSuffix(expression.pointer, expression.type)}`;
    }
}

export function isOpenApiRuntimeExpression(input: unknown): boolean {
    if (typeof input === 'string') {
        return parseOpenApiRuntimeExpression(input) !== null;
    }

    if (typeof input !== 'object' || input === null) {
        return false;
    }

    try {
        const serialized = formatOpenApiRuntimeExpression(input as OpenApiRuntimeExpression);
        return parseOpenApiRuntimeExpression(serialized) !== null;
    } catch {
        return false;
    }
}

export function evaluateOpenApiRuntimeExpression(
    expression: string | OpenApiRuntimeExpression,
    context: OpenApiRuntimeEvaluationContext,
    options: OpenApiRuntimeExpressionEvaluationOptions = {},
): unknown {
    const parsed = normalizeExpression(expression);
    if (parsed === null) {
        return undefined;
    }

    const caseInsensitiveHeaders = options.caseInsensitiveHeaders ?? CASE_INSENSITIVE_HEADERS_DEFAULT;

    switch (parsed.type) {
        case 'url':
            return context.request.url;
        case 'method':
            return context.request.method;
        case 'statusCode':
            return context.response?.status;
        case 'request.header':
            return readHeader(context.request.headers, parsed.name, caseInsensitiveHeaders);
        case 'request.query':
            return context.request.query?.[parsed.name];
        case 'request.path':
            return readPath(context.request.path, parsed.name);
        case 'request.body':
            return readBody(context.request.body, parsed.pointer);
        case 'response.header':
            return readHeader(context.response?.headers, parsed.name, caseInsensitiveHeaders);
        case 'response.query':
            return context.response?.query?.[parsed.name];
        case 'response.path':
            return readPath(context.response?.path, parsed.name);
        case 'response.body':
            return readBody(context.response?.body, parsed.pointer);
    }
}

function parseRequestExpression(input: string): OpenApiRuntimeExpression | null {
    if (input.startsWith('header.')) {
        const name = input.slice('header.'.length);
        if (!isHeaderName(name)) {
            return null;
        }
        return { type: 'request.header', name };
    }

    if (input.startsWith('query.')) {
        const name = input.slice('query.'.length);
        if (!isValueName(name)) {
            return null;
        }
        return { type: 'request.query', name };
    }

    if (input.startsWith('path.')) {
        const name = input.slice('path.'.length);
        if (!isValueName(name)) {
            return null;
        }
        return { type: 'request.path', name };
    }

    if (input === 'body') {
        return { type: 'request.body' };
    }

    if (input.startsWith('body#')) {
        const pointer = input.slice('body#'.length);
        if (parseJsonPointer(pointer) === null) {
            return null;
        }
        return { type: 'request.body', pointer };
    }

    return null;
}

function parseResponseExpression(input: string): OpenApiRuntimeExpression | null {
    if (input.startsWith('header.')) {
        const name = input.slice('header.'.length);
        if (!isHeaderName(name)) {
            return null;
        }
        return { type: 'response.header', name };
    }

    if (input.startsWith('query.')) {
        const name = input.slice('query.'.length);
        if (!isValueName(name)) {
            return null;
        }
        // OpenAPI extension: mirrors request.query for response-context tooling.
        return { type: 'response.query', name };
    }

    if (input.startsWith('path.')) {
        const name = input.slice('path.'.length);
        if (!isValueName(name)) {
            return null;
        }
        // OpenAPI extension: mirrors request.path for response-context tooling.
        return { type: 'response.path', name };
    }

    if (input === 'body') {
        return { type: 'response.body' };
    }

    if (input.startsWith('body#')) {
        const pointer = input.slice('body#'.length);
        if (parseJsonPointer(pointer) === null) {
            return null;
        }
        return { type: 'response.body', pointer };
    }

    return null;
}

function normalizeExpression(expression: string | OpenApiRuntimeExpression): OpenApiRuntimeExpression | null {
    if (typeof expression === 'string') {
        return parseOpenApiRuntimeExpression(expression);
    }

    try {
        return parseOpenApiRuntimeExpression(formatOpenApiRuntimeExpression(expression));
    } catch {
        return null;
    }
}

function formatHeaderName(name: string, expressionType: OpenApiRuntimeExpression['type']): string {
    if (!isHeaderName(name)) {
        throw new Error(`OpenAPI runtime expression "${expressionType}" requires a valid RFC 9110 token name.`);
    }
    return name;
}

function formatName(name: string, expressionType: OpenApiRuntimeExpression['type']): string {
    if (!isValueName(name)) {
        throw new Error(`OpenAPI runtime expression "${expressionType}" requires a non-empty name.`);
    }
    return name;
}

function formatPointerSuffix(pointer: string | undefined, expressionType: OpenApiRuntimeExpression['type']): string {
    if (pointer === undefined) {
        return '';
    }

    if (parseJsonPointer(pointer) === null) {
        throw new Error(`OpenAPI runtime expression "${expressionType}" has an invalid JSON Pointer.`);
    }

    return `#${pointer}`;
}

function isHeaderName(value: string | undefined): value is string {
    return typeof value === 'string' && value.length > 0 && TOKEN_CHARS.test(value);
}

function isValueName(value: string | undefined): value is string {
    return typeof value === 'string' && value.length > 0 && NAME_PATTERN.test(value);
}

function readHeader(
    headers: Record<string, string | undefined> | undefined,
    name: string,
    caseInsensitive: boolean,
): string | undefined {
    if (!headers) {
        return undefined;
    }

    if (!caseInsensitive) {
        return headers[name];
    }

    const expected = name.toLowerCase();
    const entries = Object.entries(headers);
    for (const [headerName, headerValue] of entries) {
        if (headerName.toLowerCase() === expected) {
            return headerValue;
        }
    }

    return undefined;
}

function readBody(body: unknown, pointer: string | undefined): unknown {
    if (pointer === undefined) {
        return body;
    }

    return evaluateJsonPointer(pointer, body);
}

function readPath(
    pathInput: string | Record<string, OpenApiParameterValue | undefined> | undefined,
    name: string,
): OpenApiParameterValue | undefined {
    if (!name) {
        return undefined;
    }

    if (pathInput === undefined) {
        return undefined;
    }

    if (typeof pathInput === 'object' && pathInput !== null) {
        return pathInput[name];
    }

    const values = parsePathParameterMap(pathInput);
    return values[name];
}

function parsePathParameterMap(pathname: string): Record<string, string> {
    const values: Record<string, string> = {};
    const boundaryIndexes = [pathname.indexOf('?'), pathname.indexOf('#')].filter((index) => index >= 0);
    const pathOnly = boundaryIndexes.length === 0 ? pathname : pathname.slice(0, Math.min(...boundaryIndexes));
    const trimmed = pathOnly.startsWith('/') ? pathOnly.slice(1) : pathOnly;
    if (!trimmed) {
        return values;
    }

    for (const segment of trimmed.split('/')) {
        if (!segment || !segment.includes(';')) {
            continue;
        }

        const parameters = segment.split(';').slice(1);
        for (const parameter of parameters) {
            const eqIndex = parameter.indexOf('=');
            if (eqIndex <= 0) {
                continue;
            }

            const rawName = parameter.slice(0, eqIndex);
            const rawValue = parameter.slice(eqIndex + 1);
            const name = decodePercentComponent(rawName);
            const value = decodePercentComponent(rawValue);
            if (name === null || value === null) {
                continue;
            }

            values[name] = value;
        }
    }

    return values;
}
