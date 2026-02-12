/**
 * Structured Field Values type wrappers and contracts.
 * RFC 8941 and RFC 9651.
 * @see https://www.rfc-editor.org/rfc/rfc8941.html
 * @see https://www.rfc-editor.org/rfc/rfc9651.html
 */

/**
 * Date bare item per RFC 9651 Section 3.3.7.
 * Wraps a Unix timestamp in seconds to distinguish from plain numbers.
 */
export class SfDate {
    /** Unix timestamp in seconds */
    readonly timestamp: number;

    constructor(timestamp: number) {
        if (!Number.isInteger(timestamp)) {
            throw new Error('SfDate timestamp must be an integer');
        }
        this.timestamp = timestamp;
    }

    /** Convert to JavaScript Date */
    toDate(): Date {
        return new Date(this.timestamp * 1000);
    }

    /** Create from JavaScript Date */
    static fromDate(date: Date): SfDate {
        return new SfDate(Math.floor(date.getTime() / 1000));
    }
}

/**
 * Token bare item per RFC 8941 Section 3.3.4.
 *
 * Distinguishes tokens from strings so serializers can preserve type fidelity.
 */
export class SfToken {
    readonly value: string;

    constructor(value: string) {
        this.value = value;
    }
}

/**
 * Display String bare item per RFC 9651 Section 3.3.8.
 *
 * Distinguishes display strings from sf-string so callers can preserve
 * round-trip type fidelity and opt into unicode display semantics explicitly.
 */
export class SfDisplayString {
    readonly value: string;

    constructor(value: string) {
        this.value = value;
    }
}

export type SfBareItem = number | string | boolean | Uint8Array | SfDate | SfToken | SfDisplayString;

export interface SfItem {
    value: SfBareItem;
    params?: Record<string, SfBareItem>;
}

export type SfInnerList = { items: SfItem[]; params?: Record<string, SfBareItem> };
export type SfList = Array<SfItem | SfInnerList>;
export type SfDictionary = Record<string, SfItem | SfInnerList>;
