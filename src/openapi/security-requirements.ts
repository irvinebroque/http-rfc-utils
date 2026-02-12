/**
 * OpenAPI security requirement parsing, normalization, and evaluation helpers.
 * OpenAPI Specification v3.1.1, Security Requirement Object.
 * @see https://spec.openapis.org/oas/v3.1.1#security-requirement-object
 */

import type {
    OpenApiDiagnostic,
    OpenApiSecurityCredential,
    OpenApiSecurityCredentialObject,
    OpenApiSecurityCredentials,
    OpenApiSecurityEvaluationResult,
    OpenApiSecurityRequirement,
    OpenApiSecurityRequirementEvaluationResult,
    OpenApiSecuritySchemeEvaluationResult,
    OpenApiSecuritySchemeMetadata,
    OpenApiSecuritySchemeRegistry,
    OpenApiSecurityValidationOptions,
    OpenApiUnknownSchemeHandling,
} from '../types.js';

const MODE_DEFAULT = 'tolerant';
const UNKNOWN_SCHEMES_DEFAULT_TOLERANT: OpenApiUnknownSchemeHandling = 'ignore';
const UNKNOWN_SCHEMES_DEFAULT_STRICT: OpenApiUnknownSchemeHandling = 'error';
const INVALID_SHAPE_MESSAGE = 'OpenAPI field "security" must be an array of Security Requirement Objects';
const STRICT_FALLBACK_MESSAGE =
    'OpenAPI security requirements validation failed in strict mode with no diagnostic detail; verify schemes and scopes';

export function parseOpenApiSecurityRequirements(value: unknown): OpenApiSecurityRequirement[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const requirements: OpenApiSecurityRequirement[] = [];
    for (const requirementValue of value) {
        if (!isObjectRecord(requirementValue)) {
            return null;
        }

        const requirement: OpenApiSecurityRequirement = {};
        const entries = Object.entries(requirementValue);
        for (const [schemeName, requiredScopes] of entries) {
            if (!schemeName || !Array.isArray(requiredScopes)) {
                return null;
            }

            const scopes: string[] = [];
            for (const scope of requiredScopes) {
                if (typeof scope !== 'string') {
                    return null;
                }
                scopes.push(scope);
            }

            requirement[schemeName] = scopes;
        }

        requirements.push(requirement);
    }

    return requirements;
}

export function tryParseOpenApiSecurityRequirements(json: string): OpenApiSecurityRequirement[] | null {
    try {
        return parseOpenApiSecurityRequirements(JSON.parse(json));
    } catch {
        return null;
    }
}

export function validateOpenApiSecurityRequirements(
    requirements: unknown,
    schemeRegistry: OpenApiSecuritySchemeRegistry,
    options: OpenApiSecurityValidationOptions = {},
): void {
    const parsed = parseOpenApiSecurityRequirements(requirements);
    if (parsed === null) {
        throw new Error(INVALID_SHAPE_MESSAGE);
    }

    const diagnostics = collectRequirementDiagnostics(parsed, schemeRegistry, options);
    if (isStrictMode(options) && diagnostics.length > 0) {
        throw new Error(diagnostics[0]?.message ?? STRICT_FALLBACK_MESSAGE);
    }
}

export function normalizeOpenApiSecurityRequirements(
    requirements: unknown,
    schemeRegistry: OpenApiSecuritySchemeRegistry,
    options: OpenApiSecurityValidationOptions = {},
): OpenApiSecurityRequirement[] {
    const parsed = parseOpenApiSecurityRequirements(requirements);
    if (parsed === null) {
        throw new Error(INVALID_SHAPE_MESSAGE);
    }

    const normalized = parsed.map((requirement) => normalizeRequirement(requirement));
    const diagnostics = collectRequirementDiagnostics(normalized, schemeRegistry, options);
    if (isStrictMode(options) && diagnostics.length > 0) {
        throw new Error(diagnostics[0]?.message ?? STRICT_FALLBACK_MESSAGE);
    }

    return normalized;
}

