/**
 * OpenAPI lint helpers for common specification consistency rules.
 * OpenAPI Specification v3.1.1.
 * @see https://spec.openapis.org/oas/v3.1.1.html
 */

import type {
    OpenApiDiagnostic,
    OpenApiDiagnosticSeverity,
    OpenApiLintOptions,
    OpenApiLintRuleCode,
} from '../types.js';

const OPENAPI_HTTP_METHODS = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
] as const;

const COMPONENT_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

const DEFAULT_RULE_SEVERITY: Record<OpenApiLintRuleCode, OpenApiDiagnosticSeverity> = {
    'duplicate-operation-id': 'error',
    'missing-required-path-param': 'error',
    'path-param-not-in-template': 'error',
    'parameter-schema-and-content': 'error',
    'parameter-content-too-many-entries': 'error',
    'extension-prefix': 'warning',
    'component-key-format': 'warning',
    'path-template-collision': 'error',
};

interface RuleContext {
    document: Record<string, unknown>;
    options: OpenApiLintOptions;
    diagnostics: OpenApiDiagnostic[];
}

interface PathParameterDeclaration {
    name: string;
    required: unknown;
    path: string;
}

interface OperationEntry {
    pathTemplate: string;
    pathItem: Record<string, unknown>;
    operation: Record<string, unknown>;
    method: string;
    operationPath: string;
}

interface PathCollisionCandidate {
    pathTemplate: string;
    signature: string;
    paramNames: (string | null)[];
}

export function lintOpenApiDocument(document: unknown, options: OpenApiLintOptions = {}): OpenApiDiagnostic[] {
    if (!isRecord(document)) {
        return [];
    }

    const diagnostics: OpenApiDiagnostic[] = [];
    const context: RuleContext = {
        document,
        options,
        diagnostics,
    };

    runRule(context, 'duplicate-operation-id', lintDuplicateOperationId);
    runRule(context, 'missing-required-path-param', lintMissingRequiredPathParams);
    runRule(context, 'path-param-not-in-template', lintPathParamNotInTemplate);
    runRule(context, 'parameter-schema-and-content', lintParameterSchemaAndContent);
    runRule(context, 'parameter-content-too-many-entries', lintParameterContentTooManyEntries);
    runRule(context, 'extension-prefix', lintExtensionPrefix);
    runRule(context, 'component-key-format', lintComponentKeyFormat);
    runRule(context, 'path-template-collision', lintPathTemplateCollisions);

    return diagnostics;
}

function runRule(
    context: RuleContext,
    rule: OpenApiLintRuleCode,
    lintRule: (ruleContext: RuleContext) => void,
): void {
    if (!isRuleEnabled(context.options, rule)) {
        return;
    }

    try {
        lintRule(context);
    } catch {
        // Keep linting non-throwing for malformed input.
    }
}

function lintDuplicateOperationId(context: RuleContext): void {
    const duplicates = new Map<string, OperationEntry[]>();
    const operations = listOperations(context.document);
    for (const operationEntry of operations) {
        const operationIdValue = operationEntry.operation.operationId;
        if (typeof operationIdValue !== 'string' || operationIdValue.length === 0) {
            continue;
        }

        const entries = duplicates.get(operationIdValue);
        if (entries) {
            entries.push(operationEntry);
            continue;
        }

        duplicates.set(operationIdValue, [operationEntry]);
    }

    const operationIds = [...duplicates.keys()].sort((left, right) => left.localeCompare(right));
    for (const operationId of operationIds) {
        const entries = duplicates.get(operationId);
        if (!entries || entries.length < 2) {
            continue;
        }

        const sortedEntries = [...entries].sort(compareOperationEntries);
        for (const entry of sortedEntries) {
            emitDiagnostic(
                context,
                'duplicate-operation-id',
                `operationId "${operationId}" is duplicated across ${entries.length} operations.`,
                `${entry.operationPath}.operationId`,
            );
        }
    }
}

function lintMissingRequiredPathParams(context: RuleContext): void {
    const operations = listOperations(context.document);
    for (const operationEntry of operations) {
        const placeholders = extractPathTemplatePlaceholders(operationEntry.pathTemplate);
        if (placeholders.length === 0) {
            continue;
        }

        const mergedPathParams = collectMergedPathParameterDeclarations(context.document, operationEntry);
        for (const placeholder of placeholders) {
            const declaration = mergedPathParams.get(placeholder);
            if (!declaration) {
                if (hasPotentialPathParameterReference(operationEntry.pathItem.parameters)) {
                    continue;
                }

                if (hasPotentialPathParameterReference(operationEntry.operation.parameters)) {
                    continue;
                }

                emitDiagnostic(
                    context,
                    'missing-required-path-param',
                    `Path template placeholder "${placeholder}" is not declared as a path parameter for ${operationEntry.method.toUpperCase()}.`,
                    operationEntry.operationPath,
                );
                continue;
            }

            if (declaration.required !== true) {
                emitDiagnostic(
                    context,
                    'missing-required-path-param',
                    `Path parameter "${placeholder}" must set required: true.`,
                    declaration.path,
                );
            }
        }
    }
}

