/**
 * OpenAPI shared types.
 * OpenAPI Specification v3.1.1.
 * @see https://spec.openapis.org/oas/v3.1.1.html
 */

export type OpenApiParameterLocation = 'query' | 'header' | 'path' | 'cookie';

export type OpenApiParameterStyle =
    | 'matrix'
    | 'label'
    | 'form'
    | 'simple'
    | 'spaceDelimited'
    | 'pipeDelimited'
    | 'deepObject';

export type OpenApiParameterPrimitive = string | number | boolean | null;

export type OpenApiParameterValue =
    | OpenApiParameterPrimitive
    | OpenApiParameterValue[]
    | { [key: string]: OpenApiParameterValue };

export type OpenApiParameterValueType = 'primitive' | 'array' | 'object';

export interface OpenApiSchemaParameterSpec {
    name: string;
    in: OpenApiParameterLocation;
    style?: OpenApiParameterStyle;
    explode?: boolean;
    allowReserved?: boolean;
    valueType: OpenApiParameterValueType;
}

export interface NormalizedOpenApiSchemaParameterSpec {
    name: string;
    in: OpenApiParameterLocation;
    style: OpenApiParameterStyle;
    explode: boolean;
    allowReserved: boolean;
    valueType: OpenApiParameterValueType;
}

export interface OpenApiQueryEntry {
    name: string;
    value: string;
}

export interface OpenApiCookiePair {
    name: string;
    value: string;
}

export interface OpenApiRuntimeEvaluationContext {
    request: {
        url: string;
        method: string;
        path?: string | Record<string, OpenApiParameterValue | undefined>;
        query?: Record<string, OpenApiParameterValue | undefined>;
        headers?: Record<string, string | undefined>;
        body?: unknown;
    };
    response?: {
        url?: string;
        method?: string;
        status?: number;
        path?: string | Record<string, OpenApiParameterValue | undefined>;
        query?: Record<string, OpenApiParameterValue | undefined>;
        headers?: Record<string, string | undefined>;
        body?: unknown;
    };
}

export type OpenApiRuntimeExpressionType =
    | 'url'
    | 'method'
    | 'statusCode'
    | 'request.header'
    | 'request.query'
    | 'request.path'
    | 'request.body'
    | 'response.header'
    // Non-standard extensions retained for symmetric request/response projections.
    | 'response.query'
    | 'response.path'
    | 'response.body';

export interface OpenApiUrlRuntimeExpression {
    type: 'url';
}

export interface OpenApiMethodRuntimeExpression {
    type: 'method';
}

export interface OpenApiStatusCodeRuntimeExpression {
    type: 'statusCode';
}

export interface OpenApiRequestHeaderRuntimeExpression {
    type: 'request.header';
    name: string;
}

export interface OpenApiRequestQueryRuntimeExpression {
    type: 'request.query';
    name: string;
}

export interface OpenApiRequestPathRuntimeExpression {
    type: 'request.path';
    name: string;
}

export interface OpenApiRequestBodyRuntimeExpression {
    type: 'request.body';
    pointer?: string;
}

export interface OpenApiResponseHeaderRuntimeExpression {
    type: 'response.header';
    name: string;
}

export interface OpenApiResponseQueryRuntimeExpression {
    type: 'response.query';
    name: string;
}

export interface OpenApiResponsePathRuntimeExpression {
    type: 'response.path';
    name: string;
}

export interface OpenApiResponseBodyRuntimeExpression {
    type: 'response.body';
    pointer?: string;
}

export type OpenApiRuntimeExpression =
    | OpenApiUrlRuntimeExpression
    | OpenApiMethodRuntimeExpression
    | OpenApiStatusCodeRuntimeExpression
    | OpenApiRequestHeaderRuntimeExpression
    | OpenApiRequestQueryRuntimeExpression
    | OpenApiRequestPathRuntimeExpression
    | OpenApiRequestBodyRuntimeExpression
    | OpenApiResponseHeaderRuntimeExpression
    | OpenApiResponseQueryRuntimeExpression
    | OpenApiResponsePathRuntimeExpression
    | OpenApiResponseBodyRuntimeExpression;

