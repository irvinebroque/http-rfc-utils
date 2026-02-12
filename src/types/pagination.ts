/**
 * Pagination shared types and type guards used by helpers in `src/pagination.ts`.
 *
 * These contracts are API-convention oriented rather than RFC-defined.
 */

export interface PaginationParams {
    limit: number;
    offset: number;
    sort?: string;
}

export interface PaginationError {
    error: string;
}

export type PaginationResult = PaginationParams | PaginationError;

export interface DecodedCursor {
    offset: number;
}

export interface PaginatedMeta {
    totalCount: number;
    pageSize: number;
    timestamp: string;
}

/**
 * Type guard for pagination parser error results.
 */
export function isPaginationError(result: PaginationResult): result is PaginationError {
    return 'error' in result;
}

/**
 * Type guard for successful pagination parser results.
 */
export function isPaginationParams(result: PaginationResult): result is PaginationParams {
    return 'limit' in result && 'offset' in result;
}
