/**
 * JSONPath lexer.
 * RFC 9535 §2.1, §2.3.
 */

import {
    I_JSON_MAX,
    I_JSON_MIN,
    type Token,
    type TokenType,
} from './tokens.js';

export class Lexer {
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
