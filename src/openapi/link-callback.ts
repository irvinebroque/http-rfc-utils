/**
 * OpenAPI Link and Callback runtime-expression resolution helpers.
 * OpenAPI Specification v3.1.1, Link Object and Callback Object.
 * @see https://spec.openapis.org/oas/v3.1.1#link-object
 */

import {
    evaluateOpenApiRuntimeExpression,
    parseOpenApiRuntimeExpression,
} from './runtime-expression.js';
import type {
    OpenApiCallbackUrlResolutionResult,
    OpenApiLinkMaterializationResult,
    OpenApiLinkObjectLike,
    OpenApiRuntimeEvaluationContext,
    OpenApiRuntimeResolutionIssue,
    OpenApiRuntimeResolutionOptions,
} from '../types.js';

const MODE_DEFAULT = 'tolerant';
const UNRESOLVED_RUNTIME_VALUE = Symbol('unresolved-runtime-value');

export function materializeOpenApiLinkValues(
    link: OpenApiLinkObjectLike,
    context: OpenApiRuntimeEvaluationContext,
    options: OpenApiRuntimeResolutionOptions = {},
): OpenApiLinkMaterializationResult {
    const issues: OpenApiRuntimeResolutionIssue[] = [];
    const parameters: Record<string, unknown> = {};

    const linkParameters = link.parameters ?? {};
    const parameterNames = Object.keys(linkParameters).sort((left, right) => left.localeCompare(right));
    for (const parameterName of parameterNames) {
        const value = linkParameters[parameterName];
        const resolved = resolveRuntimeValue(value, context, `parameters.${parameterName}`, issues, options);
        if (resolved !== UNRESOLVED_RUNTIME_VALUE) {
            parameters[parameterName] = resolved;
        }
    }

    const resolvedRequestBody = resolveRuntimeValue(link.requestBody, context, 'requestBody', issues, options);
    const requestBody = resolvedRequestBody === UNRESOLVED_RUNTIME_VALUE ? undefined : resolvedRequestBody;

    enforceResolutionMode(issues, options);
    return {
        parameters,
        requestBody,
        issues,
    };
}

export function resolveOpenApiCallbackUrl(
    callbackKey: string,
    context: OpenApiRuntimeEvaluationContext,
    options: OpenApiRuntimeResolutionOptions = {},
): OpenApiCallbackUrlResolutionResult {
    const directExpression = parseOpenApiRuntimeExpression(callbackKey);
    if (directExpression !== null) {
        const issues: OpenApiRuntimeResolutionIssue[] = [];
        const resolved = evaluateOpenApiRuntimeExpression(directExpression, context, options);
        if (resolved === undefined) {
            issues.push({
                code: 'unresolved-callback-expression',
                path: 'callbackKey',
                message: `Callback expression "${callbackKey}" did not resolve in context.`,
                expression: callbackKey,
            });
            enforceResolutionMode(issues, options);
            return {
                url: undefined,
                issues,
            };
        }

        const serialized = serializeRuntimeValue(resolved);
        if (serialized === undefined) {
            issues.push({
                code: 'unresolved-callback-expression',
                path: 'callbackKey',
                message: `Callback expression "${callbackKey}" resolved to a non-serializable value.`,
                expression: callbackKey,
            });
            enforceResolutionMode(issues, options);
            return {
                url: undefined,
                issues,
            };
        }

        return {
            url: serialized,
            issues,
        };
    }

    const issues: OpenApiRuntimeResolutionIssue[] = [];
    const chunks: string[] = [];

    let cursor = 0;
    while (cursor < callbackKey.length) {
        const openIndex = callbackKey.indexOf('{', cursor);
        const closeIndexBeforeOpen = callbackKey.indexOf('}', cursor);
        if (closeIndexBeforeOpen !== -1 && (openIndex === -1 || closeIndexBeforeOpen < openIndex)) {
            issues.push({
                code: 'invalid-callback-template',
                path: 'callbackKey',
                message: `Callback key has an unmatched "}" at index ${closeIndexBeforeOpen}.`,
                expression: callbackKey,
            });
            break;
        }

        if (openIndex === -1) {
            chunks.push(callbackKey.slice(cursor));
            break;
        }

        chunks.push(callbackKey.slice(cursor, openIndex));

        const closeIndex = callbackKey.indexOf('}', openIndex + 1);
        if (closeIndex === -1) {
            issues.push({
                code: 'invalid-callback-template',
                path: 'callbackKey',
                message: `Callback key has an unmatched "{" at index ${openIndex}.`,
                expression: callbackKey,
            });
            break;
        }

        const rawExpression = callbackKey.slice(openIndex + 1, closeIndex);
        if (!rawExpression) {
            issues.push({
                code: 'invalid-callback-expression',
                path: `callbackKey[${openIndex}]`,
                message: `Callback key contains an empty runtime expression at index ${openIndex}.`,
                expression: rawExpression,
            });
            cursor = closeIndex + 1;
            continue;
        }

        const parsed = parseOpenApiRuntimeExpression(rawExpression);
        if (parsed === null) {
            issues.push({
                code: 'invalid-callback-expression',
                path: `callbackKey[${openIndex}]`,
                message: `Callback expression "${rawExpression}" is malformed.`,
                expression: rawExpression,
            });
            cursor = closeIndex + 1;
            continue;
        }

        const resolved = evaluateOpenApiRuntimeExpression(parsed, context, options);
        if (resolved === undefined) {
            issues.push({
                code: 'unresolved-callback-expression',
                path: `callbackKey[${openIndex}]`,
                message: `Callback expression "${rawExpression}" did not resolve in context.`,
                expression: rawExpression,
            });
            cursor = closeIndex + 1;
            continue;
        }

        const serialized = serializeRuntimeValue(resolved);
        if (serialized === undefined) {
            issues.push({
                code: 'unresolved-callback-expression',
                path: `callbackKey[${openIndex}]`,
                message: `Callback expression "${rawExpression}" resolved to a non-serializable value.`,
                expression: rawExpression,
            });
            cursor = closeIndex + 1;
            continue;
        }

        chunks.push(serialized);
        cursor = closeIndex + 1;
    }

    enforceResolutionMode(issues, options);
    return {
        url: issues.length > 0 ? undefined : chunks.join(''),
        issues,
    };
}

