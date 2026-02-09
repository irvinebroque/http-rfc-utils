import assert from 'node:assert/strict';

const CTL_RE = /[\u0000-\u001f\u007f]/;

export function assertNoControlBytes(value: string, context: string): void {
    assert.equal(
        CTL_RE.test(value),
        false,
        `${context} must not contain control bytes`,
    );
}

export function assertNullPrototypeRecord(
    record: Record<string, unknown>,
    context: string,
): void {
    assert.equal(
        Object.getPrototypeOf(record),
        null,
        `${context} should use a null-prototype map`,
    );
}
