/**
 * Host Metadata per RFC 6415.
 * RFC 6415 §2-3: XRD and JSON formats for host-wide metadata.
 * @see https://www.rfc-editor.org/rfc/rfc6415.html
 */

import type { HostMeta, HostMetaLink } from './types.js';
import { createObjectMap } from './object-map.js';
import { toRecordOrEmpty, toStringOrNullMap } from './internal-json-shape.js';

export type { HostMeta, HostMetaLink } from './types.js';

/**
 * The XRD namespace used in host-meta documents.
 * RFC 6415 §2: XRD format uses this namespace.
 */
const XRD_NAMESPACE = 'http://docs.oasis-open.org/ns/xri/xrd-1.0';
const ATTR_REGEX_CACHE = new Map<string, RegExp>();

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
    let properties: Record<string, string | null> | null = null;

    // Parse <Link> elements.
    const linkRegex = /<Link\s([^>]*?)\/?>(?:<\/Link>)?/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(xml)) !== null) {
        const attrs = match[1];
        if (attrs === undefined) {
            continue;
        }

        const link = parseLinkAttributes(attrs);
        if (link) {
            links.push(link);
        }
    }

    // Parse <Property> elements.
    const propRegex = /<Property\s+type="([^"]*)"(?:\s*\/>|>(.*?)<\/Property>)/gi;
    while ((match = propRegex.exec(xml)) !== null) {
        const type = match[1];
        if (type === undefined || type === '') {
            continue;
        }

        const value = match[2] !== undefined ? decodeXmlEntities(match[2]) : null;
        if (properties === null) {
            properties = createObjectMap<string | null>();
        }
        properties[type] = value;
    }

    const result: HostMeta = { links };
    if (properties !== null) {
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
    let regex = ATTR_REGEX_CACHE.get(name);
    if (!regex) {
        regex = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
        ATTR_REGEX_CACHE.set(name, regex);
    }
    const match = regex.exec(attrs);
    if (!match || match[1] === undefined) {
        return null;
    }

    return decodeXmlEntities(match[1]);
}

/**
 * Decode basic XML entities.
 */
function decodeXmlEntities(text: string): string {
    if (!text.includes('&')) {
        return text;
    }

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
 * Parse a host-meta.json document without throwing.
 * Returns null for malformed JSON input.
 */
export function tryParseHostMetaJson(json: string): HostMeta | null {
    try {
        return parseHostMetaObject(JSON.parse(json));
    } catch {
        return null;
    }
}

/**
 * Parse a host-meta object (already parsed from JSON).
 */
function parseHostMetaObject(obj: unknown): HostMeta {
    const record = toRecordOrEmpty(obj);

    const links: HostMetaLink[] = [];

    if (Array.isArray(record.links)) {
        for (const linkObj of record.links) {
            if (typeof linkObj !== 'object' || linkObj === null) {
                continue;
            }

            const linkRecord = linkObj as Record<string, unknown>;
            if (typeof linkRecord.rel !== 'string') {
                continue;
            }

            const link: HostMetaLink = { rel: linkRecord.rel };
            if (typeof linkRecord.type === 'string') {
                link.type = linkRecord.type;
            }
            if (typeof linkRecord.href === 'string') {
                link.href = linkRecord.href;
            }
            if (typeof linkRecord.template === 'string') {
                link.template = linkRecord.template;
            }

            links.push(link);
        }
    }

    const result: HostMeta = { links };

    const properties = toStringOrNullMap(record.properties);
    if (properties) {
        result.properties = properties;
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
