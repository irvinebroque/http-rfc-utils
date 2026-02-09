/**
 * JSONPath evaluator.
 * RFC 9535 §2.1.2, §2.3-§2.7.
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
}

interface EvalNode {
    value: unknown;
    segments: (string | number)[];
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
 * queryJsonPath('$.store.book[*].author', doc)  // ['Author1', 'Author2']
 * queryJsonPath('$..price', doc)                // [8.95, 12.99, 399]
 * queryJsonPath('$.store.book[?@.price<10]', doc)  // [{ title: 'Book1', ... }]
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

    const nodes = evaluateQuery(ast, document);
    return nodes.map(n => n.value);
}

/**
 * Execute a JSONPath query and return nodes with paths.
 *
 * @param query - JSONPath query string
 * @param document - JSON document to query
 * @returns Array of nodes with values and paths, or null on invalid query
 *
 * @example
 * queryJsonPathNodes('$.store.book[0].title', doc)
 * // [{ value: 'Sayings of the Century', path: "$['store']['book'][0]['title']" }]
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535.html#section-2.7
 */
export function queryJsonPathNodes(
    query: string,
    document: unknown
): JsonPathNode[] | null {
    const ast = parseJsonPath(query);
    if (ast === null) return null;

    return evaluateQuery(ast, document).map(materializeNodePath);
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
            // Escape single quotes and backslashes
            const escaped = seg
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'");
            pathParts.push(`['${escaped}']`);
        }
    }
    return pathParts.join('');
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

function evaluateQuery(ast: JsonPathQuery, document: unknown): EvalNode[] {
    // RFC 9535 §2.1.2: Start with root node
    const ctx: EvalContext = {
        root: document,
        current: document,
        currentPath: [],
        regexCache: new Map(),
    };

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
        forEachDescendant(node, (descNode) => {
            for (const selector of segment.selectors) {
                const selected = evaluateSelector(selector, descNode, ctx);
                result.push(...selected);
            }
        });
    }

    return result;
}

function forEachDescendant(node: EvalNode, visit: (descendant: EvalNode) => void): void {
    const stack: EvalNode[] = [node];

    while (stack.length > 0) {
        const current = stack.pop()!;
        visit(current);

        const value = current.value;
        if (Array.isArray(value)) {
            for (let i = value.length - 1; i >= 0; i--) {
                stack.push({
                    value: value[i],
                    segments: [...current.segments, i],
                });
            }
            continue;
        }

        if (value !== null && typeof value === 'object') {
            const record = value as Record<string, unknown>;
            const keys = Object.keys(record);
            for (let i = keys.length - 1; i >= 0; i--) {
                const key = keys[i]!;
                stack.push({
                    value: record[key],
                    segments: [...current.segments, key],
                });
            }
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
            return evaluateNameSelector(selector, node);
        case 'wildcard':
            return evaluateWildcardSelector(node);
        case 'index':
            return evaluateIndexSelector(selector, node);
        case 'slice':
            return evaluateSliceSelector(selector, node);
        case 'filter':
            return evaluateFilterSelector(selector, node, ctx);
    }
}

function evaluateNameSelector(
    selector: JsonPathNameSelector,
    node: EvalNode
): EvalNode[] {
    // RFC 9535 §2.3.1.2: Select member value by name
    const value = node.value;

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return [];
    }

    const obj = value as Record<string, unknown>;
    if (!(selector.name in obj)) {
        return [];
    }

    const childSegments = [...node.segments, selector.name];

    return [{
        value: obj[selector.name],
        segments: childSegments,
    }];
}

function evaluateWildcardSelector(node: EvalNode): EvalNode[] {
    // RFC 9535 §2.3.2.2: Select all children
    const value = node.value;
    const result: EvalNode[] = [];

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            result.push({
                value: value[i],
                segments: [...node.segments, i],
            });
        }
    } else if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            result.push({
                value: (value as Record<string, unknown>)[key],
                segments: [...node.segments, key],
            });
        }
    }

    return result;
}

function evaluateIndexSelector(
    selector: JsonPathIndexSelector,
    node: EvalNode
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

    const childSegments = [...node.segments, index];

    return [{
        value: value[index],
        segments: childSegments,
    }];
}

