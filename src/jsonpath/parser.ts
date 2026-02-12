/**
 * JSONPath parser.
 * RFC 9535 §2.1-§2.5.
 * @see https://www.rfc-editor.org/rfc/rfc9535.html
 */

import type {
    JsonPathQuery,
    JsonPathSegment,
    JsonPathChildSegment,
    JsonPathDescendantSegment,
    JsonPathSelector,
    JsonPathIndexSelector,
    JsonPathSliceSelector,
    JsonPathLogicalExpr,
    JsonPathComparisonOp,
    JsonPathComparable,
    JsonPathLiteral,
    JsonPathSingularQuery,
    JsonPathSingularSegment,
    JsonPathSingularSelector,
    JsonPathFunctionExpr,
    JsonPathFunctionArg,
    JsonPathFunctionName,
} from '../types/jsonpath.js';
import { isBuiltinFunctionName } from './builtins.js';
import { Lexer } from './lexer.js';

type FunctionExprType = 'value' | 'logical' | 'nodes';

interface FunctionSignature {
    args: FunctionExprType[];
    returns: FunctionExprType;
}

interface ParserState {
    expressionDepth: number;
    maxExpressionDepth: number;
}

const DEFAULT_MAX_EXPRESSION_DEPTH = 64;
const PARSER_STATE_BY_LEXER = new WeakMap<Lexer, ParserState>();

class JsonPathParserLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JsonPathParserLimitError';
    }
}

const FUNCTION_SIGNATURES: Record<JsonPathFunctionName, FunctionSignature> = {
    length: { args: ['value'], returns: 'value' },
    count: { args: ['nodes'], returns: 'value' },
    match: { args: ['value', 'value'], returns: 'logical' },
    search: { args: ['value', 'value'], returns: 'logical' },
    value: { args: ['nodes'], returns: 'value' },
};

/**
 * Parse a JSONPath query string into an AST.
 * Returns null if the query is not well-formed or valid.
 *
 * @param query - JSONPath query string (e.g., "$.store.book[*].author")
 * @returns Parsed AST, or null on invalid syntax
 *
 * @example
 * `parseJsonPath('$.store.book[*]')`  // returns a query AST
 * `parseJsonPath('invalid')`          // null
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535.html#section-2.1
 */
export function parseJsonPath(query: string): JsonPathQuery | null {
    try {
        const lexer = new Lexer(query);
        PARSER_STATE_BY_LEXER.set(lexer, {
            expressionDepth: 0,
            maxExpressionDepth: DEFAULT_MAX_EXPRESSION_DEPTH,
        });
        const ast = parseQuery(lexer, '$');

        // Must consume entire input
        if (!lexer.isAtEnd()) {
            return null;
        }

        return ast;
    } catch {
        return null;
    }
}

function getParserState(lexer: Lexer): ParserState {
    const state = PARSER_STATE_BY_LEXER.get(lexer);
    if (state) {
        return state;
    }

    const fallback: ParserState = {
        expressionDepth: 0,
        maxExpressionDepth: DEFAULT_MAX_EXPRESSION_DEPTH,
    };
    PARSER_STATE_BY_LEXER.set(lexer, fallback);
    return fallback;
}

function enterExpression(lexer: Lexer): void {
    const state = getParserState(lexer);
    state.expressionDepth += 1;
    if (state.expressionDepth > state.maxExpressionDepth) {
        throw new JsonPathParserLimitError('JSONPath parser maxExpressionDepth limit exceeded');
    }
}

function exitExpression(lexer: Lexer): void {
    const state = getParserState(lexer);
    state.expressionDepth = Math.max(0, state.expressionDepth - 1);
}

function withExpressionScope<T>(lexer: Lexer, parse: () => T): T {
    enterExpression(lexer);
    try {
        return parse();
    } finally {
        exitExpression(lexer);
    }
}

