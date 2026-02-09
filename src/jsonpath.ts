/**
 * JSONPath query expressions per RFC 9535.
 * RFC 9535 §§2.1-2.7.
 * @see https://www.rfc-editor.org/rfc/rfc9535.html
 *
 * Implements:
 * - Root identifier ($) and current node identifier (@)
 * - Name, wildcard, index, slice, and filter selectors
 * - Child and descendant segments
 * - Built-in functions: length(), count(), match(), search(), value()
 * - Normalized path formatting
 *
 * Out of scope:
 * - Custom function extensions (only built-in functions supported)
 * - Full I-Regexp (RFC 9485) validation (uses JavaScript RegExp)
 */

import type {
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
    JsonPathComparisonExpr,
    JsonPathComparisonOp,
    JsonPathTestExpr,
    JsonPathComparable,
    JsonPathLiteral,
    JsonPathSingularQuery,
    JsonPathFunctionExpr,
    JsonPathFunctionArg,
    JsonPathFunctionName,
    JsonPathNode,
    JsonPathOptions,
} from './types.js';

// Re-export types for convenience
export type {
    JsonPathQuery,
    JsonPathSegment,
    JsonPathSelector,
    JsonPathNode,
    JsonPathOptions,
};

// =============================================================================
// Constants
// =============================================================================

// RFC 9535 §2.1: Integers MUST be within I-JSON range
const I_JSON_MIN = -(2 ** 53) + 1;  // -9007199254740991
const I_JSON_MAX = 2 ** 53 - 1;     // 9007199254740991

// Built-in function names (RFC 9535 §2.4)
const BUILTIN_FUNCTIONS = new Set<JsonPathFunctionName>([
    'length', 'count', 'match', 'search', 'value'
]);

// =============================================================================
// Lexer
// =============================================================================

type TokenType =
    | 'ROOT'          // $
    | 'CURRENT'       // @
    | 'DOT'           // .
    | 'DOTDOT'        // ..
    | 'LBRACKET'      // [
    | 'RBRACKET'      // ]
    | 'LPAREN'        // (
    | 'RPAREN'        // )
    | 'COLON'         // :
    | 'COMMA'         // ,
    | 'WILDCARD'      // *
    | 'QUESTION'      // ?
    | 'NOT'           // !
    | 'AND'           // &&
    | 'OR'            // ||
    | 'EQ'            // ==
    | 'NE'            // !=
    | 'LT'            // <
    | 'LE'            // <=
    | 'GT'            // >
    | 'GE'            // >=
    | 'STRING'        // 'string' or "string"
    | 'NUMBER'        // 123, -456, 3.14
    | 'TRUE'          // true
    | 'FALSE'         // false
    | 'NULL'          // null
    | 'NAME'          // member-name-shorthand
    | 'EOF';

interface Token {
    type: TokenType;
    value: string | number | boolean | null;
    pos: number;
}

class Lexer {
    private input: string;
    private pos: number = 0;
    private tokens: Token[] = [];
    private tokenIndex: number = 0;

    constructor(input: string) {
        this.input = input;
        this.tokenize();
    }