function lintPathParamNotInTemplate(context: RuleContext): void {
    const pathsRecord = readPathsRecord(context.document);
    const pathTemplates = Object.keys(pathsRecord).sort((left, right) => left.localeCompare(right));
    for (const pathTemplate of pathTemplates) {
        const pathItemValue = pathsRecord[pathTemplate];
        if (!isRecord(pathItemValue)) {
            continue;
        }

        const placeholderSet = new Set(extractPathTemplatePlaceholders(pathTemplate));
        const pathBasePath = `${formatPathTemplateRef(pathTemplate)}.parameters`;
        const pathLevelParams = collectPathParameterDeclarations(context.document, pathItemValue.parameters, pathBasePath);
        for (const parameterDeclaration of pathLevelParams) {
            if (!placeholderSet.has(parameterDeclaration.name)) {
                emitDiagnostic(
                    context,
                    'path-param-not-in-template',
                    `Path parameter "${parameterDeclaration.name}" is declared but not present in template "${pathTemplate}".`,
                    parameterDeclaration.path,
                );
            }
        }

        for (const method of OPENAPI_HTTP_METHODS) {
            const operationValue = pathItemValue[method];
            if (!isRecord(operationValue)) {
                continue;
            }

            const operationBasePath = `${formatPathTemplateRef(pathTemplate)}.${method}.parameters`;
            const operationLevelParams = collectPathParameterDeclarations(context.document, operationValue.parameters, operationBasePath);
            for (const parameterDeclaration of operationLevelParams) {
                if (!placeholderSet.has(parameterDeclaration.name)) {
                    emitDiagnostic(
                        context,
                        'path-param-not-in-template',
                        `Path parameter "${parameterDeclaration.name}" is declared but not present in template "${pathTemplate}".`,
                        parameterDeclaration.path,
                    );
                }
            }
        }
    }
}

function lintParameterSchemaAndContent(context: RuleContext): void {
    forEachParameterObject(context.document, (parameter, parameterPath) => {
        if (hasDefinedProperty(parameter, 'schema') && hasDefinedProperty(parameter, 'content')) {
            emitDiagnostic(
                context,
                'parameter-schema-and-content',
                'Parameter Object cannot include both "schema" and "content".',
                parameterPath,
            );
        }
    });
}

function lintParameterContentTooManyEntries(context: RuleContext): void {
    forEachParameterObject(context.document, (parameter, parameterPath) => {
        if (!hasDefinedProperty(parameter, 'content')) {
            return;
        }

        const contentValue = parameter.content;
        if (!isRecord(contentValue)) {
            return;
        }

        const mediaTypes = Object.keys(contentValue);
        if (mediaTypes.length > 1) {
            emitDiagnostic(
                context,
                'parameter-content-too-many-entries',
                `Parameter Object content map must contain at most one entry; found ${mediaTypes.length}.`,
                `${parameterPath}.content`,
            );
        }
    });
}

function lintExtensionPrefix(context: RuleContext): void {
    const visited = new WeakSet<object>();
    walkForExtensionKeys(context, context.document, '', visited, false);
}

function walkForExtensionKeys(
    context: RuleContext,
    value: unknown,
    currentPath: string,
    visited: WeakSet<object>,
    skipCurrentKeyValidation: boolean,
): void {
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            walkForExtensionKeys(context, value[index], `${currentPath}[${index}]`, visited, false);
        }
        return;
    }

    if (!isRecord(value)) {
        return;
    }

    if (visited.has(value)) {
        return;
    }
    visited.add(value);

    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
    for (const key of keys) {
        const keyPath = appendPropertyPath(currentPath, key);
        if (!skipCurrentKeyValidation && isInvalidExtensionLikeKey(key)) {
            emitDiagnostic(
                context,
                'extension-prefix',
                `Extension-like key "${key}" should use the "x-" prefix.`,
                keyPath,
            );
        }

        walkForExtensionKeys(
            context,
            value[key],
            keyPath,
            visited,
            OPENAPI_ARBITRARY_KEY_MAP_FIELDS.has(key),
        );
    }
}

