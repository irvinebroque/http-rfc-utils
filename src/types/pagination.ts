// Pagination shared types and guards.
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

export function isPaginationError(result: PaginationResult): result is PaginationError {
    return 'error' in result;
}

export function isPaginationParams(result: PaginationResult): result is PaginationParams {
    return 'limit' in result && 'offset' in result;
}
