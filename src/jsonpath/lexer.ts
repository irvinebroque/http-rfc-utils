/**
 * JSONPath lexer.
 * RFC 9535 §2.1, §2.3.
 * @see https://www.rfc-editor.org/rfc/rfc9535.html
 */

import {
    I_JSON_MAX,
    I_JSON_MIN,
    type Token,
    type TokenOf,
    type TokenType,
    type TokenValue,
} from './tokens.js';

export class Lexer {
    private readonly input: string;
    private pos: number = 0;
    private readonly tokens: Token[] = [];
    private tokenIndex: number = 0;

    constructor(input: string) {
        this.input = input;
        this.tokenize();
    }

    private tokenize(): void {
        while (this.pos < this.input.length) {
            this.skipWhitespace();
            if (this.pos >= this.input.length) {
                break;
            }

            const ch = this.input[this.pos];
            if (ch === undefined) {
                break;
            }

            const startPos = this.pos;

            // Two-character tokens
            if (ch === '.' && this.peekChar(1) === '.') {
                this.pos += 2;
                this.pushToken('DOTDOT', '..', startPos);
                continue;
            }
            if (ch === '&' && this.peekChar(1) === '&') {
                this.pos += 2;
                this.pushToken('AND', '&&', startPos);
                continue;
            }
            if (ch === '|' && this.peekChar(1) === '|') {
                this.pos += 2;
                this.pushToken('OR', '||', startPos);
                continue;
            }
            if (ch === '=' && this.peekChar(1) === '=') {
                this.pos += 2;
                this.pushToken('EQ', '==', startPos);
                continue;
            }
            if (ch === '!' && this.peekChar(1) === '=') {
                this.pos += 2;
                this.pushToken('NE', '!=', startPos);
                continue;
            }
            if (ch === '<' && this.peekChar(1) === '=') {
                this.pos += 2;
                this.pushToken('LE', '<=', startPos);
                continue;
            }
            if (ch === '>' && this.peekChar(1) === '=') {
                this.pos += 2;
                this.pushToken('GE', '>=', startPos);
                continue;
            }

            // Single-character tokens
            switch (ch) {
                case '$':
                    this.pos++;
                    this.pushToken('ROOT', '$', startPos);
                    continue;
                case '@':
                    this.pos++;
                    this.pushToken('CURRENT', '@', startPos);
                    continue;
                case '.':
                    this.pos++;
                    this.pushToken('DOT', '.', startPos);
                    continue;
                case '[':
                    this.pos++;
                    this.pushToken('LBRACKET', '[', startPos);
                    continue;
                case ']':
                    this.pos++;
                    this.pushToken('RBRACKET', ']', startPos);
                    continue;
                case '(':
                    this.pos++;
                    this.pushToken('LPAREN', '(', startPos);
                    continue;
                case ')':
                    this.pos++;
                    this.pushToken('RPAREN', ')', startPos);
                    continue;
                case ':':
                    this.pos++;
                    this.pushToken('COLON', ':', startPos);
                    continue;
                case ',':
                    this.pos++;
                    this.pushToken('COMMA', ',', startPos);
                    continue;
                case '*':
                    this.pos++;
                    this.pushToken('WILDCARD', '*', startPos);
                    continue;
                case '?':
                    this.pos++;
                    this.pushToken('QUESTION', '?', startPos);
                    continue;
                case '!':
                    this.pos++;
                    this.pushToken('NOT', '!', startPos);
                    continue;
                case '<':
                    this.pos++;
                    this.pushToken('LT', '<', startPos);
                    continue;
                case '>':
                    this.pos++;
                    this.pushToken('GT', '>', startPos);
                    continue;
            }

            // String literals
            if (ch === '"' || ch === '\'') {
                const str = this.readString(ch);
                if (str === null) {
                    throw new Error(`Invalid string at position ${startPos}`);
                }
                this.pushToken('STRING', str, startPos);
                continue;
            }

            // Numbers (including negative)
            if (ch === '-' || (ch >= '0' && ch <= '9')) {
                const num = this.readNumber();
                if (num === null) {
                    throw new Error(`Invalid number at position ${startPos}`);
                }
                this.pushToken('NUMBER', num, startPos);
                continue;
            }

            // Keywords and names
            if (this.isNameFirst(ch)) {
                const name = this.readName();
                if (name === 'true') {
                    this.pushToken('TRUE', true, startPos);
                } else if (name === 'false') {
                    this.pushToken('FALSE', false, startPos);
                } else if (name === 'null') {
                    this.pushToken('NULL', null, startPos);
                } else {
                    this.pushToken('NAME', name, startPos);
                }
                continue;
            }

            throw new Error(`Unexpected character '${ch}' at position ${this.pos}`);
        }

        this.pushToken('EOF', null, this.pos);
    }

    private pushToken<TType extends TokenType>(
        type: TType,
        value: TokenValue<TType>,
        pos: number
    ): void {
        this.tokens.push({ type, value, pos } as TokenOf<TType>);
    }

    private peekChar(offset: number = 0): string | undefined {
        return this.input[this.pos + offset];
    }