    private tokenize(): void {
        while (this.pos < this.input.length) {
            this.skipWhitespace();
            if (this.pos >= this.input.length) break;

            const ch = this.input[this.pos];
            const startPos = this.pos;

            // Two-character tokens
            if (ch === '.' && this.peek(1) === '.') {
                this.pos += 2;
                this.tokens.push({ type: 'DOTDOT', value: '..', pos: startPos });
                continue;
            }
            if (ch === '&' && this.peek(1) === '&') {
                this.pos += 2;
                this.tokens.push({ type: 'AND', value: '&&', pos: startPos });
                continue;
            }
            if (ch === '|' && this.peek(1) === '|') {
                this.pos += 2;
                this.tokens.push({ type: 'OR', value: '||', pos: startPos });
                continue;
            }
            if (ch === '=' && this.peek(1) === '=') {
                this.pos += 2;
                this.tokens.push({ type: 'EQ', value: '==', pos: startPos });
                continue;
            }
            if (ch === '!' && this.peek(1) === '=') {
                this.pos += 2;
                this.tokens.push({ type: 'NE', value: '!=', pos: startPos });
                continue;
            }
            if (ch === '<' && this.peek(1) === '=') {
                this.pos += 2;
                this.tokens.push({ type: 'LE', value: '<=', pos: startPos });
                continue;
            }
            if (ch === '>' && this.peek(1) === '=') {
                this.pos += 2;
                this.tokens.push({ type: 'GE', value: '>=', pos: startPos });
                continue;
            }

            // Single-character tokens
            switch (ch) {
                case '$':
                    this.pos++;
                    this.tokens.push({ type: 'ROOT', value: '$', pos: startPos });
                    continue;
                case '@':
                    this.pos++;
                    this.tokens.push({ type: 'CURRENT', value: '@', pos: startPos });
                    continue;
                case '.':
                    this.pos++;
                    this.tokens.push({ type: 'DOT', value: '.', pos: startPos });
                    continue;
                case '[':
                    this.pos++;
                    this.tokens.push({ type: 'LBRACKET', value: '[', pos: startPos });
                    continue;
                case ']':
                    this.pos++;
                    this.tokens.push({ type: 'RBRACKET', value: ']', pos: startPos });
                    continue;
                case '(':
                    this.pos++;
                    this.tokens.push({ type: 'LPAREN', value: '(', pos: startPos });
                    continue;
                case ')':
                    this.pos++;
                    this.tokens.push({ type: 'RPAREN', value: ')', pos: startPos });
                    continue;
                case ':':
                    this.pos++;
                    this.tokens.push({ type: 'COLON', value: ':', pos: startPos });
                    continue;
                case ',':
                    this.pos++;
                    this.tokens.push({ type: 'COMMA', value: ',', pos: startPos });
                    continue;
                case '*':
                    this.pos++;
                    this.tokens.push({ type: 'WILDCARD', value: '*', pos: startPos });
                    continue;
                case '?':
                    this.pos++;
                    this.tokens.push({ type: 'QUESTION', value: '?', pos: startPos });
                    continue;
                case '!':
                    this.pos++;
                    this.tokens.push({ type: 'NOT', value: '!', pos: startPos });
                    continue;
                case '<':
                    this.pos++;
                    this.tokens.push({ type: 'LT', value: '<', pos: startPos });
                    continue;
                case '>':
                    this.pos++;
                    this.tokens.push({ type: 'GT', value: '>', pos: startPos });
                    continue;
            }

            // String literals
            if (ch === '"' || ch === "'") {
                const str = this.readString(ch);
                if (str === null) {
                    throw new Error(`Invalid string at position ${startPos}`);
                }
                this.tokens.push({ type: 'STRING', value: str, pos: startPos });
                continue;
            }

            // Numbers (including negative)
            if (ch === '-' || (ch >= '0' && ch <= '9')) {
                const num = this.readNumber();
                if (num === null) {
                    throw new Error(`Invalid number at position ${startPos}`);
                }
                this.tokens.push({ type: 'NUMBER', value: num, pos: startPos });
                continue;
            }

            // Keywords and names
            if (this.isNameFirst(ch)) {
                const name = this.readName();
                if (name === 'true') {
                    this.tokens.push({ type: 'TRUE', value: true, pos: startPos });
                } else if (name === 'false') {
                    this.tokens.push({ type: 'FALSE', value: false, pos: startPos });
                } else if (name === 'null') {
                    this.tokens.push({ type: 'NULL', value: null, pos: startPos });
                } else {
                    this.tokens.push({ type: 'NAME', value: name, pos: startPos });
                }
                continue;
            }

            throw new Error(`Unexpected character '${ch}' at position ${this.pos}`);
        }

        this.tokens.push({ type: 'EOF', value: null, pos: this.pos });
    }

    private peek(offset: number = 0): string | undefined {
        return this.input[this.pos + offset];
    }

