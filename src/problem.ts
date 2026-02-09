/**
 * Problem Details utilities per RFC 9457.
 * RFC 9457 §3.1, §3.2, §4.1.
 */

import type { ProblemDetails, ProblemOptions } from './types.js';
import { defaultCorsHeaders } from './cors.js';

/**
 * Create a Problem Details object per RFC 9457.
 *
 * @param options - Problem configuration
 * @returns Problem Details object
 *
 * RFC 9457 members:
 * - type: URI reference identifying problem type (default: 'about:blank')
 * - title: Short human-readable summary
 * - status: HTTP status code
 * - detail: Human-readable explanation specific to this occurrence
 * - instance: URI reference identifying specific occurrence (optional)
 *
 * Extension members from options.extensions are spread into the result.
 */
// RFC 9457 §3.1, §3.2: Problem Details members and extensions.
export function createProblem(options: ProblemOptions): ProblemDetails {
    const problem: ProblemDetails = {
        type: options.type ?? 'about:blank',
        title: options.title,
        status: options.status,
        detail: options.detail,
    };

    if (options.instance !== undefined) {
        problem.instance = options.instance;
    }

    if (options.extensions) {
        Object.assign(problem, options.extensions);
    }

    return problem;
}

/**
 * Create a Problem Details Response with proper headers.
 *
 * @param options - Problem configuration
 * @param corsHeaders - Optional CORS headers (defaults to defaultCorsHeaders)
 */
// RFC 9457 §3.1, §3.2, §4.1: Problem Details response and media type.
export function problemResponse(options: ProblemOptions, corsHeaders?: Record<string, string>): Response;
/**
 * Create a Problem Details Response with proper headers.
 *
 * @param status - HTTP status code
 * @param title - Error title
 * @param detail - Error detail
 * @param instance - Optional instance URI
 */
// RFC 9457 §3.1, §3.2, §4.1: Problem Details response and media type.
export function problemResponse(status: number, title: string, detail: string, instance?: string): Response;
export function problemResponse(
    optionsOrStatus: ProblemOptions | number,
    titleOrCorsHeaders?: string | Record<string, string>,
    detail?: string,
    instance?: string
): Response {
    let problem: ProblemDetails;
    let cors: Record<string, string>;

    if (typeof optionsOrStatus === 'number') {
        // Backward-compatible signature: (status, title, detail, instance?)
        const legacyOptions: ProblemOptions = {
            status: optionsOrStatus,
            title: titleOrCorsHeaders as string,
            detail: detail!,
        };
        if (instance !== undefined) {
            legacyOptions.instance = instance;
        }

        problem = createProblem(legacyOptions);
        cors = defaultCorsHeaders;
    } else {
        // Full options object: (options, corsHeaders?)
        problem = createProblem(optionsOrStatus);
        cors = (titleOrCorsHeaders as Record<string, string> | undefined) ?? defaultCorsHeaders;
    }

    return new Response(JSON.stringify(problem), {
        status: problem.status,
        headers: {
            'Content-Type': 'application/problem+json',
            ...cors,
        },
    });
}

function createCommonProblemOptions(
    status: number,
    title: string,
    detail: string,
    instance?: string,
    extensions?: Record<string, unknown>
): ProblemOptions {
    const options: ProblemOptions = {
        status,
        title,
        detail,
    };

    if (instance !== undefined) {
        options.instance = instance;
    }
    if (extensions !== undefined) {
        options.extensions = extensions;
    }

    return options;
}

/**
 * Common HTTP error responses as Problem Details
 */
// RFC 9457 §3.1: Problem Details members populated by helpers.
export const Problems = {
    badRequest: (detail: string, instance?: string) =>
        problemResponse(createCommonProblemOptions(400, 'Bad Request', detail, instance)),

    unauthorized: (detail: string, instance?: string) =>
        problemResponse(createCommonProblemOptions(401, 'Unauthorized', detail, instance)),

    forbidden: (detail: string, instance?: string) =>
        problemResponse(createCommonProblemOptions(403, 'Forbidden', detail, instance)),

    notFound: (detail: string, instance?: string) =>
        problemResponse(createCommonProblemOptions(404, 'Not Found', detail, instance)),

    methodNotAllowed: (detail: string, allowed: string[], instance?: string) =>
        problemResponse(createCommonProblemOptions(405, 'Method Not Allowed', detail, instance, { allowed })),

    conflict: (detail: string, instance?: string) =>
        problemResponse(createCommonProblemOptions(409, 'Conflict', detail, instance)),

    gone: (detail: string, instance?: string) =>
        problemResponse(createCommonProblemOptions(410, 'Gone', detail, instance)),

    unprocessableEntity: (detail: string, errors?: unknown[], instance?: string) =>
        problemResponse(
            createCommonProblemOptions(
                422,
                'Unprocessable Entity',
                detail,
                instance,
                errors ? { errors } : undefined
            )
        ),

    tooManyRequests: (detail: string, retryAfter?: number, instance?: string) =>
        problemResponse(
            createCommonProblemOptions(
                429,
                'Too Many Requests',
                detail,
                instance,
                retryAfter !== undefined ? { retryAfter } : undefined
            )
        ),

    internalServerError: (detail: string, instance?: string) =>
        problemResponse(createCommonProblemOptions(500, 'Internal Server Error', detail, instance)),

    serviceUnavailable: (detail: string, retryAfter?: number, instance?: string) =>
        problemResponse(
            createCommonProblemOptions(
                503,
                'Service Unavailable',
                detail,
                instance,
                retryAfter !== undefined ? { retryAfter } : undefined
            )
        ),
} as const;
