/**
 * URI Template expansion per RFC 6570.
 * RFC 6570 §1.2-§1.6, §2, §3.
 * @see https://www.rfc-editor.org/rfc/rfc6570.html
 */

import type {
    UriTemplateValue,
    UriTemplateVariables,
    UriTemplateOperator,
    UriTemplateVarSpec,
    UriTemplateExpression,
    UriTemplatePart,
    UriTemplate,
    CompiledUriTemplate,
} from './types.js';

// Re-export types for convenience
export type {
    UriTemplateValue,
    UriTemplateVariables,
    UriTemplateOperator,
    UriTemplateVarSpec,
    UriTemplateExpression,
    UriTemplatePart,
    UriTemplate,
    CompiledUriTemplate,
};

// =============================================================================
// Operator configuration table
// =============================================================================

// RFC 6570 §3.2.2-§3.2.9: Operator rules table
interface OperatorConfig {
    prefix: string;
    separator: string;
    named: boolean;
    ifEmpty: string;
    allowReserved: boolean;
}

const OPERATOR_CONFIG: Record<UriTemplateOperator, OperatorConfig> = {
    '': { prefix: '', separator: ',', named: false, ifEmpty: '', allowReserved: false },
    '+': { prefix: '', separator: ',', named: false, ifEmpty: '', allowReserved: true },
    '#': { prefix: '#', separator: ',', named: false, ifEmpty: '', allowReserved: true },
    '.': { prefix: '.', separator: '.', named: false, ifEmpty: '', allowReserved: false },
    '/': { prefix: '/', separator: '/', named: false, ifEmpty: '', allowReserved: false },
    ';': { prefix: ';', separator: ';', named: true, ifEmpty: '', allowReserved: false },
    '?': { prefix: '?', separator: '&', named: true, ifEmpty: '=', allowReserved: false },
    '&': { prefix: '&', separator: '&', named: true, ifEmpty: '=', allowReserved: false },
};

// RFC 3986 §2.3: Unreserved characters
const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

// RFC 3986 §2.2: Reserved characters
const RESERVED = ':/?#[]@!$&\'()*+,;=';

// =============================================================================
// Character validation (RFC 6570 §2.3)
// =============================================================================

/**
 * Check if character is valid for variable names (varchar).
 * RFC 6570 §2.3: varchar = ALPHA / DIGIT / "_" / pct-encoded
 */
function isVarChar(char: string): boolean {
    const code = char.charCodeAt(0);
    // ALPHA
    if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
        return true;
    }
    // DIGIT
    if (code >= 0x30 && code <= 0x39) {
        return true;
    }
    // "_"
    if (char === '_') {
        return true;
    }
    return false;
}

/**
 * Check if a string is a valid operator.
 */
function isOperator(char: string): char is UriTemplateOperator {
    return char === '+' || char === '#' || char === '.' ||
           char === '/' || char === ';' || char === '?' || char === '&';
}

// =============================================================================
// Percent-encoding (RFC 6570 §1.6, §3.2.1)
// =============================================================================

/**
 * Percent-encode a string for URI Template expansion.
 * RFC 6570 §1.6: Non-ASCII MUST be encoded as UTF-8 before percent-encoding.
 *
 * @param str - String to encode
 * @param allowReserved - Whether to preserve reserved characters
 * @returns Percent-encoded string
 */
function encodeValue(str: string, allowReserved: boolean): string {
    const result: string[] = [];
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);

    for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i]!;

        if (byte < 128) {
            const char = String.fromCharCode(byte);

            // Always allow unreserved
            if (UNRESERVED.includes(char)) {
                result.push(char);
                continue;
            }

            // Allow reserved if operator permits
            if (allowReserved && RESERVED.includes(char)) {
                result.push(char);
                continue;
            }

            // Allow already percent-encoded sequences if allowReserved
            if (allowReserved && char === '%' && i + 2 < bytes.length) {
                const hex1 = String.fromCharCode(bytes[i + 1]!);
                const hex2 = String.fromCharCode(bytes[i + 2]!);
                if (isHexDigit(hex1) && isHexDigit(hex2)) {
                    result.push('%', hex1.toUpperCase(), hex2.toUpperCase());
                    i += 2;
                    continue;
                }
            }
        }

        // Percent-encode the byte with uppercase hex
        result.push('%', byte.toString(16).toUpperCase().padStart(2, '0'));
    }

    return result.join('');
}