function parseQuery(lexer: Lexer, expectedRoot: '$' | '@'): JsonPathQuery | null {
    // RFC 9535 §2.2.1: jsonpath-query = root-identifier segments
    const rootType = expectedRoot === '$' ? 'ROOT' : 'CURRENT';
    if (!lexer.match(rootType)) {
        return null;
    }

    const segments = parseSegments(lexer);

    return {
        type: 'query',
        root: expectedRoot,
        segments,
    };
}

function parseSegments(lexer: Lexer): JsonPathSegment[] {
    // RFC 9535 §2.1.1: segments = *(S segment)
    const segments: JsonPathSegment[] = [];

    while (!lexer.isAtEnd()) {
        const segment = parseSegment(lexer);
        if (segment === null) {
            break;
        }

        segments.push(segment);
    }

    return segments;
}

function parseSegment(lexer: Lexer): JsonPathSegment | null {
    // RFC 9535 §2.5: segment = child-segment / descendant-segment

    // Descendant segment: ".." (bracketed-selection / wildcard-selector / member-name-shorthand)
    if (lexer.match('DOTDOT')) {
        return parseDescendantSegment(lexer);
    }

    // Child segment: "[" ... "]" or "." (wildcard-selector / member-name-shorthand)
    if (lexer.check('LBRACKET')) {
        return parseChildBracketSegment(lexer);
    }

    if (lexer.match('DOT')) {
        return parseChildDotSegment(lexer);
    }

    return null;
}

function parseDescendantSegment(lexer: Lexer): JsonPathDescendantSegment | null {
    // RFC 9535 §2.5.2.1: descendant-segment = ".." (bracketed-selection / wildcard / member-name)

    if (lexer.check('LBRACKET')) {
        const selectors = parseBracketedSelection(lexer);
        if (selectors === null) {
            return null;
        }

        return { type: 'descendant', selectors };
    }

    if (lexer.match('WILDCARD')) {
        return { type: 'descendant', selectors: [{ type: 'wildcard' }] };
    }

    const nameToken = lexer.matchToken('NAME');
    if (nameToken) {
        return { type: 'descendant', selectors: [{ type: 'name', name: nameToken.value }] };
    }

    return null;
}

function parseChildBracketSegment(lexer: Lexer): JsonPathChildSegment | null {
    const selectors = parseBracketedSelection(lexer);
    if (selectors === null) {
        return null;
    }

    return { type: 'child', selectors };
}

function parseChildDotSegment(lexer: Lexer): JsonPathChildSegment | null {
    // RFC 9535 §2.5.1.1: "." (wildcard-selector / member-name-shorthand)

    if (lexer.match('WILDCARD')) {
        return { type: 'child', selectors: [{ type: 'wildcard' }] };
    }

    const nameToken = lexer.matchToken('NAME');
    if (nameToken) {
        return { type: 'child', selectors: [{ type: 'name', name: nameToken.value }] };
    }

    return null;
}

function parseBracketedSelection(lexer: Lexer): JsonPathSelector[] | null {
    // RFC 9535 §2.5.1.1: bracketed-selection = "[" S selector *( S "," S selector ) S "]"

    if (!lexer.match('LBRACKET')) {
        return null;
    }

    const selectors: JsonPathSelector[] = [];

    const first = parseSelector(lexer);
    if (first === null) {
        return null;
    }
    selectors.push(first);

    while (lexer.match('COMMA')) {
        const next = parseSelector(lexer);
        if (next === null) {
            return null;
        }

        selectors.push(next);
    }

    if (!lexer.match('RBRACKET')) {
        return null;
    }

    return selectors;
}

function parseSelector(lexer: Lexer): JsonPathSelector | null {
    // RFC 9535 §2.3: selector = name-selector / wildcard / slice / index / filter

    // Filter selector: "?" logical-expr
    if (lexer.match('QUESTION')) {
        const expr = parseLogicalExpr(lexer);
        if (expr === null) {
            return null;
        }

        return { type: 'filter', expression: expr };
    }

    // Wildcard selector
    if (lexer.match('WILDCARD')) {
        return { type: 'wildcard' };
    }

    // Name selector (string literal)
    const stringToken = lexer.matchToken('STRING');
    if (stringToken) {
        return { type: 'name', name: stringToken.value };
    }

    // Index or slice selector
    if (lexer.check('NUMBER') || lexer.check('COLON')) {
        return parseIndexOrSlice(lexer);
    }

    return null;
}

