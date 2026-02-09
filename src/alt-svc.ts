/**
 * Alt-Svc and Alt-Used header utilities per RFC 7838.
 * RFC 7838 §3, §3.1, §5.
 * @see https://www.rfc-editor.org/rfc/rfc7838.html#section-3
 */

import type { AltSvcAlternative, AltSvcRecord, AltUsed } from './types.js';
import {
    TOKEN_CHARS,
    assertNoCtl,
    parseDeltaSeconds,
    parseKeyValueSegment,
    parseQuotedStringStrict,
    splitQuotedValue,
} from './header-utils.js';

/**
 * Parse an Alt-Svc header field value.
 */
// RFC 7838 §3: Alt-Svc = clear / 1#alt-value.
export function parseAltSvc(value: string | string[]): AltSvcRecord | null {
    const headerValues = Array.isArray(value) ? value : [value];
    const members: string[] = [];

    for (const headerValue of headerValues) {
        if (!headerValue) {
            continue;
        }

        for (const member of splitQuotedValue(headerValue, ',')) {
            members.push(member.trim());
        }
    }

    if (members.length === 1 && members[0] === 'clear') {
        return {
            clear: true,
            alternatives: [],
        };
    }

    const alternatives: AltSvcAlternative[] = [];
    for (const member of members) {
        if (!member) {
            continue;
        }

        const alternative = parseAlternative(member);
        if (alternative) {
            alternatives.push(alternative);
        }
    }

    if (alternatives.length === 0) {
        return null;
    }

    return {
        clear: false,
        alternatives,
    };
}

/**
 * Format an Alt-Svc header field value.
 */
// RFC 7838 §3: field value is either case-sensitive "clear" or alt-value list.
export function formatAltSvc(record: AltSvcRecord): string {
    if (record.clear) {
        if (record.alternatives.length > 0) {
            throw new Error('Alt-Svc clear value cannot include alternatives');
        }
        return 'clear';
    }

    if (record.alternatives.length === 0) {
        throw new Error('Alt-Svc requires at least one alternative unless clear is set');
    }

    return record.alternatives.map((alternative) => formatAlternative(alternative)).join(', ');
}

/**
 * Parse an Alt-Used header field value.
 */
// RFC 7838 §5: Alt-Used = uri-host [ ":" port ].
export function parseAltUsed(value: string): AltUsed | null {
    const trimmed = value.trim();
    if (!trimmed || /\s/.test(trimmed)) {
        return null;
    }

    if (trimmed.startsWith('[')) {
        const closeIndex = trimmed.indexOf(']');
        if (closeIndex <= 1) {
            return null;
        }

        const host = trimmed.slice(1, closeIndex);
        const remainder = trimmed.slice(closeIndex + 1);
        if (!remainder) {
            return { host };
        }

        if (!remainder.startsWith(':')) {
            return null;
        }

        const port = parsePortNumber(remainder.slice(1));
        if (port === null) {
            return null;
        }

        return { host, port };
    }

    const firstColon = trimmed.indexOf(':');
    if (firstColon === -1) {
        if (!isValidAltUsedHost(trimmed)) {
            return null;
        }

        return { host: trimmed };
    }

    if (trimmed.indexOf(':', firstColon + 1) !== -1) {
        return null;
    }

    const host = trimmed.slice(0, firstColon);
    const port = parsePortNumber(trimmed.slice(firstColon + 1));
    if (!isValidAltUsedHost(host) || port === null) {
        return null;
    }

    return { host, port };
}

/**
 * Format an Alt-Used header field value.
 */
// RFC 7838 §5: serialize uri-host with optional ":port".
export function formatAltUsed(altUsed: AltUsed): string {
    const host = altUsed.host.trim();
    if (!isValidAltUsedHost(host) && !isValidBracketedIpv6Host(host)) {
        throw new Error('Invalid Alt-Used host');
    }

    let serializedHost = host;
    if (host.includes(':') && !isValidBracketedIpv6Host(host)) {
        serializedHost = `[${host}]`;
    }

    if (altUsed.port === undefined) {
        return serializedHost;
    }

    if (!isValidPort(altUsed.port)) {
        throw new Error('Invalid Alt-Used port');
    }

    return `${serializedHost}:${altUsed.port}`;
}