function isHexDigit(char: string): boolean {
    return /^[0-9A-Fa-f]$/.test(char);
}

// =============================================================================
// Template parsing (RFC 6570 §2)
// =============================================================================

/**
 * Parse a variable specification (varname with optional modifiers).
 * RFC 6570 §2.3, §2.4.
 *
 * @param spec - Variable specification string
 * @returns Parsed varspec or null if invalid
 */
function parseVarSpec(spec: string): UriTemplateVarSpec | null {
    if (!spec) {
        return null;
    }

    let name = spec;
    let prefix: number | undefined;
    let explode = false;

    // RFC 6570 §2.4.2: Check for explode modifier
    if (name.endsWith('*')) {
        explode = true;
        name = name.slice(0, -1);
    }

    // RFC 6570 §2.4.1: Check for prefix modifier
    const colonIndex = name.indexOf(':');
    if (colonIndex !== -1) {
        const prefixStr = name.slice(colonIndex + 1);
        name = name.slice(0, colonIndex);

        // RFC 6570 §2.4.1: max-length = %x31-39 0*3DIGIT (1-9999)
        if (!/^[1-9]\d{0,3}$/.test(prefixStr)) {
            return null;
        }
        prefix = parseInt(prefixStr, 10);

        // Cannot have both prefix and explode
        if (explode) {
            return null;
        }
    }

    // RFC 6570 §2.3: Validate variable name
    // varname = varchar *( ["."] varchar )
    if (!isValidVarName(name)) {
        return null;
    }

    return { name, prefix, explode };
}

/**
 * Validate a variable name per RFC 6570 §2.3.
 * varname = varchar *( ["."] varchar )
 * varchar = ALPHA / DIGIT / "_" / pct-encoded
 */
function isValidVarName(name: string): boolean {
    if (!name) {
        return false;
    }

    let i = 0;
    let expectVarChar = true;

    while (i < name.length) {
        const char = name[i]!;

        if (char === '%') {
            // pct-encoded
            if (i + 2 >= name.length) {
                return false;
            }
            if (!isHexDigit(name[i + 1]!) || !isHexDigit(name[i + 2]!)) {
                return false;
            }
            i += 3;
            expectVarChar = false;
        } else if (char === '.') {
            // "." can only appear between varchars
            if (expectVarChar) {
                return false;
            }
            // Cannot end with "."
            if (i === name.length - 1) {
                return false;
            }
            i++;
            expectVarChar = true;
        } else if (isVarChar(char)) {
            i++;
            expectVarChar = false;
        } else {
            return false;
        }
    }

    return !expectVarChar;
}

/**
 * Parse an expression (content between braces).
 * RFC 6570 §2.2.
 *
 * @param content - Expression content (without braces)
 * @returns Parsed expression or null if invalid
 */
function parseExpression(content: string): UriTemplateExpression | null {
    if (!content) {
        return null;
    }

    let operator: UriTemplateOperator = '';
    let variableList = content;

    // RFC 6570 §2.2: Check for operator
    const firstChar = content[0]!;
    if (isOperator(firstChar)) {
        operator = firstChar;
        variableList = content.slice(1);
    } else if (firstChar === '=' || firstChar === ',' || firstChar === '!' ||
               firstChar === '@' || firstChar === '|') {
        // RFC 6570 §2.2: Reserved operators - treat as invalid
        return null;
    }

    if (!variableList) {
        return null;
    }

    // Parse variable list
    const varSpecs = variableList.split(',');
    const variables: UriTemplateVarSpec[] = [];

    for (const spec of varSpecs) {
        const parsed = parseVarSpec(spec);
        if (!parsed) {
            return null;
        }
        variables.push(parsed);
    }

    if (variables.length === 0) {
        return null;
    }

    return { operator, variables };
}

