/**
 * HTTP Message Signatures per RFC 9421.
 * RFC 9421 §2-3.
 * @see https://www.rfc-editor.org/rfc/rfc9421.html
 *
 * This module provides primitives for creating signature bases and parsing/formatting
 * Signature-Input and Signature fields. Actual cryptographic signing/verification
 * is out of scope - this provides the HTTP-layer primitives.
 */

import { Buffer } from 'node:buffer';
import { parseSfDict, serializeSfDict } from './structured-fields.js';
import type {
    SignatureComponent,
    SignatureComponentParams,
    SignatureParams,
    SignatureInput,
    Signature,
    SignatureMessageContext,
    SignatureBaseResult,
    DerivedComponentName,
    SfInnerList,
    SfItem,
    SfBareItem,
} from './types.js';

/**
 * Derived component names per RFC 9421 §2.2.
 * These are special component identifiers that start with '@'.
 */
export const DERIVED_COMPONENTS: readonly DerivedComponentName[] = [
    '@method',
    '@target-uri',
    '@authority',
    '@scheme',
    '@request-target',
    '@path',
    '@query',
    '@query-param',
    '@status',
] as const;

const UTF8_ENCODER = new TextEncoder();

/**
 * Check if a component name is a derived component.
 * RFC 9421 §2.2.
 */
export function isDerivedComponent(name: string): name is DerivedComponentName {
    return (DERIVED_COMPONENTS as readonly string[]).includes(name);
}

/**
 * Parse a Signature-Input field value.
 * RFC 9421 §4.1.
 *
 * The Signature-Input field is a Dictionary Structured Field containing the
 * metadata for one or more message signatures.
 *
 * @param value - The Signature-Input header field value
 * @returns Array of parsed SignatureInput objects, or null if parsing fails
 *
 * @example
 * ```ts
 * const inputs = parseSignatureInput(
 *     'sig1=("@method" "@authority" "content-type");created=1618884473;keyid="test-key"'
 * );
 * // Returns: [{ label: 'sig1', components: [...], params: { created: 1618884473, keyid: 'test-key' } }]
 * ```
 */
export function parseSignatureInput(value: string): SignatureInput[] | null {
    const dict = parseSfDict(value);
    if (!dict) {
        return null;
    }

    const results: SignatureInput[] = [];

    for (const [label, entry] of Object.entries(dict)) {
        // Each entry MUST be an inner list
        if (!('items' in entry)) {
            return null;
        }

        const innerList = entry as SfInnerList;
        const components: SignatureComponent[] = [];

        // Parse component identifiers from inner list items
        for (const item of innerList.items) {
            // Each item MUST be a string (component identifier)
            if (typeof item.value !== 'string') {
                return null;
            }

            const component = parseComponentIdentifierFromItem(item);
            if (!component) {
                return null;
            }
            components.push(component);
        }

        // Parse signature parameters from inner list params
        const params = parseSignatureParamsFromSf(innerList.params);
        if (params === null) {
            return null;
        }

        results.push({ label, components, params });
    }

    return results;
}

/**
 * Parse a component identifier from a structured field item.
 * RFC 9421 §2.
 */
function parseComponentIdentifierFromItem(item: SfItem): SignatureComponent | null {
    if (typeof item.value !== 'string') {
        return null;
    }

    const name: string = item.value;
    const params: SignatureComponentParams = {};

    if (item.params) {
        if (item.params.sf === true) {
            params.sf = true;
        }
        if (typeof item.params.key === 'string') {
            params.key = item.params.key;
        }
        if (item.params.bs === true) {
            params.bs = true;
        }
        if (item.params.req === true) {
            params.req = true;
        }
        if (item.params.tr === true) {
            params.tr = true;
        }
    }

    return Object.keys(params).length > 0 ? { name, params } : { name };
}

/**
 * Parse signature parameters from structured field params.
 * RFC 9421 §2.3.
 */
