/**
 * JSONPath evaluator.
 * RFC 9535 §2.1.2, §2.3-§2.7.
 * @see https://www.rfc-editor.org/rfc/rfc9535.html
 */

import type {
    JsonPathQuery,
    JsonPathSegment,
    JsonPathChildSegment,
    JsonPathDescendantSegment,
    JsonPathSelector,
    JsonPathNameSelector,
    JsonPathIndexSelector,
    JsonPathSliceSelector,
    JsonPathFilterSelector,
    JsonPathLogicalExpr,
    JsonPathOrExpr,
    JsonPathAndExpr,
    JsonPathNotExpr,
    JsonPathComparisonExpr,
    JsonPathComparisonOp,
    JsonPathTestExpr,
    JsonPathComparable,
    JsonPathSingularQuery,
    JsonPathFunctionExpr,
    JsonPathFunctionArg,
    JsonPathNode,
    JsonPathOptions,
} from '../types/jsonpath.js';
import { parseJsonPath } from './parser.js';

interface EvalContext {
    root: unknown;
    current: unknown;
    currentPath: (string | number)[];
    regexCache: Map<string, RegExp | null>;
    limits: EvalLimits;
    nodesVisited: number;
}

interface EvalLimits {
    maxNodesVisited: number;
    maxDepth: number;
    maxRegexPatternLength: number;
    maxRegexInputLength: number;
    rejectUnsafeRegex: boolean;
}

const DEFAULT_EVAL_LIMITS: EvalLimits = {
    maxNodesVisited: 100000,
    maxDepth: 64,
    maxRegexPatternLength: 256,
    maxRegexInputLength: 1024,
    rejectUnsafeRegex: true,
};

class JsonPathExecutionLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JsonPathExecutionLimitError';
    }
}

interface EvalNode {
    value: unknown;
    segments: (string | number)[];
}

const NOTHING = Symbol('JSONPathNothing');
type JsonPathNothing = typeof NOTHING;

function isNothing(value: unknown): value is JsonPathNothing {
    return value === NOTHING;
}

/**
 * Execute a JSONPath query against a JSON document.
 * Returns an array of matching values (nodelist).
 *
 * @param query - JSONPath query string
 * @param document - JSON document to query
 * @param options - Query options
 * @returns Array of matching values, or null on invalid query
 *
 * @example
 * `queryJsonPath('$.store.book[*].author', doc)`      // ['Author1', 'Author2']
 * `queryJsonPath('$..price', doc)`                    // [8.95, 12.99, 399]
 * `queryJsonPath('$.store.book[?@.price<10]', doc)`   // array of matching book objects
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535.html#section-2.1.2
 */
export function queryJsonPath(
    query: string,
    document: unknown,
    options?: JsonPathOptions
): unknown[] | null {
    const ast = parseJsonPath(query);
    if (ast === null) {
        if (options?.throwOnError) {
            throw new Error(`Invalid JSONPath query: ${query}`);
        }
        return null;
    }

    try {
        const nodes = evaluateQuery(ast, document, options);
        return nodes.map(n => n.value);
    } catch (error) {
        if (options?.throwOnError) {
            throw error;
        }
        if (error instanceof JsonPathExecutionLimitError) {
            return null;
        }
        throw error;
    }
}

/**
 * Execute a JSONPath query and return nodes with paths.
 *
 * @param query - JSONPath query string
 * @param document - JSON document to query
 * @returns Array of nodes with values and paths, or null on invalid query
 *
 * @example
 * `queryJsonPathNodes('$.store.book[0].title', doc)`
 * // `[{ value: 'Sayings of the Century', path: "$['store']['book'][0]['title']" }]`
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535.html#section-2.7
 */
export function queryJsonPathNodes(
    query: string,
    document: unknown,
    options?: JsonPathOptions
): JsonPathNode[] | null {
    const ast = parseJsonPath(query);
    if (ast === null) {
        if (options?.throwOnError) {
            throw new Error(`Invalid JSONPath query: ${query}`);
        }
        return null;
    }

    try {
        return evaluateQuery(ast, document, options).map(materializeNodePath);
    } catch (error) {
        if (options?.throwOnError) {
            throw error;
        }
        if (error instanceof JsonPathExecutionLimitError) {
            return null;
        }
        throw error;
    }
}

/**
 * Validate a JSONPath query string without parsing.
 *
 * @param query - String to validate
 * @returns true if valid JSONPath syntax
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535.html#section-2.1
 */
export function isValidJsonPath(query: string): boolean {
    return parseJsonPath(query) !== null;
}

