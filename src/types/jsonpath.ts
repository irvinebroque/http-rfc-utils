/**
 * JSONPath types.
 * RFC 9535.
 * @see https://www.rfc-editor.org/rfc/rfc9535.html
 */

/**
 * A node in the result nodelist: value and its normalized path.
 * RFC 9535 Section 2.7.
 */
export interface JsonPathNode {
    value: unknown;
    path: string;
}

/**
 * Options for JSONPath query execution.
 */
export interface JsonPathOptions {
    throwOnError?: boolean;
    maxNodesVisited?: number;
    maxDepth?: number;
    maxRegexPatternLength?: number;
    maxRegexInputLength?: number;
    rejectUnsafeRegex?: boolean;
}

/**
 * JSONPath AST root query node.
 * RFC 9535 Section 2.1.
 */
export interface JsonPathQuery {
    type: 'query';
    root: '$' | '@';
    segments: JsonPathSegment[];
}

/**
 * JSONPath segment types.
 * RFC 9535 Section 2.5.
 */
export type JsonPathSegment = JsonPathChildSegment | JsonPathDescendantSegment;

export interface JsonPathChildSegment {
    type: 'child';
    selectors: JsonPathSelector[];
}

export interface JsonPathDescendantSegment {
    type: 'descendant';
    selectors: JsonPathSelector[];
}

/**
 * JSONPath selector types.
 * RFC 9535 Section 2.3.
 */
export type JsonPathSelector =
    | JsonPathNameSelector
    | JsonPathWildcardSelector
    | JsonPathIndexSelector
    | JsonPathSliceSelector
    | JsonPathFilterSelector;

export interface JsonPathNameSelector {
    type: 'name';
    name: string;
}

export interface JsonPathWildcardSelector {
    type: 'wildcard';
}

export interface JsonPathIndexSelector {
    type: 'index';
    index: number;
}

export type JsonPathSingularSelector = JsonPathNameSelector | JsonPathIndexSelector;

export interface JsonPathSliceSelector {
    type: 'slice';
    start?: number;
    end?: number;
    step?: number;
}

export interface JsonPathFilterSelector {
    type: 'filter';
    expression: JsonPathLogicalExpr;
}

/**
 * JSONPath logical expression types for filter selectors.
 * RFC 9535 Section 2.3.5.
 */
export type JsonPathLogicalExpr =
    | JsonPathOrExpr
    | JsonPathAndExpr
    | JsonPathNotExpr
    | JsonPathComparisonExpr
    | JsonPathTestExpr
    | JsonPathFunctionExpr;

export interface JsonPathOrExpr {
    type: 'or';
    operands: JsonPathLogicalExpr[];
}

export interface JsonPathAndExpr {
    type: 'and';
    operands: JsonPathLogicalExpr[];
}

export interface JsonPathNotExpr {
    type: 'not';
    operand: JsonPathLogicalExpr;
}

export type JsonPathComparisonOp = '==' | '!=' | '<' | '<=' | '>' | '>=';

export interface JsonPathComparisonExpr {
    type: 'comparison';
    operator: JsonPathComparisonOp;
    left: JsonPathComparable;
    right: JsonPathComparable;
}

export interface JsonPathTestExpr {
    type: 'test';
    query: JsonPathQuery;
}

/**
 * JSONPath comparable types for comparisons.
 * RFC 9535 Section 2.3.5.2.
 */
export type JsonPathComparable =
    | JsonPathLiteral
    | JsonPathSingularQuery
    | JsonPathFunctionExpr;

export interface JsonPathLiteral {
    type: 'literal';
    value: string | number | boolean | null;
}

export interface JsonPathSingularQuery {
    type: 'singular-query';
    root: '$' | '@';
    segments: JsonPathSegment[];
}

export type JsonPathSingularSegment = JsonPathSingularChildSegment;

export interface JsonPathSingularChildSegment {
    type: 'child';
    selectors: [JsonPathSingularSelector];
}

/**
 * JSONPath function expression.
 * RFC 9535 Section 2.4.
 */
export type JsonPathFunctionName = 'length' | 'count' | 'match' | 'search' | 'value';

export interface JsonPathFunctionExpr {
    type: 'function';
    name: JsonPathFunctionName;
    args: JsonPathFunctionArg[];
}

export type JsonPathFunctionArg =
    | JsonPathLiteral
    | JsonPathQuery
    | JsonPathFunctionExpr;