    private skipWhitespace(): void {
        // RFC 9535 §2.1.1: B = %x20 / %x09 / %x0A / %x0D
        while (this.pos < this.input.length) {
            const ch = this.input[this.pos];
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
                this.pos++;
                continue;
            }

            break;
        }
    }

    // RFC 9535 §2.3.1.1: member-name-shorthand = name-first *name-char
    private isNameFirst(ch: string): boolean {
        const code = ch.codePointAt(0);
        if (code === undefined) {
            return false;
        }

        // ALPHA / "_" / %x80-D7FF / %xE000-10FFFF
        return (
            (code >= 0x41 && code <= 0x5A) ||
            (code >= 0x61 && code <= 0x7A) ||
            code === 0x5F ||
            (code >= 0x80 && code <= 0xD7FF) ||
            (code >= 0xE000 && code <= 0x10FFFF)
        );
    }

    private isNameChar(ch: string): boolean {
        const code = ch.codePointAt(0);
        if (code === undefined) {
            return false;
        }

        // name-first / DIGIT
        return this.isNameFirst(ch) || (code >= 0x30 && code <= 0x39);
    }

    private readName(): string {
        const start = this.pos;

        while (this.pos < this.input.length) {
            const ch = this.input[this.pos];
            if (ch === undefined || !this.isNameChar(ch)) {
                break;
            }

            const code = ch.codePointAt(0);
            if (code !== undefined && code > 0xFFFF) {
                this.pos += 2;
            } else {
                this.pos++;
            }
        }

        return this.input.slice(start, this.pos);
    }

    // RFC 9535 §2.3.1.1: String literal parsing with escape sequences
    private readString(quote: '"' | '\''): string | null {
        this.pos++; // Skip opening quote
        let result = '';

        while (this.pos < this.input.length) {
            const ch = this.input[this.pos];
            if (ch === undefined) {
                return null;
            }

            if (ch === quote) {
                this.pos++; // Skip closing quote
                return result;
            }

            if (ch === '\\') {
                this.pos++;
                if (this.pos >= this.input.length) {
                    return null;
                }

                const escaped = this.input[this.pos];
                if (escaped === undefined) {
                    return null;
                }

                switch (escaped) {
                    case 'b':
                        result += '\b';
                        break;
                    case 'f':
                        result += '\f';
                        break;
                    case 'n':
                        result += '\n';
                        break;
                    case 'r':
                        result += '\r';
                        break;
                    case 't':
                        result += '\t';
                        break;
                    case '/':
                        result += '/';
                        break;
                    case '\\':
                        result += '\\';
                        break;
                    case '"':
                        result += '"';
                        break;
                    case '\'':
                        result += '\'';
                        break;
                    case 'u': {
                        // Unicode escape: \uXXXX or surrogate pair
                        this.pos++;
                        const hex = this.input.slice(this.pos, this.pos + 4);
                        if (!/^[0-9A-Fa-f]{4}$/.test(hex)) {
                            return null;
                        }

                        const codePoint = parseInt(hex, 16);
                        this.pos += 4;

                        // Check for high surrogate
                        if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
                            // Must be followed by \uXXXX low surrogate
                            if (this.input.slice(this.pos, this.pos + 2) !== '\\u') {
                                return null;
                            }

                            this.pos += 2;
                            const lowSurrogateHex = this.input.slice(this.pos, this.pos + 4);
                            if (!/^[0-9A-Fa-f]{4}$/.test(lowSurrogateHex)) {
                                return null;
                            }

                            const lowSurrogate = parseInt(lowSurrogateHex, 16);
                            if (lowSurrogate < 0xDC00 || lowSurrogate > 0xDFFF) {
                                return null;
                            }

                            this.pos += 4;

                            // Decode surrogate pair
                            const combined =
                                0x10000
                                + ((codePoint - 0xD800) << 10)
                                + (lowSurrogate - 0xDC00);
                            result += String.fromCodePoint(combined);
                        } else {
                            result += String.fromCodePoint(codePoint);
                        }

                        continue;
                    }
                    default:
                        return null;
                }

                this.pos++;
                continue;
            }

            result += ch;
            this.pos++;
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
        if (firstDigit === undefined) {
            this.pos = start;
            return null;
        }

        // "0" by itself or leading zeros not allowed for non-zero integers
        if (firstDigit === '0') {
            this.pos++;
            const next = this.input[this.pos];
            if (next !== undefined && next >= '0' && next <= '9') {
                this.pos = start;
                return null;
            }
        } else if (firstDigit >= '1' && firstDigit <= '9') {
            this.pos++;
            while (this.pos < this.input.length) {
                const digit = this.input[this.pos];
                if (digit !== undefined && digit >= '0' && digit <= '9') {
                    this.pos++;
                    continue;
                }

                break;
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

    current(): Token {
        return this.tokens[this.tokenIndex] ?? this.tokens[this.tokens.length - 1]!;
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

    peekToken<TType extends TokenType>(type: TType): TokenOf<TType> | null {
        const token = this.current();
        if (token.type !== type) {
            return null;
        }

        return token as TokenOf<TType>;
    }

    matchToken<TType extends TokenType>(type: TType): TokenOf<TType> | null {
        const token = this.peekToken(type);
        if (!token) {
            return null;
        }

        this.advance();
        return token;
    }

    match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.matchToken(type)) {
                return true;
            }
        }

        return false;
    }

    expect<TType extends TokenType>(type: TType): TokenOf<TType> {
        const token = this.matchToken(type);
        if (token) {
            return token;
        }

        throw new Error(`Expected ${type} but got ${this.current().type}`);
    }

    isAtEnd(): boolean {
        return this.check('EOF');
    }
}