/**
 * Format a normalized path from path segments.
 *
 * @param segments - Array of string keys or numeric indices
 * @returns Normalized path string
 *
 * @example
 * formatNormalizedPath(['store', 'book', 0])  // "$['store']['book'][0]"
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535.html#section-2.7
 */
export function formatNormalizedPath(segments: (string | number)[]): string {
    // RFC 9535 §2.7: normalized-path = root-identifier *(normal-index-segment / normal-name-segment)
    const pathParts: string[] = ['$'];
    for (const seg of segments) {
        if (typeof seg === 'number') {
            pathParts.push(`[${seg}]`);
        } else {
            const escaped = escapeNormalizedPathString(seg);
            pathParts.push(`['${escaped}']`);
        }
    }
    return pathParts.join('');
}

function escapeNormalizedPathString(value: string): string {
    let escaped = '';

    for (let i = 0; i < value.length; i++) {
        const ch = value[i]!;
        const code = ch.charCodeAt(0);

        if (ch === '\\') {
            escaped += '\\\\';
            continue;
        }
        if (ch === '\'') {
            escaped += "\\'";
            continue;
        }

        if (code <= 0x1F) {
            switch (code) {
                case 0x08:
                    escaped += '\\b';
                    continue;
                case 0x09:
                    escaped += '\\t';
                    continue;
                case 0x0A:
                    escaped += '\\n';
                    continue;
                case 0x0C:
                    escaped += '\\f';
                    continue;
                case 0x0D:
                    escaped += '\\r';
                    continue;
                default:
                    escaped += `\\u${code.toString(16).padStart(4, '0').toUpperCase()}`;
                    continue;
            }
        }

        escaped += ch;
    }

    return escaped;
}

/**
 * Compile a JSONPath query for repeated execution.
 * More efficient when the same query is used multiple times.
 *
 * @param query - JSONPath query string
 * @returns Compiled query function, or null on invalid query
 *
 * @example
 * const fn = compileJsonPath('$.store.book[*].author');
 * fn(doc1)  // ['Author1', ...]
 * fn(doc2)  // ['Author2', ...]
 */
export function compileJsonPath(
    query: string
): ((document: unknown) => unknown[]) | null {
    const ast = parseJsonPath(query);
    if (ast === null) return null;

    return (document: unknown) => {
        const nodes = evaluateQuery(ast, document);
        return nodes.map(n => n.value);
    };
}

function resolveEvalLimits(options?: JsonPathOptions): EvalLimits {
    const isFiniteNumber = (value: unknown): value is number => {
        return typeof value === 'number' && Number.isFinite(value);
    };

    const requestedMaxNodesVisited = options?.maxNodesVisited;
    const requestedMaxDepth = options?.maxDepth;
    const requestedMaxRegexPatternLength = options?.maxRegexPatternLength;
    const requestedMaxRegexInputLength = options?.maxRegexInputLength;

    const maxNodesVisited = isFiniteNumber(requestedMaxNodesVisited)
        && requestedMaxNodesVisited > 0
        ? Math.floor(requestedMaxNodesVisited)
        : DEFAULT_EVAL_LIMITS.maxNodesVisited;
    const maxDepth = isFiniteNumber(requestedMaxDepth)
        && requestedMaxDepth >= 0
        ? Math.floor(requestedMaxDepth)
        : DEFAULT_EVAL_LIMITS.maxDepth;
    const maxRegexPatternLength = isFiniteNumber(requestedMaxRegexPatternLength)
        && requestedMaxRegexPatternLength > 0
        ? Math.floor(requestedMaxRegexPatternLength)
        : DEFAULT_EVAL_LIMITS.maxRegexPatternLength;
    const maxRegexInputLength = isFiniteNumber(requestedMaxRegexInputLength)
        && requestedMaxRegexInputLength > 0
        ? Math.floor(requestedMaxRegexInputLength)
        : DEFAULT_EVAL_LIMITS.maxRegexInputLength;

    return {
        maxNodesVisited,
        maxDepth,
        maxRegexPatternLength,
        maxRegexInputLength,
        rejectUnsafeRegex: options?.rejectUnsafeRegex ?? DEFAULT_EVAL_LIMITS.rejectUnsafeRegex,
    };
}

function trackNodeVisit(ctx: EvalContext, depth: number): void {
    if (depth > ctx.limits.maxDepth) {
        throw new JsonPathExecutionLimitError('JSONPath maxDepth limit exceeded');
    }

    ctx.nodesVisited += 1;
    if (ctx.nodesVisited > ctx.limits.maxNodesVisited) {
        throw new JsonPathExecutionLimitError('JSONPath maxNodesVisited limit exceeded');
    }
}

