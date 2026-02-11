/**
 * Content negotiation-related types.
 * RFC 7231, RFC 5789, RFC 7240, RFC 9110, RFC 4647.
 * @see https://www.rfc-editor.org/rfc/rfc7231.html
 */

// Content Negotiation (RFC 7231)
export interface AcceptEntry {
    type: string;
    subtype: string;
    q: number;
    params: Map<string, string>;
}

export type MediaType = 'json' | 'csv' | 'html' | 'text' | 'xml';

// Accept-Patch (RFC 5789)
export interface AcceptPatchParameter {
    name: string;
    value: string;
}

export interface AcceptPatchMediaType {
    type: string;
    subtype: string;
    parameters: AcceptPatchParameter[];
}

export interface OptionsResponseOptions {
    acceptPatch?: AcceptPatchMediaType[];
}

// CORS
export interface CorsOptions {
    origin?: string | string[] | '*';
    methods?: string[];
    allowHeaders?: string[];
    exposeHeaders?: string[];
    vary?: string;
    credentials?: boolean;
    maxAge?: number;
}

// Prefer / Preference-Applied (RFC 7240)
export interface PreferParam {
    key: string;
    value?: string;
}

export interface PreferToken {
    token: string;
    value?: string;
    params: PreferParam[];
}

export type PreferMap = Map<string, PreferToken>;

// Accept-Language (RFC 9110 + RFC 4647)
export interface LanguageRange {
    tag: string;
    q: number;
}

// Accept-Encoding (RFC 9110)
export interface EncodingRange {
    encoding: string;
    q: number;
}
