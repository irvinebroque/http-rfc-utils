/**
 * L4S ECN protocol utilities per RFC 9331.
 * RFC 9331 §2, §4.1, §5.1, §5.3, §8.
 * @see https://www.rfc-editor.org/rfc/rfc9331.html
 */

import type {
    EcnCodepoint,
    EcnCodepointBits,
    L4sClassificationOptions,
    L4sTreatment,
} from './types.js';

const ECN_CODEPOINT_BY_BITS: Record<EcnCodepointBits, EcnCodepoint> = {
    0: 'not-ect',
    1: 'ect(1)',
    2: 'ect(0)',
    3: 'ce',
};

const ECN_BITS_BY_CODEPOINT: Record<EcnCodepoint, EcnCodepointBits> = {
    'not-ect': 0,
    'ect(1)': 1,
    'ect(0)': 2,
    'ce': 3,
};

const ECN_LABEL_BY_CODEPOINT: Record<EcnCodepoint, string> = {
    'not-ect': 'Not-ECT',
    'ect(1)': 'ECT(1)',
    'ect(0)': 'ECT(0)',
    'ce': 'CE',
};

function parseEcnCodepointFromBits(value: number): EcnCodepoint | null {
    if (!Number.isInteger(value) || value < 0 || value > 3) {
        return null;
    }

    return ECN_CODEPOINT_BY_BITS[value as EcnCodepointBits] ?? null;
}

function parseEcnCodepointFromToken(value: string): EcnCodepoint | null {
    const normalized = value.trim().toLowerCase();

    switch (normalized) {
        case '00':
        case 'not-ect':
        case 'notect':
        case 'not_ect':
            return 'not-ect';
        case '01':
        case 'ect(1)':
        case 'ect1':
            return 'ect(1)';
        case '10':
        case 'ect(0)':
        case 'ect0':
            return 'ect(0)';
        case '11':
        case 'ce':
            return 'ce';
        default:
            return null;
    }
}

/**
 * Parse an ECN codepoint from binary/token text or 2-bit integer.
 */
// RFC 9331 §8 + IANA ECN registry: 00=Not-ECT, 01=ECT(1), 10=ECT(0), 11=CE.
export function parseEcnCodepoint(value: string | number): EcnCodepoint | null {
    if (typeof value === 'number') {
        return parseEcnCodepointFromBits(value);
    }

    if (!value || !value.trim()) {
        return null;
    }

    return parseEcnCodepointFromToken(value);
}

/**
 * Format an ECN codepoint using RFC keyword form.
 */
export function formatEcnCodepoint(codepoint: EcnCodepoint): string {
    const formatted = ECN_LABEL_BY_CODEPOINT[codepoint];
    if (!formatted) {
        throw new Error(`Invalid ECN codepoint: ${String(codepoint)}`);
    }

    return formatted;
}

/**
 * Format an ECN codepoint as a two-bit binary string.
 */
export function formatEcnCodepointBits(codepoint: EcnCodepoint): string {
    const bits = ECN_BITS_BY_CODEPOINT[codepoint];
    if (bits === undefined) {
        throw new Error(`Invalid ECN codepoint: ${String(codepoint)}`);
    }

    return bits.toString(2).padStart(2, '0');
}

/**
 * Check whether a codepoint is part of the L4S identifier scheme.
 */
// RFC 9331 §3 + §5.1: L4S identification uses ECT(1), with CE classified as L4S by default.
export function isL4sIdentifier(value: string | number): boolean {
    const codepoint = parseEcnCodepoint(value);
    if (!codepoint) {
        return false;
    }

    return codepoint === 'ect(1)' || codepoint === 'ce';
}

/**
 * Check whether a codepoint is valid for sender-side L4S marking.
 */
// RFC 9331 §4.1: senders requesting L4S treatment MUST set ECT(1).
export function isL4sSenderCodepoint(value: string | number): boolean {
    return parseEcnCodepoint(value) === 'ect(1)';
}

/**
 * Classify a packet for L4S or Classic treatment.
 */
// RFC 9331 §5.1 + §5.3: ECT(1)=L4S; CE defaults to L4S with a transport-aware exception.
export function classifyL4sTreatment(
    value: string | number,
    options: L4sClassificationOptions = {},
): L4sTreatment | null {
    const codepoint = parseEcnCodepoint(value);
    if (!codepoint) {
        return null;
    }

    if (options.override) {
        return options.override;
    }

    if (codepoint === 'ect(1)') {
        return 'l4s';
    }

    if (codepoint === 'ce') {
        if (options.classifyCeAsClassicIfFlowEct0Only === true) {
            return 'classic';
        }

        return 'l4s';
    }

    return 'classic';
}

/**
 * Validate L4S-specific ECN re-marking constraints.
 */
// RFC 9331 §5.1: ECT(1) MUST NOT change except to CE; CE MUST NOT change.
export function isL4sEcnTransitionAllowed(fromValue: string | number, toValue: string | number): boolean {
    const from = parseEcnCodepoint(fromValue);
    const to = parseEcnCodepoint(toValue);

    if (!from || !to) {
        return false;
    }

    if (from === 'ect(1)') {
        return to === 'ect(1)' || to === 'ce';
    }

    if (from === 'ce') {
        return to === 'ce';
    }

    return true;
}

/**
 * Apply L4S-disable fallback behavior to a codepoint.
 */
// RFC 9331 §5.1: when L4S is disabled, ECT(1) packets are treated as Not-ECT.
export function disableL4sCodepoint(value: string | number): EcnCodepoint | null {
    const codepoint = parseEcnCodepoint(value);
    if (!codepoint) {
        return null;
    }

    if (codepoint === 'ect(1)') {
        return 'not-ect';
    }

    return codepoint;
}