function parseAlternative(member: string): AltSvcAlternative | null {
    const eqIndex = member.indexOf('=');
    if (eqIndex <= 0) {
        return null;
    }

    const protocolId = member.slice(0, eqIndex).trim();
    if (!TOKEN_CHARS.test(protocolId)) {
        return null;
    }

    const remainder = member.slice(eqIndex + 1);
    const parts = splitQuotedValue(remainder, ';');
    const authority = parseQuotedStringStrict(parts[0]?.trim() ?? '');
    if (authority === null) {
        return null;
    }

    const alternative: AltSvcAlternative = {
        protocolId,
        authority,
    };

    for (let i = 1; i < parts.length; i++) {
        const parameter = parseParameter(parts[i]?.trim() ?? '');
        if (!parameter) {
            continue;
        }

        if (parameter.name === 'ma') {
            const ma = parseDeltaSeconds(parameter.value);
            if (ma !== null) {
                alternative.ma = ma;
            }
            continue;
        }

        if (parameter.name === 'persist') {
            // RFC 7838 §3.1: persist has meaning only when value is 1.
            if (parameter.value === '1') {
                alternative.persist = true;
            }
        }
    }

    return alternative;
}

function formatAlternative(alternative: AltSvcAlternative): string {
    if (!TOKEN_CHARS.test(alternative.protocolId)) {
        throw new Error('Invalid Alt-Svc protocol-id');
    }

    assertNoCtl(alternative.authority, 'Alt-Svc alt-authority');
    if (!alternative.authority) {
        throw new Error('Alt-Svc alt-authority must not be empty');
    }

    const escapedAuthority = alternative.authority.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const parts = [`${alternative.protocolId}="${escapedAuthority}"`];

    if (alternative.ma !== undefined) {
        if (!Number.isInteger(alternative.ma) || alternative.ma < 0) {
            throw new Error('Invalid Alt-Svc ma parameter; expected non-negative integer');
        }
        parts.push(`ma=${alternative.ma}`);
    }

    if (alternative.persist !== undefined) {
        if (alternative.persist !== true) {
            throw new Error('Invalid Alt-Svc persist parameter; only true can be serialized');
        }
        parts.push('persist=1');
    }

    return parts.join('; ');
}

function parseParameter(parameter: string): { name: string; value: string } | null {
    const parsedParameter = parseKeyValueSegment(parameter);
    if (!parsedParameter || !parsedParameter.hasEquals) {
        return null;
    }

    const name = parsedParameter.key.trim().toLowerCase();
    if (!TOKEN_CHARS.test(name)) {
        return null;
    }

    const rawValue = (parsedParameter.value ?? '').trim();
    if (!rawValue) {
        return null;
    }

    if (rawValue.startsWith('"')) {
        const quoted = parseQuotedStringStrict(rawValue);
        if (quoted === null) {
            return null;
        }
        return { name, value: quoted };
    }

    if (!TOKEN_CHARS.test(rawValue)) {
        return null;
    }

    return { name, value: rawValue };
}

function parsePortNumber(value: string): number | null {
    if (!/^\d+$/.test(value)) {
        return null;
    }

    const parsed = Number(value);
    if (!isValidPort(parsed)) {
        return null;
    }

    return parsed;
}

function isValidPort(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 65535;
}

function isValidAltUsedHost(host: string): boolean {
    if (!host) {
        return false;
    }

    if (/[\s\[\]\/]/.test(host)) {
        return false;
    }

    return true;
}

function isValidBracketedIpv6Host(host: string): boolean {
    return host.startsWith('[') && host.endsWith(']') && host.length > 2;
}
