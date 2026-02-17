/**
 * Shared header-focused type contracts.
 * RFC 7239, RFC 6266, RFC 8187, RFC 7838, RFC 8470, RFC 8942, RFC 9218,
 * RFC 9331, RFC 9842.
 * @see https://github.com/irvinebroque/http-rfc-utils/blob/main/docs/reference/rfc-map.md
 */

// Forwarded (RFC 7239)
export interface ForwardedElement {
    for?: string;
    by?: string;
    host?: string;
    proto?: string;
    extensions?: Record<string, string>;
}

// Content-Disposition (RFC 6266 + RFC 8187)
export interface ContentDisposition {
    type: string;
    params: Record<string, string>;
}

export interface DispositionParams {
    filename?: string;
    filenameStar?: { value: string; language?: string };
    [key: string]: string | { value: string; language?: string } | undefined;
}

export interface ParamOptions {
    extended?: boolean;
    language?: string;
}

// Extended parameter value (RFC 8187)
export interface ExtValue {
    charset: string;
    language?: string;
    value: string;
}

export interface ExtValueOptions {
    language?: string;
}

// Compression Dictionary Transport (RFC 9842)
export interface UseAsDictionary {
    match: string;
    matchDest: string[];
    id: string;
    type: string;
}

export interface StoredDictionary extends UseAsDictionary {
    url: string;
    hash: Uint8Array;
    fetchedAt: Date;
}

export interface DictionaryMatchOptions {
    requestDestination?: string | null;
    supportsRequestDestination?: boolean;
    allowUnsupportedType?: boolean;
    supportedTypes?: readonly string[];
}

// Alternative Services (RFC 7838)
export interface AltSvcAlternative {
    protocolId: string;
    authority: string;
    ma?: number;
    persist?: boolean;
}

export interface AltSvcRecord {
    clear: boolean;
    alternatives: AltSvcAlternative[];
}

export interface AltUsed {
    host: string;
    port?: number;
}

// Early-Data (RFC 8470)
export type EarlyDataValue = 1;

export interface EarlyData425Options {
    requestInEarlyData?: boolean;
    earlyData?: Request | Headers | string | string[] | null;
}

// Client Hints (RFC 8942)
export type ClientHintToken = string;
export type ClientHintList = string[];

// Priority (RFC 9218)

/**
 * Priority field members from RFC 9218.
 *
 * Members are optional because they can be omitted in header values. Apply
 * defaults with applyPriorityDefaults() when request semantics are needed.
 */
export interface PriorityField {
    /** RFC 9218 Section 4.1: urgency in range 0..7 (lower is higher priority). */
    u?: number;
    /** RFC 9218 Section 4.2: incremental delivery preference. */
    i?: boolean;
}

/**
 * Priority values after RFC 9218 defaults are applied.
 */
export interface RequiredPriority {
    u: number;
    i: boolean;
}

// L4S ECN protocol (RFC 9331 + RFC 3168)
export type EcnCodepoint = 'not-ect' | 'ect(0)' | 'ect(1)' | 'ce';

export type EcnCodepointBits = 0 | 1 | 2 | 3;

export type L4sTreatment = 'classic' | 'l4s';

export interface L4sClassificationOptions {
    override?: L4sTreatment;
    classifyCeAsClassicIfFlowEct0Only?: boolean;
}
