/**
 * Priority header utilities per RFC 9218.
 * RFC 9218 §4, §5, §8.
 * @see https://www.rfc-editor.org/rfc/rfc9218.html#section-4
 */

import type { PriorityField, RequiredPriority, SfDictionary } from './types.js';
import { parseSfDict, serializeSfDict } from './structured-fields.js';
import { isSfItem } from './structured-field-helpers.js';

const DEFAULT_URGENCY = 3;
const MIN_URGENCY = 0;
const MAX_URGENCY = 7;

function isValidUrgency(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isInteger(value)
        && value >= MIN_URGENCY
        && value <= MAX_URGENCY;
}

/**
 * Parse a Priority header field value.
 *
 * RFC 9218 §5 defines Priority as an SF Dictionary. This parser is strict at
 * dictionary parsing (invalid SF returns null) and permissive at member
 * semantics (invalid/unknown members are ignored) per RFC 9218 §4.
 */
// RFC 9218 §5: Priority field value is a Structured Field Dictionary.
export function parsePriority(header: string): PriorityField | null {
    if (!header || !header.trim()) {
        return null;
    }

    const dict = parseSfDict(header.trim());
    if (!dict) {
        return null;
    }

    const parsed: PriorityField = {};

    const urgencyMember = dict.u;
    // RFC 9218 §4.1: u is an Integer in the range 0..7.
    if (urgencyMember && isSfItem(urgencyMember) && isValidUrgency(urgencyMember.value)) {
        parsed.u = urgencyMember.value;
    }

    const incrementalMember = dict.i;
    // RFC 9218 §4.2: i is a Boolean.
    if (incrementalMember && isSfItem(incrementalMember) && typeof incrementalMember.value === 'boolean') {
        parsed.i = incrementalMember.value;
    }

    return parsed;
}

/**
 * Apply RFC 9218 request defaults to a parsed or partial Priority value.
 */
// RFC 9218 §4.1 and §4.2: default u=3 and i=false.
export function applyPriorityDefaults(priority?: PriorityField | null): RequiredPriority {
    const merged: RequiredPriority = {
        u: DEFAULT_URGENCY,
        i: false,
    };

    if (priority?.u !== undefined && isValidUrgency(priority.u)) {
        merged.u = priority.u;
    }

    if (priority?.i !== undefined && typeof priority.i === 'boolean') {
        merged.i = priority.i;
    }

    return merged;
}

/**
 * Merge client and server Priority signals.
 *
 * Merge starts from client defaults, then applies explicit server members.
 */
// RFC 9218 §8: server and client signals can be merged.
export function mergePriority(
    clientPriority?: PriorityField | null,
    serverPriority?: PriorityField | null,
): RequiredPriority {
    const merged = applyPriorityDefaults(clientPriority);

    if (serverPriority?.u !== undefined && isValidUrgency(serverPriority.u)) {
        merged.u = serverPriority.u;
    }

    if (serverPriority?.i !== undefined && typeof serverPriority.i === 'boolean') {
        merged.i = serverPriority.i;
    }

    return merged;
}

/**
 * Format a Priority header field value.
 *
 * This serializer only emits explicit members provided by the caller.
 * Use applyPriorityDefaults() first when request-default materialization is
 * desired.
 */
// RFC 9218 §5: serialize as SF Dictionary members u and/or i.
export function formatPriority(priority: PriorityField): string {
    const dict: SfDictionary = {};

    if (priority.u !== undefined) {
        if (!isValidUrgency(priority.u)) {
            throw new Error('Invalid Priority urgency; expected integer 0..7');
        }
        dict.u = { value: priority.u };
    }

    if (priority.i !== undefined) {
        if (typeof priority.i !== 'boolean') {
            throw new Error('Invalid Priority incremental flag; expected boolean');
        }
        dict.i = { value: priority.i };
    }

    return serializeSfDict(dict);
}
