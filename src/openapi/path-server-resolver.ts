/**
 * OpenAPI path matching and server resolution helpers.
 * OpenAPI Specification v3.1.1, Paths Object and Server Object.
 * @see https://spec.openapis.org/oas/v3.1.1#paths-object
 */

import type {
    OpenApiDiagnostic,
    OpenApiDocumentLike,
    OpenApiOperationObjectLike,
    OpenApiPathMatch,
    OpenApiPathMatchCandidate,
    OpenApiPathMatcher,
    OpenApiPathMatcherExplainResult,
    OpenApiPathMatcherOptions,
    OpenApiPathMatcherTemplateSegment,
    OpenApiPathPatternKind,
    OpenApiPathServerResolverOptions,
    OpenApiPathTemplateMatchOptions,
    OpenApiPathVariableMap,
    OpenApiServerCandidate,
    OpenApiServerCandidateLevel,
    OpenApiServerObject,
    OpenApiServerResolutionInput,
    OpenApiServerResolutionResult,
    OpenApiServerVariableMap,
    OpenApiServerVariableOverridesByLevel,
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

const PATH_MATCHER_DEFAULTS: Required<OpenApiPathMatcherOptions> = {
    caseSensitive: true,
    decodePathSegments: true,
    ignoreTrailingSlash: true,
};

const EXTRACT_PARAMS_DEFAULTS: Required<OpenApiPathTemplateMatchOptions> = {
    caseSensitive: true,
    decodePathSegments: true,
    ignoreTrailingSlash: true,
};

export function compileOpenApiPathMatcher(
    paths: Record<string, unknown> | undefined,
    options: OpenApiPathMatcherOptions = {},
): OpenApiPathMatcher {
    const matcherOptions = {
        ...PATH_MATCHER_DEFAULTS,
        ...options,
    };

    const entries: OpenApiPathMatchCandidate[] = [];
    const pathEntries = Object.entries(paths ?? {});
    for (const [pathTemplate, pathItemValue] of pathEntries) {
        if (!isRecord(pathItemValue)) {
            continue;
        }

        const compiled = compileTemplate(pathTemplate, matcherOptions);
        entries.push({
            pathTemplate,
            pathItem: pathItemValue,
            operationMethods: collectOperationMethods(pathItemValue),
            patternKind: compiled.patternKind,
            normalizedTemplatePath: compiled.normalizedTemplatePath,
            templateSegments: compiled.templateSegments,
        });
    }

    entries.sort(comparePathCandidates);

    return {
        match(requestPath: string, method?: string): OpenApiPathMatch | null {
            const normalizedMethod = normalizeMethod(method);
            const normalizedRequestPath = normalizePathInput(requestPath, matcherOptions.ignoreTrailingSlash);
            const requestSegments = splitPathSegments(normalizedRequestPath);

            for (const candidate of entries) {
                const match = tryMatchCandidate(candidate, requestSegments, normalizedMethod, matcherOptions);
                if (match !== null) {
                    return match;
                }
            }

            return null;
        },
        matchAll(requestPath: string, method?: string): OpenApiPathMatch[] {
            const normalizedMethod = normalizeMethod(method);
            const normalizedRequestPath = normalizePathInput(requestPath, matcherOptions.ignoreTrailingSlash);
            const requestSegments = splitPathSegments(normalizedRequestPath);

            const matches: OpenApiPathMatch[] = [];
            for (const candidate of entries) {
                const match = tryMatchCandidate(candidate, requestSegments, normalizedMethod, matcherOptions);
                if (match !== null) {
                    matches.push(match);
                }
            }

            return matches;
        },
        explain(requestPath: string, method?: string): OpenApiPathMatcherExplainResult {
            const normalizedMethod = normalizeMethod(method);
            const normalizedRequestPath = normalizePathInput(requestPath, matcherOptions.ignoreTrailingSlash);
            const requestSegments = splitPathSegments(normalizedRequestPath);

            const matches: OpenApiPathMatch[] = [];
            const checked: OpenApiPathMatchCandidate[] = [];
            for (const candidate of entries) {
                checked.push(candidate);
                const match = tryMatchCandidate(candidate, requestSegments, normalizedMethod, matcherOptions);
                if (match !== null) {
                    matches.push(match);
                }
            }

            return {
                requestPath,
                normalizedRequestPath,
                method: normalizedMethod,
                checked,
                matches,
            };
        },
    };
}

export function extractOpenApiPathParams(
    template: string,
    concretePath: string,
    options: OpenApiPathTemplateMatchOptions = {},
): OpenApiPathVariableMap | null {
    const matchOptions = {
        ...EXTRACT_PARAMS_DEFAULTS,
        ...options,
    };

    const compiled = compileTemplate(template, matchOptions);
    const normalizedConcretePath = normalizePathInput(concretePath, matchOptions.ignoreTrailingSlash);
    const concreteSegments = splitPathSegments(normalizedConcretePath);

    if (compiled.templateSegments.length !== concreteSegments.length) {
        return null;
    }

    const params: OpenApiPathVariableMap = {};
    for (let index = 0; index < compiled.templateSegments.length; index++) {
        const templateSegment = compiled.templateSegments[index];
        const requestSegment = concreteSegments[index];
        if (requestSegment === undefined) {
            return null;
        }

        if (templateSegment.kind === 'literal') {
            if (!segmentEquals(templateSegment.value, requestSegment, matchOptions.caseSensitive)) {
                return null;
            }
            continue;
        }

        const decoded = decodeSegment(requestSegment, matchOptions.decodePathSegments);
        if (decoded === null) {
            return null;
        }

        params[templateSegment.name] = decoded;
    }

    return params;
}

export function listOpenApiServerCandidates(
    document: OpenApiDocumentLike,
    pathTemplate?: string,
    method?: string,
    options: OpenApiPathServerResolverOptions = {},
): OpenApiServerCandidate[] {
    const selectedPathItem = pathTemplate ? readPathItem(document, pathTemplate) : undefined;
    const selectedMethod = normalizeMethod(method);
    const selectedOperation = selectedPathItem && selectedMethod
        ? readOperation(selectedPathItem, selectedMethod)
        : undefined;

    const operationServers = options.overrides?.operationServers ?? selectedOperation?.servers;
    if (Array.isArray(operationServers)) {
        return createServerCandidates(operationServers, 'operation', pathTemplate, selectedMethod);
    }

    const pathServers = options.overrides?.pathServers ?? selectedPathItem?.servers;
    if (Array.isArray(pathServers)) {
        return createServerCandidates(pathServers, 'path', pathTemplate, selectedMethod);
    }

    const rootServers = options.overrides?.rootServers ?? document.servers;
    if (Array.isArray(rootServers)) {
        return createServerCandidates(rootServers, 'root', pathTemplate, selectedMethod);
    }

    return [];
}

export function resolveOpenApiServerUrl(
    input: OpenApiServerResolutionInput,
): OpenApiServerResolutionResult {
    const diagnostics: OpenApiDiagnostic[] = [];
    const level = input.level ?? 'root';
    const variableValues = resolveServerVariableValues(input, level);
    const resolvedTemplate = substituteServerVariables(input.server, variableValues, diagnostics);

    const resolvedUrl = resolveServerUrlReference(resolvedTemplate, input.baseUrl, diagnostics);
    return {
        url: resolvedUrl,
        diagnostics,
        variables: variableValues,
    };
}

function createServerCandidates(
    servers: readonly OpenApiServerObject[],
    level: OpenApiServerCandidateLevel,
    pathTemplate?: string,
    method?: string,
): OpenApiServerCandidate[] {
    const candidates: OpenApiServerCandidate[] = [];
    for (let index = 0; index < servers.length; index++) {
        const server = servers[index];
        if (!server || typeof server.url !== 'string') {
            continue;
        }

        candidates.push({
            level,
            index,
            pathTemplate,
            method,
            server,
        });
    }
    return candidates;
}

function resolveServerVariableValues(
    input: OpenApiServerResolutionInput,
    level: OpenApiServerCandidateLevel,
): OpenApiServerVariableMap {
    const resolved: OpenApiServerVariableMap = {};
    const variables = input.server.variables ?? {};
    const mergedOverrides = mergeVariableOverridesByLevel(input.variableOverridesByLevel, level);
    const selectedLevelOverrides = input.variableOverridesByLevel?.[level] ?? {};
    const directOverrides = input.variables ?? {};

    const variableNames = new Set<string>([
        ...Object.keys(variables),
        ...Object.keys(mergedOverrides),
        ...Object.keys(selectedLevelOverrides),
        ...Object.keys(directOverrides),
    ]);

    const sortedNames = [...variableNames].sort((left, right) => left.localeCompare(right));
    for (const variableName of sortedNames) {
        const directValue = directOverrides[variableName];
        if (directValue !== undefined) {
            resolved[variableName] = String(directValue);
            continue;
        }

        const scopedValue = selectedLevelOverrides[variableName];
        if (scopedValue !== undefined) {
            resolved[variableName] = String(scopedValue);
            continue;
        }

        const fallbackValue = mergedOverrides[variableName];
        if (fallbackValue !== undefined) {
            resolved[variableName] = String(fallbackValue);
            continue;
        }

        const definedDefault = variables[variableName]?.default;
        if (typeof definedDefault === 'string') {
            resolved[variableName] = definedDefault;
        }
    }

    return resolved;
}

function substituteServerVariables(
    server: OpenApiServerObject,
    variableValues: OpenApiServerVariableMap,
    diagnostics: OpenApiDiagnostic[],
): string {
    const serverVariables = server.variables ?? {};
    return server.url.replace(/\{([^{}]+)\}/g, (fullMatch: string, rawVariableName: string): string => {
        const variableName = rawVariableName.trim();
        if (!variableName) {
            diagnostics.push({
                severity: 'error',
                code: 'openapi-server.invalid-variable-name',
                message: 'Server URL template contains an empty variable name.',
                path: 'server.url',
            });
            return fullMatch;
        }

        const value = variableValues[variableName];
        const definition = serverVariables[variableName];
        if (value === undefined) {
            diagnostics.push({
                severity: 'error',
                code: 'openapi-server.missing-variable-default',
                message: `Server variable "${variableName}" is missing a value and has no default.`,
                path: `server.variables.${variableName}`,
            });
            return fullMatch;
        }

        if (definition && Array.isArray(definition.enum) && definition.enum.length > 0 && !definition.enum.includes(value)) {
            diagnostics.push({
                severity: 'error',
                code: 'openapi-server.enum-mismatch',
                message: `Server variable "${variableName}" uses value "${value}" outside enum [${definition.enum.join(', ')}].`,
                path: `server.variables.${variableName}`,
            });
        }

        return value;
    });
}

function resolveServerUrlReference(
    urlTemplateResult: string,
    baseUrl: string | undefined,
    diagnostics: OpenApiDiagnostic[],
): string {
    if (!baseUrl) {
        return urlTemplateResult;
    }

    let parsedBaseUrl: URL;
    try {
        parsedBaseUrl = new URL(baseUrl);
    } catch {
        diagnostics.push({
            severity: 'error',
            code: 'openapi-server.invalid-base-url',
            message: `Base URL "${baseUrl}" is not a valid absolute URL.`,
            path: 'baseUrl',
        });
        return urlTemplateResult;
    }

    try {
        return new URL(urlTemplateResult, parsedBaseUrl).toString();
    } catch {
        diagnostics.push({
            severity: 'error',
            code: 'openapi-server.invalid-url',
            message: `Resolved server URL "${urlTemplateResult}" is invalid.`,
            path: 'server.url',
        });
        return urlTemplateResult;
    }
}

function compileTemplate(
    pathTemplate: string,
    options: Required<Pick<OpenApiPathTemplateMatchOptions, 'ignoreTrailingSlash'>>,
): {
    patternKind: OpenApiPathPatternKind;
    normalizedTemplatePath: string;
    templateSegments: OpenApiPathMatcherTemplateSegment[];
} {
    const normalizedTemplatePath = normalizePathInput(pathTemplate, options.ignoreTrailingSlash);
    const rawSegments = splitPathSegments(normalizedTemplatePath);
    const templateSegments: OpenApiPathMatcherTemplateSegment[] = [];

    let hasTemplateSegments = false;
    for (const rawSegment of rawSegments) {
        const templated = parseTemplateSegment(rawSegment);
        if (templated === null) {
            templateSegments.push({
                kind: 'literal',
                value: rawSegment,
            });
            continue;
        }

        hasTemplateSegments = true;
        templateSegments.push(templated);
    }

    return {
        patternKind: hasTemplateSegments ? 'templated' : 'concrete',
        normalizedTemplatePath,
        templateSegments,
    };
}

function tryMatchCandidate(
    candidate: OpenApiPathMatchCandidate,
    requestSegments: readonly string[],
    method: string | undefined,
    options: Required<OpenApiPathMatcherOptions>,
): OpenApiPathMatch | null {
    if (method && !candidate.operationMethods.has(method)) {
        return null;
    }

    if (candidate.templateSegments.length !== requestSegments.length) {
        return null;
    }

    const params: OpenApiPathVariableMap = {};
    for (let index = 0; index < candidate.templateSegments.length; index++) {
        const templateSegment = candidate.templateSegments[index];
        const requestSegment = requestSegments[index];
        if (requestSegment === undefined) {
            return null;
        }

        if (templateSegment.kind === 'literal') {
            if (!segmentEquals(templateSegment.value, requestSegment, options.caseSensitive)) {
                return null;
            }
            continue;
        }

        const decodedValue = decodeSegment(requestSegment, options.decodePathSegments);
        if (decodedValue === null) {
            return null;
        }

        params[templateSegment.name] = decodedValue;
    }

    const operation = method ? readOperation(candidate.pathItem, method) : undefined;
    return {
        pathTemplate: candidate.pathTemplate,
        normalizedTemplatePath: candidate.normalizedTemplatePath,
        requestPath: `/${requestSegments.join('/')}`,
        method,
        params,
        patternKind: candidate.patternKind,
        operation,
        pathItem: candidate.pathItem,
    };
}

function collectOperationMethods(pathItem: Record<string, unknown>): Set<string> {
    const methods = new Set<string>();
    for (const method of OPENAPI_HTTP_METHODS) {
        if (isRecord(pathItem[method])) {
            methods.add(method);
        }
    }
    return methods;
}

function comparePathCandidates(left: OpenApiPathMatchCandidate, right: OpenApiPathMatchCandidate): number {
    if (left.patternKind !== right.patternKind) {
        return left.patternKind === 'concrete' ? -1 : 1;
    }

    const leftLiteralCount = countLiteralSegments(left.templateSegments);
    const rightLiteralCount = countLiteralSegments(right.templateSegments);
    if (leftLiteralCount !== rightLiteralCount) {
        return rightLiteralCount - leftLiteralCount;
    }

    if (left.templateSegments.length !== right.templateSegments.length) {
        return right.templateSegments.length - left.templateSegments.length;
    }

    return left.pathTemplate.localeCompare(right.pathTemplate);
}

function countLiteralSegments(segments: readonly OpenApiPathMatcherTemplateSegment[]): number {
    let count = 0;
    for (const segment of segments) {
        if (segment.kind === 'literal') {
            count++;
        }
    }
    return count;
}

function parseTemplateSegment(segment: string): OpenApiPathMatcherTemplateSegment | null {
    if (!segment.startsWith('{') || !segment.endsWith('}')) {
        return null;
    }

    const name = segment.slice(1, -1).trim();
    if (!name || name.includes('{') || name.includes('}') || name.includes('/')) {
        return null;
    }

    return {
        kind: 'param',
        name,
    };
}

function normalizeMethod(method: string | undefined): string | undefined {
    if (!method) {
        return undefined;
    }
    const normalized = method.trim().toLowerCase();
    return normalized || undefined;
}

function normalizePathInput(pathValue: string, ignoreTrailingSlash: boolean): string {
    const extractedPath = extractPathFromInput(pathValue);
    const ensured = extractedPath.startsWith('/') ? extractedPath : `/${extractedPath}`;
    if (!ignoreTrailingSlash || ensured === '/') {
        return ensured || '/';
    }

    if (ensured.length > 1 && ensured.endsWith('/')) {
        return ensured.slice(0, -1);
    }

    return ensured;
}

function extractPathFromInput(pathValue: string): string {
    const trimmed = pathValue.trim();
    if (!trimmed) {
        return '/';
    }

    if (trimmed.startsWith('/')) {
        return stripQueryAndHash(trimmed);
    }

    try {
        const parsed = new URL(trimmed);
        return parsed.pathname || '/';
    } catch {
        return stripQueryAndHash(trimmed);
    }
}

function stripQueryAndHash(pathValue: string): string {
    const queryIndex = pathValue.indexOf('?');
    const hashIndex = pathValue.indexOf('#');
    const cutIndex = queryIndex === -1
        ? hashIndex
        : hashIndex === -1
            ? queryIndex
            : Math.min(queryIndex, hashIndex);
    return cutIndex === -1 ? pathValue : pathValue.slice(0, cutIndex);
}

function splitPathSegments(pathValue: string): string[] {
    if (!pathValue || pathValue === '/') {
        return [];
    }

    return pathValue.split('/').filter((segment) => segment.length > 0);
}

function segmentEquals(left: string, right: string, caseSensitive: boolean): boolean {
    if (caseSensitive) {
        return left === right;
    }
    return left.toLowerCase() === right.toLowerCase();
}

function decodeSegment(value: string, shouldDecode: boolean): string | null {
    if (!shouldDecode) {
        return value;
    }

    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
}

function readPathItem(document: OpenApiDocumentLike, pathTemplate: string): Record<string, unknown> | undefined {
    const pathItem = document.paths?.[pathTemplate];
    return isRecord(pathItem) ? pathItem : undefined;
}

function readOperation(pathItem: Record<string, unknown>, method: string): OpenApiOperationObjectLike | undefined {
    const operation = pathItem[method];
    return isRecord(operation) ? operation : undefined;
}

function mergeVariableOverridesByLevel(
    overrides: OpenApiServerVariableOverridesByLevel | undefined,
    level: OpenApiServerCandidateLevel,
): OpenApiServerVariableMap {
    const merged: OpenApiServerVariableMap = {};
    if (!overrides) {
        return merged;
    }

    const levelsByPriority: Record<OpenApiServerCandidateLevel, readonly OpenApiServerCandidateLevel[]> = {
        root: ['root'],
        path: ['root', 'path'],
        operation: ['root', 'path', 'operation'],
    };

    for (const scopedLevel of levelsByPriority[level]) {
        const levelValues = overrides[scopedLevel];
        if (!levelValues) {
            continue;
        }

        const names = Object.keys(levelValues).sort((left, right) => left.localeCompare(right));
        for (const name of names) {
            const value = levelValues[name];
            if (value !== undefined) {
                merged[name] = String(value);
            }
        }
    }

    return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
