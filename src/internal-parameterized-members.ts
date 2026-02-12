/**
 * Internal helpers for parameterized member parsing/formatting.
 * Shared shape: token[=value];param[=value] and similar variants.
 * @internal
 */

export interface InternalParsedKeyValueSegment {
    key: string;
    value: string | undefined;
    hasEquals: boolean;
}

export interface ParameterizedMember {
    raw: string;
    base: InternalParsedKeyValueSegment | null;
    parameters: InternalParsedKeyValueSegment[];
}

export interface ParseParameterizedMemberOptions {
    parameterDelimiter?: string;
    hasBaseSegment?: boolean;
    baseFromFirstSegment?: boolean;
}

export interface ParseParameterizedMembersOptions extends ParseParameterizedMemberOptions {
    memberDelimiter?: string;
}

function splitQuoted(input: string, delimiter: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let escaped = false;

    for (const char of input) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\' && inQuotes) {
            current += char;
            escaped = true;
            continue;
        }

        if (char === '"') {
            inQuotes = !inQuotes;
            current += char;
            continue;
        }

        if (char === delimiter && !inQuotes) {
            parts.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    parts.push(current);
    return parts;
}

export function parseParameterizedSegment(segment: string): InternalParsedKeyValueSegment | null {
    const trimmed = segment.trim();
    if (!trimmed) {
        return null;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
        return {
            key: trimmed,
            value: undefined,
            hasEquals: false,
        };
    }

    return {
        key: trimmed.slice(0, eqIndex).trim(),
        value: trimmed.slice(eqIndex + 1).trim(),
        hasEquals: true,
    };
}

export function splitAndParseParameterizedSegments(value: string, delimiter: string): InternalParsedKeyValueSegment[] {
    const parsed: InternalParsedKeyValueSegment[] = [];

    for (const segment of splitQuoted(value, delimiter)) {
        const item = parseParameterizedSegment(segment);
        if (item) {
            parsed.push(item);
        }
    }

    return parsed;
}

export function parseParameterizedMember(
    member: string,
    options: ParseParameterizedMemberOptions = {}
): ParameterizedMember {
    const parameterDelimiter = options.parameterDelimiter ?? ';';
    const hasBaseSegment = options.hasBaseSegment ?? true;
    const baseFromFirstSegment = options.baseFromFirstSegment ?? false;
    const segments = splitAndParseParameterizedSegments(member, parameterDelimiter);

    const raw = member.trim();

    if (!hasBaseSegment) {
        return {
            raw,
            base: null,
            parameters: segments,
        };
    }

    if (baseFromFirstSegment) {
        const rawSegments = splitQuoted(member, parameterDelimiter);
        const [baseSegmentRaw, ...parameterSegmentRaw] = rawSegments;
        const parameters: InternalParsedKeyValueSegment[] = [];

        for (const parameterRaw of parameterSegmentRaw) {
            const parsedParameter = parseParameterizedSegment(parameterRaw);
            if (parsedParameter) {
                parameters.push(parsedParameter);
            }
        }

        return {
            raw,
            base: parseParameterizedSegment(baseSegmentRaw ?? ''),
            parameters,
        };
    }

    const [base, ...parameters] = segments;
    return {
        raw,
        base: base ?? null,
        parameters,
    };
}

export function parseParameterizedMembers(
    value: string | readonly string[],
    options: ParseParameterizedMembersOptions = {}
): ParameterizedMember[] {
    const memberDelimiter = options.memberDelimiter ?? ',';
    const parameterDelimiter = options.parameterDelimiter ?? ';';
    const hasBaseSegment = options.hasBaseSegment ?? true;
    const baseFromFirstSegment = options.baseFromFirstSegment ?? false;
    const values = Array.isArray(value) ? value : [value];
    const parsed: ParameterizedMember[] = [];

    for (const rawValue of values) {
        for (const rawMember of splitQuoted(rawValue, memberDelimiter)) {
            const trimmedMember = rawMember.trim();
            if (!trimmedMember) {
                continue;
            }

            parsed.push(parseParameterizedMember(trimmedMember, {
                parameterDelimiter,
                hasBaseSegment,
                baseFromFirstSegment,
            }));
        }
    }

    return parsed;
}

export interface FormatParameterizedMemberOptions {
    parameterDelimiter?: string;
    includeSpaceAfterDelimiter?: boolean;
}

export function formatParameterizedMember(
    base: string,
    parameters: readonly string[] = [],
    options: FormatParameterizedMemberOptions = {}
): string {
    const parameterDelimiter = options.parameterDelimiter ?? ';';
    const includeSpaceAfterDelimiter = options.includeSpaceAfterDelimiter ?? true;

    if (parameters.length === 0) {
        return base;
    }

    const separator = includeSpaceAfterDelimiter ? `${parameterDelimiter} ` : parameterDelimiter;
    return `${base}${parameterDelimiter}${includeSpaceAfterDelimiter ? ' ' : ''}${parameters.join(separator)}`;
}
