/**
 * HTTP message signature types.
 * RFC 9421.
 * @see https://www.rfc-editor.org/rfc/rfc9421.html
 */

/**
 * Component identifier parameter flags.
 * RFC 9421 Section 2.1.
 */
export interface SignatureComponentParams {
    sf?: boolean;
    key?: string;
    bs?: boolean;
    req?: boolean;
    tr?: boolean;
}

/**
 * A component identifier for signature base creation.
 * RFC 9421 Section 2.
 */
export interface SignatureComponent {
    name: string;
    params?: SignatureComponentParams;
}

/**
 * Signature parameters.
 * RFC 9421 Section 2.3.
 */
export interface SignatureParams {
    created?: number;
    expires?: number;
    nonce?: string;
    alg?: string;
    keyid?: string;
    tag?: string;
}

/**
 * Parsed Signature-Input entry.
 * RFC 9421 Section 4.1.
 */
export interface SignatureInput {
    label: string;
    components: SignatureComponent[];
    params?: SignatureParams;
}

/**
 * Parsed Signature entry.
 * RFC 9421 Section 4.2.
 */
export interface Signature {
    label: string;
    value: Uint8Array;
}

/**
 * Derived component names.
 * RFC 9421 Section 2.2.
 */
export type DerivedComponentName =
    | '@method'
    | '@target-uri'
    | '@authority'
    | '@scheme'
    | '@request-target'
    | '@path'
    | '@query'
    | '@query-param'
    | '@status';

/**
 * Message context for signature base creation.
 * RFC 9421 Section 2.
 */
export interface SignatureMessageContext {
    method?: string;
    targetUri?: string;
    authority?: string;
    scheme?: string;
    path?: string;
    query?: string;
    status?: number;
    headers: Map<string, string[]>;
    trailers?: Map<string, string[]>;
    request?: SignatureMessageContext;
}

/**
 * Result of signature base creation.
 * RFC 9421 Section 2.5.
 */
export interface SignatureBaseResult {
    base: string;
    signatureParams: string;
}