function resolveRuntimeValue(
    value: unknown,
    context: OpenApiRuntimeEvaluationContext,
    path: string,
    issues: OpenApiRuntimeResolutionIssue[],
    options: OpenApiRuntimeResolutionOptions,
): unknown | typeof UNRESOLVED_RUNTIME_VALUE {
    if (typeof value !== 'string') {
        return value;
    }

    if (!value.startsWith('$') && !value.includes('{$')) {
        return value;
    }

    if (!value.startsWith('$') && value.includes('{$')) {
        return resolveRuntimeTemplateValue(value, context, path, issues, options);
    }

    const parsed = parseOpenApiRuntimeExpression(value);
    if (parsed === null) {
        issues.push({
            code: 'invalid-runtime-expression',
            path,
            message: `Runtime expression "${value}" is malformed.`,
            expression: value,
        });
        return UNRESOLVED_RUNTIME_VALUE;
    }

    const resolved = evaluateOpenApiRuntimeExpression(parsed, context, options);
    if (resolved === undefined) {
        issues.push({
            code: 'unresolved-runtime-expression',
            path,
            message: `Runtime expression "${value}" did not resolve in context.`,
            expression: value,
        });
        return UNRESOLVED_RUNTIME_VALUE;
    }

    return resolved;
}

function resolveRuntimeTemplateValue(
    value: string,
    context: OpenApiRuntimeEvaluationContext,
    path: string,
    issues: OpenApiRuntimeResolutionIssue[],
    options: OpenApiRuntimeResolutionOptions,
): string | typeof UNRESOLVED_RUNTIME_VALUE {
    const chunks: string[] = [];
    let cursor = 0;
    let hadIssue = false;

    while (cursor < value.length) {
        const openIndex = value.indexOf('{', cursor);
        if (openIndex === -1) {
            chunks.push(value.slice(cursor));
            break;
        }

        chunks.push(value.slice(cursor, openIndex));
        const closeIndex = value.indexOf('}', openIndex + 1);
        if (closeIndex === -1) {
            issues.push({
                code: 'invalid-runtime-expression',
                path,
                message: `Runtime expression template "${value}" has an unmatched "{" at index ${openIndex}.`,
                expression: value,
            });
            return UNRESOLVED_RUNTIME_VALUE;
        }

        const rawExpression = value.slice(openIndex + 1, closeIndex);
        if (!rawExpression || !rawExpression.startsWith('$')) {
            issues.push({
                code: 'invalid-runtime-expression',
                path,
                message: `Runtime expression "${rawExpression}" is malformed.`,
                expression: rawExpression,
            });
            hadIssue = true;
            cursor = closeIndex + 1;
            continue;
        }

        const parsed = parseOpenApiRuntimeExpression(rawExpression);
        if (parsed === null) {
            issues.push({
                code: 'invalid-runtime-expression',
                path,
                message: `Runtime expression "${rawExpression}" is malformed.`,
                expression: rawExpression,
            });
            hadIssue = true;
            cursor = closeIndex + 1;
            continue;
        }

        const resolved = evaluateOpenApiRuntimeExpression(parsed, context, options);
        if (resolved === undefined) {
            issues.push({
                code: 'unresolved-runtime-expression',
                path,
                message: `Runtime expression "${rawExpression}" did not resolve in context.`,
                expression: rawExpression,
            });
            hadIssue = true;
            cursor = closeIndex + 1;
            continue;
        }

        const serialized = serializeRuntimeValue(resolved);
        if (serialized === undefined) {
            issues.push({
                code: 'unresolved-runtime-expression',
                path,
                message: `Runtime expression "${rawExpression}" resolved to a non-serializable value.`,
                expression: rawExpression,
            });
            hadIssue = true;
            cursor = closeIndex + 1;
            continue;
        }

        chunks.push(serialized);
        cursor = closeIndex + 1;
    }

    if (hadIssue) {
        return UNRESOLVED_RUNTIME_VALUE;
    }

    return chunks.join('');
}

function serializeRuntimeValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }

    if (value === null) {
        return 'null';
    }

    try {
        const serialized = JSON.stringify(value);
        return serialized === undefined ? undefined : serialized;
    } catch {
        return undefined;
    }
}

function enforceResolutionMode(issues: readonly OpenApiRuntimeResolutionIssue[], options: OpenApiRuntimeResolutionOptions): void {
    const mode = options.mode ?? MODE_DEFAULT;
    if (mode === 'strict' && issues.length > 0) {
        throw new Error(issues[0]?.message ?? 'OpenAPI runtime resolution failed.');
    }
}
