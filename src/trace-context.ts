/**
 * Trace Context helpers for traceparent and tracestate.
 * W3C Trace Context §3.2, §3.3, §3.5, §4.2, §4.3.
 * @see https://www.w3.org/TR/trace-context/
 */

import type {
    ParsedTraceContext,
    TraceContextValidationResult,
    Traceparent,
    TracestateEntry,
} from './types.js';

const TRACEPARENT_VERSION = '00';
const TRACEPARENT_DELIMITER = '-';

const TRACE_ID_HEX_RE = /^[0-9a-f]{32}$/;
const PARENT_ID_HEX_RE = /^[0-9a-f]{16}$/;
const TRACE_FLAGS_HEX_RE = /^[0-9a-f]{2}$/;

const SIMPLE_TRACESTATE_KEY_RE = /^[a-z][a-z0-9_\-*/]{0,255}$/;
const TRACESTATE_VALUE_RE = /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,256}$/;
const MAX_TRACESTATE_MEMBERS = 32;
const MAX_TRACESTATE_LENGTH = 512;

interface TraceMutationOptions {
    sampled?: boolean;
    tracestate?: string | TracestateEntry[] | null;
}

function isAllZero(value: string): boolean {
    return /^0+$/.test(value);
}

function isValidTenantId(value: string): boolean {
    if (value.length < 1 || value.length > 241) {
        return false;
    }

    if (!/^[a-z0-9]/.test(value) || !/[a-z0-9]$/.test(value)) {
        return false;
    }

    return /^[a-z0-9_\-*/]+$/.test(value);
}

function isValidSystemId(value: string): boolean {
    if (value.length < 1 || value.length > 14) {
        return false;
    }

    if (!/^[a-z]/.test(value) || !/[a-z0-9]$/.test(value)) {
        return false;
    }

    return /^[a-z0-9_\-*/]+$/.test(value);
}

function isValidTracestateKey(key: string): boolean {
    if (key.length < 1 || key.length > 256) {
        return false;
    }

    if (SIMPLE_TRACESTATE_KEY_RE.test(key)) {
        return true;
    }

    const atIndex = key.indexOf('@');
    if (atIndex <= 0 || atIndex !== key.lastIndexOf('@')) {
        return false;
    }

    const tenantId = key.slice(0, atIndex);
    const systemId = key.slice(atIndex + 1);

    return isValidTenantId(tenantId) && isValidSystemId(systemId);
}

function isValidTracestateValue(value: string): boolean {
    return TRACESTATE_VALUE_RE.test(value);
}

function parseTraceparentParts(rawValue: string): [string, string, string, string] | null {
    const value = rawValue.trim();
    if (!value) {
        return null;
    }

    const parts = value.split(TRACEPARENT_DELIMITER);
    if (parts.length !== 4) {
        return null;
    }

    const [version, traceId, parentId, traceFlags] = parts;
    if (version === undefined || traceId === undefined || parentId === undefined || traceFlags === undefined) {
        return null;
    }

    return [version, traceId, parentId, traceFlags];
}

function parseTraceparentInput(input: string | Traceparent | null | undefined): Traceparent | null {
    if (input == null) {
        return null;
    }

    if (typeof input === 'string') {
        return parseTraceparent(input);
    }

    const candidate = `${input.version}-${input.traceId}-${input.parentId}-${input.traceFlags}`;
    return parseTraceparent(candidate);
}

function isTraceparentInputValid(input: string | Traceparent | null | undefined): boolean {
    if (input == null) {
        return false;
    }

    if (typeof input === 'string') {
        return validateTraceparent(input).valid;
    }

    const candidate = `${input.version}-${input.traceId}-${input.parentId}-${input.traceFlags}`;
    return validateTraceparent(candidate).valid;
}

function toTracestateEntries(input: string | TracestateEntry[] | null | undefined): TracestateEntry[] | null {
    if (input == null) {
        return [];
    }

    if (typeof input === 'string') {
        return parseTracestate(input);
    }

    const seenKeys = new Set<string>();
    for (const entry of input) {
        if (!isValidTracestateKey(entry.key) || !isValidTracestateValue(entry.value)) {
            return null;
        }
        if (seenKeys.has(entry.key)) {
            return null;
        }
        seenKeys.add(entry.key);
    }

    return [...input];
}

function setSampledFlag(traceFlags: string, sampled: boolean): string {
    const byte = Number.parseInt(traceFlags, 16);
    const nextByte = sampled ? (byte | 0x01) : (byte & 0xfe);
    return nextByte.toString(16).padStart(2, '0');
}

function randomHex(bytes: number): string {
    const array = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, (value) => value.toString(16).padStart(2, '0')).join('');
}

function randomNonZeroHex(bytes: number): string {
    let value = randomHex(bytes);
    while (isAllZero(value)) {
        value = randomHex(bytes);
    }
    return value;
}