function parseIndexOrSlice(lexer: Lexer): JsonPathIndexSelector | JsonPathSliceSelector | null {
    // RFC 9535 §2.3.3/§2.3.4: Determine if this is an index or slice

    let start: number | undefined;
    let end: number | undefined;
    let step: number | undefined;
    let isSlice = false;

    // Start value
    const startToken = lexer.matchToken('NUMBER');
    if (startToken) {
        if (!isIntegerNumberToken(startToken.raw, startToken.value)) {
            return null;
        }
        start = startToken.value;
    }

    // First colon (makes it a slice)
    if (lexer.match('COLON')) {
        isSlice = true;

        // End value
        const endToken = lexer.matchToken('NUMBER');
        if (endToken) {
            if (!isIntegerNumberToken(endToken.raw, endToken.value)) {
                return null;
            }
            end = endToken.value;
        }

        // Second colon and step
        if (lexer.match('COLON')) {
            const stepToken = lexer.matchToken('NUMBER');
            if (stepToken) {
                if (!isIntegerNumberToken(stepToken.raw, stepToken.value)) {
                    return null;
                }
                step = stepToken.value;
            }
        }
    }

    if (isSlice) {
        const slice: JsonPathSliceSelector = { type: 'slice' };
        if (start !== undefined) {
            slice.start = start;
        }
        if (end !== undefined) {
            slice.end = end;
        }
        if (step !== undefined) {
            slice.step = step;
        }
        return slice;
    }

    if (start !== undefined) {
        return { type: 'index', index: start };
    }

    return null;
}

// =============================================================================
// Filter Expression Parser
// =============================================================================

function parseLogicalExpr(lexer: Lexer): JsonPathLogicalExpr | null {
    // RFC 9535 §2.3.5.1: logical-expr = logical-or-expr
    return withExpressionScope(lexer, () => parseLogicalOrExpr(lexer));
}

function parseLogicalOrExpr(lexer: Lexer): JsonPathLogicalExpr | null {
    // RFC 9535 §2.3.5.1: logical-or-expr = logical-and-expr *( "||" S logical-and-expr )
    const first = parseLogicalAndExpr(lexer);
    if (first === null) {
        return null;
    }

    const operands: JsonPathLogicalExpr[] = [first];

    while (lexer.match('OR')) {
        const right = parseLogicalAndExpr(lexer);
        if (right === null) {
            return null;
        }

        operands.push(right);
    }

    if (operands.length === 1) {
        return first;
    }

    return { type: 'or', operands };
}

function parseLogicalAndExpr(lexer: Lexer): JsonPathLogicalExpr | null {
    // RFC 9535 §2.3.5.1: logical-and-expr = basic-expr *( "&&" S basic-expr )
    const first = parseBasicExpr(lexer);
    if (first === null) {
        return null;
    }

    const operands: JsonPathLogicalExpr[] = [first];

    while (lexer.match('AND')) {
        const right = parseBasicExpr(lexer);
        if (right === null) {
            return null;
        }

        operands.push(right);
    }

    if (operands.length === 1) {
        return first;
    }

    return { type: 'and', operands };
}

function parseBasicExpr(lexer: Lexer): JsonPathLogicalExpr | null {
    // RFC 9535 §2.3.5.1: basic-expr = paren-expr / comparison-expr / test-expr

    // Parenthesized expression
    if (lexer.match('LPAREN')) {
        const expr = parseLogicalExpr(lexer);
        if (expr === null) {
            return null;
        }
        if (!lexer.match('RPAREN')) {
            return null;
        }

        return expr;
    }

    // Negation
    if (lexer.match('NOT')) {
        const operand = withExpressionScope(lexer, () => parseBasicExpr(lexer));
        if (operand === null) {
            return null;
        }

        return { type: 'not', operand };
    }

    // Try to parse a comparable (for comparison) or test expression
    return parseComparisonOrTest(lexer);
}