function lintComponentKeyFormat(context: RuleContext): void {
    const componentsValue = context.document.components;
    if (!isRecord(componentsValue)) {
        return;
    }

    const componentSectionNames = Object.keys(componentsValue).sort((left, right) => left.localeCompare(right));
    for (const componentSectionName of componentSectionNames) {
        const sectionValue = componentsValue[componentSectionName];
        if (!isRecord(sectionValue)) {
            continue;
        }

        const keys = Object.keys(sectionValue).sort((left, right) => left.localeCompare(right));
        for (const key of keys) {
            if (COMPONENT_KEY_PATTERN.test(key)) {
                continue;
            }

            const sectionPath = appendPropertyPath('components', componentSectionName);
            emitDiagnostic(
                context,
                'component-key-format',
                `Component key "${key}" must match /^[A-Za-z0-9._-]+$/.`,
                appendPropertyPath(sectionPath, key),
            );
        }
    }
}

function lintPathTemplateCollisions(context: RuleContext): void {
    const pathsRecord = readPathsRecord(context.document);
    const templates = Object.keys(pathsRecord).sort((left, right) => left.localeCompare(right));
    const groupedCandidates = new Map<string, PathCollisionCandidate[]>();

    for (const pathTemplate of templates) {
        const candidate = buildPathCollisionCandidate(pathTemplate);
        if (!candidate) {
            continue;
        }

        const existing = groupedCandidates.get(candidate.signature);
        if (existing) {
            existing.push(candidate);
            continue;
        }

        groupedCandidates.set(candidate.signature, [candidate]);
    }

    const collisionsByPath = new Map<string, Set<string>>();
    for (const candidates of groupedCandidates.values()) {
        if (candidates.length < 2) {
            continue;
        }

        const sortedCandidates = [...candidates].sort((left, right) => left.pathTemplate.localeCompare(right.pathTemplate));
        for (let leftIndex = 0; leftIndex < sortedCandidates.length; leftIndex++) {
            const leftCandidate = sortedCandidates[leftIndex];
            if (leftCandidate === undefined) {
                continue;
            }

            for (let rightIndex = leftIndex + 1; rightIndex < sortedCandidates.length; rightIndex++) {
                const rightCandidate = sortedCandidates[rightIndex];
                if (rightCandidate === undefined) {
                    continue;
                }

                if (!haveDifferentParameterNames(leftCandidate.paramNames, rightCandidate.paramNames)) {
                    continue;
                }

                addPathCollision(collisionsByPath, leftCandidate.pathTemplate, rightCandidate.pathTemplate);
                addPathCollision(collisionsByPath, rightCandidate.pathTemplate, leftCandidate.pathTemplate);
            }
        }
    }

    const sortedPaths = [...collisionsByPath.keys()].sort((left, right) => left.localeCompare(right));
    for (const pathTemplate of sortedPaths) {
        const collisions = [...(collisionsByPath.get(pathTemplate) ?? new Set<string>())].sort((left, right) => left.localeCompare(right));
        emitDiagnostic(
            context,
            'path-template-collision',
            `Path template "${pathTemplate}" collides with ${collisions.map((entry) => `"${entry}"`).join(', ')} because only parameter names differ.`,
            formatPathTemplateRef(pathTemplate),
        );
    }
}

function buildPathCollisionCandidate(pathTemplate: string): PathCollisionCandidate | null {
    const segments = splitPathTemplateSegments(pathTemplate);
    const normalizedSegments: string[] = [];
    const paramNames: (string | null)[] = [];
    let hasTemplatedSegment = false;

    for (const segment of segments) {
        const parameterName = parsePathTemplateSegmentParameterName(segment);
        if (parameterName === null) {
            normalizedSegments.push(`lit:${segment}`);
            paramNames.push(null);
            continue;
        }

        hasTemplatedSegment = true;
        normalizedSegments.push('{}');
        paramNames.push(parameterName);
    }

    if (!hasTemplatedSegment) {
        return null;
    }

    return {
        pathTemplate,
        signature: normalizedSegments.join('/'),
        paramNames,
    };
}

function haveDifferentParameterNames(
    leftParamNames: readonly (string | null)[],
    rightParamNames: readonly (string | null)[],
): boolean {
    const maxLength = Math.max(leftParamNames.length, rightParamNames.length);
    for (let index = 0; index < maxLength; index++) {
        const left = leftParamNames[index];
        const right = rightParamNames[index];
        if (left !== null && right !== null && left !== right) {
            return true;
        }
    }

    return false;
}

