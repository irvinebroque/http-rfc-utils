/**
 * Problem Details type contracts.
 * RFC 9457.
 * @see https://www.rfc-editor.org/rfc/rfc9457.html
 */

export interface ProblemDetails {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    instance?: string;
    [key: string]: unknown; // Extension members
}

export interface ProblemOptions {
    type?: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
    extensions?: Record<string, unknown>;
}