    private skipWhitespace(): void {
        // RFC 9535 §2.1.1: B = %x20 / %x09 / %x0A / %x0D
        while (this.pos < this.input.length) {
            const ch = this.input[this.pos];
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
                this.pos++;
            } else {
                break;
            }
        }
    }

    // RFC 9535 §2.3.1.1: member-name-shorthand = name-first *name-char
    private isNameFirst(ch: string): boolean {
        const code = ch.codePointAt(0);
        if (code === undefined) return false;
        // ALPHA / "_" / %x80-D7FF / %xE000-10FFFF
        return (
            (code >= 0x41 && code <= 0x5A) ||  // A-Z
            (code >= 0x61 && code <= 0x7A) ||  // a-z
            code === 0x5F ||                    // _
            (code >= 0x80 && code <= 0xD7FF) ||
            (code >= 0xE000 && code <= 0x10FFFF)
        );
    }

    private isNameChar(ch: string): boolean {
        const code = ch.codePointAt(0);
        if (code === undefined) return false;
        // name-first / DIGIT
        return this.isNameFirst(ch) || (code >= 0x30 && code <= 0x39);
    }

    private readName(): string {
        const start = this.pos;
        // Handle multi-byte characters
        while (this.pos < this.input.length) {
            const ch = this.input[this.pos];
            if (!this.isNameChar(ch)) break;
            // Handle surrogate pairs
            const code = ch.codePointAt(0)!;
            if (code > 0xFFFF) {
                this.pos += 2;
            } else {
                this.pos++;
            }
        }
        return this.input.slice(start, this.pos);
    }

    // RFC 9535 §2.3.1.1: String literal parsing with escape sequences
    private readString(quote: string): string | null {
        this.pos++; // Skip opening quote
        let result = '';

        while (this.pos < this.input.length) {
            const ch = this.input[this.pos];

            if (ch === quote) {
                this.pos++; // Skip closing quote
                return result;
            }

            if (ch === '\\') {
                this.pos++;
                if (this.pos >= this.input.length) return null;

                const escaped = this.input[this.pos];
                switch (escaped) {
                    case 'b': result += '\b'; break;
                    case 'f': result += '\f'; break;
                    case 'n': result += '\n'; break;
                    case 'r': result += '\r'; break;
                    case 't': result += '\t'; break;
                    case '/': result += '/'; break;
                    case '\\': result += '\\'; break;
                    case '"': result += '"'; break;
                    case "'": result += "'"; break;
                    case 'u': {
                        // Unicode escape: \uXXXX or surrogate pair
                        this.pos++;
                        const hex = this.input.slice(this.pos, this.pos + 4);
                        if (!/^[0-9A-Fa-f]{4}$/.test(hex)) return null;
                        const codePoint = parseInt(hex, 16);
                        this.pos += 4;

                        // Check for high surrogate
                        if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
                            // Must be followed by \uXXXX low surrogate
                            if (this.input.slice(this.pos, this.pos + 2) !== '\\u') return null;
                            this.pos += 2;
                            const hex2 = this.input.slice(this.pos, this.pos + 4);
                            if (!/^[0-9A-Fa-f]{4}$/.test(hex2)) return null;
                            const lowSurrogate = parseInt(hex2, 16);
                            if (lowSurrogate < 0xDC00 || lowSurrogate > 0xDFFF) return null;
                            this.pos += 4;
                            // Decode surrogate pair
                            const combined = 0x10000 + ((codePoint - 0xD800) << 10) + (lowSurrogate - 0xDC00);
                            result += String.fromCodePoint(combined);
                        } else {
                            result += String.fromCodePoint(codePoint);
                        }
                        continue; // Already advanced pos
                    }
                    default:
                        return null; // Invalid escape
                }
                this.pos++;
            } else {
                result += ch;
                this.pos++;
            }
        }

        return null; // Unterminated string
    }

    // RFC 9535 §2.3.3.1: int = "0" / (["-"] DIGIT1 *DIGIT)
    private readNumber(): number | null {
        const start = this.pos;
        let hasSign = false;

        if (this.input[this.pos] === '-') {
            hasSign = true;
            this.pos++;
        }

        if (this.pos >= this.input.length) {
            this.pos = start;
            return null;
        }

        const firstDigit = this.input[this.pos];

        // "0" by itself or leading zeros not allowed for non-zero integers
        if (firstDigit === '0') {
            this.pos++;
            // Check if followed by more digits (invalid: 00, 01, etc.)
            if (this.pos < this.input.length) {
                const next = this.input[this.pos];
                if (next >= '0' && next <= '9') {
                    // Could be a decimal
                    if (next !== '.') {
                        this.pos = start;
                        return null; // Leading zero in integer
                    }
                }
            }
        } else if (firstDigit >= '1' && firstDigit <= '9') {
            this.pos++;
            while (this.pos < this.input.length) {
                const ch = this.input[this.pos];
                if (ch >= '0' && ch <= '9') {
                    this.pos++;
                } else {
                    break;
                }
            }
        } else if (hasSign) {
            // - not followed by digit
            this.pos = start;
            return null;
        } else {
            this.pos = start;
            return null;
        }

        const numStr = this.input.slice(start, this.pos);
        const num = parseInt(numStr, 10);

        // RFC 9535 §2.1: Integers MUST be within I-JSON range
        if (num < I_JSON_MIN || num > I_JSON_MAX) {
            return null;
        }

        return num;
    }

    // Token access methods
    current(): Token {
        return this.tokens[this.tokenIndex] ?? this.tokens[this.tokens.length - 1];
    }

    advance(): Token {
        const token = this.current();
        if (this.tokenIndex < this.tokens.length - 1) {
            this.tokenIndex++;
        }
        return token;
    }

    check(type: TokenType): boolean {
        return this.current().type === type;
    }

    match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    expect(type: TokenType): Token {
        if (!this.check(type)) {
            throw new Error(`Expected ${type} but got ${this.current().type}`);
        }
        return this.advance();
    }

    isAtEnd(): boolean {
        return this.check('EOF');
    }
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse a JSONPath query string into an AST.
 * Returns null if the query is not well-formed or valid.
 *
 * @param query - JSONPath query string (e.g., "$.store.book[*].author")
 * @returns Parsed AST, or null on invalid syntax
 *
 * @example
 * parseJsonPath('$.store.book[*]')  // { type: 'query', root: '$', segments: [...] }
 * parseJsonPath('invalid')          // null
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535.html#section-2.1
 */
