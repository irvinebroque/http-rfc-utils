/**
 * Additional HTTP status code helpers (RFC 6585).
 * RFC 6585 §3, §4, §5, §6.
 * @see https://www.rfc-editor.org/rfc/rfc6585.html
 */

export type Rfc6585StatusCode = 428 | 429 | 431 | 511;

export type Rfc6585ReasonPhrase =
    | 'Precondition Required'
    | 'Too Many Requests'
    | 'Request Header Fields Too Large'
    | 'Network Authentication Required';

export type Rfc6585Section = '3' | '4' | '5' | '6';

export interface Rfc6585StatusInfo {
    code: Rfc6585StatusCode;
    reasonPhrase: Rfc6585ReasonPhrase;
    section: Rfc6585Section;
    cacheControl: 'no-store';
}

export interface Rfc6585HeadersOptions {
    retryAfter?: Date | number;
}
