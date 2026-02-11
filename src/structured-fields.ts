/**
 * Structured Field Values per RFC 8941 + RFC 9651.
 * RFC 8941 §3, §4.
 * RFC 9651 §3.3.7, §3.3.8, §4.1.10, §4.1.11, §4.2.10.
 * @see https://www.rfc-editor.org/rfc/rfc9651.html
 */

import { Buffer } from 'node:buffer';
import { SfDate, SfDisplayString, SfToken } from './types.js';
import type { SfBareItem, SfItem, SfInnerList, SfList, SfDictionary } from './types.js';
import { encodeUtf8, hasLoneSurrogate } from './internal-unicode.js';

// RFC 8941 §3.3.4: sf-token allows ALPHA (case-insensitive), digits, and tchar plus : and /
export const SF_TOKEN_TEXT_RE = /^[A-Za-z*][A-Za-z0-9!#$%&'*+\-.^_`|~:/]*$/;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
export const SF_KEY_TEXT_RE = /^[a-z*][a-z0-9_\-.*]*$/;
const LOWER_HEX_RE = /^[0-9a-f]{2}$/;
const INTEGER_RE = /-?\d+/y;
const NUMBER_RE = /(-?)(\d+)(?:\.(\d{1,3}))?/y;

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function isKeyChar(char: string): boolean {
    const code = char.charCodeAt(0);
    return (code >= 0x61 && code <= 0x7a)
        || (code >= 0x30 && code <= 0x39)
        || char === '_'
        || char === '-'
        || char === '.'
        || char === '*';
}

function isTokenChar(char: string): boolean {
    const code = char.charCodeAt(0);
    return (code >= 0x41 && code <= 0x5a)
        || (code >= 0x61 && code <= 0x7a)
        || (code >= 0x30 && code <= 0x39)
        || char === '!'
        || char === '#'
        || char === '$'
        || char === '%'
        || char === '&'
        || char === '\''
        || char === '*'
        || char === '+'
        || char === '-'
        || char === '.'
        || char === '^'
        || char === '_'
        || char === '`'
        || char === '|'
        || char === '~'
        || char === ':'
        || char === '/';
}

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

    private skipSP(): void {
        while (!this.eof() && this.peek() === ' ') {
            this.consume();
        }
    }

    isAtEnd(): boolean {
        this.skipOWS();
        return this.eof();
    }

    parseItem(): SfItem | null {
        return this.parseItemWithParameterOWS(true);
    }

    private parseItemWithParameterOWS(allowLeadingParameterOWS: boolean): SfItem | null {
        const value = this.parseBareItem();
        if (value === null) {
            return null;
        }

        const params = this.parseParameters(allowLeadingParameterOWS);
        return params ? { value, params } : { value };
    }

    parseInnerList(): SfInnerList | null {
        if (this.peek() !== '(') {
            return null;
        }

        this.consume();
        const items: SfItem[] = [];

        while (!this.eof()) {
            this.skipSP();
            if (this.peek() === ')') {
                break;
            }

            const item = this.parseItemWithParameterOWS(false);
            if (!item) {
                return null;
            }
            items.push(item);

            const next = this.peek();
            if (next === ')') {
                break;
            }
            if (next !== ' ') {
                return null;
            }

            this.skipSP();
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
                this.skipOWS();
                // RFC 8941 §3.1: A trailing comma does not produce a member.
                if (this.eof()) {
                    return null;
                }
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
                this.skipOWS();
                // RFC 8941 §3.2: A trailing comma does not produce a member.
                if (this.eof()) {
                    return null;
                }
                continue;
            }
            return null;
        }

        return dict;
    }

    private parseParameters(allowLeadingOWS: boolean = true): Record<string, SfBareItem> | null {
        const params: Record<string, SfBareItem> = {};
        let hasParams = false;

        while (true) {
            if (allowLeadingOWS) {
                this.skipOWS();
            }
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
            hasParams = true;
        }

        return hasParams ? params : null;
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
        // RFC 9651 §4.2.3.1: Display String bare item starts with '%'.
        if (char === '%') {
            return this.parseDisplayString();
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
        const intValue = this.parseInteger();
        if (intValue === null) {
            return null;
        }
        return new SfDate(intValue);
    }

    // RFC 9651 §4.2.10: Display String bare item.
    private parseDisplayString(): SfDisplayString | null {
        if (this.consume() !== '%' || this.consume() !== '"') {
            return null;
        }

        const bytes: number[] = [];
        while (!this.eof()) {
            const char = this.consume();
            const code = char.charCodeAt(0);

            if (code < 0x20 || code > 0x7E) {
                return null;
            }

            if (char === '%') {
                const octetHex = this.input.slice(this.index, this.index + 2);
                if (octetHex.length < 2 || !LOWER_HEX_RE.test(octetHex)) {
                    return null;
                }
                this.index += 2;
                bytes.push(Number.parseInt(octetHex, 16));
                continue;
            }

            if (char === '"') {
                try {
                    return new SfDisplayString(UTF8_DECODER.decode(new Uint8Array(bytes)));
                } catch {
                    return null;
                }
            }

            bytes.push(code);
        }

        return null;
    }

    private parseInteger(): number | null {
        INTEGER_RE.lastIndex = this.index;
        const match = INTEGER_RE.exec(this.input);
        if (!match) {
            return null;
        }

        const raw = match[0];
        const integerPart = raw.startsWith('-') ? raw.slice(1) : raw;
        if (integerPart.length === 0 || integerPart.length > 15) {
            return null;
        }

        this.index = INTEGER_RE.lastIndex;
        const value = Number(raw);
        if (!Number.isInteger(value)) {
            return null;
        }

        return value;
    }

    private parseKey(): string | null {
        const first = this.peek();
        const firstCode = first.charCodeAt(0);
        const isValidFirst = first === '*' || (firstCode >= 0x61 && firstCode <= 0x7A);
        if (!isValidFirst) {
            return null;
        }

        const start = this.index;
        this.consume();

        while (!this.eof()) {
            const char = this.peek();
            if (!isKeyChar(char)) {
                break;
            }
            this.consume();
        }

        return this.input.slice(start, this.index);
    }

    // RFC 8941 §3.3.3: String bare item.
    private parseString(): string | null {
        if (this.consume() !== '"') {
            return null;
        }

        const chars: string[] = [];
        while (!this.eof()) {
            const char = this.consume();
            if (char === '"') {
                return chars.join('');
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
                chars.push(escapedChar);
            } else {
                // RFC 8941 §3.3.3: Validate unescaped chars are printable ASCII (excluding " and \).
                const code = char.charCodeAt(0);
                if (code < 0x20 || code > 0x7E || code === 0x22 || code === 0x5C) {
                    return null;
                }
                chars.push(char);
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
        const start = this.index;
        while (!this.eof()) {
            const char = this.consume();
            if (char === ':') {
                try {
                    const base64 = this.input.slice(start, this.index - 1);
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
        }

        return null;
    }

    // RFC 8941 §3.3.1: Numeric bare item.
    private parseNumber(): number | null {
        NUMBER_RE.lastIndex = this.index;
        const match = NUMBER_RE.exec(this.input);
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

        this.index = NUMBER_RE.lastIndex;
        const value = Number(match[0]);
        if (!Number.isFinite(value)) {
            return null;
        }
        return value;
    }

    // RFC 8941 §3.3.4: Token parsing.
    private parseToken(): SfToken | null {
        const first = this.peek();
        const firstCode = first.charCodeAt(0);
        const isAlpha = (firstCode >= 0x41 && firstCode <= 0x5A) || (firstCode >= 0x61 && firstCode <= 0x7A);
        if (!(isAlpha || first === '*')) {
            return null;
        }

        const start = this.index;
        this.consume();

        while (!this.eof()) {
            const char = this.peek();
            // RFC 8941 §3.3.4: tchar plus ":" and "/"
            if (!isTokenChar(char)) {
                break;
            }
            this.consume();
        }

        const token = this.input.slice(start, this.index);
        return new SfToken(token);
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

        // RFC 8941 §4.1.5: Decimal range check.
        if (value < -999_999_999_999.999 || value > 999_999_999_999.999) {
            throw new Error('Decimal out of range for structured field');
        }

        let encoded = value.toFixed(3);
        encoded = encoded.replace(/0+$/, '');
        if (encoded.endsWith('.')) {
            encoded += '0';
        }

        const [wholePart] = encoded.startsWith('-') ? encoded.slice(1).split('.') : encoded.split('.');
        if (!wholePart || wholePart.length > 12) {
            throw new Error('Decimal out of range for structured field');
        }

        return encoded;
    }

    if (value instanceof Uint8Array) {
        const base64 = Buffer.from(value).toString('base64');
        return `:${base64}:`;
    }

    if (value instanceof SfToken) {
        return value.value;
    }

    // RFC 9651 §4.1.11: Display String serialization.
    if (value instanceof SfDisplayString) {
        if (hasLoneSurrogate(value.value)) {
            throw new Error('Invalid display string value for structured field');
        }

        const bytes = encodeUtf8(value.value);
        let encoded = '%"';
        for (const byte of bytes) {
            if (byte === 0x25 || byte === 0x22 || byte < 0x20 || byte > 0x7E) {
                encoded += `%${byte.toString(16).padStart(2, '0')}`;
            } else {
                encoded += String.fromCharCode(byte);
            }
        }
        return `${encoded}"`;
    }

    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code < 0x20 || code > 0x7E) {
            throw new Error('Invalid string character for structured field');
        }
    }

    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function serializeParams(params?: Record<string, SfBareItem>): string {
    if (!params) {
        return '';
    }

    let serialized = '';
    for (const key in params) {
        if (!Object.prototype.hasOwnProperty.call(params, key)) {
            continue;
        }
        const value = params[key]!;
        if (value === true) {
            serialized += `;${key}`;
        } else {
            serialized += `;${key}=${serializeBareItem(value)}`;
        }
    }

    return serialized;
}

function serializeItem(item: SfItem): string {
    const base = serializeBareItem(item.value);
    return base + serializeParams(item.params);
}

function serializeInnerList(list: SfInnerList): string {
    let items = '';
    for (let index = 0; index < list.items.length; index++) {
        if (index > 0) {
            items += ' ';
        }
        items += serializeItem(list.items[index]!);
    }

    return `(${items})${serializeParams(list.params)}`;
}

/**
 * Serialize a Structured Field List.
 */
// RFC 8941 §4: Structured Field List serialization.
export function serializeSfList(list: SfList): string {
    let serialized = '';
    for (let index = 0; index < list.length; index++) {
        if (index > 0) {
            serialized += ', ';
        }

        const member = list[index]!;
        if ('items' in member) {
            serialized += serializeInnerList(member);
        } else {
            serialized += serializeItem(member);
        }
    }

    return serialized;
}

/**
 * Serialize a Structured Field Dictionary.
 */
// RFC 8941 §4: Structured Field Dictionary serialization.
export function serializeSfDict(dict: SfDictionary): string {
    let serialized = '';
    let first = true;

    for (const key in dict) {
        if (!Object.prototype.hasOwnProperty.call(dict, key)) {
            continue;
        }
        const value = dict[key]!;

        if (!first) {
            serialized += ', ';
        } else {
            first = false;
        }

        if ('items' in value) {
            serialized += `${key}=${serializeInnerList(value)}`;
            continue;
        }

        const item = value as SfItem;
        if (item.value === true) {
            serialized += key + serializeParams(item.params);
            continue;
        }

        serialized += `${key}=${serializeItem(item)}`;
    }

    return serialized;
}

/**
 * Serialize a Structured Field Item.
 */
// RFC 8941 §4: Structured Field Item serialization.
export function serializeSfItem(item: SfItem): string {
    return serializeItem(item);
}
