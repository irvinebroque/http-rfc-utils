/**
 * Host Metadata per RFC 6415.
 * RFC 6415 §2-3: XRD and JSON formats for host-wide metadata.
 * @see https://www.rfc-editor.org/rfc/rfc6415.html
 */

import type { HostMeta, HostMetaLink } from './types.js';

export type { HostMeta, HostMetaLink } from './types.js';

/**
 * The XRD namespace used in host-meta documents.
 * RFC 6415 §2: XRD format uses this namespace.
 */
const XRD_NAMESPACE = 'http://docs.oasis-open.org/ns/xri/xrd-1.0';

// =============================================================================
// XML Parsing/Formatting
// =============================================================================

/**
 * Parse a host-meta XRD XML document into a HostMeta object.
 * RFC 6415 §2: XRD-based host-wide metadata.
 *
 * Uses simple regex-based parsing; no XML library required.
 */
export function parseHostMeta(xml: string): HostMeta {
    const links: HostMetaLink[] = [];
    const properties: Record<string, string | null> = {};

    // Parse <Link> elements.
    const linkRegex = /<Link\s([^>]*?)\/?>(?:<\/Link>)?/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(xml)) !== null) {
        const attrs = match[1];
        const link = parseLinkAttributes(attrs);
        if (link) {
            links.push(link);
        }
    }

    // Parse <Property> elements.
    const propRegex = /<Property\s+type="([^"]*)"(?:\s*\/>|>(.*?)<\/Property>)/gi;
    while ((match = propRegex.exec(xml)) !== null) {
        const type = match[1];
        const value = match[2] !== undefined ? decodeXmlEntities(match[2]) : null;
        properties[type] = value;
    }

    const result: HostMeta = { links };
    if (Object.keys(properties).length > 0) {
        result.properties = properties;
    }
    return result;
}

/**
 * Parse attributes from a <Link> element string.
 */
function parseLinkAttributes(attrs: string): HostMetaLink | null {
    const rel = extractAttr(attrs, 'rel');
    if (!rel) return null;

    const link: HostMetaLink = { rel };

    const type = extractAttr(attrs, 'type');
    if (type) link.type = type;

    const href = extractAttr(attrs, 'href');
    if (href) link.href = href;

    const template = extractAttr(attrs, 'template');
    if (template) link.template = template;

    return link;
}

/**
 * Extract an attribute value from an XML attributes string.
 */
function extractAttr(attrs: string, name: string): string | null {
    const regex = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
    const match = regex.exec(attrs);
    return match ? decodeXmlEntities(match[1]) : null;
}

/**
 * Decode basic XML entities.
 */
function decodeXmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

/**
 * Encode basic XML entities.
 */
function encodeXmlEntities(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Serialize a HostMeta to XRD XML format.
 * RFC 6415 §2: XRD document structure.
 */
export function formatHostMeta(config: HostMeta): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<XRD xmlns="${XRD_NAMESPACE}">`);

    if (config.properties) {
        for (const [type, value] of Object.entries(config.properties)) {
            if (value === null) {
                lines.push(`  <Property type="${encodeXmlEntities(type)}"/>`);
            } else {
                lines.push(`  <Property type="${encodeXmlEntities(type)}">${encodeXmlEntities(value)}</Property>`);
            }
        }
    }

    for (const link of config.links) {
        const attrs: string[] = [];
        attrs.push(`rel="${encodeXmlEntities(link.rel)}"`);
        if (link.type) attrs.push(`type="${encodeXmlEntities(link.type)}"`);
        if (link.href) attrs.push(`href="${encodeXmlEntities(link.href)}"`);
        if (link.template) attrs.push(`template="${encodeXmlEntities(link.template)}"`);
        lines.push(`  <Link ${attrs.join(' ')}/>`);
    }

    lines.push('</XRD>');
    lines.push('');
    return lines.join('\n');
}

// =============================================================================
// JSON Parsing/Formatting
// =============================================================================

/**
 * Parse a host-meta.json document.
 * RFC 6415 §3: JSON format mirrors the XRD structure.
 */
export function parseHostMetaJson(json: string): HostMeta {
    const obj = JSON.parse(json);
    return parseHostMetaObject(obj);
}

/**
 * Parse a host-meta object (already parsed from JSON).
 */
function parseHostMetaObject(obj: Record<string, unknown>): HostMeta {
    const links: HostMetaLink[] = [];

    if (Array.isArray(obj.links)) {
        for (const linkObj of obj.links) {
            if (typeof linkObj === 'object' && linkObj !== null && typeof (linkObj as Record<string, unknown>).rel === 'string') {
                const link: HostMetaLink = { rel: (linkObj as Record<string, string>).rel };
                if (typeof (linkObj as Record<string, unknown>).type === 'string') {
                    link.type = (linkObj as Record<string, string>).type;
                }
                if (typeof (linkObj as Record<string, unknown>).href === 'string') {
                    link.href = (linkObj as Record<string, string>).href;
                }
                if (typeof (linkObj as Record<string, unknown>).template === 'string') {
                    link.template = (linkObj as Record<string, string>).template;
                }
                links.push(link);
            }
        }
    }

    const result: HostMeta = { links };

    if (obj.properties !== null && typeof obj.properties === 'object' && !Array.isArray(obj.properties)) {
        result.properties = obj.properties as Record<string, string | null>;
    }

    return result;
}

/**
 * Serialize a HostMeta to JSON format.
 * RFC 6415 §3: JSON host-meta document.
 */
export function formatHostMetaJson(config: HostMeta): string {
    const obj: Record<string, unknown> = {};

    if (config.properties && Object.keys(config.properties).length > 0) {
        obj.properties = config.properties;
    }

    obj.links = config.links.map(link => {
        const linkObj: Record<string, string> = { rel: link.rel };
        if (link.type) linkObj.type = link.type;
        if (link.href) linkObj.href = link.href;
        if (link.template) linkObj.template = link.template;
        return linkObj;
    });

    return JSON.stringify(obj, null, 2);
}