export interface OpenApiRuntimeExpressionEvaluationOptions {
    caseInsensitiveHeaders?: boolean;
}

export type OpenApiRuntimeResolutionMode = 'tolerant' | 'strict';

export interface OpenApiRuntimeResolutionOptions extends OpenApiRuntimeExpressionEvaluationOptions {
    mode?: OpenApiRuntimeResolutionMode;
}

export type OpenApiRuntimeResolutionIssueCode =
    | 'invalid-runtime-expression'
    | 'unresolved-runtime-expression'
    | 'invalid-callback-expression'
    | 'invalid-callback-template'
    | 'unresolved-callback-expression';

export interface OpenApiRuntimeResolutionIssue {
    code: OpenApiRuntimeResolutionIssueCode;
    message: string;
    path: string;
    expression?: string;
}

export interface OpenApiLinkObjectLike {
    parameters?: Record<string, unknown>;
    requestBody?: unknown;
}

export interface OpenApiLinkMaterializationResult {
    parameters: Record<string, unknown>;
    requestBody: unknown;
    issues: OpenApiRuntimeResolutionIssue[];
}

export interface OpenApiCallbackUrlResolutionResult {
    url: string | undefined;
    issues: OpenApiRuntimeResolutionIssue[];
}

export type OpenApiSecuritySchemeType = 'apiKey' | 'http' | 'mutualTLS' | 'oauth2' | 'openIdConnect';

export type OpenApiApiKeyLocation = 'query' | 'header' | 'cookie';

export interface OpenApiSecurityRequirement {
    [schemeName: string]: string[];
}

export type OpenApiSecurityRequirements = OpenApiSecurityRequirement[];

export interface OpenApiApiKeySecurityScheme {
    type: 'apiKey';
    in: OpenApiApiKeyLocation;
    name: string;
    description?: string;
}

export type OpenApiOAuthScopes = Record<string, string>;

export interface OpenApiOAuthImplicitFlowObject {
    authorizationUrl: string;
    refreshUrl?: string;
    scopes: OpenApiOAuthScopes;
}

export interface OpenApiOAuthPasswordFlowObject {
    tokenUrl: string;
    refreshUrl?: string;
    scopes: OpenApiOAuthScopes;
}

export interface OpenApiOAuthClientCredentialsFlowObject {
    tokenUrl: string;
    refreshUrl?: string;
    scopes: OpenApiOAuthScopes;
}

export interface OpenApiOAuthAuthorizationCodeFlowObject {
    authorizationUrl: string;
    tokenUrl: string;
    refreshUrl?: string;
    scopes: OpenApiOAuthScopes;
}

interface OpenApiOAuthFlowsObjectShape {
    implicit?: OpenApiOAuthImplicitFlowObject;
    password?: OpenApiOAuthPasswordFlowObject;
    clientCredentials?: OpenApiOAuthClientCredentialsFlowObject;
    authorizationCode?: OpenApiOAuthAuthorizationCodeFlowObject;
}

export type OpenApiOAuthFlowsObject = OpenApiOAuthFlowsObjectShape & (
    { implicit: OpenApiOAuthImplicitFlowObject }
    | { password: OpenApiOAuthPasswordFlowObject }
    | { clientCredentials: OpenApiOAuthClientCredentialsFlowObject }
    | { authorizationCode: OpenApiOAuthAuthorizationCodeFlowObject }
);

export interface OpenApiHttpSecurityScheme {
    type: 'http';
    scheme: string;
    bearerFormat?: string;
    description?: string;
}

export interface OpenApiOAuth2SecurityScheme {
    type: 'oauth2';
    flows: OpenApiOAuthFlowsObject;
    availableScopes?: readonly string[];
    description?: string;
}

export interface OpenApiOpenIdConnectSecurityScheme {
    type: 'openIdConnect';
    openIdConnectUrl: string;
    availableScopes?: readonly string[];
    description?: string;
}