function addResultNode(result: EvalNode[], node: EvalNode, ctx: EvalContext): void {
    trackNodeVisit(ctx, node.segments.length);
    result.push(node);
}

function evaluateQuery(
    ast: JsonPathQuery,
    document: unknown,
    options?: JsonPathOptions
): EvalNode[] {
    // RFC 9535 §2.1.2: Start with root node
    const ctx: EvalContext = {
        root: document,
        current: document,
        currentPath: [],
        regexCache: new Map(),
        limits: resolveEvalLimits(options),
        nodesVisited: 0,
    };

    trackNodeVisit(ctx, 0);

    let nodes: EvalNode[] = [{
        value: document,
        segments: [],
    }];

    // Apply each segment in sequence
    for (const segment of ast.segments) {
        nodes = evaluateSegment(segment, nodes, ctx);
    }

    return nodes;
}

function materializeNodePath(node: EvalNode): JsonPathNode {
    return {
        value: node.value,
        path: formatNormalizedPath(node.segments),
    };
}

function evaluateSegment(
    segment: JsonPathSegment,
    nodes: EvalNode[],
    ctx: EvalContext
): EvalNode[] {
    if (segment.type === 'child') {
        return evaluateChildSegment(segment, nodes, ctx);
    } else {
        return evaluateDescendantSegment(segment, nodes, ctx);
    }
}

function evaluateChildSegment(
    segment: JsonPathChildSegment,
    nodes: EvalNode[],
    ctx: EvalContext
): EvalNode[] {
    // RFC 9535 §2.5.1.2: Apply selectors to each input node
    const result: EvalNode[] = [];

    for (const node of nodes) {
        for (const selector of segment.selectors) {
            const selected = evaluateSelector(selector, node, ctx);
            result.push(...selected);
        }
    }

    return result;
}

function evaluateDescendantSegment(
    segment: JsonPathDescendantSegment,
    nodes: EvalNode[],
    ctx: EvalContext
): EvalNode[] {
    // RFC 9535 §2.5.2.2: Select from node and all its descendants
    const result: EvalNode[] = [];

    for (const node of nodes) {
        forEachDescendant(node, ctx, (descNode) => {
            for (const selector of segment.selectors) {
                const selected = evaluateSelector(selector, descNode, ctx);
                result.push(...selected);
            }
        });
    }

    return result;
}

interface DescendantStackFrame {
    node: EvalNode;
    depth: number;
    exiting?: boolean;
    objectRef?: object;
}

function forEachDescendant(
    node: EvalNode,
    ctx: EvalContext,
    visit: (descendant: EvalNode) => void
): void {
    const stack: DescendantStackFrame[] = [{ node, depth: node.segments.length }];
    const ancestorObjects = new WeakSet<object>();

    while (stack.length > 0) {
        const frame = stack.pop()!;

        if (frame.exiting) {
            if (frame.objectRef) {
                ancestorObjects.delete(frame.objectRef);
            }
            continue;
        }

        const current = frame.node;
        const currentValue = current.value;
        if (currentValue !== null && typeof currentValue === 'object') {
            if (ancestorObjects.has(currentValue as object)) {
                continue;
            }
        }

        trackNodeVisit(ctx, frame.depth);
        visit(current);

        const value = currentValue;
        if (value === null || typeof value !== 'object') {
            continue;
        }

        const objectRef = value as object;
        ancestorObjects.add(objectRef);
        stack.push({
            node: current,
            depth: frame.depth,
            exiting: true,
            objectRef,
        });

        if (Array.isArray(value)) {
            for (let i = value.length - 1; i >= 0; i--) {
                stack.push({
                    node: {
                        value: value[i],
                        segments: [...current.segments, i],
                    },
                    depth: frame.depth + 1,
                });
            }
            continue;
        }

        const record = value as Record<string, unknown>;
        const keys = Object.keys(record);
        for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i]!;
            stack.push({
                node: {
                    value: record[key],
                    segments: [...current.segments, key],
                },
                depth: frame.depth + 1,
            });
        }
    }
}

function evaluateSelector(
    selector: JsonPathSelector,
    node: EvalNode,
    ctx: EvalContext
): EvalNode[] {
    switch (selector.type) {
        case 'name':
            return evaluateNameSelector(selector, node, ctx);
        case 'wildcard':
            return evaluateWildcardSelector(node, ctx);
        case 'index':
            return evaluateIndexSelector(selector, node, ctx);
        case 'slice':
            return evaluateSliceSelector(selector, node, ctx);
        case 'filter':
            return evaluateFilterSelector(selector, node, ctx);
    }
}