function addPathCollision(collisionsByPath: Map<string, Set<string>>, pathTemplate: string, collisionWith: string): void {
    const existing = collisionsByPath.get(pathTemplate);
    if (existing) {
        existing.add(collisionWith);
        return;
    }

    collisionsByPath.set(pathTemplate, new Set([collisionWith]));
}

function forEachParameterObject(
    document: Record<string, unknown>,
    visitor: (parameter: Record<string, unknown>, path: string) => void,
): void {
    const pathsRecord = readPathsRecord(document);
    const pathTemplates = Object.keys(pathsRecord).sort((left, right) => left.localeCompare(right));
    for (const pathTemplate of pathTemplates) {
        const pathItemValue = pathsRecord[pathTemplate];
        if (!isRecord(pathItemValue)) {
            continue;
        }

        const pathLevelParametersPath = `${formatPathTemplateRef(pathTemplate)}.parameters`;
        forEachParameterInArray(pathItemValue.parameters, pathLevelParametersPath, visitor);

        for (const method of OPENAPI_HTTP_METHODS) {
            const operationValue = pathItemValue[method];
            if (!isRecord(operationValue)) {
                continue;
            }

            const operationParametersPath = `${formatPathTemplateRef(pathTemplate)}.${method}.parameters`;
            forEachParameterInArray(operationValue.parameters, operationParametersPath, visitor);
        }
    }
}

function forEachParameterInArray(
    value: unknown,
    basePath: string,
    visitor: (parameter: Record<string, unknown>, path: string) => void,
): void {
    if (!Array.isArray(value)) {
        return;
    }

    for (let index = 0; index < value.length; index++) {
        const parameterValue = value[index];
        if (!isRecord(parameterValue) || isReferenceObject(parameterValue)) {
            continue;
        }

        visitor(parameterValue, `${basePath}[${index}]`);
    }
}

function collectMergedPathParameterDeclarations(
    document: Record<string, unknown>,
    operationEntry: OperationEntry,
): Map<string, PathParameterDeclaration> {
    const merged = new Map<string, PathParameterDeclaration>();
    const pathDeclarations = collectPathParameterDeclarations(
        document,
        operationEntry.pathItem.parameters,
        `${formatPathTemplateRef(operationEntry.pathTemplate)}.parameters`,
    );
    for (const declaration of pathDeclarations) {
        merged.set(declaration.name, declaration);
    }

    const operationDeclarations = collectPathParameterDeclarations(
        document,
        operationEntry.operation.parameters,
        `${operationEntry.operationPath}.parameters`,
    );
    for (const declaration of operationDeclarations) {
        merged.set(declaration.name, declaration);
    }

    return merged;
}

function collectPathParameterDeclarations(
    document: Record<string, unknown>,
    value: unknown,
    basePath: string,
): PathParameterDeclaration[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const declarations: PathParameterDeclaration[] = [];
    for (let index = 0; index < value.length; index++) {
        const parameterValue = resolveReferencedParameterObject(document, value[index]);
        if (!parameterValue) {
            continue;
        }

        if (parameterValue.in !== 'path') {
            continue;
        }

        if (typeof parameterValue.name !== 'string' || parameterValue.name.trim().length === 0) {
            continue;
        }

        declarations.push({
            name: parameterValue.name.trim(),
            required: parameterValue.required,
            path: `${basePath}[${index}]`,
        });
    }

    return declarations;
}

function resolveReferencedParameterObject(
    document: Record<string, unknown>,
    value: unknown,
): Record<string, unknown> | null {
    if (!isRecord(value)) {
        return null;
    }

    if (!isReferenceObject(value)) {
        return value;
    }

    return dereferenceLocalObject(document, value.$ref, new Set<string>());
}

function dereferenceLocalObject(
    document: Record<string, unknown>,
    ref: unknown,
    seenRefs: Set<string>,
): Record<string, unknown> | null {
    if (typeof ref !== 'string' || !ref.startsWith('#/')) {
        return null;
    }

    if (seenRefs.has(ref)) {
        return null;
    }
    seenRefs.add(ref);

    let current: unknown = document;
    const pointerSegments = ref
        .slice(2)
        .split('/')
        .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

    for (const segment of pointerSegments) {
        if (!isRecord(current)) {
            return null;
        }
        current = current[segment];
    }

    if (!isRecord(current)) {
        return null;
    }

    if (!isReferenceObject(current)) {
        return current;
    }

    return dereferenceLocalObject(document, current.$ref, seenRefs);
}

function hasPotentialPathParameterReference(value: unknown): boolean {
    if (!Array.isArray(value)) {
        return false;
    }

    for (const entry of value) {
        if (!isRecord(entry) || !isReferenceObject(entry)) {
            continue;
        }

        return true;
    }

    return false;
}