function parseComparisonOrTest(lexer: Lexer): JsonPathLogicalExpr | null {
    // This handles both comparison expressions and test expressions
    // We need to look ahead to determine which one

    // Check for filter query (existence test): @... or $...
    if (lexer.check('CURRENT') || lexer.check('ROOT')) {
        const query = parseFilterQuery(lexer);
        if (query === null) {
            return null;
        }

        // Check if followed by comparison operator
        const op = tryParseComparisonOp(lexer);
        if (op !== null) {
            const right = parseComparable(lexer);
            if (right === null) {
                return null;
            }

            const singularSegments = toSingularSegments(query.segments);
            if (singularSegments === null) {
                return null;
            }

            // Convert query to singular-query comparable
            const left: JsonPathSingularQuery = {
                type: 'singular-query',
                root: query.root,
                segments: singularSegments,
            };

            return { type: 'comparison', operator: op, left, right };
        }

        // It's a test expression
        return { type: 'test', query };
    }

    // Check for function call
    if (lexer.check('NAME')) {
        const func = parseFunctionExpr(lexer);
        if (func === null) {
            return null;
        }

        // Check if followed by comparison operator
        const op = tryParseComparisonOp(lexer);
        if (op !== null) {
            const right = parseComparable(lexer);
            if (right === null) {
                return null;
            }

            return { type: 'comparison', operator: op, left: func, right };
        }

        // It's a test expression (function MUST return LogicalType)
        if (getFunctionReturnType(func.name) !== 'logical') {
            return null;
        }

        return func;
    }

    // Literal followed by comparison
    const literal = parseLiteral(lexer);
    if (literal !== null) {
        const op = tryParseComparisonOp(lexer);
        if (op !== null) {
            const right = parseComparable(lexer);
            if (right === null) {
                return null;
            }

            return { type: 'comparison', operator: op, left: literal, right };
        }

        // Bare literal is not valid as a test expression
        return null;
    }

    return null;
}

function parseFilterQuery(lexer: Lexer): JsonPathQuery | null {
    // RFC 9535 §2.3.5.1: filter-query = rel-query / jsonpath-query
    if (lexer.check('ROOT')) {
        return parseQuery(lexer, '$');
    }
    if (lexer.check('CURRENT')) {
        return parseQuery(lexer, '@');
    }

    return null;
}

function tryParseComparisonOp(lexer: Lexer): JsonPathComparisonOp | null {
    if (lexer.match('EQ')) return '==';
    if (lexer.match('NE')) return '!=';
    if (lexer.match('LE')) return '<=';
    if (lexer.match('GE')) return '>=';
    if (lexer.match('LT')) return '<';
    if (lexer.match('GT')) return '>';
    return null;
}

function parseComparable(lexer: Lexer): JsonPathComparable | null {
    // RFC 9535 §2.3.5.1: comparable = literal / singular-query / function-expr

    // Function
    if (lexer.check('NAME')) {
        const func = parseFunctionExpr(lexer);
        if (func === null) {
            return null;
        }

        if (getFunctionReturnType(func.name) !== 'value') {
            return null;
        }

        return func;
    }

    // Singular query
    if (lexer.check('ROOT') || lexer.check('CURRENT')) {
        const query = parseFilterQuery(lexer);
        if (query === null) {
            return null;
        }

        const singularSegments = toSingularSegments(query.segments);
        if (singularSegments === null) {
            return null;
        }

        return {
            type: 'singular-query',
            root: query.root,
            segments: singularSegments,
        };
    }

    // Literal
    return parseLiteral(lexer);
}

function parseLiteral(lexer: Lexer): JsonPathLiteral | null {
    const stringToken = lexer.matchToken('STRING');
    if (stringToken) {
        return { type: 'literal', value: stringToken.value };
    }

    const numberToken = lexer.matchToken('NUMBER');
    if (numberToken) {
        return { type: 'literal', value: numberToken.value };
    }

    if (lexer.match('TRUE')) {
        return { type: 'literal', value: true };
    }
    if (lexer.match('FALSE')) {
        return { type: 'literal', value: false };
    }
    if (lexer.match('NULL')) {
        return { type: 'literal', value: null };
    }

    return null;
}