export function resolveEffectiveOpenApiSecurity(
    rootSecurity: readonly OpenApiSecurityRequirement[] | undefined,
    operationSecurity: readonly OpenApiSecurityRequirement[] | undefined,
): OpenApiSecurityRequirement[] {
    const source = operationSecurity !== undefined ? operationSecurity : (rootSecurity ?? []);
    return source.map((requirement) => cloneRequirement(requirement));
}

export function evaluateOpenApiSecurity(
    requirements: unknown,
    schemeRegistry: OpenApiSecuritySchemeRegistry,
    credentials: OpenApiSecurityCredentials,
    options: OpenApiSecurityValidationOptions = {},
): OpenApiSecurityEvaluationResult {
    const parsed = parseOpenApiSecurityRequirements(requirements);
    if (parsed === null) {
        if (isStrictMode(options)) {
            throw new Error(INVALID_SHAPE_MESSAGE);
        }

        return {
            allowed: false,
            anonymous: false,
            matchedRequirementIndex: null,
            requirements: [],
            diagnostics: [{
                severity: 'error',
                code: 'openapi-security.invalid-shape',
                message: INVALID_SHAPE_MESSAGE,
                path: 'security',
            }],
        };
    }

    const normalized = parsed.map((requirement) => normalizeRequirement(requirement));
    const diagnostics = collectRequirementDiagnostics(normalized, schemeRegistry, options);
    const unknownHandling = resolveUnknownSchemeHandling(options);
    if (isStrictMode(options) && diagnostics.length > 0) {
        throw new Error(diagnostics[0]?.message ?? STRICT_FALLBACK_MESSAGE);
    }

    if (normalized.length === 0) {
        return {
            allowed: true,
            anonymous: true,
            matchedRequirementIndex: null,
            requirements: [],
            diagnostics,
        };
    }

    const requirementResults: OpenApiSecurityRequirementEvaluationResult[] = [];
    let matchedRequirementIndex: number | null = null;

    for (let requirementIndex = 0; requirementIndex < normalized.length; requirementIndex++) {
        const requirement = normalized[requirementIndex];
        if (requirement === undefined) {
            continue;
        }

        const schemeNames = Object.keys(requirement);
        if (schemeNames.length === 0) {
            const anonymousResult: OpenApiSecurityRequirementEvaluationResult = {
                index: requirementIndex,
                anonymous: true,
                satisfied: true,
                schemes: [],
            };
            requirementResults.push(anonymousResult);
            if (matchedRequirementIndex === null) {
                matchedRequirementIndex = requirementIndex;
            }
            continue;
        }

        const schemeResults: OpenApiSecuritySchemeEvaluationResult[] = [];
        let requirementSatisfied = true;

        for (const schemeName of schemeNames) {
            const requiredScopes = requirement[schemeName] ?? [];
            const scheme = schemeRegistry[schemeName];

            if (!scheme && unknownHandling === 'ignore') {
                continue;
            }

            const credential = credentials[schemeName];
            const schemeResult = evaluateScheme(
                schemeName,
                scheme,
                requiredScopes,
                credential,
            );

            if (!schemeResult.satisfied) {
                requirementSatisfied = false;
            }

            schemeResults.push(schemeResult);
        }

        const requirementResult: OpenApiSecurityRequirementEvaluationResult = {
            index: requirementIndex,
            anonymous: false,
            satisfied: requirementSatisfied,
            schemes: schemeResults,
        };
        requirementResults.push(requirementResult);

        if (requirementSatisfied && matchedRequirementIndex === null) {
            matchedRequirementIndex = requirementIndex;
        }
    }

    const matchedRequirement = matchedRequirementIndex === null
        ? null
        : (requirementResults[matchedRequirementIndex] ?? null);
    return {
        allowed: matchedRequirementIndex !== null,
        anonymous: matchedRequirement?.anonymous ?? false,
        matchedRequirementIndex,
        requirements: requirementResults,
        diagnostics,
    };
}