function parseSignatureParamsFromSf(
    sfParams?: Record<string, SfBareItem>
): SignatureParams | undefined | null {
    if (!sfParams) {
        return undefined;
    }

    const params: SignatureParams = {};

    if (sfParams.created !== undefined) {
        if (typeof sfParams.created !== 'number' || !Number.isInteger(sfParams.created)) {
            return null;
        }
        params.created = sfParams.created;
    }
    if (sfParams.expires !== undefined) {
        if (typeof sfParams.expires !== 'number' || !Number.isInteger(sfParams.expires)) {
            return null;
        }
        params.expires = sfParams.expires;
    }
    if (typeof sfParams.nonce === 'string') {
        params.nonce = sfParams.nonce;
    }
    if (typeof sfParams.alg === 'string') {
        params.alg = sfParams.alg;
    }
    if (typeof sfParams.keyid === 'string') {
        params.keyid = sfParams.keyid;
    }
    if (typeof sfParams.tag === 'string') {
        params.tag = sfParams.tag;
    }

    return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * Format SignatureInput objects to a Signature-Input field value.
 * RFC 9421 §4.1.
 *
 * @param inputs - Array of SignatureInput objects to format
 * @returns The formatted Signature-Input header field value
 *
 * @example
 * ```ts
 * const value = formatSignatureInput([{
 *     label: 'sig1',
 *     components: [{ name: '@method' }, { name: 'content-type' }],
 *     params: { created: 1618884473, keyid: 'test-key' }
 * }]);
 * // Returns: 'sig1=("@method" "content-type");created=1618884473;keyid="test-key"'
 * ```
 */
export function formatSignatureInput(inputs: SignatureInput[]): string {
    const dict: Record<string, SfInnerList> = {};

    for (const input of inputs) {
        const items: SfItem[] = input.components.map(component => {
            const item: SfItem = { value: component.name };
            if (component.params) {
                const params: Record<string, SfBareItem> = {};
                if (component.params.sf) {
                    params.sf = true;
                }
                if (component.params.key !== undefined) {
                    params.key = component.params.key;
                }
                if (component.params.bs) {
                    params.bs = true;
                }
                if (component.params.req) {
                    params.req = true;
                }
                if (component.params.tr) {
                    params.tr = true;
                }
                if (Object.keys(params).length > 0) {
                    item.params = params;
                }
            }
            return item;
        });

        const innerList: SfInnerList = { items };

        if (input.params) {
            const params: Record<string, SfBareItem> = {};
            if (input.params.created !== undefined) {
                if (!Number.isInteger(input.params.created)) {
                    throw new Error('Signature parameter "created" must be an integer');
                }
                params.created = input.params.created;
            }
            if (input.params.expires !== undefined) {
                if (!Number.isInteger(input.params.expires)) {
                    throw new Error('Signature parameter "expires" must be an integer');
                }
                params.expires = input.params.expires;
            }
            if (input.params.nonce !== undefined) {
                params.nonce = input.params.nonce;
            }
            if (input.params.alg !== undefined) {
                params.alg = input.params.alg;
            }
            if (input.params.keyid !== undefined) {
                params.keyid = input.params.keyid;
            }
            if (input.params.tag !== undefined) {
                params.tag = input.params.tag;
            }
            if (Object.keys(params).length > 0) {
                innerList.params = params;
            }
        }

        dict[input.label] = innerList;
    }

    return serializeSfDict(dict);
}

/**
 * Parse a Signature field value.
 * RFC 9421 §4.2.
 *
 * The Signature field is a Dictionary Structured Field containing signature
 * values as byte sequences.
 *
 * @param value - The Signature header field value
 * @returns Array of parsed Signature objects, or null if parsing fails
 *
 * @example
 * ```ts
 * const sigs = parseSignature('sig1=:YmFzZTY0ZW5jb2RlZHNpZw==:');
 * // Returns: [{ label: 'sig1', value: Uint8Array([...]) }]
 * ```
 */
export function parseSignature(value: string): Signature[] | null {
    const dict = parseSfDict(value);
    if (!dict) {
        return null;
    }

    const results: Signature[] = [];

    for (const [label, entry] of Object.entries(dict)) {
        // Each entry MUST be a byte sequence (item)
        if ('items' in entry) {
            return null;
        }

        const item = entry as SfItem;
        if (!(item.value instanceof Uint8Array)) {
            return null;
        }

        results.push({ label, value: item.value });
    }

    return results;
}

/**
 * Format Signature objects to a Signature field value.
 * RFC 9421 §4.2.
 *
 * @param signatures - Array of Signature objects to format
 * @returns The formatted Signature header field value
 *
 * @example
 * ```ts
 * const value = formatSignature([{
 *     label: 'sig1',
 *     value: new Uint8Array([98, 97, 115, 101, 54, 52])
 * }]);
 * // Returns: 'sig1=:YmFzZTY0:' (base64 encoded)
 * ```
 */
export function formatSignature(signatures: Signature[]): string {
    const dict: Record<string, SfItem> = {};

    for (const sig of signatures) {
        dict[sig.label] = { value: sig.value };
    }

    return serializeSfDict(dict);
}

/**
 * Parse a component identifier string.
 * RFC 9421 §2.
 *
 * Component identifiers are strings that identify HTTP message components
 * to be included in the signature base.
 *
 * @param value - The component identifier string (e.g., '"content-type"' or '"cache-control";sf')
 * @returns Parsed SignatureComponent, or null if parsing fails
 *
 * @example
 * ```ts
 * const component = parseComponentIdentifier('"content-type"');
 * // Returns: { name: 'content-type' }
 *
 * const componentWithParams = parseComponentIdentifier('"example-dict";key="member"');
 * // Returns: { name: 'example-dict', params: { key: 'member' } }
 * ```
 */
export function parseComponentIdentifier(value: string): SignatureComponent | null {
    // A component identifier is represented as a string item with optional parameters
    // Format: "name" or "name";param1;param2=value
    const trimmed = value.trim();

    // Must start with a quote
    if (!trimmed.startsWith('"')) {
        return null;
    }

    // Find the end of the quoted string
    let i = 1;
    let name = '';
    while (i < trimmed.length) {
        const char = trimmed[i];
        if (char === '"') {
            i++;
            break;
        }
        if (char === '\\' && i + 1 < trimmed.length) {
            // Escape sequence
            i++;
            name += trimmed[i];
        } else {
            name += char;
        }
        i++;
    }

    if (i === trimmed.length && trimmed[i - 1] !== '"') {
        return null; // Unterminated string
    }

    const params: SignatureComponentParams = {};

    // Parse parameters after the quoted string
    while (i < trimmed.length) {
        // Skip whitespace
        while (i < trimmed.length && (trimmed[i] === ' ' || trimmed[i] === '\t')) {
            i++;
        }

        if (i >= trimmed.length) {
            break;
        }

        // Expect semicolon
        if (trimmed[i] !== ';') {
            return null;
        }
        i++;

        // Skip whitespace
        while (i < trimmed.length && (trimmed[i] === ' ' || trimmed[i] === '\t')) {
            i++;
        }

        // Parse parameter name
        let paramName = '';
        while (i < trimmed.length) {
            const ch = trimmed[i];
            if (ch === undefined || !/[a-z0-9_\-\.\*]/.test(ch)) {
                break;
            }
            paramName += ch;
            i++;
        }

        if (!paramName) {
            return null;
        }

        // Check for parameter value
        // Skip whitespace
        while (i < trimmed.length && (trimmed[i] === ' ' || trimmed[i] === '\t')) {
            i++;
        }

        if (i < trimmed.length && trimmed[i] === '=') {
            i++;
            // Skip whitespace
            while (i < trimmed.length && (trimmed[i] === ' ' || trimmed[i] === '\t')) {
                i++;
            }

            // Parse parameter value (quoted string or token)
            if (trimmed[i] === '"') {
                i++;
                let paramValue = '';
                while (i < trimmed.length && trimmed[i] !== '"') {
                    if (trimmed[i] === '\\' && i + 1 < trimmed.length) {
                        i++;
                        paramValue += trimmed[i];
                    } else {
                        paramValue += trimmed[i];
                    }
                    i++;
                }
                if (trimmed[i] !== '"') {
                    return null;
                }
                i++;

                if (paramName === 'key') {
                    params.key = paramValue;
                }
            } else {
                // Token value
                let paramValue = '';
                while (i < trimmed.length) {
                    const ch = trimmed[i];
                    if (ch === undefined || !/[A-Za-z0-9!#$%&'*+\-.^_`|~:\/]/.test(ch)) {
                        break;
                    }
                    paramValue += ch;
                    i++;
                }
                if (paramName === 'key') {
                    params.key = paramValue;
                }
            }
        } else {
            // Boolean parameter
            if (paramName === 'sf') {
                params.sf = true;
            } else if (paramName === 'bs') {
                params.bs = true;
            } else if (paramName === 'req') {
                params.req = true;
            } else if (paramName === 'tr') {
                params.tr = true;
            }
        }
    }

    return Object.keys(params).length > 0 ? { name, params } : { name };
}

/**
 * Format a component identifier to string.
 * RFC 9421 §2.
 *
 * @param component - The SignatureComponent to format
 * @returns The formatted component identifier string
 *
 * @example
 * ```ts
 * formatComponentIdentifier({ name: 'content-type' });
 * // Returns: '"content-type"'
 *
 * formatComponentIdentifier({ name: 'example-dict', params: { key: 'member' } });
 * // Returns: '"example-dict";key="member"'
 * ```
 */
export function formatComponentIdentifier(component: SignatureComponent): string {
    // Escape special characters in name
    const escapedName = component.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    let result = `"${escapedName}"`;

    if (component.params) {
        if (component.params.sf) {
            result += ';sf';
        }
        if (component.params.key !== undefined) {
            const escapedKey = component.params.key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            result += `;key="${escapedKey}"`;
        }
        if (component.params.bs) {
            result += ';bs';
        }
        if (component.params.req) {
            result += ';req';
        }
        if (component.params.tr) {
            result += ';tr';
        }
    }

    return result;
}

/**
 * Canonicalize field values per RFC 9421 §2.1.
 *
 * Multiple field values are combined with ", " (comma + space).
 * Leading/trailing whitespace is trimmed from each value.
 * Obsolete line folding is replaced with a single space.
 *
 * @param values - Array of field values
 * @returns The canonicalized field value
 *
 * @example
 * ```ts
 * canonicalizeFieldValue(['  value1  ', '  value2  ']);
 * // Returns: 'value1, value2'
 * ```
 */
export function canonicalizeFieldValue(values: string[]): string {
    return values
        .map(v => {
            // RFC 9421 §2.1: Replace obsolete line folding (CRLF + WSP) with single space
            const unfolded = v.replace(/\r?\n[ \t]+/g, ' ');
            // Trim leading and trailing whitespace
            return unfolded.trim();
        })
        .join(', ');
}

/**
 * Binary-wrap field values per RFC 9421 §2.1.4.
 *
 * Each field value is base64-encoded individually, and the results are
 * combined with ", " (comma + space) and then re-encoded as a byte sequence.
 *
 * @param values - Array of field values
 * @returns The binary-wrapped field value as a byte sequence
 *
 * @example
 * ```ts
 * binaryWrapFieldValues(['value1', 'value2']);
 * // Returns base64 of each value concatenated
 * ```
 */
export function binaryWrapFieldValues(values: string[]): Uint8Array {
    // RFC 9421 §2.1.4: For binary-wrapped fields, each field line value is
    // base64-encoded and the results are concatenated with ":"
    const encoded: string[] = [];
    for (const value of values) {
        encoded.push(`:${Buffer.from(value.trim(), 'utf8').toString('base64')}:`);
    }

    // Join with ", " and return as bytes
    return UTF8_ENCODER.encode(encoded.join(', '));
}

/**
 * Derive a component value from a message context.
 * RFC 9421 §2.
 *
 * @param message - The message context
 * @param component - The component to derive
 * @returns The derived value, or null if the component cannot be derived
 */
export function deriveComponentValue(
    message: SignatureMessageContext,
    component: SignatureComponent
): string | null {
    const name = component.name.toLowerCase();

    // RFC 9421 §2.1: Field names MUST be lowercased
    // RFC 9421 §2.2: Derived components start with '@'
    if (isDerivedComponent(name)) {
        return deriveDerivedComponentValue(message, component);
    }

    // Regular header field
    return deriveFieldValue(message, component);
}

/**
 * Derive a derived component value.
 * RFC 9421 §2.2.
 */
function deriveDerivedComponentValue(
    message: SignatureMessageContext,
    component: SignatureComponent
): string | null {
    const name = component.name as DerivedComponentName;

    // RFC 9421 §2.2.9: If req parameter is set, derive from request context
    const ctx = component.params?.req ? message.request : message;
    if (component.params?.req && !message.request) {
        return null;
    }

    switch (name) {
        case '@method':
            // RFC 9421 §2.2.1: Method MUST be uppercase
            return ctx?.method?.toUpperCase() ?? null;

        case '@target-uri':
            // RFC 9421 §2.2.2: Full target URI
            return ctx?.targetUri ?? null;

        case '@authority':
            // RFC 9421 §2.2.3: Host + optional port
            return ctx?.authority ?? null;

        case '@scheme':
            // RFC 9421 §2.2.4: Scheme (lowercase)
            return ctx?.scheme?.toLowerCase() ?? null;

        case '@request-target':
            // RFC 9421 §2.2.5: Request target (path + query, HTTP/1.1 style)
            if (ctx?.path === undefined) {
                return null;
            }
            return ctx.query ? `${ctx.path}?${ctx.query.slice(1)}` : ctx.path;

        case '@path':
            // RFC 9421 §2.2.6: Absolute path (normalized)
            return ctx?.path ?? null;

        case '@query':
            // RFC 9421 §2.2.7: Query string with leading '?', or '?' if empty
            if (ctx?.query === undefined) {
                return null;
            }
            // Query should include leading '?'
            return ctx.query.startsWith('?') ? ctx.query : `?${ctx.query}`;

        case '@query-param':
            // RFC 9421 §2.2.8: Individual query parameter
            return deriveQueryParam(ctx, component);

        case '@status':
            // RFC 9421 §2.2.10: Status code (3 digits, response only)
            if (message.status === undefined) {
                return null;
            }
            return String(message.status).padStart(3, '0');

        default:
            return null;
    }
}

/**
 * Derive a query parameter value.
 * RFC 9421 §2.2.8.
 */
function deriveQueryParam(
    ctx: SignatureMessageContext | undefined,
    component: SignatureComponent
): string | null {
    if (!ctx?.query || !component.params?.key) {
        return null;
    }

    // Parse query string
    const query = ctx.query.startsWith('?') ? ctx.query.slice(1) : ctx.query;
    const params = new URLSearchParams(query);
    const value = params.get(component.params.key);

    return value;
}

/**
 * Derive a field value from headers.
 * RFC 9421 §2.1.
 */
function deriveFieldValue(
    message: SignatureMessageContext,
    component: SignatureComponent
): string | null {
    const name = component.name.toLowerCase();

    // RFC 9421 §2.2.9: If req parameter is set, derive from request context
    const ctx = component.params?.req ? message.request : message;
    if (component.params?.req && !message.request) {
        return null;
    }

    // RFC 9421 §2.1.3: If tr parameter is set, derive from trailers
    const headers = component.params?.tr ? ctx?.trailers : ctx?.headers;
    if (!headers) {
        return null;
    }

    const values = headers.get(name);
    if (!values || values.length === 0) {
        return null;
    }

    // RFC 9421 §2.1.4: Binary-wrapped fields
    if (component.params?.bs) {
        const wrapped = binaryWrapFieldValues(values);
        return `:${Buffer.from(wrapped).toString('base64')}:`;
    }

    // RFC 9421 §2.1: Canonicalize field value
    return canonicalizeFieldValue(values);
}

/**
 * Create the signature base string.
 * RFC 9421 §2.5.
 *
 * The signature base is the string that will be signed. It contains one line
 * per covered component, plus the signature parameters line at the end.
 *
 * @param message - The message context
 * @param components - The components to include in the signature
 * @param params - The signature parameters
 * @returns The signature base and formatted signature-params, or null if creation fails
 *
 * @example
 * ```ts
 * const result = createSignatureBase(
 *     {
 *         method: 'POST',
 *         authority: 'example.com',
 *         headers: new Map([['content-type', ['application/json']]])
 *     },
 *     [{ name: '@method' }, { name: '@authority' }, { name: 'content-type' }],
 *     { created: 1618884473, keyid: 'test-key' }
 * );
 * // Returns:
 * // {
 * //     base: '"@method": POST\n"@authority": example.com\n"content-type": application/json\n"@signature-params": ("@method" "@authority" "content-type");created=1618884473;keyid="test-key"',
 * //     signatureParams: '("@method" "@authority" "content-type");created=1618884473;keyid="test-key"'
 * // }
 * ```
 */
export function createSignatureBase(
    message: SignatureMessageContext,
    components: SignatureComponent[],
    params?: SignatureParams
): SignatureBaseResult | null {
    const lines: string[] = [];

    // RFC 9421 §2.5: Each component identifier MUST occur only once
    const seen = new Set<string>();

    for (const component of components) {
        const identifier = formatComponentIdentifier(component);

        if (seen.has(identifier)) {
            return null; // Duplicate component
        }
        seen.add(identifier);

        const value = deriveComponentValue(message, component);
        if (value === null) {
            return null; // Required component missing
        }

        // RFC 9421 §2.5: Component values MUST NOT contain newline characters
        if (value.includes('\n') || value.includes('\r')) {
            return null;
        }

        // RFC 9421 §2.5: Each line is "identifier": value
        lines.push(`${identifier}: ${value}`);
    }

    // RFC 9421 §3.1: Build @signature-params as the final line
    const signatureParams = buildSignatureParamsValue(components, params);
    if (signatureParams === null) {
        return null;
    }
    lines.push(`"@signature-params": ${signatureParams}`);

    // RFC 9421 §2.5: Lines separated by single LF (no trailing LF)
    const base = lines.join('\n');

    return { base, signatureParams };
}

/**
 * Build the @signature-params value.
 * RFC 9421 §2.3.
 */
function buildSignatureParamsValue(
    components: SignatureComponent[],
    params?: SignatureParams
): string | null {
    // Build the inner list representation
    const items: string[] = components.map(formatComponentIdentifier);
    let result = `(${items.join(' ')})`;

    // Add parameters in the defined order
    if (params) {
        if (params.created !== undefined) {
            if (!Number.isInteger(params.created)) {
                return null;
            }
            result += `;created=${params.created}`;
        }
        if (params.expires !== undefined) {
            if (!Number.isInteger(params.expires)) {
                return null;
            }
            result += `;expires=${params.expires}`;
        }
        if (params.nonce !== undefined) {
            const escapedNonce = params.nonce.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            result += `;nonce="${escapedNonce}"`;
        }
        if (params.alg !== undefined) {
            const escapedAlg = params.alg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            result += `;alg="${escapedAlg}"`;
        }
        if (params.keyid !== undefined) {
            const escapedKeyid = params.keyid.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            result += `;keyid="${escapedKeyid}"`;
        }
        if (params.tag !== undefined) {
            const escapedTag = params.tag.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            result += `;tag="${escapedTag}"`;
        }
    }

    return result;
}