function evaluateNameSelector(
    selector: JsonPathNameSelector,
    node: EvalNode,
    ctx: EvalContext
): EvalNode[] {
    // RFC 9535 §2.3.1.2: Select member value by name
    const value = node.value;

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return [];
    }

    const obj = value as Record<string, unknown>;
    if (!Object.hasOwn(obj, selector.name)) {
        return [];
    }

    const result: EvalNode[] = [];
    addResultNode(result, {
        value: obj[selector.name],
        segments: [...node.segments, selector.name],
    }, ctx);

    return result;
}

function evaluateWildcardSelector(node: EvalNode, ctx: EvalContext): EvalNode[] {
    // RFC 9535 §2.3.2.2: Select all children
    const value = node.value;
    const result: EvalNode[] = [];

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            addResultNode(result, {
                value: value[i],
                segments: [...node.segments, i],
            }, ctx);
        }
    } else if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            addResultNode(result, {
                value: (value as Record<string, unknown>)[key],
                segments: [...node.segments, key],
            }, ctx);
        }
    }

    return result;
}

function evaluateIndexSelector(
    selector: JsonPathIndexSelector,
    node: EvalNode,
    ctx: EvalContext
): EvalNode[] {
    // RFC 9535 §2.3.3.2: Select array element by index
    const value = node.value;

    if (!Array.isArray(value)) {
        return [];
    }

    let index = selector.index;

    // RFC 9535 §2.3.3.2: Negative index counts from end
    if (index < 0) {
        index = value.length + index;
    }

    if (index < 0 || index >= value.length) {
        return [];
    }

    const result: EvalNode[] = [];
    addResultNode(result, {
        value: value[index],
        segments: [...node.segments, index],
    }, ctx);

    return result;
}

function evaluateSliceSelector(
    selector: JsonPathSliceSelector,
    node: EvalNode,
    ctx: EvalContext
): EvalNode[] {
    // RFC 9535 §2.3.4.2: Array slice
    const value = node.value;

    if (!Array.isArray(value)) {
        return [];
    }

    const len = value.length;
    const step = selector.step ?? 1;

    // RFC 9535 §2.3.4.2.1: step of 0 selects no elements
    if (step === 0) {
        return [];
    }

    // RFC 9535 Table 8: Default values depend on step sign
    const defaultStart = step >= 0 ? 0 : len - 1;
    const defaultEnd = step >= 0 ? len : -len - 1;

    const start = selector.start ?? defaultStart;
    const end = selector.end ?? defaultEnd;

    // Normalize
    const nStart = normalize(start, len);
    const nEnd = normalize(end, len);

    // Compute bounds
    let lower: number, upper: number;
    if (step >= 0) {
        lower = Math.min(Math.max(nStart, 0), len);
        upper = Math.min(Math.max(nEnd, 0), len);
    } else {
        lower = Math.min(Math.max(nEnd, -1), len - 1);
        upper = Math.min(Math.max(nStart, -1), len - 1);
    }

    const result: EvalNode[] = [];
    const baseSegments = node.segments;

    if (step > 0) {
        for (let i = lower; i < upper; i += step) {
            addResultNode(result, {
                value: value[i],
                segments: [...baseSegments, i],
            }, ctx);
        }
    } else {
        for (let i = upper; i > lower; i += step) {
            addResultNode(result, {
                value: value[i],
                segments: [...baseSegments, i],
            }, ctx);
        }
    }

    return result;
}

function normalize(i: number, len: number): number {
    return i >= 0 ? i : len + i;
}

function evaluateFilterSelector(
    selector: JsonPathFilterSelector,
    node: EvalNode,
    ctx: EvalContext
): EvalNode[] {
    // RFC 9535 §2.3.5.2: Filter children by logical expression
    const value = node.value;
    const result: EvalNode[] = [];

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const childSegments = [...node.segments, i];
            const childNode: EvalNode = {
                value: value[i],
                segments: childSegments,
            };

            trackNodeVisit(ctx, childSegments.length);

            const childCtx: EvalContext = {
                ...ctx,
                current: value[i],
                currentPath: childSegments,
            };

            if (evaluateLogicalExpr(selector.expression, childCtx)) {
                addResultNode(result, childNode, ctx);
            }
        }
    } else if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            const childSegments = [...node.segments, key];
            const childValue = (value as Record<string, unknown>)[key];
            const childNode: EvalNode = {
                value: childValue,
                segments: childSegments,
            };

            trackNodeVisit(ctx, childSegments.length);

            const childCtx: EvalContext = {
                ...ctx,
                current: childValue,
                currentPath: childSegments,
            };

            if (evaluateLogicalExpr(selector.expression, childCtx)) {
                addResultNode(result, childNode, ctx);
            }
        }
    }

    return result;
}

