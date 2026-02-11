/**
 * Alt-Svc and Alt-Used header utilities per RFC 7838.
 * RFC 7838 §3, §3.1, §5.
 * @see https://www.rfc-editor.org/rfc/rfc7838.html#section-3
 */

import type { AltSvcAlternative, AltSvcRecord, AltUsed } from './types.js';
import {
    TOKEN_CHARS,
    assertNoCtl,
    escapeQuotedString,
    parseDeltaSeconds,
    parseQuotedStringStrict,
} from './header-utils.js';
import {
    parseParameterizedMember,
    parseParameterizedMembers,
    type InternalParsedKeyValueSegment,
} from './internal-parameterized-members.js';

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

        members.push(...parseParameterizedMembers(headerValue, {
            memberDelimiter: ',',
            hasBaseSegment: false,
        }).map(member => member.raw));
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
            throw new Error(
                `Alt-Svc with clear=true must not include alternatives; received ${record.alternatives.length} alternative(s)`,
            );
        }
        return 'clear';
    }

    if (record.alternatives.length === 0) {
        throw new Error('Alt-Svc must include at least one alternative when clear is false');
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
        throw new Error(
            `Alt-Used host must be a valid host token or bracketed IPv6 literal; received ${String(altUsed.host)}`,
        );
    }

    let serializedHost = host;
    if (host.includes(':') && !isValidBracketedIpv6Host(host)) {
        serializedHost = `[${host}]`;
    }

    if (altUsed.port === undefined) {
        return serializedHost;
    }

    if (!isValidPort(altUsed.port)) {
        throw new Error(`Alt-Used port must be an integer in range 0-65535; received ${String(altUsed.port)}`);
    }

    return `${serializedHost}:${altUsed.port}`;
}

function parseAlternative(member: string): AltSvcAlternative | null {
    const parsedMember = parseParameterizedMember(member, {
        parameterDelimiter: ';',
        hasBaseSegment: true,
        baseFromFirstSegment: true,
    });
    if (!parsedMember.base || !parsedMember.base.hasEquals) {
        return null;
    }

    const protocolId = parsedMember.base.key.trim();
    if (!TOKEN_CHARS.test(protocolId)) {
        return null;
    }

    const authority = parseQuotedStringStrict(parsedMember.base.value ?? '');
    if (authority === null) {
        return null;
    }

    const alternative: AltSvcAlternative = {
        protocolId,
        authority,
    };

    for (const segment of parsedMember.parameters) {
        const parameter = parseParameterSegment(segment);
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
        throw new Error(
            `Alt-Svc protocol-id must be a valid HTTP token; received ${String(alternative.protocolId)}`,
        );
    }

    assertNoCtl(alternative.authority, 'Alt-Svc alt-authority');
    if (!alternative.authority) {
        throw new Error('Alt-Svc alt-authority must not be empty');
    }

    const escapedAuthority = escapeQuotedString(alternative.authority);
    const parts = [`${alternative.protocolId}="${escapedAuthority}"`];

    if (alternative.ma !== undefined) {
        if (!Number.isInteger(alternative.ma) || alternative.ma < 0) {
            throw new Error(
                `Alt-Svc parameter "ma" must be a non-negative integer; received ${String(alternative.ma)}`,
            );
        }
        parts.push(`ma=${alternative.ma}`);
    }

    if (alternative.persist !== undefined) {
        if (alternative.persist !== true) {
            throw new Error(
                `Alt-Svc parameter "persist" can only be serialized as true; received ${String(alternative.persist)}`,
            );
        }
        parts.push('persist=1');
    }

    return parts.join('; ');
}

function parseParameterSegment(parameter: InternalParsedKeyValueSegment): { name: string; value: string } | null {
    if (!parameter.hasEquals) {
        return null;
    }

    const name = parameter.key.trim().toLowerCase();
    if (!TOKEN_CHARS.test(name)) {
        return null;
    }

    const rawValue = (parameter.value ?? '').trim();
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

    if (/[\s[\]/]/.test(host)) {
        return false;
    }

    return true;
}

function isValidBracketedIpv6Host(host: string): boolean {
    return host.startsWith('[') && host.endsWith(']') && host.length > 2;
}