function collectRequirementDiagnostics(
    requirements: readonly OpenApiSecurityRequirement[],
    schemeRegistry: OpenApiSecuritySchemeRegistry,
    options: OpenApiSecurityValidationOptions,
): OpenApiDiagnostic[] {
    const diagnostics: OpenApiDiagnostic[] = [];
    const unknownHandling = resolveUnknownSchemeHandling(options);
    const enforceScopeDeclarations = options.enforceScopeDeclarations ?? false;

    for (let requirementIndex = 0; requirementIndex < requirements.length; requirementIndex++) {
        const requirement = requirements[requirementIndex];
        if (requirement === undefined) {
            continue;
        }

        const schemeNames = Object.keys(requirement);
        for (const schemeName of schemeNames) {
            const requiredScopes = requirement[schemeName] ?? [];
            const scheme = schemeRegistry[schemeName];

            if (!scheme) {
                if (unknownHandling === 'error') {
                    diagnostics.push({
                        severity: 'error',
                        code: 'openapi-security.unknown-scheme',
                        message: `Security scheme "${schemeName}" is not present in the registry.`,
                        path: `security[${requirementIndex}].${schemeName}`,
                    });
                }
                continue;
            }

            if ((scheme.type === 'oauth2' || scheme.type === 'openIdConnect') && enforceScopeDeclarations) {
                const declaredScopes = collectDeclaredScopes(scheme);
                for (const requiredScope of requiredScopes) {
                    if (!declaredScopes.has(requiredScope)) {
                        diagnostics.push({
                            severity: 'error',
                            code: 'openapi-security.undeclared-scope',
                            message: `Security scheme "${schemeName}" does not declare scope "${requiredScope}".`,
                            path: `security[${requirementIndex}].${schemeName}`,
                        });
                    }
                }
            }
        }
    }

    return diagnostics;
}

function collectDeclaredScopes(scheme: OpenApiSecuritySchemeMetadata): Set<string> {
    const declaredScopes = new Set<string>();

    if (scheme.type === 'oauth2') {
        for (const flow of Object.values(scheme.flows)) {
            if (!flow) {
                continue;
            }

            for (const scope of Object.keys(flow.scopes)) {
                if (scope.length > 0) {
                    declaredScopes.add(scope);
                }
            }
        }
    }

    if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') {
        for (const scope of scheme.availableScopes ?? []) {
            if (scope.length > 0) {
                declaredScopes.add(scope);
            }
        }
    }

    return declaredScopes;
}