// =============================================================================
// Logical Expression Evaluator
// =============================================================================

function evaluateLogicalExpr(expr: JsonPathLogicalExpr, ctx: EvalContext): boolean {
    switch (expr.type) {
        case 'or':
            return evaluateOrExpr(expr, ctx);
        case 'and':
            return evaluateAndExpr(expr, ctx);
        case 'not':
            return evaluateNotExpr(expr, ctx);
        case 'comparison':
            return evaluateComparisonExpr(expr, ctx);
        case 'test':
            return evaluateTestExpr(expr, ctx);
        case 'function':
            return evaluateFunctionAsBool(expr, ctx);
    }
}

function evaluateOrExpr(expr: JsonPathOrExpr, ctx: EvalContext): boolean {
    for (const operand of expr.operands) {
        if (evaluateLogicalExpr(operand, ctx)) {
            return true;
        }
    }
    return false;
}

function evaluateAndExpr(expr: JsonPathAndExpr, ctx: EvalContext): boolean {
    for (const operand of expr.operands) {
        if (!evaluateLogicalExpr(operand, ctx)) {
            return false;
        }
    }
    return true;
}

function evaluateNotExpr(expr: JsonPathNotExpr, ctx: EvalContext): boolean {
    return !evaluateLogicalExpr(expr.operand, ctx);
}

function evaluateComparisonExpr(expr: JsonPathComparisonExpr, ctx: EvalContext): boolean {
    const left = evaluateComparable(expr.left, ctx);
    const right = evaluateComparable(expr.right, ctx);
    return compare(left, expr.operator, right, ctx);
}

function evaluateTestExpr(expr: JsonPathTestExpr, ctx: EvalContext): boolean {
    // RFC 9535 §2.3.5.2: Existence test - true if nodelist is non-empty
    const nodes = evaluateFilterQuery(expr.query, ctx);
    return nodes.length > 0;
}

function evaluateFunctionAsBool(expr: JsonPathFunctionExpr, ctx: EvalContext): boolean {
    // RFC 9535 §2.4: Functions returning LogicalType
    const result = evaluateFunction(expr, ctx);
    return result === true;
}

function evaluateComparable(comp: JsonPathComparable, ctx: EvalContext): unknown {
    switch (comp.type) {
        case 'literal':
            return comp.value;
        case 'singular-query':
            return evaluateSingularQuery(comp, ctx);
        case 'function':
            return evaluateFunction(comp, ctx);
    }
}

function evaluateSingularQuery(query: JsonPathSingularQuery, ctx: EvalContext): unknown | JsonPathNothing {
    const startValue = query.root === '$' ? ctx.root : ctx.current;
    const startPath = query.root === '$' ? [] : [...ctx.currentPath];

    trackNodeVisit(ctx, startPath.length);

    let nodes: EvalNode[] = [{
        value: startValue,
        segments: startPath,
    }];

    for (const segment of query.segments) {
        nodes = evaluateSegment(segment, nodes, ctx);
    }

    // RFC 9535 §2.3.5.1: Singular query produces at most one node
    if (nodes.length !== 1) {
        return NOTHING;
    }

    const [onlyNode] = nodes;
    return onlyNode?.value;
}

function evaluateFilterQuery(query: JsonPathQuery, ctx: EvalContext): EvalNode[] {
    const startValue = query.root === '$' ? ctx.root : ctx.current;
    const startPath = query.root === '$' ? [] : [...ctx.currentPath];

    trackNodeVisit(ctx, startPath.length);

    let nodes: EvalNode[] = [{
        value: startValue,
        segments: startPath,
    }];

    for (const segment of query.segments) {
        nodes = evaluateSegment(segment, nodes, ctx);
    }

    return nodes;
}

// =============================================================================
// Comparison
// =============================================================================

function compare(left: unknown, op: JsonPathComparisonOp, right: unknown, ctx: EvalContext): boolean {
    // RFC 9535 §2.3.5.2.2: Comparison semantics
    // Any comparison involving Nothing evaluates to false.
    if (isNothing(left) || isNothing(right)) {
        return false;
    }

    switch (op) {
        case '==':
            return deepEqual(left, right, ctx);
        case '!=':
            return !deepEqual(left, right, ctx);
        case '<':
            return compareLessThan(left, right);
        case '<=':
            return compareLessThanOrEqual(left, right);
        case '>':
            return compareLessThan(right, left);
        case '>=':
            return compareLessThanOrEqual(right, left);
    }
}

