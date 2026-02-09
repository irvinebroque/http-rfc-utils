/**
 * JSONPath types.
 * RFC 9535.
 */
export type {
    JsonPathNode,
    JsonPathOptions,
    JsonPathQuery,
    JsonPathSegment,
    JsonPathChildSegment,
    JsonPathDescendantSegment,
    JsonPathSelector,
    JsonPathNameSelector,
    JsonPathWildcardSelector,
    JsonPathIndexSelector,
    JsonPathSliceSelector,
    JsonPathFilterSelector,
    JsonPathLogicalExpr,
    JsonPathOrExpr,
    JsonPathAndExpr,
    JsonPathNotExpr,
    JsonPathComparisonOp,
    JsonPathComparisonExpr,
    JsonPathTestExpr,
    JsonPathComparable,
    JsonPathLiteral,
    JsonPathSingularQuery,
    JsonPathFunctionName,
    JsonPathFunctionExpr,
    JsonPathFunctionArg,
} from './shared.js';