export interface OpenApiMutualTlsSecurityScheme {
    type: 'mutualTLS';
    description?: string;
}

export type OpenApiSecuritySchemeMetadata =
    | OpenApiApiKeySecurityScheme
    | OpenApiHttpSecurityScheme
    | OpenApiOAuth2SecurityScheme
    | OpenApiOpenIdConnectSecurityScheme
    | OpenApiMutualTlsSecurityScheme;

export type OpenApiSecuritySchemeRegistry = Record<string, OpenApiSecuritySchemeMetadata | undefined>;

export type OpenApiUnknownSchemeHandling = 'ignore' | 'error';

export type OpenApiSecurityValidationMode = 'tolerant' | 'strict';

export interface OpenApiSecurityValidationOptions {
    mode?: OpenApiSecurityValidationMode;
    unknownSchemes?: OpenApiUnknownSchemeHandling;
    enforceScopeDeclarations?: boolean;
}

export interface OpenApiSecurityCredentialObject {
    present?: boolean;
    value?: string;
    scheme?: string;
    scopes?: readonly string[];
}

export type OpenApiSecurityCredential = boolean | string | readonly string[] | OpenApiSecurityCredentialObject;

export type OpenApiSecurityCredentials = Record<string, OpenApiSecurityCredential | undefined>;

export type OpenApiSecurityEvaluationSchemeCode =
    | 'satisfied'
    | 'missing-credential'
    | 'missing-scopes'
    | 'http-scheme-mismatch'
    | 'unknown-scheme';

export interface OpenApiSecuritySchemeEvaluationResult {
    schemeName: string;
    schemeType?: OpenApiSecuritySchemeType;
    satisfied: boolean;
    code: OpenApiSecurityEvaluationSchemeCode;
    message: string;
    requiredScopes: string[];
    grantedScopes: string[];
    missingScopes: string[];
}

export interface OpenApiSecurityRequirementEvaluationResult {
    index: number;
    anonymous: boolean;
    satisfied: boolean;
    schemes: OpenApiSecuritySchemeEvaluationResult[];
}

export interface OpenApiSecurityEvaluationResult {
    allowed: boolean;
    anonymous: boolean;
    matchedRequirementIndex: number | null;
    requirements: OpenApiSecurityRequirementEvaluationResult[];
    diagnostics: OpenApiDiagnostic[];
}

export type OpenApiDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface OpenApiDiagnostic {
    severity: OpenApiDiagnosticSeverity;
    message: string;
    code?: string;
    path?: string;
}

export type OpenApiLintRuleCode =
    | 'duplicate-operation-id'
    | 'missing-required-path-param'
    | 'path-param-not-in-template'
    | 'parameter-schema-and-content'
    | 'parameter-content-too-many-entries'
    | 'extension-prefix'
    | 'component-key-format'
    | 'path-template-collision';

export interface OpenApiLintOptions {
    enabled?: readonly OpenApiLintRuleCode[] | Partial<Record<OpenApiLintRuleCode, boolean>>;
    severity?: Partial<Record<OpenApiLintRuleCode, OpenApiDiagnosticSeverity>>;
}

export type OpenApiPathPatternKind = 'concrete' | 'templated';

export interface OpenApiPathTemplateLiteralSegment {
    kind: 'literal';
    value: string;
}

export interface OpenApiPathTemplateParamSegment {
    kind: 'param';
    name: string;
}

export type OpenApiPathMatcherTemplateSegment =
    | OpenApiPathTemplateLiteralSegment
    | OpenApiPathTemplateParamSegment;

export type OpenApiPathVariableMap = Record<string, string>;

export type OpenApiPathItemHttpMethod =
    | 'get'
    | 'put'
    | 'post'
    | 'delete'
    | 'options'
    | 'head'
    | 'patch'
    | 'trace';

export interface OpenApiServerVariableObject {
    default: string;
    enum?: readonly string[];
    description?: string;
}