interface DeepEqualFrame {
    left: unknown;
    right: unknown;
    depth: number;
}

function deepEqual(a: unknown, b: unknown, ctx: EvalContext): boolean {
    const stack: DeepEqualFrame[] = [{ left: a, right: b, depth: 0 }];
    const seenPairs = new WeakMap<object, WeakSet<object>>();

    while (stack.length > 0) {
        const frame = stack.pop()!;
        trackNodeVisit(ctx, frame.depth);

        const left = frame.left;
        const right = frame.right;

        if (left === right) {
            continue;
        }

        if (typeof left !== typeof right) {
            return false;
        }

        if (left === null || right === null) {
            return false;
        }

        if (typeof left !== 'object' || typeof right !== 'object') {
            return false;
        }

        const leftObj = left as object;
        const rightObj = right as object;

        const seenRights = seenPairs.get(leftObj);
        if (seenRights?.has(rightObj)) {
            continue;
        }

        if (seenRights) {
            seenRights.add(rightObj);
        } else {
            seenPairs.set(leftObj, new WeakSet([rightObj]));
        }

        const leftIsArray = Array.isArray(leftObj);
        const rightIsArray = Array.isArray(rightObj);
        if (leftIsArray !== rightIsArray) {
            return false;
        }

        if (leftIsArray && rightIsArray) {
            const leftArray = leftObj as unknown[];
            const rightArray = rightObj as unknown[];
            if (leftArray.length !== rightArray.length) {
                return false;
            }

            for (let i = 0; i < leftArray.length; i++) {
                stack.push({
                    left: leftArray[i],
                    right: rightArray[i],
                    depth: frame.depth + 1,
                });
            }

            continue;
        }

        const leftRecord = leftObj as Record<string, unknown>;
        const rightRecord = rightObj as Record<string, unknown>;
        const keysLeft = Object.keys(leftRecord);
        const keysRight = Object.keys(rightRecord);

        if (keysLeft.length !== keysRight.length) {
            return false;
        }

        for (const key of keysLeft) {
            if (!Object.hasOwn(rightRecord, key)) {
                return false;
            }

            stack.push({
                left: leftRecord[key],
                right: rightRecord[key],
                depth: frame.depth + 1,
            });
        }
    }

    return true;
}

function compareLessThan(left: unknown, right: unknown): boolean {
    // RFC 9535 §2.3.5.2.2: < only defined for numbers and strings of same type
    if (typeof left === 'number' && typeof right === 'number') {
        return left < right;
    }
    if (typeof left === 'string' && typeof right === 'string') {
        return left < right;
    }
    return false;
}

function compareLessThanOrEqual(left: unknown, right: unknown): boolean {
    if (typeof left === 'number' && typeof right === 'number') {
        return left <= right;
    }
    if (typeof left === 'string' && typeof right === 'string') {
        return left <= right;
    }
    return false;
}

// =============================================================================
// Built-in Functions
// =============================================================================

function evaluateFunction(expr: JsonPathFunctionExpr, ctx: EvalContext): unknown {
    switch (expr.name) {
        case 'length':
            return fnLength(expr.args, ctx);
        case 'count':
            return fnCount(expr.args, ctx);
        case 'match':
            return fnMatch(expr.args, ctx);
        case 'search':
            return fnSearch(expr.args, ctx);
        case 'value':
            return fnValue(expr.args, ctx);
    }
}

// RFC 9535 §2.4.4: length() function
function fnLength(args: JsonPathFunctionArg[], ctx: EvalContext): number | JsonPathNothing {
    if (args.length !== 1) return NOTHING;

    const [arg] = args;
    if (!arg) {
        return NOTHING;
    }

    const value = evaluateFunctionArg(arg, ctx);

    if (typeof value === 'string') {
        return value.length;
    }
    if (Array.isArray(value)) {
        return value.length;
    }
    if (value !== null && typeof value === 'object') {
        return Object.keys(value).length;
    }

    return NOTHING;
}

// RFC 9535 §2.4.5: count() function
function fnCount(args: JsonPathFunctionArg[], ctx: EvalContext): number {
    if (args.length !== 1) return 0;

    const [arg] = args;
    if (!arg) {
        return 0;
    }

    if (arg.type === 'query') {
        const nodes = evaluateFilterQuery(arg, ctx);
        return nodes.length;
    }

    return 0;
}