function evaluateSliceSelector(
    selector: JsonPathSliceSelector,
    node: EvalNode
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
            result.push({
                value: value[i],
                segments: [...baseSegments, i],
            });
        }
    } else {
        for (let i = upper; i > lower; i += step) {
            result.push({
                value: value[i],
                segments: [...baseSegments, i],
            });
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

            const childCtx: EvalContext = {
                ...ctx,
                current: value[i],
                currentPath: childSegments,
            };

            if (evaluateLogicalExpr(selector.expression, childCtx)) {
                result.push(childNode);
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

            const childCtx: EvalContext = {
                ...ctx,
                current: childValue,
                currentPath: childSegments,
            };

            if (evaluateLogicalExpr(selector.expression, childCtx)) {
                result.push(childNode);
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
    return compare(left, expr.operator, right);
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

function evaluateSingularQuery(query: JsonPathSingularQuery, ctx: EvalContext): unknown {
    const startValue = query.root === '$' ? ctx.root : ctx.current;
    const startPath = query.root === '$' ? [] : [...ctx.currentPath];

    let nodes: EvalNode[] = [{
        value: startValue,
        segments: startPath,
    }];

    for (const segment of query.segments) {
        nodes = evaluateSegment(segment, nodes, ctx);
    }

    // RFC 9535 §2.3.5.1: Singular query produces at most one node
    return nodes.length === 1 ? nodes[0].value : undefined;
}

function evaluateFilterQuery(query: JsonPathQuery, ctx: EvalContext): EvalNode[] {
    const startValue = query.root === '$' ? ctx.root : ctx.current;
    const startPath = query.root === '$' ? [] : [...ctx.currentPath];

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

function compare(left: unknown, op: JsonPathComparisonOp, right: unknown): boolean {
    // RFC 9535 §2.3.5.2.2: Comparison semantics

    switch (op) {
        case '==':
            return deepEqual(left, right);
        case '!=':
            return !deepEqual(left, right);
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

function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (typeof a !== typeof b) return false;

    if (a === null || b === null) return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
        const keysA = Object.keys(a as object);
        const keysB = Object.keys(b as object);
        if (keysA.length !== keysB.length) return false;
        const keySetB = new Set(keysB);
        for (const key of keysA) {
            if (!keySetB.has(key)) return false;
            if (!deepEqual(
                (a as Record<string, unknown>)[key],
                (b as Record<string, unknown>)[key]
            )) return false;
        }
        return true;
    }

    return false;
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
function fnLength(args: JsonPathFunctionArg[], ctx: EvalContext): number | null {
    if (args.length !== 1) return null;

    const value = evaluateFunctionArg(args[0], ctx);

    if (typeof value === 'string') {
        return value.length;
    }
    if (Array.isArray(value)) {
        return value.length;
    }
    if (value !== null && typeof value === 'object') {
        return Object.keys(value).length;
    }

    return null;
}

// RFC 9535 §2.4.5: count() function
function fnCount(args: JsonPathFunctionArg[], ctx: EvalContext): number {
    if (args.length !== 1) return 0;

    const arg = args[0];
    if (arg.type === 'query') {
        const nodes = evaluateFilterQuery(arg, ctx);
        return nodes.length;
    }

    return 0;
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

    const value = evaluateFunctionArg(args[0], ctx);
    const pattern = evaluateFunctionArg(args[1], ctx);

    if (typeof value !== 'string' || typeof pattern !== 'string') {
        return false;
    }

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

    const value = evaluateFunctionArg(args[0], ctx);
    const pattern = evaluateFunctionArg(args[1], ctx);

    if (typeof value !== 'string' || typeof pattern !== 'string') {
        return false;
    }

    const re = getCachedRegex(ctx, `search:${pattern}`, pattern);
    if (!re) {
        return false;
    }

    return re.test(value);
}

// RFC 9535 §2.4.8: value() function
function fnValue(args: JsonPathFunctionArg[], ctx: EvalContext): unknown {
    if (args.length !== 1) return null;

    const arg = args[0];
    if (arg.type === 'query') {
        const nodes = evaluateFilterQuery(arg, ctx);
        return nodes.length === 1 ? nodes[0].value : null;
    }

    return null;
}

function evaluateFunctionArg(arg: JsonPathFunctionArg, ctx: EvalContext): unknown {
    switch (arg.type) {
        case 'literal':
            return arg.value;
        case 'query':
            // For value-type arguments, get the singular value
            const nodes = evaluateFilterQuery(arg, ctx);
            return nodes.length === 1 ? nodes[0].value : undefined;
        case 'function':
            return evaluateFunction(arg, ctx);
    }
}