function parseFunctionExpr(lexer: Lexer): JsonPathFunctionExpr | null {
    // RFC 9535 §2.4: function-expr = function-name "(" [function-argument *( "," function-argument )] ")"

    return withExpressionScope(lexer, () => {
        const nameToken = lexer.matchToken('NAME');
        if (!nameToken) {
            return null;
        }

        const name = nameToken.value;
        if (!isBuiltinFunctionName(name)) {
            return null;
        }

        if (!lexer.match('LPAREN')) {
            return null;
        }

        const args: JsonPathFunctionArg[] = [];

        if (!lexer.check('RPAREN')) {
            const first = parseFunctionArg(lexer);
            if (first === null) {
                return null;
            }
            args.push(first);

            while (lexer.match('COMMA')) {
                const next = parseFunctionArg(lexer);
                if (next === null) {
                    return null;
                }
                args.push(next);
            }
        }

        if (!lexer.match('RPAREN')) {
            return null;
        }

        const expr: JsonPathFunctionExpr = {
            type: 'function',
            name,
            args,
        };

        if (!isWellTypedFunctionExpr(expr)) {
            return null;
        }

        return expr;
    });
}

function parseFunctionArg(lexer: Lexer): JsonPathFunctionArg | null {
    // RFC 9535 §2.4: function-argument = literal / filter-query / function-expr

    // Function
    if (lexer.check('NAME')) {
        return parseFunctionExpr(lexer);
    }

    // Filter query
    if (lexer.check('ROOT') || lexer.check('CURRENT')) {
        return parseFilterQuery(lexer);
    }

    // Literal
    return parseLiteral(lexer);
}

function isIntegerNumberToken(raw: string | undefined, value: number): boolean {
    if (!Number.isInteger(value)) {
        return false;
    }

    if (raw === undefined) {
        return true;
    }

    return /^-?(?:0|[1-9][0-9]*)$/.test(raw);
}

function getFunctionReturnType(name: JsonPathFunctionName): FunctionExprType {
    return FUNCTION_SIGNATURES[name].returns;
}

function getFunctionArgType(arg: JsonPathFunctionArg): FunctionExprType {
    switch (arg.type) {
        case 'literal':
            return 'value';
        case 'query':
            return isSingularQuery(arg) ? 'value' : 'nodes';
        case 'function':
            return getFunctionReturnType(arg.name);
    }
}

function isArgTypeCompatible(arg: JsonPathFunctionArg, expectedType: FunctionExprType): boolean {
    if (expectedType === 'nodes') {
        return arg.type === 'query';
    }

    return getFunctionArgType(arg) === expectedType;
}

function isWellTypedFunctionExpr(expr: JsonPathFunctionExpr): boolean {
    const signature = FUNCTION_SIGNATURES[expr.name];
    if (expr.args.length !== signature.args.length) {
        return false;
    }

    for (let i = 0; i < signature.args.length; i++) {
        const expectedType = signature.args[i];
        const arg = expr.args[i];
        if (!expectedType || !arg || !isArgTypeCompatible(arg, expectedType)) {
            return false;
        }
    }

    return true;
}

function toSingularSegments(segments: JsonPathSegment[]): JsonPathSingularSegment[] | null {
    const singularSegments: JsonPathSingularSegment[] = [];
    for (const segment of segments) {
        if (segment.type !== 'child') {
            return null;
        }

        if (segment.selectors.length !== 1) {
            return null;
        }

        const selector = segment.selectors[0];
        if (!selector || !isSingularSelector(selector)) {
            return null;
        }

        singularSegments.push({
            type: 'child',
            selectors: [selector],
        });
    }

    return singularSegments;
}

function isSingularSelector(selector: JsonPathSelector): selector is JsonPathSingularSelector {
    return selector.type === 'name' || selector.type === 'index';
}

function isSingularQuery(query: JsonPathQuery): boolean {
    return toSingularSegments(query.segments) !== null;
}