function parseRepeatingQuantifierLength(pattern: string, start: number): number {
    const ch = pattern[start];
    if (!ch) {
        return 0;
    }

    if (ch === '+' || ch === '*') {
        return 1;
    }

    if (ch !== '{') {
        return 0;
    }

    let cursor = start + 1;
    let minDigits = '';
    while (cursor < pattern.length) {
        const digit = pattern[cursor];
        if (digit === undefined || digit < '0' || digit > '9') {
            break;
        }

        minDigits += digit;
        cursor += 1;
    }

    if (minDigits.length === 0) {
        return 0;
    }

    const next = pattern[cursor];
    if (next === '}') {
        const exact = Number.parseInt(minDigits, 10);
        return exact > 1 ? cursor - start + 1 : 0;
    }

    if (next !== ',') {
        return 0;
    }

    cursor += 1;
    let maxDigits = '';
    while (cursor < pattern.length) {
        const digit = pattern[cursor];
        if (digit === undefined || digit < '0' || digit > '9') {
            break;
        }

        maxDigits += digit;
        cursor += 1;
    }

    if (pattern[cursor] !== '}') {
        return 0;
    }

    if (maxDigits.length === 0) {
        return cursor - start + 1;
    }

    const max = Number.parseInt(maxDigits, 10);
    return max > 1 ? cursor - start + 1 : 0;
}

function normalizeQuantifiedGroupBody(groupBody: string): string {
    if (groupBody.startsWith('?:')) {
        return groupBody.slice(2);
    }

    if (groupBody.startsWith('?<')) {
        const endName = groupBody.indexOf('>');
        if (endName >= 0) {
            return groupBody.slice(endName + 1);
        }
    }

    return groupBody;
}

function findQuantifiedGroups(pattern: string): string[] {
    const quantifiedGroups: string[] = [];
    const groupStartStack: number[] = [];
    let escaped = false;
    let inCharClass = false;

    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i]!;

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            escaped = true;
            continue;
        }

        if (inCharClass) {
            if (ch === ']') {
                inCharClass = false;
            }
            continue;
        }

        if (ch === '[') {
            inCharClass = true;
            continue;
        }

        if (ch === '(') {
            groupStartStack.push(i);
            continue;
        }

        if (ch === ')' && groupStartStack.length > 0) {
            const start = groupStartStack.pop()!;
            const quantifierLength = parseRepeatingQuantifierLength(pattern, i + 1);
            if (quantifierLength > 0) {
                quantifiedGroups.push(normalizeQuantifiedGroupBody(pattern.slice(start + 1, i)));
            }
        }
    }

    return quantifiedGroups;
}

function splitTopLevelAlternatives(groupBody: string): string[] {
    const alternatives: string[] = [];
    let start = 0;
    let depth = 0;
    let escaped = false;
    let inCharClass = false;

    for (let i = 0; i < groupBody.length; i++) {
        const ch = groupBody[i]!;

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            escaped = true;
            continue;
        }

        if (inCharClass) {
            if (ch === ']') {
                inCharClass = false;
            }
            continue;
        }

        if (ch === '[') {
            inCharClass = true;
            continue;
        }

        if (ch === '(') {
            depth += 1;
            continue;
        }

        if (ch === ')' && depth > 0) {
            depth -= 1;
            continue;
        }

        if (ch === '|' && depth === 0) {
            alternatives.push(groupBody.slice(start, i));
            start = i + 1;
        }
    }

    alternatives.push(groupBody.slice(start));
    return alternatives;
}

function extractSimpleLiteralAlternative(alt: string): string | null {
    let value = '';
    for (let i = 0; i < alt.length; i++) {
        const ch = alt[i]!;
        if (ch === '\\') {
            i += 1;
            const escaped = alt[i];
            if (!escaped) {
                return null;
            }
            value += escaped;
            continue;
        }

        if ('^$.*+?()[]{}|'.includes(ch)) {
            return null;
        }

        value += ch;
    }

    return value;
}

function alternativesHavePrefixOverlap(alternatives: string[]): boolean {
    const literalAlternatives: string[] = [];
    for (const alt of alternatives) {
        const literal = extractSimpleLiteralAlternative(alt);
        if (literal === null) {
            return false;
        }
        literalAlternatives.push(literal);
    }

    for (let i = 0; i < literalAlternatives.length; i++) {
        const left = literalAlternatives[i]!;
        for (let j = i + 1; j < literalAlternatives.length; j++) {
            const right = literalAlternatives[j]!;
            if (left.startsWith(right) || right.startsWith(left)) {
                return true;
            }
        }
    }

    return false;
}

