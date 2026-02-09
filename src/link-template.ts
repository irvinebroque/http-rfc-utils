/**
 * Link-Template header utilities per RFC 9652.
 * RFC 9652 §2, §2.1.
 * @see https://www.rfc-editor.org/rfc/rfc9652.html#section-2
 */

import { expandUriTemplate, getTemplateVariables } from './uri-template.js';
import { parseSfList, serializeSfList } from './structured-fields.js';
import { SfDisplayString } from './types.js';
import type { SfBareItem, SfItem, LinkTemplate, ExpandedLinkTemplate, UriTemplateVariables } from './types.js';

const CONSTRAINED_PARAM_KEYS = new Set(['rel', 'anchor', 'var-base']);
const NON_ASCII_RE = /[^\x00-\x7F]/;
const ABSOLUTE_URI_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * Parse a Link-Template header field value.
 */
// RFC 9652 §2: Link-Template is an SF List of sf-string members.
export function parseLinkTemplateHeader(value: string): LinkTemplate[] | null {
    const list = parseSfList(value);
    if (!list) {
        return null;
    }

    const templates: LinkTemplate[] = [];

    for (const member of list) {
        if ('items' in member) {
            return null;
        }

        const item = member as SfItem;
        if (typeof item.value !== 'string') {
            return null;
        }

        const params = item.params ?? {};
        const rel = readConstrainedParam(params, 'rel');
        const anchor = readConstrainedParam(params, 'anchor');
        const varBase = readConstrainedParam(params, 'var-base');
        if (rel === null || anchor === null || varBase === null) {
            return null;
        }

        const extensionParams: Record<string, SfBareItem> = {};
        for (const [key, paramValue] of Object.entries(params)) {
            if (!CONSTRAINED_PARAM_KEYS.has(key)) {
                extensionParams[key] = paramValue;
            }
        }

        const parsedTemplate: LinkTemplate = {
            template: item.value,
        };

        if (rel !== undefined) {
            parsedTemplate.rel = rel;
        }
        if (anchor !== undefined) {
            parsedTemplate.anchor = anchor;
        }
        if (varBase !== undefined) {
            parsedTemplate.varBase = varBase;
        }
        if (Object.keys(extensionParams).length > 0) {
            parsedTemplate.params = extensionParams;
        }

        templates.push(parsedTemplate);
    }

    return templates;
}

/**
 * Format Link-Template entries into a header field value.
 */
// RFC 9652 §2: Link-Template serializes as an SF List of sf-string members.
export function formatLinkTemplateHeader(templates: LinkTemplate[]): string {
    const list = templates.map((template): SfItem => {
        if (typeof template.template !== 'string') {
            throw new Error('Link-Template entry template must be a string');
        }

        const params: Record<string, SfBareItem> = {};

        if (template.rel !== undefined) {
            params.rel = expectStringParam(template.rel, 'rel');
        }

        if (template.anchor !== undefined) {
            params.anchor = expectStringParam(template.anchor, 'anchor');
        }

        if (template.varBase !== undefined) {
            params['var-base'] = expectStringParam(template.varBase, 'varBase');
        }

        for (const [key, value] of Object.entries(template.params ?? {})) {
            if (CONSTRAINED_PARAM_KEYS.has(key)) {
                throw new Error(`Parameter ${key} must use dedicated LinkTemplate property`);
            }

            if (typeof value === 'string' && NON_ASCII_RE.test(value)) {
                // RFC 9652 §2: non-ASCII target attributes are Display Strings.
                params[key] = new SfDisplayString(value);
            } else {
                params[key] = value;
            }
        }

        return Object.keys(params).length > 0 ? { value: template.template, params } : { value: template.template };
    });

    return serializeSfList(list);
}

/**
 * Expand a Link-Template entry with URI Template variables.
 */
// RFC 9652 §2: target and anchor can contain URI Templates.
export function expandLinkTemplate(
    template: LinkTemplate,
    variables: UriTemplateVariables,
    contextUri?: string
): ExpandedLinkTemplate {
    const href = resolveUriReference(expandUriTemplate(template.template, variables), contextUri);
    const anchor = template.anchor
        ? resolveUriReference(expandUriTemplate(template.anchor, variables), contextUri)
        : undefined;

    const variableUris: Record<string, string> = {};
    const variableNames = new Set<string>(getTemplateVariables(template.template));
    if (template.anchor) {
        for (const name of getTemplateVariables(template.anchor)) {
            variableNames.add(name);
        }
    }

    for (const variableName of variableNames) {
        variableUris[variableName] = resolveTemplateVariableUri(variableName, template.varBase, contextUri);
    }

    const expanded: ExpandedLinkTemplate = {
        href,
        params: { ...(template.params ?? {}) },
        variableUris,
    };

    if (template.rel !== undefined) {
        expanded.rel = template.rel;
    }
    if (anchor !== undefined) {
        expanded.anchor = anchor;
    }

    return expanded;
}

/**
 * Resolve a URI identifying a template variable.
 */
// RFC 9652 §2.1: resolve against var-base, then context when still relative.
export function resolveTemplateVariableUri(variableName: string, varBase?: string, contextUri?: string): string {
    if (!varBase) {
        return variableName;
    }

    const fromVarBase = resolveUriReference(variableName, varBase);
    if (isAbsoluteUri(fromVarBase) || !contextUri) {
        return fromVarBase;
    }

    return resolveUriReference(fromVarBase, contextUri);
}

function readConstrainedParam(
    params: Record<string, SfBareItem>,
    key: 'rel' | 'anchor' | 'var-base'
): string | undefined | null {
    if (!(key in params)) {
        return undefined;
    }

    const value = params[key];
    if (typeof value !== 'string') {
        return null;
    }

    return value;
}

function expectStringParam(value: string, name: string): string {
    if (typeof value !== 'string') {
        throw new Error(`Link-Template parameter ${name} must be a string`);
    }

    return value;
}

function isAbsoluteUri(value: string): boolean {
    return ABSOLUTE_URI_RE.test(value);
}

function resolveUriReference(reference: string, base?: string): string {
    if (!base) {
        return reference;
    }

    try {
        return new URL(reference, base).toString();
    } catch {
        return resolveRelativeReference(reference, base);
    }
}

function resolveRelativeReference(reference: string, base: string): string {
    if (!reference) {
        return base;
    }

    if (isAbsoluteUri(reference) || reference.startsWith('/')) {
        return reference;
    }

    if (reference.startsWith('?')) {
        return `${stripQueryAndFragment(base)}${reference}`;
    }

    if (reference.startsWith('#')) {
        return `${stripFragment(base)}${reference}`;
    }

    const basePath = stripQueryAndFragment(base);
    if (!basePath) {
        return reference;
    }

    if (basePath.endsWith('/')) {
        return `${basePath}${reference}`;
    }

    const lastSlash = basePath.lastIndexOf('/');
    if (lastSlash === -1) {
        return reference;
    }

    return `${basePath.slice(0, lastSlash + 1)}${reference}`;
}

function stripFragment(value: string): string {
    const index = value.indexOf('#');
    return index === -1 ? value : value.slice(0, index);
}

function stripQueryAndFragment(value: string): string {
    const withoutFragment = stripFragment(value);
    const queryIndex = withoutFragment.indexOf('?');
    return queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
}