function listOperations(document: Record<string, unknown>): OperationEntry[] {
    const pathsRecord = readPathsRecord(document);
    const pathTemplates = Object.keys(pathsRecord).sort((left, right) => left.localeCompare(right));
    const operations: OperationEntry[] = [];

    for (const pathTemplate of pathTemplates) {
        const pathItemValue = pathsRecord[pathTemplate];
        if (!isRecord(pathItemValue)) {
            continue;
        }

        for (const method of OPENAPI_HTTP_METHODS) {
            const operationValue = pathItemValue[method];
            if (!isRecord(operationValue)) {
                continue;
            }

            operations.push({
                pathTemplate,
                pathItem: pathItemValue,
                operation: operationValue,
                method,
                operationPath: `${formatPathTemplateRef(pathTemplate)}.${method}`,
            });
        }
    }

    return operations;
}

function compareOperationEntries(left: OperationEntry, right: OperationEntry): number {
    if (left.pathTemplate !== right.pathTemplate) {
        return left.pathTemplate.localeCompare(right.pathTemplate);
    }

    return left.method.localeCompare(right.method);
}

function extractPathTemplatePlaceholders(pathTemplate: string): string[] {
    const names = new Set<string>();
    const matcher = /\{([^{}/]+)\}/g;

    let match = matcher.exec(pathTemplate);
    while (match) {
        const candidateName = match[1]?.trim();
        if (candidateName) {
            names.add(candidateName);
        }
        match = matcher.exec(pathTemplate);
    }

    return [...names].sort((left, right) => left.localeCompare(right));
}

function splitPathTemplateSegments(pathTemplate: string): string[] {
    if (!pathTemplate || pathTemplate === '/') {
        return [];
    }

    return pathTemplate.split('/').filter((segment) => segment.length > 0);
}

function parsePathTemplateSegmentParameterName(segment: string): string | null {
    if (!segment.startsWith('{') || !segment.endsWith('}')) {
        return null;
    }

    const name = segment.slice(1, -1).trim();
    if (!name || name.includes('{') || name.includes('}') || name.includes('/')) {
        return null;
    }

    return name;
}

function readPathsRecord(document: Record<string, unknown>): Record<string, unknown> {
    const pathsValue = document.paths;
    if (!isRecord(pathsValue)) {
        return {};
    }
    return pathsValue;
}

function isRuleEnabled(options: OpenApiLintOptions, rule: OpenApiLintRuleCode): boolean {
    const enabled = options.enabled;
    if (!enabled) {
        return true;
    }

    if (Array.isArray(enabled)) {
        return enabled.includes(rule);
    }

    const enabledByRule = enabled as Partial<Record<OpenApiLintRuleCode, boolean>>;
    return enabledByRule[rule] ?? true;
}

function emitDiagnostic(
    context: RuleContext,
    rule: OpenApiLintRuleCode,
    message: string,
    path: string,
): void {
    context.diagnostics.push({
        severity: context.options.severity?.[rule] ?? DEFAULT_RULE_SEVERITY[rule],
        code: `openapi-lint.${rule}`,
        message,
        path,
    });
}

function appendPropertyPath(parentPath: string, propertyName: string): string {
    if (IDENTIFIER_PATH_SEGMENT_PATTERN.test(propertyName)) {
        return parentPath ? `${parentPath}.${propertyName}` : propertyName;
    }

    return `${parentPath}[${JSON.stringify(propertyName)}]`;
}

function formatPathTemplateRef(pathTemplate: string): string {
    return `paths[${JSON.stringify(pathTemplate)}]`;
}

function hasDefinedProperty(record: Record<string, unknown>, key: string): boolean {
    return Object.hasOwn(record, key) && record[key] !== undefined;
}

function isInvalidExtensionLikeKey(key: string): boolean {
    if (key.startsWith('x-')) {
        return false;
    }

    if (key.startsWith('X-')) {
        return true;
    }

    return /^(?:x|X)(?:$|[A-Z0-9_.])/.test(key);
}

function isReferenceObject(value: Record<string, unknown>): boolean {
    return typeof value.$ref === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const OPENAPI_ARBITRARY_KEY_MAP_FIELDS = new Set([
    '$defs',
    'callbacks',
    'content',
    'definitions',
    'dependentSchemas',
    'encoding',
    'examples',
    'headers',
    'links',
    'mapping',
    'parameters',
    'pathItems',
    'paths',
    'patternProperties',
    'properties',
    'requestBodies',
    'responses',
    'schemas',
    'securitySchemes',
    'variables',
    'webhooks',
]);

const IDENTIFIER_PATH_SEGMENT_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