/**
 * Parse a URI Template string.
 * RFC 6570 §2.
 *
 * @param template - URI Template string
 * @returns Parsed template or null if invalid
 */
export function parseUriTemplate(template: string): UriTemplate | null {
    const parts: UriTemplatePart[] = [];
    const variableNames = new Set<string>();
    let i = 0;
    let literalStart = 0;

    while (i < template.length) {
        if (template[i] === '{') {
            // Save any preceding literal
            if (i > literalStart) {
                parts.push(template.slice(literalStart, i));
            }

            // Find matching closing brace
            const closeIndex = template.indexOf('}', i + 1);
            if (closeIndex === -1) {
                // Unclosed expression
                return null;
            }

            // Parse expression
            const content = template.slice(i + 1, closeIndex);
            const expr = parseExpression(content);
            if (!expr) {
                return null;
            }

            parts.push(expr);

            // Collect variable names
            for (const varSpec of expr.variables) {
                variableNames.add(varSpec.name);
            }

            i = closeIndex + 1;
            literalStart = i;
        } else if (template[i] === '}') {
            // Unmatched closing brace
            return null;
        } else {
            i++;
        }
    }

    // Save any trailing literal
    if (i > literalStart) {
        parts.push(template.slice(literalStart, i));
    }

    return {
        parts,
        variables: Array.from(variableNames),
    };
}

// =============================================================================
// Template expansion (RFC 6570 §3)
// =============================================================================

/**
 * Expand a single variable value.
 * RFC 6570 §3.2.1.
 *
 * @param varSpec - Variable specification
 * @param value - Variable value
 * @param config - Operator configuration
 * @returns Expanded string or null if undefined
 */
function expandVariable(
    varSpec: UriTemplateVarSpec,
    value: UriTemplateValue,
    config: OperatorConfig
): string | null {
    // RFC 6570 §3.2.1: Undefined variables are ignored
    if (value === undefined || value === null) {
        return null;
    }

    const { name, prefix, explode } = varSpec;
    const { named, ifEmpty, allowReserved } = config;

    // String value
    if (typeof value === 'string') {
        let str = value;

        // RFC 6570 §2.4.1: Apply prefix modifier
        if (prefix !== undefined && prefix < str.length) {
            str = str.slice(0, prefix);
        }

        const encoded = encodeValue(str, allowReserved);

        if (named) {
            // RFC 6570 §3.2.7-3.2.9: Named expansion
            if (value === '') {
                return `${encodeValue(name, false)}${ifEmpty}`;
            }
            return `${encodeValue(name, false)}=${encoded}`;
        }

        return encoded;
    }

    // Array value
    if (Array.isArray(value)) {
        // RFC 6570 §2.3: Empty list is considered undefined
        if (value.length === 0) {
            return null;
        }

        if (explode) {
            // RFC 6570 §2.4.2: Explode array
            const parts = value.map(v => {
                const encoded = encodeValue(v, allowReserved);
                if (named) {
                    if (v === '') {
                        return `${encodeValue(name, false)}${ifEmpty}`;
                    }
                    return `${encodeValue(name, false)}=${encoded}`;
                }
                return encoded;
            });
            return parts.join(config.separator);
        } else {
            // Non-exploded: join with comma
            const encoded = value.map(v => encodeValue(v, allowReserved)).join(',');
            if (named) {
                return `${encodeValue(name, false)}=${encoded}`;
            }
            return encoded;
        }
    }

    // Associative array (object) value
    if (typeof value === 'object') {
        const entries = Object.entries(value);

        // RFC 6570 §2.3: Empty object or all undefined values is undefined
        if (entries.length === 0) {
            return null;
        }

        // RFC 6570 §2.4.1: Prefix on composite is undefined behavior
        // We ignore prefix for objects as per spec
        if (prefix !== undefined) {
            // Prefix modifier on composite - undefined behavior, ignore prefix
        }

        if (explode) {
            // RFC 6570 §2.4.2: Explode object as name=value pairs
            const parts = entries.map(([k, v]) => {
                const encodedKey = encodeValue(k, allowReserved);
                const encodedVal = encodeValue(v, allowReserved);
                return `${encodedKey}=${encodedVal}`;
            });
            return parts.join(config.separator);
        } else {
            // Non-exploded: key,value,key,value format
            const parts: string[] = [];
            for (const [k, v] of entries) {
                parts.push(encodeValue(k, allowReserved));
                parts.push(encodeValue(v, allowReserved));
            }
            const encoded = parts.join(',');
            if (named) {
                return `${encodeValue(name, false)}=${encoded}`;
            }
            return encoded;
        }
    }

    return null;
}