function hasUnsafeRegexConstructs(pattern: string): boolean {
    // Backreferences are frequently involved in catastrophic backtracking.
    if (/\\[1-9]/.test(pattern)) {
        return true;
    }

    // Heuristic nested quantifier detection, e.g. (a+)+, (a*){2,}.
    if (/\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/.test(pattern)) {
        return true;
    }

    // Quantified groups with overlapping top-level alternatives are prone to
    // catastrophic backtracking, e.g. (a|aa)+$.
    const quantifiedGroups = findQuantifiedGroups(pattern);
    for (const groupBody of quantifiedGroups) {
        const alternatives = splitTopLevelAlternatives(groupBody);
        if (alternatives.length > 1 && alternativesHavePrefixOverlap(alternatives)) {
            return true;
        }
    }

    return false;
}

function enforceRegexPolicy(pattern: string, input: string, ctx: EvalContext): void {
    if (pattern.length > ctx.limits.maxRegexPatternLength) {
        throw new JsonPathExecutionLimitError('JSONPath maxRegexPatternLength limit exceeded');
    }

    if (input.length > ctx.limits.maxRegexInputLength) {
        throw new JsonPathExecutionLimitError('JSONPath maxRegexInputLength limit exceeded');
    }

    if (ctx.limits.rejectUnsafeRegex && hasUnsafeRegexConstructs(pattern)) {
        throw new JsonPathExecutionLimitError('JSONPath rejected unsafe regular expression pattern');
    }
}

function getCachedRegex(ctx: EvalContext, cacheKey: string, pattern: string): RegExp | null {
    if (ctx.regexCache.has(cacheKey)) {
        return ctx.regexCache.get(cacheKey) ?? null;
    }

    try {
        const compiled = new RegExp(pattern, 'u');
        ctx.regexCache.set(cacheKey, compiled);
        return compiled;
    } catch {
        ctx.regexCache.set(cacheKey, null);
        return null;
    }
}

// RFC 9535 §2.4.6: match() function - full regex match
function fnMatch(args: JsonPathFunctionArg[], ctx: EvalContext): boolean {
    if (args.length !== 2) return false;

    const [valueArg, patternArg] = args;
    if (!valueArg || !patternArg) {
        return false;
    }

    const value = evaluateFunctionArg(valueArg, ctx);
    const pattern = evaluateFunctionArg(patternArg, ctx);

    if (typeof value !== 'string' || typeof pattern !== 'string') {
        return false;
    }

    enforceRegexPolicy(pattern, value, ctx);

    // RFC 9535 §2.4.6: Full match (anchored)
    const re = getCachedRegex(ctx, `match:${pattern}`, `^(?:${pattern})$`);
    if (!re) {
        return false;
    }

    return re.test(value);
}

// RFC 9535 §2.4.7: search() function - partial regex match
function fnSearch(args: JsonPathFunctionArg[], ctx: EvalContext): boolean {
    if (args.length !== 2) return false;

    const [valueArg, patternArg] = args;
    if (!valueArg || !patternArg) {
        return false;
    }

    const value = evaluateFunctionArg(valueArg, ctx);
    const pattern = evaluateFunctionArg(patternArg, ctx);

    if (typeof value !== 'string' || typeof pattern !== 'string') {
        return false;
    }

    enforceRegexPolicy(pattern, value, ctx);

    const re = getCachedRegex(ctx, `search:${pattern}`, pattern);
    if (!re) {
        return false;
    }

    return re.test(value);
}

// RFC 9535 §2.4.8: value() function
function fnValue(args: JsonPathFunctionArg[], ctx: EvalContext): unknown {
    if (args.length !== 1) return NOTHING;

    const [arg] = args;
    if (!arg) {
        return NOTHING;
    }

    if (arg.type === 'query') {
        const nodes = evaluateFilterQuery(arg, ctx);
        if (nodes.length !== 1) {
            return NOTHING;
        }

        const [onlyNode] = nodes;
        return onlyNode?.value;
    }

    return NOTHING;
}

function evaluateFunctionArg(arg: JsonPathFunctionArg, ctx: EvalContext): unknown {
    switch (arg.type) {
        case 'literal':
            return arg.value;
        case 'query':
            // For value-type arguments, get the singular value
            const nodes = evaluateFilterQuery(arg, ctx);
            if (nodes.length !== 1) {
                return NOTHING;
            }

            return nodes[0]?.value;
        case 'function':
            return evaluateFunction(arg, ctx);
    }
}