function evaluateScheme(
    schemeName: string,
    scheme: OpenApiSecuritySchemeMetadata | undefined,
    requiredScopes: readonly string[],
    credential: OpenApiSecurityCredential | undefined,
): OpenApiSecuritySchemeEvaluationResult {
    const required = [...requiredScopes];

    if (!scheme) {
        return {
            schemeName,
            satisfied: false,
            code: 'unknown-scheme',
            message: `Security scheme "${schemeName}" is not present in the registry.`,
            requiredScopes: required,
            grantedScopes: [],
            missingScopes: required,
        };
    }

    switch (scheme.type) {
        case 'apiKey': {
            if (!hasApiKeyCredential(credential)) {
                return {
                    schemeName,
                    schemeType: scheme.type,
                    satisfied: false,
                    code: 'missing-credential',
                    message: `Security scheme "${schemeName}" is required but no credential was provided.`,
                    requiredScopes: required,
                    grantedScopes: [],
                    missingScopes: required,
                };
            }

            return {
                schemeName,
                schemeType: scheme.type,
                satisfied: true,
                code: 'satisfied',
                message: `Security scheme "${schemeName}" is satisfied.`,
                requiredScopes: required,
                grantedScopes: [],
                missingScopes: [],
            };
        }
        case 'mutualTLS': {
            if (!hasMutualTlsCredential(credential)) {
                return {
                    schemeName,
                    schemeType: scheme.type,
                    satisfied: false,
                    code: 'missing-credential',
                    message: `Security scheme "${schemeName}" is required but no credential was provided.`,
                    requiredScopes: required,
                    grantedScopes: [],
                    missingScopes: required,
                };
            }

            return {
                schemeName,
                schemeType: scheme.type,
                satisfied: true,
                code: 'satisfied',
                message: `Security scheme "${schemeName}" is satisfied.`,
                requiredScopes: required,
                grantedScopes: [],
                missingScopes: [],
            };
        }
        case 'http': {
            if (!hasHttpCredential(credential)) {
                return {
                    schemeName,
                    schemeType: scheme.type,
                    satisfied: false,
                    code: 'missing-credential',
                    message: `HTTP security scheme "${schemeName}" is required but no credential was provided.`,
                    requiredScopes: required,
                    grantedScopes: [],
                    missingScopes: required,
                };
            }

            const expectedScheme = scheme.scheme.trim().toLowerCase();
            const providedScheme = extractHttpScheme(credential);
            if (providedScheme !== undefined && providedScheme !== expectedScheme) {
                return {
                    schemeName,
                    schemeType: scheme.type,
                    satisfied: false,
                    code: 'http-scheme-mismatch',
                    message: `HTTP security scheme "${schemeName}" expects "${scheme.scheme}" credentials.`,
                    requiredScopes: required,
                    grantedScopes: [],
                    missingScopes: required,
                };
            }

            return {
                schemeName,
                schemeType: scheme.type,
                satisfied: true,
                code: 'satisfied',
                message: `HTTP security scheme "${schemeName}" is satisfied.`,
                requiredScopes: required,
                grantedScopes: [],
                missingScopes: [],
            };
        }
        case 'oauth2':
        case 'openIdConnect': {
            if (!hasScopedCredential(credential)) {
                return {
                    schemeName,
                    schemeType: scheme.type,
                    satisfied: false,
                    code: 'missing-credential',
                    message: `Security scheme "${schemeName}" is required but no credential was provided.`,
                    requiredScopes: required,
                    grantedScopes: [],
                    missingScopes: required,
                };
            }

            const grantedScopes = normalizeScopes(extractCredentialScopes(credential));
            const grantedSet = new Set(grantedScopes);
            const missingScopes = required.filter((scope) => !grantedSet.has(scope));
            if (missingScopes.length > 0) {
                return {
                    schemeName,
                    schemeType: scheme.type,
                    satisfied: false,
                    code: 'missing-scopes',
                    message: `Security scheme "${schemeName}" is missing required scopes: ${missingScopes.join(', ')}.`,
                    requiredScopes: required,
                    grantedScopes,
                    missingScopes,
                };
            }

            return {
                schemeName,
                schemeType: scheme.type,
                satisfied: true,
                code: 'satisfied',
                message: `Security scheme "${schemeName}" is satisfied.`,
                requiredScopes: required,
                grantedScopes,
                missingScopes: [],
            };
        }
        default: {
            const neverScheme: never = scheme;
            throw new Error(`Unknown OpenAPI security scheme type for "${schemeName}": ${String(neverScheme)}`);
        }
    }
}

function normalizeRequirement(requirement: OpenApiSecurityRequirement): OpenApiSecurityRequirement {
    const normalized: OpenApiSecurityRequirement = {};
    const schemeNames = Object.keys(requirement).sort((left, right) => left.localeCompare(right));
    for (const schemeName of schemeNames) {
        normalized[schemeName] = normalizeScopes(requirement[schemeName] ?? []);
    }
    return normalized;
}

function cloneRequirement(requirement: OpenApiSecurityRequirement): OpenApiSecurityRequirement {
    const clone: OpenApiSecurityRequirement = {};
    for (const [schemeName, requiredScopes] of Object.entries(requirement)) {
        clone[schemeName] = [...requiredScopes];
    }
    return clone;
}

function normalizeScopes(scopes: readonly string[]): string[] {
    return Array.from(new Set(scopes)).sort((left, right) => left.localeCompare(right));
}

function hasApiKeyCredential(credential: OpenApiSecurityCredential | undefined): boolean {
    if (credential === undefined || credential === null) {
        return false;
    }

    if (typeof credential === 'boolean') {
        return credential;
    }

    if (typeof credential === 'string') {
        return credential.trim().length > 0;
    }

    if (Array.isArray(credential)) {
        return false;
    }

    if (!isSecurityCredentialObject(credential)) {
        return false;
    }

    if (typeof credential.present === 'boolean') {
        return credential.present;
    }

    return typeof credential.value === 'string' && credential.value.trim().length > 0;
}