export function parseJsonPath(query: string): JsonPathQuery | null {
    try {
        const lexer = new Lexer(query);
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
        if (segment === null) break;
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
        if (selectors === null) return null;
        return { type: 'descendant', selectors };
    }

    if (lexer.match('WILDCARD')) {
        return { type: 'descendant', selectors: [{ type: 'wildcard' }] };
    }

    if (lexer.check('NAME')) {
        const name = lexer.advance().value as string;
        return { type: 'descendant', selectors: [{ type: 'name', name }] };
    }

    return null;
}

function parseChildBracketSegment(lexer: Lexer): JsonPathChildSegment | null {
    const selectors = parseBracketedSelection(lexer);
    if (selectors === null) return null;
    return { type: 'child', selectors };
}

function parseChildDotSegment(lexer: Lexer): JsonPathChildSegment | null {
    // RFC 9535 §2.5.1.1: "." (wildcard-selector / member-name-shorthand)

    if (lexer.match('WILDCARD')) {
        return { type: 'child', selectors: [{ type: 'wildcard' }] };
    }

    if (lexer.check('NAME')) {
        const name = lexer.advance().value as string;
        return { type: 'child', selectors: [{ type: 'name', name }] };
    }

    return null;
}

function parseBracketedSelection(lexer: Lexer): JsonPathSelector[] | null {
    // RFC 9535 §2.5.1.1: bracketed-selection = "[" S selector *( S "," S selector ) S "]"

    if (!lexer.match('LBRACKET')) return null;

    const selectors: JsonPathSelector[] = [];

    const first = parseSelector(lexer);
    if (first === null) return null;
    selectors.push(first);

    while (lexer.match('COMMA')) {
        const next = parseSelector(lexer);
        if (next === null) return null;
        selectors.push(next);
    }

    if (!lexer.match('RBRACKET')) return null;

    return selectors;
}