/**
 * Parse a traceparent header value.
 *
 * W3C Trace Context §3.2.
 */
export function parseTraceparent(value: string): Traceparent | null {
    const validation = validateTraceparent(value);
    if (!validation.valid) {
        return null;
    }

    const parts = parseTraceparentParts(value);
    if (!parts) {
        return null;
    }

    const [version, traceId, parentId, traceFlags] = parts;
    return {
        version,
        traceId,
        parentId,
        traceFlags,
    };
}

/**
 * Format a traceparent header value.
 *
 * W3C Trace Context §3.2.2.
 */
export function formatTraceparent(traceparent: Traceparent): string {
    const candidate = `${traceparent.version}-${traceparent.traceId}-${traceparent.parentId}-${traceparent.traceFlags}`;
    const validation = validateTraceparent(candidate);
    if (!validation.valid) {
        throw new Error(`Invalid traceparent: ${validation.errors.join('; ')}`);
    }
    return candidate;
}

/**
 * Validate a traceparent header value.
 *
 * W3C Trace Context §3.2.2.3 and §3.2.2.4.
 */
export function validateTraceparent(value: string): TraceContextValidationResult {
    const errors: string[] = [];

    const parts = parseTraceparentParts(value);
    if (!parts) {
        return { valid: false, errors: ['traceparent must contain 4 dash-delimited fields'] };
    }

    const [version, traceId, parentId, traceFlags] = parts;

    if (!TRACE_FLAGS_HEX_RE.test(version)) {
        errors.push('version must be 2 lowercase hex characters');
    } else if (version === 'ff') {
        errors.push('version ff is invalid');
    } else if (version !== TRACEPARENT_VERSION) {
        errors.push('only traceparent version 00 is supported');
    }

    if (!TRACE_ID_HEX_RE.test(traceId)) {
        errors.push('trace-id must be 32 lowercase hex characters');
    } else if (isAllZero(traceId)) {
        errors.push('trace-id must not be all zeros');
    }

    if (!PARENT_ID_HEX_RE.test(parentId)) {
        errors.push('parent-id must be 16 lowercase hex characters');
    } else if (isAllZero(parentId)) {
        errors.push('parent-id must not be all zeros');
    }

    if (!TRACE_FLAGS_HEX_RE.test(traceFlags)) {
        errors.push('trace-flags must be 2 lowercase hex characters');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Parse a tracestate header value.
 *
 * W3C Trace Context §3.3.1.
 */
export function parseTracestate(value: string): TracestateEntry[] | null {
    const validation = validateTracestate(value);
    if (!validation.valid) {
        return null;
    }

    const entries: TracestateEntry[] = [];
    for (const rawMember of value.trim().split(',')) {
        const member = rawMember.trim();
        const index = member.indexOf('=');
        const key = member.slice(0, index);
        const entryValue = member.slice(index + 1);

        entries.push({
            key,
            value: entryValue,
        });
    }

    return entries;
}

/**
 * Format a tracestate header value.
 *
 * W3C Trace Context §3.3.1.5.
 */
export function formatTracestate(entries: TracestateEntry[]): string {
    const truncated = truncateTracestate(entries) ?? [];
    const serialized = truncated.map((entry) => `${entry.key}=${entry.value}`).join(',');
    const validation = validateTracestate(serialized);
    if (!validation.valid && serialized !== '') {
        throw new Error(`Invalid tracestate: ${validation.errors.join('; ')}`);
    }
    return serialized;
}

/**
 * Validate a tracestate header value.
 *
 * W3C Trace Context §3.3.1.3.
 */
export function validateTracestate(value: string): TraceContextValidationResult {
    const errors: string[] = [];
    const trimmed = value.trim();

    if (!trimmed) {
        return { valid: false, errors: ['tracestate must not be empty'] };
    }

    if (trimmed.length > MAX_TRACESTATE_LENGTH) {
        errors.push(`tracestate must not exceed ${MAX_TRACESTATE_LENGTH} characters`);
    }

    const entries = trimmed.split(',');
    if (entries.length > MAX_TRACESTATE_MEMBERS) {
        errors.push(`tracestate must not exceed ${MAX_TRACESTATE_MEMBERS} list-members`);
    }

    const seenKeys = new Set<string>();

    for (const rawEntry of entries) {
        const entry = rawEntry.trim();
        if (!entry) {
            errors.push('tracestate contains an empty list-member');
            continue;
        }

        const index = entry.indexOf('=');
        if (index <= 0 || index !== entry.lastIndexOf('=')) {
            errors.push(`invalid tracestate list-member: ${entry}`);
            continue;
        }

        const key = entry.slice(0, index);
        const entryValue = entry.slice(index + 1);

        if (!isValidTracestateKey(key)) {
            errors.push(`invalid tracestate key: ${key}`);
        }

        if (!isValidTracestateValue(entryValue)) {
            errors.push(`invalid tracestate value for key: ${key}`);
        }

        if (seenKeys.has(key)) {
            errors.push(`duplicate tracestate key: ${key}`);
        }
        seenKeys.add(key);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Update parent-id for downstream propagation.
 *
 * W3C Trace Context §3.4 and §4.3.
 */
export function updateTraceparentParent(
    traceparent: string | Traceparent,
    options: TraceMutationOptions = {},
): ParsedTraceContext {
    const current = parseTraceparentInput(traceparent);

    if (!current) {
        return {
            traceparent: null,
            tracestate: [],
        };
    }

    const traceFlags = options.sampled === undefined
        ? current.traceFlags
        : setSampledFlag(current.traceFlags, options.sampled);

    const next: Traceparent = {
        version: current.version,
        traceId: current.traceId,
        parentId: randomNonZeroHex(8),
        traceFlags,
    };

    const tracestate = toTracestateEntries(options.tracestate) ?? [];

    return {
        traceparent: next,
        tracestate,
    };
}

/**
 * Restart tracing with new identifiers.
 *
 * W3C Trace Context §4.2 and §4.3.
 */
export function restartTraceparent(
    traceparent?: string | Traceparent | null,
    options: TraceMutationOptions = {},
): ParsedTraceContext {
    const current = parseTraceparentInput(traceparent);

    const sampled = options.sampled
        ?? (current ? (Number.parseInt(current.traceFlags, 16) & 0x01) === 0x01 : false);

    const next: Traceparent = {
        version: TRACEPARENT_VERSION,
        traceId: randomNonZeroHex(16),
        parentId: randomNonZeroHex(8),
        traceFlags: sampled ? '01' : '00',
    };

    if (traceparent != null && !current) {
        return {
            traceparent: next,
            tracestate: [],
        };
    }

    const tracestate = toTracestateEntries(options.tracestate) ?? [];

    return {
        traceparent: next,
        tracestate,
    };
}

/**
 * Add or update a tracestate list-member and keep newest first.
 *
 * W3C Trace Context §3.5.
 */
export function addOrUpdateTracestate(
    tracestate: string | TracestateEntry[] | null | undefined,
    key: string,
    value: string,
    traceparent?: string | Traceparent | null,
): TracestateEntry[] | null {
    if (traceparent !== undefined && traceparent !== null && !isTraceparentInputValid(traceparent)) {
        return [];
    }

    if (!isValidTracestateKey(key) || !isValidTracestateValue(value)) {
        return null;
    }

    const entries = toTracestateEntries(tracestate);
    if (entries == null) {
        return null;
    }

    const withoutKey = entries.filter((entry) => entry.key !== key);
    const next = [{ key, value }, ...withoutKey];

    return truncateTracestate(next);
}

/**
 * Remove a tracestate list-member by key.
 */
export function removeTracestateKey(
    tracestate: string | TracestateEntry[] | null | undefined,
    key: string,
    traceparent?: string | Traceparent | null,
): TracestateEntry[] | null {
    if (traceparent !== undefined && traceparent !== null && !isTraceparentInputValid(traceparent)) {
        return [];
    }

    if (!isValidTracestateKey(key)) {
        return null;
    }

    const entries = toTracestateEntries(tracestate);
    if (entries == null) {
        return null;
    }

    return entries.filter((entry) => entry.key !== key);
}

/**
 * Enforce tracestate size limits while preserving order.
 *
 * W3C Trace Context §3.3.1.5.
 */
export function truncateTracestate(
    tracestate: string | TracestateEntry[] | null | undefined,
    maxMembers = MAX_TRACESTATE_MEMBERS,
    maxLength = MAX_TRACESTATE_LENGTH,
    traceparent?: string | Traceparent | null,
): TracestateEntry[] | null {
    if (traceparent !== undefined && traceparent !== null && !isTraceparentInputValid(traceparent)) {
        return [];
    }

    if (!Number.isInteger(maxMembers) || maxMembers < 0) {
        return null;
    }

    if (!Number.isInteger(maxLength) || maxLength < 0) {
        return null;
    }

    const entries = toTracestateEntries(tracestate);
    if (entries == null) {
        return null;
    }

    const truncated: TracestateEntry[] = [];

    for (const entry of entries) {
        if (!isValidTracestateKey(entry.key) || !isValidTracestateValue(entry.value)) {
            return null;
        }

        if (truncated.length >= maxMembers) {
            break;
        }

        const candidate = [...truncated, entry];
        const serializedCandidate = candidate.map((item) => `${item.key}=${item.value}`).join(',');

        if (serializedCandidate.length > maxLength) {
            break;
        }

        truncated.push(entry);
    }

    return truncated;
}