function hasMutualTlsCredential(credential: OpenApiSecurityCredential | undefined): boolean {
    if (credential === undefined || credential === null) {
        return false;
    }

    if (typeof credential === 'boolean') {
        return credential;
    }

    if (typeof credential === 'string') {
        return credential.trim().length > 0;
    }

    if (Array.isArray(credential)) {
        return false;
    }

    if (!isSecurityCredentialObject(credential)) {
        return false;
    }

    if (typeof credential.present === 'boolean') {
        return credential.present;
    }

    return typeof credential.value === 'string' && credential.value.trim().length > 0;
}

function hasHttpCredential(credential: OpenApiSecurityCredential | undefined): boolean {
    if (credential === undefined || credential === null) {
        return false;
    }

    if (typeof credential === 'boolean') {
        return credential;
    }

    if (typeof credential === 'string') {
        return credential.trim().length > 0;
    }

    if (Array.isArray(credential)) {
        return false;
    }

    if (!isSecurityCredentialObject(credential)) {
        return false;
    }

    if (typeof credential.present === 'boolean') {
        return credential.present;
    }

    if (typeof credential.scheme === 'string' && credential.scheme.trim().length > 0) {
        return true;
    }

    return typeof credential.value === 'string' && credential.value.trim().length > 0;
}

function hasScopedCredential(credential: OpenApiSecurityCredential | undefined): boolean {
    if (credential === undefined || credential === null) {
        return false;
    }

    if (typeof credential === 'boolean') {
        return credential;
    }

    if (typeof credential === 'string') {
        return credential.trim().length > 0;
    }

    if (Array.isArray(credential)) {
        return credential.some((scope) => typeof scope === 'string' && scope.trim().length > 0);
    }

    if (!isSecurityCredentialObject(credential)) {
        return false;
    }

    if (typeof credential.present === 'boolean') {
        return credential.present;
    }

    if (typeof credential.value === 'string' && credential.value.trim().length > 0) {
        return true;
    }

    return Array.isArray(credential.scopes)
        && credential.scopes.some((scope) => typeof scope === 'string' && scope.trim().length > 0);
}

function extractCredentialScopes(credential: OpenApiSecurityCredential | undefined): string[] {
    if (!credential) {
        return [];
    }

    if (Array.isArray(credential)) {
        return credential.filter((scope): scope is string => typeof scope === 'string');
    }

    if (isSecurityCredentialObject(credential) && Array.isArray(credential.scopes)) {
        return credential.scopes.filter((scope): scope is string => typeof scope === 'string');
    }

    return [];
}

function extractHttpScheme(credential: OpenApiSecurityCredential | undefined): string | undefined {
    if (!credential) {
        return undefined;
    }

    if (typeof credential === 'string') {
        return parseHttpAuthScheme(credential);
    }

    if (!isSecurityCredentialObject(credential)) {
        return undefined;
    }

    if (typeof credential.scheme === 'string' && credential.scheme.trim()) {
        return credential.scheme.trim().toLowerCase();
    }

    if (typeof credential.value === 'string') {
        return parseHttpAuthScheme(credential.value);
    }

    return undefined;
}

function parseHttpAuthScheme(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    const spaceIndex = trimmed.indexOf(' ');
    const scheme = (spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)).trim().toLowerCase();
    return scheme || undefined;
}

function resolveUnknownSchemeHandling(options: OpenApiSecurityValidationOptions): OpenApiUnknownSchemeHandling {
    if (options.unknownSchemes) {
        return options.unknownSchemes;
    }

    return isStrictMode(options) ? UNKNOWN_SCHEMES_DEFAULT_STRICT : UNKNOWN_SCHEMES_DEFAULT_TOLERANT;
}

function isStrictMode(options: OpenApiSecurityValidationOptions): boolean {
    return (options.mode ?? MODE_DEFAULT) === 'strict';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSecurityCredentialObject(
    value: OpenApiSecurityCredential | undefined,
): value is OpenApiSecurityCredentialObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
