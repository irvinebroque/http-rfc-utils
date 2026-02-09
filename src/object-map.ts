/**
 * Internal helpers for dynamic key maps.
 * @internal
 */

export function createObjectMap<T>(): Record<string, T> {
    return Object.create(null) as Record<string, T>;
}

export function hasOwnKey<T extends object, K extends PropertyKey>(
    record: T,
    key: K
): key is Extract<K, keyof T> {
    return Object.hasOwn(record, key);
}

export function pushObjectMapArrayValue(
    record: Record<string, string[]>,
    key: string,
    value: string
): void {
    if (!hasOwnKey(record, key)) {
        record[key] = [value];
        return;
    }

    const existing = record[key];
    if (existing === undefined) {
        record[key] = [value];
        return;
    }

    existing.push(value);
}
