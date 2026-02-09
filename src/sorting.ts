/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Parsed sort field
 */
export interface SortField {
    field: string;
    direction: SortDirection;
}

/**
 * Parse a sort string into field/direction pairs.
 *
 * Format: "field1,-field2,field3"
 * - Prefix with '-' for descending
 * - No prefix for ascending
 * - Multiple fields separated by comma
 *
 * @param sort - The sort string
 * @returns Array of SortField objects
 */
export function parseSortString(sort: string): SortField[] {
    if (!sort || !sort.trim()) {
        return [];
    }

    return sort
        .split(',')
        .map(field => field.trim())
        .filter(field => field.length > 0)
        .map(field => {
            if (field.startsWith('-')) {
                return {
                    field: field.slice(1),
                    direction: 'desc' as SortDirection
                };
            }
            return {
                field,
                direction: 'asc' as SortDirection
            };
        });
}

function getNestedValueByParts(obj: Record<string, unknown>, parts: string[]): unknown {
    let current: unknown = obj;

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== 'object') {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}

function compileNestedAccessor(path: string): (obj: Record<string, unknown>) => unknown {
    const parts = path.split('.');
    return (obj: Record<string, unknown>) => getNestedValueByParts(obj, parts);
}

/**
 * Compare two values for sorting.
 * Internal helper exposed for custom comparators.
 *
 * @param a - First value
 * @param b - Second value
 * @param direction - Sort direction
 * @returns Comparison result (-1, 0, 1)
 */
export function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
    const multiplier = direction === 'desc' ? -1 : 1;

    // Handle null/undefined - always sort last
    const aIsNullish = a === null || a === undefined;
    const bIsNullish = b === null || b === undefined;

    if (aIsNullish && bIsNullish) {
        return 0;
    }
    if (aIsNullish) {
        return 1; // a sorts last regardless of direction
    }
    if (bIsNullish) {
        return -1; // b sorts last regardless of direction
    }

    // Handle dates
    if (a instanceof Date && b instanceof Date) {
        return multiplier * (a.getTime() - b.getTime());
    }

    // Handle booleans (false < true)
    if (typeof a === 'boolean' && typeof b === 'boolean') {
        if (a === b) return 0;
        return multiplier * (a ? 1 : -1);
    }

    // Handle numbers
    if (typeof a === 'number' && typeof b === 'number') {
        return multiplier * (a - b);
    }

    // Handle strings (case-insensitive)
    if (typeof a === 'string' && typeof b === 'string') {
        const comparison = a.toLowerCase().localeCompare(b.toLowerCase());
        return multiplier * comparison;
    }

    // Mixed types - convert to strings for comparison
    const aStr = String(a).toLowerCase();
    const bStr = String(b).toLowerCase();
    return multiplier * aStr.localeCompare(bStr);
}

/**
 * Apply sorting to an array of objects.
 *
 * @param data - Array to sort (not mutated, returns new array)
 * @param sort - Sort string (e.g., "-date,title")
 * @returns Sorted array
 *
 * Sorting rules:
 * - undefined/null values sort last
 * - Strings are compared case-insensitively
 * - Numbers compared numerically
 * - Dates compared by timestamp
 * - Booleans: false sorts before true
 * - Multiple sort fields applied in order
 */
export function applySorting<T extends Record<string, unknown>>(
    data: T[],
    sort: string | undefined
): T[] {
    if (!sort || !sort.trim()) {
        return data;
    }

    const sortFields = parseSortString(sort);

    if (sortFields.length === 0) {
        return data;
    }

    const compiledFields = sortFields.map(({ field, direction }) => ({
        direction,
        getValue: compileNestedAccessor(field),
    }));

    // Create shallow copy to avoid mutating input
    const result = [...data];

    result.sort((a, b) => {
        for (const { direction, getValue } of compiledFields) {
            const aValue = getValue(a);
            const bValue = getValue(b);

            const comparison = compareValues(aValue, bValue, direction);

            if (comparison !== 0) {
                return comparison;
            }
        }
        return 0;
    });

    return result;
}

/**
 * Validate that sort fields exist in the data.
 *
 * @param sort - Sort string
 * @param allowedFields - Array of allowed field names
 * @returns true if all fields are allowed, false otherwise
 */
export function validateSortFields(sort: string, allowedFields: string[]): boolean {
    const sortFields = parseSortString(sort);

    if (sortFields.length === 0) {
        return true;
    }

    const allowedSet = new Set(allowedFields);

    return sortFields.every(({ field }) => allowedSet.has(field));
}

/**
 * Build a sort string from field/direction pairs.
 * Inverse of parseSortString.
 *
 * @param fields - Array of SortField objects
 * @returns Sort string
 */
export function buildSortString(fields: SortField[]): string {
    return fields
        .map(({ field, direction }) => {
            return direction === 'desc' ? `-${field}` : field;
        })
        .join(',');
}
