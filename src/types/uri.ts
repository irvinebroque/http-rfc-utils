/**
 * URI and URI-derived types.
 * RFC 3986, RFC 6570, RFC 6920, RFC 8615.
 */

// URI (RFC 3986)
export type UriComponent = 'path' | 'query' | 'fragment' | 'userinfo';

// URI Template (RFC 6570)

/**
 * A variable value for URI Template expansion.
 * RFC 6570 Section 2.3, Section 2.4.2.
 */
export type UriTemplateValue = string | string[] | Record<string, string> | undefined;

/**
 * Variable bindings for URI Template expansion.
 */
export type UriTemplateVariables = Record<string, UriTemplateValue>;

/**
 * Expression operators per RFC 6570 Section 2.2.
 */
export type UriTemplateOperator = '' | '+' | '#' | '.' | '/' | ';' | '?' | '&';

/**
 * Variable specification with optional modifiers.
 * RFC 6570 Section 2.3, Section 2.4.
 */
export interface UriTemplateVarSpec {
    name: string;
    prefix?: number;
    explode?: boolean;
}

/**
 * Parsed expression with operator and variables.
 * RFC 6570 Section 2.2.
 */
export interface UriTemplateExpression {
    operator: UriTemplateOperator;
    variables: UriTemplateVarSpec[];
}

/**
 * Part of a parsed URI Template: either a literal string or an expression.
 */
export type UriTemplatePart = string | UriTemplateExpression;

/**
 * Parsed URI Template structure.
 */
export interface UriTemplate {
    parts: UriTemplatePart[];
    variables: string[];
}

/**
 * Compiled template for efficient repeated expansion.
 */
export interface CompiledUriTemplate {
    expand: (variables: UriTemplateVariables) => string;
    variables: string[];
}

// Named Information URIs (RFC 6920)

/**
 * NI hash algorithm name from the Named Information Hash Algorithm Registry.
 * RFC 6920 Section 9.4.
 */
export type NiHashAlgorithm =
    | 'sha-256'
    | 'sha-256-128'
    | 'sha-256-120'
    | 'sha-256-96'
    | 'sha-256-64'
    | 'sha-256-32'
    | (string & {});

/**
 * Parsed ni URI query parameters.
 * RFC 6920 Section 3.1.
 */
export interface NiQueryParams {
    ct?: string;
    [name: string]: string | undefined;
}

/**
 * Parsed NI URI representation.
 * RFC 6920 Section 3.
 */
export interface NiUri {
    algorithm: NiHashAlgorithm;
    value: string;
    digest: Uint8Array;
    authority?: string;
    query?: NiQueryParams;
}

/**
 * Identity comparison result for two NI names.
 * RFC 6920 Section 2, Section 10.
 */
export interface NiComparisonResult {
    matches: boolean;
    leftValid: boolean;
    rightValid: boolean;
}

// Well-Known URIs (RFC 8615)

/**
 * Parsed top-level well-known path parts.
 * RFC 8615 Section 3.
 */
export interface WellKnownPathParts {
    prefix: '/.well-known/';
    suffix: string;
    path: string;
}