function parseSelector(lexer: Lexer): JsonPathSelector | null {
    // RFC 9535 §2.3: selector = name-selector / wildcard / slice / index / filter

    // Filter selector: "?" logical-expr
    if (lexer.match('QUESTION')) {
        const expr = parseLogicalExpr(lexer);
        if (expr === null) return null;
        return { type: 'filter', expression: expr };
    }

    // Wildcard selector
    if (lexer.match('WILDCARD')) {
        return { type: 'wildcard' };
    }

    // Name selector (string literal)
    if (lexer.check('STRING')) {
        const name = lexer.advance().value as string;
        return { type: 'name', name };
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
    if (lexer.check('NUMBER')) {
        start = lexer.advance().value as number;
    }

    // First colon (makes it a slice)
    if (lexer.match('COLON')) {
        isSlice = true;

        // End value
        if (lexer.check('NUMBER')) {
            end = lexer.advance().value as number;
        }

        // Second colon and step
        if (lexer.match('COLON')) {
            if (lexer.check('NUMBER')) {
                step = lexer.advance().value as number;
            }
        }
    }

    if (isSlice) {
        return { type: 'slice', start, end, step };
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
    return parseLogicalOrExpr(lexer);
}

function parseLogicalOrExpr(lexer: Lexer): JsonPathLogicalExpr | null {
    // RFC 9535 §2.3.5.1: logical-or-expr = logical-and-expr *( "||" S logical-and-expr )
    let left = parseLogicalAndExpr(lexer);
    if (left === null) return null;

    const operands: JsonPathLogicalExpr[] = [left];

    while (lexer.match('OR')) {
        const right = parseLogicalAndExpr(lexer);
        if (right === null) return null;
        operands.push(right);
    }

    if (operands.length === 1) {
        return operands[0];
    }

    return { type: 'or', operands };
}

function parseLogicalAndExpr(lexer: Lexer): JsonPathLogicalExpr | null {
    // RFC 9535 §2.3.5.1: logical-and-expr = basic-expr *( "&&" S basic-expr )
    let left = parseBasicExpr(lexer);
    if (left === null) return null;

    const operands: JsonPathLogicalExpr[] = [left];

    while (lexer.match('AND')) {
        const right = parseBasicExpr(lexer);
        if (right === null) return null;
        operands.push(right);
    }

    if (operands.length === 1) {
        return operands[0];
    }

    return { type: 'and', operands };
}

function parseBasicExpr(lexer: Lexer): JsonPathLogicalExpr | null {
    // RFC 9535 §2.3.5.1: basic-expr = paren-expr / comparison-expr / test-expr

    // Parenthesized expression
    if (lexer.match('LPAREN')) {
        const expr = parseLogicalExpr(lexer);
        if (expr === null) return null;
        if (!lexer.match('RPAREN')) return null;
        return expr;
    }

    // Negation
    if (lexer.match('NOT')) {
        const operand = parseBasicExpr(lexer);
        if (operand === null) return null;
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
        if (query === null) return null;

        // Check if followed by comparison operator
        const op = tryParseComparisonOp(lexer);
        if (op !== null) {
            const right = parseComparable(lexer);
            if (right === null) return null;

            // Convert query to singular-query comparable
            const left: JsonPathSingularQuery = {
                type: 'singular-query',
                root: query.root,
                segments: query.segments,
            };

            return { type: 'comparison', operator: op, left, right };
        }

        // It's a test expression
        return { type: 'test', query };
    }

    // Check for function call
    if (lexer.check('NAME')) {
        const func = parseFunctionExpr(lexer);
        if (func === null) return null;

        // Check if followed by comparison operator
        const op = tryParseComparisonOp(lexer);
        if (op !== null) {
            const right = parseComparable(lexer);
            if (right === null) return null;
            return { type: 'comparison', operator: op, left: func, right };
        }

        // It's a test expression (function returning LogicalType)
        return func;
    }

    // Literal followed by comparison
    const literal = parseLiteral(lexer);
    if (literal !== null) {
        const op = tryParseComparisonOp(lexer);
        if (op !== null) {
            const right = parseComparable(lexer);
            if (right === null) return null;
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
        return parseFunctionExpr(lexer);
    }

    // Singular query
    if (lexer.check('ROOT') || lexer.check('CURRENT')) {
        const query = parseFilterQuery(lexer);
        if (query === null) return null;
        return {
            type: 'singular-query',
            root: query.root,
            segments: query.segments,
        };
    }

    // Literal
    return parseLiteral(lexer);
}

function parseLiteral(lexer: Lexer): JsonPathLiteral | null {
    if (lexer.check('STRING')) {
        return { type: 'literal', value: lexer.advance().value as string };
    }
    if (lexer.check('NUMBER')) {
        return { type: 'literal', value: lexer.advance().value as number };
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

    if (!lexer.check('NAME')) return null;

    const name = lexer.advance().value as string;
    if (!BUILTIN_FUNCTIONS.has(name as JsonPathFunctionName)) {
        return null;
    }

    if (!lexer.match('LPAREN')) return null;

    const args: JsonPathFunctionArg[] = [];

    if (!lexer.check('RPAREN')) {
        const first = parseFunctionArg(lexer);
        if (first === null) return null;
        args.push(first);

        while (lexer.match('COMMA')) {
            const next = parseFunctionArg(lexer);
            if (next === null) return null;
            args.push(next);
        }
    }

    if (!lexer.match('RPAREN')) return null;

    return {
        type: 'function',
        name: name as JsonPathFunctionName,
        args,
    };
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

// =============================================================================
// Evaluator
// =============================================================================

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