export interface OpenApiServerObject {
    url: string;
    description?: string;
    variables?: Record<string, OpenApiServerVariableObject | undefined>;
}

export interface OpenApiOperationObjectLike {
    servers?: readonly OpenApiServerObject[];
    [key: string]: unknown;
}

export interface OpenApiPathItemObjectLike {
    servers?: readonly OpenApiServerObject[];
    get?: OpenApiOperationObjectLike;
    put?: OpenApiOperationObjectLike;
    post?: OpenApiOperationObjectLike;
    delete?: OpenApiOperationObjectLike;
    options?: OpenApiOperationObjectLike;
    head?: OpenApiOperationObjectLike;
    patch?: OpenApiOperationObjectLike;
    trace?: OpenApiOperationObjectLike;
    [key: string]: unknown;
}

export interface OpenApiDocumentLike {
    servers?: readonly OpenApiServerObject[];
    paths?: Record<string, OpenApiPathItemObjectLike | undefined>;
    [key: string]: unknown;
}

export interface OpenApiPathTemplateMatchOptions {
    caseSensitive?: boolean;
    decodePathSegments?: boolean;
    ignoreTrailingSlash?: boolean;
}

export interface OpenApiPathMatcherOptions extends OpenApiPathTemplateMatchOptions {
}

export interface OpenApiPathMatch {
    pathTemplate: string;
    normalizedTemplatePath: string;
    requestPath: string;
    method?: string;
    params: OpenApiPathVariableMap;
    patternKind: OpenApiPathPatternKind;
    operation?: OpenApiOperationObjectLike;
    pathItem: Record<string, unknown>;
}

export interface OpenApiPathMatchCandidate {
    pathTemplate: string;
    normalizedTemplatePath: string;
    patternKind: OpenApiPathPatternKind;
    templateSegments: OpenApiPathMatcherTemplateSegment[];
    operationMethods: Set<string>;
    pathItem: Record<string, unknown>;
}

export interface OpenApiPathMatcherExplainResult {
    requestPath: string;
    normalizedRequestPath: string;
    method?: string;
    checked: OpenApiPathMatchCandidate[];
    matches: OpenApiPathMatch[];
}

export interface OpenApiPathMatcher {
    match(requestPath: string, method?: string): OpenApiPathMatch | null;
    matchAll(requestPath: string, method?: string): OpenApiPathMatch[];
    explain(requestPath: string, method?: string): OpenApiPathMatcherExplainResult;
}

export type OpenApiServerCandidateLevel = 'root' | 'path' | 'operation';

export interface OpenApiServerCandidate {
    level: OpenApiServerCandidateLevel;
    index: number;
    pathTemplate?: string;
    method?: string;
    server: OpenApiServerObject;
}

export type OpenApiServerVariableValue = string | number | boolean;

export type OpenApiServerVariableMap = Record<string, string>;

export interface OpenApiServerVariableOverridesByLevel {
    root?: Record<string, OpenApiServerVariableValue | undefined>;
    path?: Record<string, OpenApiServerVariableValue | undefined>;
    operation?: Record<string, OpenApiServerVariableValue | undefined>;
}

export interface OpenApiPathServerResolverOverrides {
    rootServers?: readonly OpenApiServerObject[];
    pathServers?: readonly OpenApiServerObject[];
    operationServers?: readonly OpenApiServerObject[];
}

export interface OpenApiPathServerResolverOptions {
    overrides?: OpenApiPathServerResolverOverrides;
}

export interface OpenApiServerResolutionInput {
    server: OpenApiServerObject;
    level?: OpenApiServerCandidateLevel;
    baseUrl?: string;
    variables?: Record<string, OpenApiServerVariableValue | undefined>;
    variableOverridesByLevel?: OpenApiServerVariableOverridesByLevel;
}

export interface OpenApiServerResolutionResult {
    url: string;
    diagnostics: OpenApiDiagnostic[];
    variables: OpenApiServerVariableMap;
}
