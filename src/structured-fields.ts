/**
 * Structured Field Values per RFC 8941 + RFC 9651.
 * RFC 8941 §3, §4.
 * RFC 9651 §3.3.7, §4.1.10 (Date type).
 * @see https://www.rfc-editor.org/rfc/rfc9651.html
 */

import { Buffer } from 'node:buffer';
import { SfDate } from './types.js';
import type { SfBareItem, SfItem, SfInnerList, SfList, SfDictionary } from './types.js';

// RFC 8941 §3.3.4: sf-token allows ALPHA (case-insensitive), digits, and tchar plus : and /
const TOKEN_RE = /^[A-Za-z*][A-Za-z0-9!#$%&'*+\-.^_`|~:\/]*$/;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const KEY_RE = /^[a-z*][a-z0-9_\-\.\*]*$/;

class Parser {
    private input: string;
    private index: number;

    constructor(input: string) {
        this.input = input;
        this.index = 0;
    }

    private eof(): boolean {
        return this.index >= this.input.length;
    }

    private peek(): string {
        return this.input[this.index] ?? '';
    }

    private consume(): string {
        return this.input[this.index++] ?? '';
    }

    private skipOWS(): void {
        while (!this.eof()) {
            const char = this.peek();
            if (char === ' ' || char === '\t') {
                this.consume();
            } else {
                break;
            }
        }
    }

    isAtEnd(): boolean {
        this.skipOWS();
        return this.eof();
    }

    parseItem(): SfItem | null {
        const value = this.parseBareItem();
        if (value === null) {
            return null;
        }

        const params = this.parseParameters();
        return params ? { value, params } : { value };
    }

    parseInnerList(): SfInnerList | null {
        if (this.peek() !== '(') {
            return null;
        }

        this.consume();
        const items: SfItem[] = [];

        this.skipOWS();
        while (!this.eof() && this.peek() !== ')') {
            const item = this.parseItem();
            if (!item) {
                return null;
            }
            items.push(item);
            this.skipOWS();
        }

        if (this.peek() !== ')') {
            return null;
        }

        this.consume();
        const params = this.parseParameters();
        return params ? { items, params } : { items };
    }

    parseList(): SfList | null {
        const list: SfList = [];

        while (true) {
            this.skipOWS();
            if (this.eof()) {
                break;
            }

            const member = this.peek() === '(' ? this.parseInnerList() : this.parseItem();
            if (!member) {
                return null;
            }
            list.push(member);

            this.skipOWS();
            if (this.eof()) {
                break;
            }
            if (this.peek() === ',') {
                this.consume();
                continue;
            }
            return null;
        }

        return list;
    }

    parseDictionary(): SfDictionary | null {
        const dict: SfDictionary = {};

        while (true) {
            this.skipOWS();
            if (this.eof()) {
                break;
            }

            const key = this.parseKey();
            if (!key) {
                return null;
            }

            this.skipOWS();
            let value: SfItem | SfInnerList;

            if (this.peek() === '=') {
                this.consume();
                this.skipOWS();
                if (this.peek() === '(') {
                    const list = this.parseInnerList();
                    if (!list) {
                        return null;
                    }
                    value = list;
                } else {
                    const item = this.parseItem();
                    if (!item) {
                        return null;
                    }
                    value = item;
                }
            } else {
                const params = this.parseParameters();
                value = params ? { value: true, params } : { value: true };
            }

            dict[key] = value;

            this.skipOWS();
            if (this.eof()) {
                break;
            }
            if (this.peek() === ',') {
                this.consume();
                continue;
            }
            return null;
        }

        return dict;
    }

    private parseParameters(): Record<string, SfBareItem> | null {
        const params: Record<string, SfBareItem> = {};

        while (true) {
            this.skipOWS();
            if (this.peek() !== ';') {
                break;
            }
            this.consume();
            this.skipOWS();

            const key = this.parseKey();
            if (!key) {
                return null;
            }

            let value: SfBareItem = true;
            this.skipOWS();
            if (this.peek() === '=') {
                this.consume();
                this.skipOWS();
                const bare = this.parseBareItem();
                if (bare === null) {
                    return null;
                }
                value = bare;
            }

            params[key] = value;
        }

        return Object.keys(params).length > 0 ? params : null;
    }

    private parseBareItem(): SfBareItem | null {
        if (this.eof()) {
            return null;
        }

        const char = this.peek();
        if (char === '"') {
            return this.parseString();
        }
        if (char === '?') {
            return this.parseBoolean();
        }
        if (char === ':') {
            return this.parseByteSequence();
        }
        // RFC 9651 §3.3.7: Date bare item starts with '@'
        if (char === '@') {
            return this.parseDate();
        }
        if (char === '-' || (char >= '0' && char <= '9')) {
            return this.parseNumber();
        }

        return this.parseToken();
    }

    // RFC 9651 §3.3.7: Date bare item.
    // Dates are indicated by a leading '@' followed by an integer (unix seconds).
    private parseDate(): SfDate | null {
        if (this.consume() !== '@') {
            return null;
        }
        // The value after '@' MUST be an sf-integer (RFC 9651 §3.3.7)
        const numValue = this.parseNumber();
        if (numValue === null || !Number.isInteger(numValue)) {
            return null;
        }
        return new SfDate(numValue);
    }

    private parseKey(): string | null {
        let key = '';
        while (!this.eof()) {
            const char = this.peek();
            if (!/[a-z0-9_\-\.\*]/.test(char)) {
                break;
            }
            key += char;
            this.consume();
        }

        if (!key || !KEY_RE.test(key)) {
            return null;
        }

        return key;
    }

    // RFC 8941 §3.3.3: String bare item.
    private parseString(): string | null {
        if (this.consume() !== '"') {
            return null;
        }

        let result = '';
        while (!this.eof()) {
            const char = this.consume();
            if (char === '"') {
                return result;
            }
            if (char === '\\') {
                if (this.eof()) {
                    return null;
                }
                const escapedChar = this.consume();
                // RFC 8941 §3.3.3: Only \" and \\ are valid escape sequences.
                if (escapedChar !== '"' && escapedChar !== '\\') {
                    return null;
                }
                result += escapedChar;
            } else {
                // RFC 8941 §3.3.3: Validate unescaped chars are printable ASCII (excluding " and \).
                const code = char.charCodeAt(0);
                if (code < 0x20 || code > 0x7E || code === 0x22 || code === 0x5C) {
                    return null;
                }
                result += char;
            }
        }

        return null;
    }

    // RFC 8941 §3.3.6: Boolean bare item.
    private parseBoolean(): boolean | null {
        if (this.consume() !== '?') {
            return null;
        }
        const char = this.consume();
        if (char === '1') {
            return true;
        }
        if (char === '0') {
            return false;
        }
        return null;
    }

    // RFC 8941 §3.3.5: Byte sequence bare item.
    private parseByteSequence(): Uint8Array | null {
        if (this.consume() !== ':') {
            return null;
        }
        let base64 = '';
        while (!this.eof()) {
            const char = this.consume();
            if (char === ':') {
                try {
                    if (base64.includes('\n') || base64.includes('\r')) {
                        return null;
                    }
                    if (!BASE64_RE.test(base64)) {
                        return null;
                    }
                    if (base64.length % 4 !== 0) {
                        return null;
                    }
                    const buffer = Buffer.from(base64, 'base64');
                    return new Uint8Array(buffer);
                } catch {
                    return null;
                }
            }
            base64 += char;
        }

        return null;
    }

    // RFC 8941 §3.3.1: Numeric bare item.
    private parseNumber(): number | null {
        const remaining = this.input.slice(this.index);
        const match = remaining.match(/^(-?)(\d+)(?:\.(\d{1,3}))?/);
        if (!match) {
            return null;
        }

        const integerPart = match[2] ?? '';
        const fractionalPart = match[3];
        if (fractionalPart !== undefined) {
            if (integerPart.length > 12) {
                return null;
            }
            if (fractionalPart.length > 3) {
                return null;
            }
        } else if (integerPart.length > 15) {
            return null;
        }

        this.index += match[0].length;
        const value = Number(match[0]);
        if (!Number.isFinite(value)) {
            return null;
        }
        return value;
    }

    // RFC 8941 §3.3.4: Token parsing.
    private parseToken(): string | null {
        let token = '';
        while (!this.eof()) {
            const char = this.peek();
            // RFC 8941 §3.3.4: tchar plus ":" and "/"
            if (!/[A-Za-z0-9!#$%&'*+\-.^_`|~:\/]/.test(char)) {
                break;
            }
            token += char;
            this.consume();
        }

        if (!token || !TOKEN_RE.test(token)) {
            return null;
        }

        return token;
    }
}

/**
 * Parse a Structured Field List.
 */
// RFC 8941 §3.1: Structured Field List.
export function parseSfList(value: string): SfList | null {
    const parser = new Parser(value);
    const list = parser.parseList();
    if (!list) {
        return null;
    }
    if (!parser.isAtEnd()) {
        return null;
    }
    return list;
}

/**
 * Parse a Structured Field Dictionary.
 */
// RFC 8941 §3.2: Structured Field Dictionary.
export function parseSfDict(value: string): SfDictionary | null {
    const parser = new Parser(value);
    const dict = parser.parseDictionary();
    if (!dict) {
        return null;
    }
    if (!parser.isAtEnd()) {
        return null;
    }
    return dict;
}

/**
 * Parse a Structured Field Item.
 */
// RFC 8941 §3.3: Structured Field Item.
export function parseSfItem(value: string): SfItem | null {
    const parser = new Parser(value.trim());
    const item = parser.parseItem();
    if (!item) {
        return null;
    }
    if (!parser.isAtEnd()) {
        return null;
    }
    return item;
}

// RFC 8941 §4 + RFC 9651 §4.1.10: Structured Field serialization.
function serializeBareItem(value: SfBareItem): string {
    if (typeof value === 'boolean') {
        return value ? '?1' : '?0';
    }

    // RFC 9651 §4.1.10: Date serialization.
    if (value instanceof SfDate) {
        return `@${value.timestamp}`;
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error('Invalid numeric structured field value');
        }

        if (Number.isInteger(value)) {
            // RFC 8941 §4.1.4: Integer range check.
            if (value < -999_999_999_999_999 || value > 999_999_999_999_999) {
                throw new Error('Integer out of range for structured field');
            }
            return String(value);
        }

        let encoded = value.toFixed(3);
        encoded = encoded.replace(/0+$/, '');
        if (encoded.endsWith('.')) {
            encoded = encoded.slice(0, -1);
        }
        return encoded;
    }

    if (value instanceof Uint8Array) {
        const base64 = Buffer.from(value).toString('base64');
        return `:${base64}:`;
    }

    if (TOKEN_RE.test(value)) {
        return value;
    }

    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function serializeParams(params?: Record<string, SfBareItem>): string {
    if (!params) {
        return '';
    }

    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        if (value === true) {
            parts.push(`;${key}`);
        } else {
            parts.push(`;${key}=${serializeBareItem(value)}`);
        }
    }

    return parts.join('');
}

function serializeItem(item: SfItem): string {
    const base = serializeBareItem(item.value);
    return base + serializeParams(item.params);
}

function serializeInnerList(list: SfInnerList): string {
    const items = list.items.map(serializeItem).join(' ');
    return `(${items})${serializeParams(list.params)}`;
}

/**
 * Serialize a Structured Field List.
 */
// RFC 8941 §4: Structured Field List serialization.
export function serializeSfList(list: SfList): string {
    return list.map(member => {
        if ('items' in member) {
            return serializeInnerList(member);
        }
        return serializeItem(member);
    }).join(', ');
}

/**
 * Serialize a Structured Field Dictionary.
 */
// RFC 8941 §4: Structured Field Dictionary serialization.
export function serializeSfDict(dict: SfDictionary): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(dict)) {
        if ('items' in value) {
            parts.push(`${key}=${serializeInnerList(value)}`);
            continue;
        }

        const item = value as SfItem;
        const isBareTrue = item.value === true && !item.params;
        if (isBareTrue) {
            parts.push(key);
            continue;
        }

        parts.push(`${key}=${serializeItem(item)}`);
    }

    return parts.join(', ');
}

/**
 * Serialize a Structured Field Item.
 */
// RFC 8941 §4: Structured Field Item serialization.
export function serializeSfItem(item: SfItem): string {
    return serializeItem(item);
}
