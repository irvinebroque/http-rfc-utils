/**
 * Content Security Policy (CSP) subset utilities.
 * W3C CSP3 Section 2.2, Section 2.3.1, Section 3.1, Section 3.2, and Section 6.5.
 * @see https://www.w3.org/TR/CSP3/
 */

import { TOKEN_CHARS, assertNoCtl, isEmptyHeader, splitQuotedValue } from './header-utils.js';
import type {
    ContentSecurityPolicy,
    CspDirectiveName,
    CspSourceExpression,
} from './types.js';

const DIRECTIVE_NAME_REGEX = /^[A-Za-z0-9-]+$/;
const SCHEME_SOURCE_REGEX = /^[A-Za-z][A-Za-z0-9+.-]*:$/;
const NONCE_SOURCE_REGEX = /^'nonce-[A-Za-z0-9+/_-]+={0,2}'$/;
const HASH_SOURCE_REGEX = /^'(?:sha256|sha384|sha512)-[A-Za-z0-9+/_-]+={0,2}'$/i;
const HOST_SOURCE_REGEX =
    /^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/)?(?:\*|(?:\*\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.?)(?::(?:\*|[0-9]+))?(?:\/[^;,\s]*)?$/;

const SOURCE_KEYWORDS = new Set([
    "'self'",
    "'none'",
    "'unsafe-inline'",
    "'unsafe-eval'",
]);

const UNSAFE_SOURCE_KEYWORDS = new Set([
    "'unsafe-inline'",
    "'unsafe-eval'",
]);

const SUPPORTED_DIRECTIVES: readonly CspDirectiveName[] = [
    'default-src',
    'script-src',
    'style-src',
    'img-src',
    'connect-src',
    'object-src',
    'base-uri',
    'form-action',
    'frame-ancestors',
    'report-uri',
    'report-to',
];

const SOURCE_LIST_DIRECTIVE_TO_PROPERTY = {
    'default-src': 'defaultSrc',
    'script-src': 'scriptSrc',
    'style-src': 'styleSrc',
    'img-src': 'imgSrc',
    'connect-src': 'connectSrc',
    'object-src': 'objectSrc',
    'base-uri': 'baseUri',
    'form-action': 'formAction',
    'frame-ancestors': 'frameAncestors',
} as const;

const SUPPORTED_DIRECTIVE_SET = new Set<string>(SUPPORTED_DIRECTIVES);

type SourceListDirectiveName = keyof typeof SOURCE_LIST_DIRECTIVE_TO_PROPERTY;
type SourceListDirectiveProperty = (typeof SOURCE_LIST_DIRECTIVE_TO_PROPERTY)[SourceListDirectiveName];

interface SourceListValidationOptions {
    allowUnsafeKeywords: boolean;
}

function hasAsciiWhitespace(value: string): boolean {
    return /[\t\n\f\r ]/.test(value);
}

function normalizeSourceExpression(expression: string): string {
    const lowered = expression.toLowerCase();
    if (SOURCE_KEYWORDS.has(lowered)) {
        return lowered;
    }

    if (HASH_SOURCE_REGEX.test(expression)) {
        const separatorIndex = expression.indexOf('-');
        if (separatorIndex !== -1) {
            const algorithm = expression.slice(1, separatorIndex).toLowerCase();
            const digest = expression.slice(separatorIndex + 1, -1);
            return `'${algorithm}-${digest}'`;
        }
    }

    if (SCHEME_SOURCE_REGEX.test(expression)) {
        return expression.toLowerCase();
    }

    return expression;
}

function isValidSourceExpression(expression: string, options: SourceListValidationOptions): boolean {
    if (expression === '*') {
        return true;
    }

    const lowered = expression.toLowerCase();
    if (SOURCE_KEYWORDS.has(lowered)) {
        if (!options.allowUnsafeKeywords && UNSAFE_SOURCE_KEYWORDS.has(lowered)) {
            return false;
        }

        return true;
    }

    if (NONCE_SOURCE_REGEX.test(expression)) {
        return options.allowUnsafeKeywords;
    }

    if (HASH_SOURCE_REGEX.test(expression)) {
        return options.allowUnsafeKeywords;
    }

    if (SCHEME_SOURCE_REGEX.test(expression)) {
        return true;
    }

    return HOST_SOURCE_REGEX.test(expression);
}

function parseSourceList(
    value: string | null | undefined,
    options: SourceListValidationOptions,
): CspSourceExpression[] | null {
    if (value == null) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const tokens = trimmed.split(/[\t\n\f\r ]+/).filter(Boolean);
    if (tokens.length === 0) {
        return null;
    }

    const normalized: CspSourceExpression[] = [];
    for (const token of tokens) {
        const expression = token.trim();
        if (!expression || hasAsciiWhitespace(expression) || expression.includes(',') || expression.includes(';')) {
            return null;
        }

        if (!isValidSourceExpression(expression, options)) {
            return null;
        }

        normalized.push(normalizeSourceExpression(expression));
    }

    if (normalized.includes("'none'") && normalized.length > 1) {
        return null;
    }

    return normalized;
}

function validateSourceList(
    sourceList: readonly string[],
    context: string,
    options: SourceListValidationOptions,
): CspSourceExpression[] {
    if (!Array.isArray(sourceList)) {
        throw new Error(`${context} must be an array of source expressions`);
    }

    if (sourceList.length === 0) {
        throw new Error(`${context} must contain at least one source expression`);
    }

    const normalized: CspSourceExpression[] = [];
    for (const [index, source] of sourceList.entries()) {
        if (typeof source !== 'string') {
            throw new Error(`${context} source expression at index ${index} must be a string`);
        }

        const trimmed = source.trim();
        if (!trimmed) {
            throw new Error(`${context} source expression at index ${index} must be non-empty`);
        }

        assertNoCtl(trimmed, `${context} source expression at index ${index}`);
        if (hasAsciiWhitespace(trimmed) || trimmed.includes(',') || trimmed.includes(';')) {
            throw new Error(`${context} source expression at index ${index} must not contain separators`);
        }

        if (!isValidSourceExpression(trimmed, options)) {
            throw new Error(`${context} source expression at index ${index} is invalid: ${source}`);
        }

        normalized.push(normalizeSourceExpression(trimmed));
    }

    if (normalized.includes("'none'") && normalized.length > 1) {
        throw new Error(`${context} cannot combine 'none' with other source expressions`);
    }

    return normalized;
}

function parseReportUriValue(value: string): string[] | null {
    const tokens = value.trim().split(/[\t\n\f\r ]+/).filter(Boolean);
    if (tokens.length === 0) {
        return null;
    }

    for (const token of tokens) {
        if (hasAsciiWhitespace(token) || token.includes(';') || token.includes(',')) {
            return null;
        }
        if (token.length === 0) {
            return null;
        }
    }

    return tokens;
}

function validateReportUriValue(value: readonly string[]): string[] {
    if (!Array.isArray(value)) {
        throw new Error('Content Security Policy report-uri must be an array');
    }

    if (value.length === 0) {
        throw new Error('Content Security Policy report-uri must contain at least one URI');
    }

    const normalized: string[] = [];
    for (const [index, uri] of value.entries()) {
        if (typeof uri !== 'string') {
            throw new Error(`Content Security Policy report-uri value at index ${index} must be a string`);
        }

        const trimmed = uri.trim();
        if (!trimmed) {
            throw new Error(`Content Security Policy report-uri value at index ${index} must be non-empty`);
        }

        assertNoCtl(trimmed, `Content Security Policy report-uri value at index ${index}`);
        if (hasAsciiWhitespace(trimmed) || trimmed.includes(';') || trimmed.includes(',')) {
            throw new Error(`Content Security Policy report-uri value at index ${index} must not contain separators`);
        }

        normalized.push(trimmed);
    }

    return normalized;
}

function parseReportToValue(value: string): string | null {
    const token = value.trim();
    if (!token || !TOKEN_CHARS.test(token)) {
        return null;
    }
    return token;
}

function validateReportToValue(value: string): string {
    const token = value.trim();
    if (!token) {
        throw new Error('Content Security Policy report-to must be non-empty');
    }

    assertNoCtl(token, 'Content Security Policy report-to');
    if (!TOKEN_CHARS.test(token)) {
        throw new Error('Content Security Policy report-to must be a valid token');
    }

    return token;
}

function isPolicyEmpty(policy: ContentSecurityPolicy): boolean {
    return Object.keys(policy).length === 0;
}

function parseSerializedPolicy(serialized: string): ContentSecurityPolicy | null {
    if (isEmptyHeader(serialized)) {
        return null;
    }

    const policy: ContentSecurityPolicy = {};
    const seenDirectives = new Set<string>();

    for (const token of splitQuotedValue(serialized, ';')) {
        const directive = token.trim();
        if (!directive) {
            continue;
        }

        if (/[^\x20-\x7E]/.test(directive)) {
            return null;
        }

        const whitespaceIndex = directive.search(/[\t\n\f\r ]/);
        const name = (whitespaceIndex === -1 ? directive : directive.slice(0, whitespaceIndex)).toLowerCase();
        const rawValue = whitespaceIndex === -1 ? '' : directive.slice(whitespaceIndex).trim();

        if (!DIRECTIVE_NAME_REGEX.test(name)) {
            return null;
        }

        if (seenDirectives.has(name)) {
            continue;
        }
        seenDirectives.add(name);

        if (!SUPPORTED_DIRECTIVE_SET.has(name)) {
            continue;
        }

        if (!rawValue) {
            return null;
        }

        if (Object.prototype.hasOwnProperty.call(SOURCE_LIST_DIRECTIVE_TO_PROPERTY, name)) {
            const options: SourceListValidationOptions = {
                allowUnsafeKeywords: name !== 'frame-ancestors',
            };
            const sourceList = parseSourceList(rawValue, options);
            if (sourceList === null) {
                return null;
            }

            const property = SOURCE_LIST_DIRECTIVE_TO_PROPERTY[name as SourceListDirectiveName];
            policy[property] = sourceList;
            continue;
        }

        if (name === 'report-uri') {
            const reportUri = parseReportUriValue(rawValue);
            if (reportUri === null) {
                return null;
            }
            policy.reportUri = reportUri;
            continue;
        }

        if (name === 'report-to') {
            const reportTo = parseReportToValue(rawValue);
            if (reportTo === null) {
                return null;
            }
            policy.reportTo = reportTo;
            continue;
        }
    }

    return policy;
}

/**
 * Parse a Content-Security-Policy header field value.
 */
// W3C CSP3 Section 2.2.1 + Section 3.1: parse semicolon-delimited directives; ignore unknown names.
export function parseContentSecurityPolicy(value: string | null | undefined): ContentSecurityPolicy | null {
    return value == null ? null : parseSerializedPolicy(value);
}

/**
 * Parse a Content-Security-Policy-Report-Only header field value.
 */
// W3C CSP3 Section 2.2.1 + Section 3.2: report-only policies share serialized policy grammar.
export function parseContentSecurityPolicyReportOnly(value: string | null | undefined): ContentSecurityPolicy | null {
    return value == null ? null : parseSerializedPolicy(value);
}

/**
 * Parse one or more serialized CSP policies from header values.
 */
// W3C CSP3 Section 2.2.2 + Section 3.1-3.2: parse header-delivered serialized policy lists.
export function parseContentSecurityPolicies(value: string | string[] | null | undefined): ContentSecurityPolicy[] {
    if (value == null) {
        return [];
    }

    const values = Array.isArray(value) ? value : [value];
    const parsedPolicies: ContentSecurityPolicy[] = [];

    for (const headerValue of values) {
        if (isEmptyHeader(headerValue)) {
            return [];
        }

        const serializedPolicies = splitQuotedValue(headerValue, ',')
            .map((entry) => entry.trim())
            .filter(Boolean);
        if (serializedPolicies.length === 0) {
            return [];
        }

        for (const serializedPolicy of serializedPolicies) {
            const parsed = parseSerializedPolicy(serializedPolicy);
            if (parsed === null) {
                return [];
            }

            if (!isPolicyEmpty(parsed)) {
                parsedPolicies.push(parsed);
            }
        }
    }

    return parsedPolicies;
}

/**
 * Parse a serialized CSP source-list.
 */
// W3C CSP3 Section 2.3.1: source lists are whitespace-delimited source expressions.
export function parseCspSourceList(value: string | null | undefined): CspSourceExpression[] | null {
    return parseSourceList(value, { allowUnsafeKeywords: true });
}

/**
 * Validate a CSP source-list for strict formatting/serialization.
 */
export function validateCspSourceList(sourceList: readonly string[]): CspSourceExpression[] {
    return validateSourceList(sourceList, 'Content Security Policy source list', {
        allowUnsafeKeywords: true,
    });
}

/**
 * Format a CSP source-list.
 */
export function formatCspSourceList(sourceList: readonly string[]): string {
    return validateCspSourceList(sourceList).join(' ');
}

/**
 * Validate a CSP subset policy object.
 */
export function validateContentSecurityPolicy(policy: ContentSecurityPolicy): ContentSecurityPolicy {
    if (typeof policy !== 'object' || policy === null || Array.isArray(policy)) {
        throw new Error('Content Security Policy must be an object');
    }

    const validated: ContentSecurityPolicy = {};

    for (const [directive, rawValue] of Object.entries(policy)) {
        if (rawValue === undefined) {
            continue;
        }

        if (directive === 'reportUri') {
            validated.reportUri = validateReportUriValue(rawValue as readonly string[]);
            continue;
        }

        if (directive === 'reportTo') {
            if (typeof rawValue !== 'string') {
                throw new Error('Content Security Policy report-to must be a string');
            }
            validated.reportTo = validateReportToValue(rawValue);
            continue;
        }

        if (!Object.values(SOURCE_LIST_DIRECTIVE_TO_PROPERTY).includes(directive as SourceListDirectiveProperty)) {
            throw new Error(`Unsupported Content Security Policy directive key: ${directive}`);
        }

        const isFrameAncestors = directive === 'frameAncestors';
        const options: SourceListValidationOptions = {
            allowUnsafeKeywords: !isFrameAncestors,
        };
        const sourceList = validateSourceList(
            rawValue as readonly string[],
            `Content Security Policy ${directive}`,
            options,
        );

        validated[directive as SourceListDirectiveProperty] = sourceList;
    }

    if (isPolicyEmpty(validated)) {
        throw new Error('Content Security Policy must contain at least one supported directive');
    }

    return validated;
}

const SERIALIZE_DIRECTIVES: Array<{
    name: SourceListDirectiveName;
    property: SourceListDirectiveProperty;
}> = [
    { name: 'default-src', property: 'defaultSrc' },
    { name: 'script-src', property: 'scriptSrc' },
    { name: 'style-src', property: 'styleSrc' },
    { name: 'img-src', property: 'imgSrc' },
    { name: 'connect-src', property: 'connectSrc' },
    { name: 'object-src', property: 'objectSrc' },
    { name: 'base-uri', property: 'baseUri' },
    { name: 'form-action', property: 'formAction' },
    { name: 'frame-ancestors', property: 'frameAncestors' },
];

/**
 * Format a strict Content-Security-Policy header field value.
 */
// W3C CSP3 Section 3.1: emit a serialized policy with semicolon-delimited directives.
export function formatContentSecurityPolicy(policy: ContentSecurityPolicy): string {
    const validated = validateContentSecurityPolicy(policy);
    const directives: string[] = [];

    for (const directive of SERIALIZE_DIRECTIVES) {
        const sourceList = validated[directive.property];
        if (!sourceList) {
            continue;
        }

        directives.push(`${directive.name} ${sourceList.join(' ')}`);
    }

    if (validated.reportUri) {
        directives.push(`report-uri ${validated.reportUri.join(' ')}`);
    }

    if (validated.reportTo) {
        directives.push(`report-to ${validated.reportTo}`);
    }

    return directives.join('; ');
}

/**
 * Format a strict Content-Security-Policy-Report-Only header field value.
 */
// W3C CSP3 Section 3.2: report-only header serializes policies with the same grammar.
export function formatContentSecurityPolicyReportOnly(policy: ContentSecurityPolicy): string {
    return formatContentSecurityPolicy(policy);
}