/**
 * Expand an expression.
 * RFC 6570 §3.2.
 *
 * @param expr - Parsed expression
 * @param variables - Variable values
 * @returns Expanded string
 */
function expandExpression(
    expr: UriTemplateExpression,
    variables: UriTemplateVariables
): string {
    const config = OPERATOR_CONFIG[expr.operator];
    const expanded: string[] = [];

    for (const varSpec of expr.variables) {
        const value = variables[varSpec.name];
        const result = expandVariable(varSpec, value, config);
        if (result !== null) {
            expanded.push(result);
        }
    }

    // RFC 6570 §3.2.1: If all undefined, return empty string
    if (expanded.length === 0) {
        return '';
    }

    // Apply prefix and join
    return config.prefix + expanded.join(config.separator);
}

/**
 * Expand a URI Template with the given variables.
 * RFC 6570 §3.
 *
 * @param template - URI Template string or parsed template
 * @param variables - Variable values
 * @returns Expanded URI string
 */
export function expandUriTemplate(
    template: string | UriTemplate,
    variables: UriTemplateVariables
): string {
    const parsed = typeof template === 'string' ? parseUriTemplate(template) : template;

    if (!parsed) {
        // Return original template if parsing fails
        return typeof template === 'string' ? template : '';
    }

    const result: string[] = [];

    for (const part of parsed.parts) {
        if (typeof part === 'string') {
            // RFC 6570 §3.1: Literal expansion
            // Literals are copied directly; non-URI characters should already be encoded
            result.push(part);
        } else {
            // Expression expansion
            result.push(expandExpression(part, variables));
        }
    }

    return result.join('');
}

// =============================================================================
// Utility functions
// =============================================================================

/**
 * Check if a string is a valid URI Template.
 * RFC 6570 §2.
 *
 * @param template - String to validate
 * @returns true if valid URI Template
 */
export function isValidUriTemplate(template: string): boolean {
    return parseUriTemplate(template) !== null;
}

/**
 * Get the variable names from a URI Template.
 * RFC 6570 §2.3.
 *
 * @param template - URI Template string or parsed template
 * @returns Array of variable names
 */
export function getTemplateVariables(template: string | UriTemplate): string[] {
    if (typeof template === 'string') {
        const parsed = parseUriTemplate(template);
        return parsed ? parsed.variables : [];
    }
    return template.variables;
}

/**
 * Compile a URI Template for efficient repeated expansion.
 *
 * @param template - URI Template string
 * @returns Compiled template with expand function and variables list, or null if invalid
 */
export function compileUriTemplate(template: string): CompiledUriTemplate | null {
    const parsed = parseUriTemplate(template);
    if (!parsed) {
        return null;
    }

    return {
        expand: (variables: UriTemplateVariables) => expandUriTemplate(parsed, variables),
        variables: parsed.variables,
    };
}
