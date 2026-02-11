/**
 * Accept-Patch utilities per RFC 5789.
 * RFC 5789 §3.1, §3.2.
 * @see https://www.rfc-editor.org/rfc/rfc5789.html#section-3.1
 */

import type { AcceptPatchMediaType, AcceptPatchParameter } from './types.js';
import {
    formatMediaType,
    parseMediaType,
    parseTypeAndSubtype,
    splitQuotedValue,
    TOKEN_CHARS,
} from './header-utils.js';

/**
 * Parse Accept-Patch into ordered media-type members.
 */
// RFC 5789 §3.1: Accept-Patch = 1#media-type.
export function parseAcceptPatch(value: string | string[]): AcceptPatchMediaType[] | null {
    const headers = Array.isArray(value) ? value : [value];
    const parsed: AcceptPatchMediaType[] = [];

    for (const headerValue of headers) {
        if (!headerValue || !headerValue.trim()) {
            return null;
        }

        const members = splitQuotedValue(headerValue, ',');
        for (const member of members) {
            const trimmed = member.trim();
            if (!trimmed) {
                return null;
            }

            const parsedMember = parseMediaTypeMember(trimmed);
            if (!parsedMember) {
                return null;
            }

            parsed.push(parsedMember);
        }
    }

    return parsed.length > 0 ? parsed : null;
}

/**
 * Format Accept-Patch from ordered media-type members.
 */
// RFC 5789 §3.1: field value is a comma-separated media-type list.
export function formatAcceptPatch(mediaTypes: AcceptPatchMediaType[]): string {
    if (mediaTypes.length === 0) {
        throw new Error('Accept-Patch must include at least one media type entry');
    }

    return mediaTypes
        .map((mediaType) => formatMediaTypeMember(mediaType))
        .join(', ');
}

/**
 * Determine PATCH support from Accept-Patch advertisement.
 */
// RFC 5789 §3.1: presence of Accept-Patch implies PATCH is allowed.
export function supportsPatch(
    acceptPatch: string | string[] | AcceptPatchMediaType[] | null | undefined,
    mediaType?: string
): boolean {
    if (acceptPatch == null) {
        return false;
    }

    let parsed: AcceptPatchMediaType[] | null;
    if (typeof acceptPatch === 'string' || isStringArray(acceptPatch)) {
        parsed = parseAcceptPatch(acceptPatch);
    } else {
        parsed = acceptPatch;
    }

    if (!parsed || parsed.length === 0) {
        return false;
    }

    if (!mediaType) {
        return true;
    }

    const requested = parseMediaTypeMember(mediaType.trim());
    if (!requested) {
        return false;
    }

    return parsed.some((member) => {
        const normalized = parseTypeAndSubtype(`${member.type}/${member.subtype}`);
        if (!normalized) {
            return false;
        }

        return normalized.type === requested.type && normalized.subtype === requested.subtype;
    });
}

function isStringArray(value: string[] | AcceptPatchMediaType[]): value is string[] {
    if (value.length === 0) {
        return true;
    }

    return typeof value[0] === 'string';
}

function parseMediaTypeMember(member: string): AcceptPatchMediaType | null {
    const parsed = parseMediaType(member);
    if (!parsed) {
        return null;
    }

    return {
        type: parsed.type,
        subtype: parsed.subtype,
        parameters: parsed.parameters,
    };
}

function formatMediaTypeMember(mediaType: AcceptPatchMediaType): string {
    const mediaTypeText = `${mediaType.type}/${mediaType.subtype}`;
    const type = parseTypeAndSubtype(mediaTypeText);
    if (!type) {
        throw new Error(`Accept-Patch entry "${mediaTypeText}" must use valid HTTP token syntax`);
    }

    for (const parameter of mediaType.parameters) {
        const normalizedName = parameter.name.trim().toLowerCase();
        if (!TOKEN_CHARS.test(normalizedName)) {
            throw new Error(`Accept-Patch parameter name "${parameter.name}" must be a valid HTTP token`);
        }
    }

    return formatMediaType(type.type, type.subtype, mediaType.parameters as AcceptPatchParameter[]);
}
