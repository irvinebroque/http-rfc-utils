/**
 * Tests for json merge patch behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { JsonMergePatchDocument } from '../src/types.js';
import {
    MERGE_PATCH_CONTENT_TYPE,
    parseJsonMergePatch,
    formatJsonMergePatch,
    validateJsonMergePatch,
    applyJsonMergePatch,
} from '../src/json-merge-patch.js';

const MAX_JSON_MERGE_PATCH_DEPTH = 128;

function buildDeepObject(depth: number): JsonMergePatchDocument {
    let value: JsonMergePatchDocument = 'leaf';

    for (let i = 0; i < depth; i++) {
        value = { nested: value };
    }

    return value;
}

function buildDeepArray(depth: number): JsonMergePatchDocument {
    let value: JsonMergePatchDocument = 'leaf';

    for (let i = 0; i < depth; i++) {
        value = [value];
    }

    return value;
}

function buildCyclicObject(): Record<string, unknown> {
    const value: Record<string, unknown> = {};
    value.self = value;
    return value;
}

function buildCyclicArray(): unknown[] {
    const value: unknown[] = [];
    value.push(value);
    return value;
}

describe('JSON Merge Patch (RFC 7396 Sections 2-4, Appendix A)', () => {
    // RFC 7396 Section 4: media type registration.
    it('exports the JSON Merge Patch media type constant', () => {
        assert.equal(MERGE_PATCH_CONTENT_TYPE, 'application/merge-patch+json');
    });

    // RFC 7396 Section 2: Patch can be any JSON value.
    describe('parseJsonMergePatch', () => {
        it('accepts and clones valid JSON values', () => {
            const input = {
                title: 'Hello!',
                nested: { remove: null },
                tags: ['example'],
            };
            const parsed = parseJsonMergePatch(input);

            assert.deepEqual(parsed, {
                title: 'Hello!',
                nested: { remove: null },
                tags: ['example'],
            });
            assert.notEqual(parsed, null);
            assert.notEqual(parsed, input);
        });

        it('returns null for syntax-level invalid runtime values', () => {
            assert.equal(parseJsonMergePatch(undefined), null);
            assert.equal(parseJsonMergePatch(Number.NaN), null);
            assert.equal(parseJsonMergePatch(Number.POSITIVE_INFINITY), null);
            assert.equal(parseJsonMergePatch({ bad: undefined }), null);
            assert.equal(parseJsonMergePatch([1, undefined]), null);
            assert.equal(parseJsonMergePatch(() => 'nope'), null);
            assert.equal(parseJsonMergePatch(3n), null);
        });

        it('returns null for cyclic structures with deterministic handling', () => {
            assert.equal(parseJsonMergePatch(buildCyclicObject()), null);
            assert.equal(parseJsonMergePatch(buildCyclicArray()), null);
        });

        it('returns null when depth exceeds the safety limit', () => {
            assert.equal(parseJsonMergePatch(buildDeepObject(MAX_JSON_MERGE_PATCH_DEPTH + 1)), null);
            assert.equal(parseJsonMergePatch(buildDeepArray(MAX_JSON_MERGE_PATCH_DEPTH + 1)), null);
        });

        it('accepts documents at the depth safety limit boundary', () => {
            assert.notEqual(parseJsonMergePatch(buildDeepObject(MAX_JSON_MERGE_PATCH_DEPTH)), null);
            assert.notEqual(parseJsonMergePatch(buildDeepArray(MAX_JSON_MERGE_PATCH_DEPTH)), null);
        });

        it('accepts __proto__, constructor, and prototype keys without prototype pollution', () => {
            const parsed = parseJsonMergePatch(
                JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"marker":1}},"prototype":{"safe":true}}')
            );

            assert.notEqual(parsed, null);
            assert.equal(({} as Record<string, unknown>).polluted, undefined);
            assert.equal(Object.prototype.hasOwnProperty.call(parsed, '__proto__'), true);
            assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'constructor'), true);
            assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'prototype'), true);
        });
    });

    // RFC 7396 Section 2: strict semantic validation for runtime-invalid values.
    describe('validateJsonMergePatch and formatJsonMergePatch', () => {
        it('throws for semantically invalid runtime values', () => {
            assert.throws(
                () => validateJsonMergePatch({ bad: Number.NaN } as unknown as JsonMergePatchDocument),
                /valid JSON value/
            );
            assert.throws(
                () => formatJsonMergePatch({ bad: undefined } as unknown as JsonMergePatchDocument),
                /valid JSON value/
            );
        });

        it('throws when document depth exceeds the safety limit', () => {
            assert.throws(
                () => validateJsonMergePatch(buildDeepObject(MAX_JSON_MERGE_PATCH_DEPTH + 1)),
                /JSON Merge Patch document exceeds maximum depth of 128/
            );
            assert.throws(
                () => formatJsonMergePatch(buildDeepArray(MAX_JSON_MERGE_PATCH_DEPTH + 1)),
                /JSON Merge Patch document exceeds maximum depth of 128/
            );
        });

        it('throws deterministic errors for cyclic patch values', () => {
            assert.throws(
                () => validateJsonMergePatch(buildCyclicObject() as unknown as JsonMergePatchDocument),
                /must not contain cyclic references/
            );
            assert.throws(
                () => formatJsonMergePatch(buildCyclicArray() as unknown as JsonMergePatchDocument),
                /must not contain cyclic references/
            );
        });

        it('formats a valid patch document', () => {
            const patch = {
                title: 'Hello!',
                author: {
                    familyName: null,
                },
            };

            const formatted = formatJsonMergePatch(patch);
            assert.deepEqual(JSON.parse(formatted), patch);
        });

        it('formats dangerous property names without mutating Object.prototype', () => {
            const patch = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"marker":1}},"prototype":{"safe":true}}');

            const formatted = formatJsonMergePatch(patch);
            const reparsed = JSON.parse(formatted) as Record<string, unknown>;

            assert.equal(({} as Record<string, unknown>).polluted, undefined);
            assert.equal(Object.prototype.hasOwnProperty.call(reparsed, '__proto__'), true);
            assert.equal(Object.prototype.hasOwnProperty.call(reparsed, 'constructor'), true);
            assert.equal(Object.prototype.hasOwnProperty.call(reparsed, 'prototype'), true);
        });
    });

    // RFC 7396 Section 2 and Section 3: recursive object merge semantics.
    describe('applyJsonMergePatch', () => {
        it('applies the Section 3 example behavior', () => {
            const target = {
                title: 'Goodbye!',
                author: {
                    givenName: 'John',
                    familyName: 'Doe',
                },
                tags: ['example', 'sample'],
                content: 'This will be unchanged',
            };

            const patch = {
                title: 'Hello!',
                phoneNumber: '+01-123-456-7890',
                author: {
                    familyName: null,
                },
                tags: ['example'],
            };

            const result = applyJsonMergePatch(target, patch);

            assert.deepEqual(result, {
                title: 'Hello!',
                author: {
                    givenName: 'John',
                },
                tags: ['example'],
                content: 'This will be unchanged',
                phoneNumber: '+01-123-456-7890',
            });
        });

        it('returns a new value and does not mutate target or patch inputs', () => {
            const target = {
                a: {
                    b: 'c',
                },
                list: ['x', 'y'],
            };
            const patch = {
                a: {
                    b: 'd',
                    c: null,
                },
                list: ['z'],
            };

            const originalTargetClone = JSON.parse(JSON.stringify(target));
            const originalPatchClone = JSON.parse(JSON.stringify(patch));

            const result = applyJsonMergePatch(target, patch);

            assert.deepEqual(result, {
                a: {
                    b: 'd',
                },
                list: ['z'],
            });
            assert.deepEqual(target, originalTargetClone);
            assert.deepEqual(patch, originalPatchClone);
            assert.notEqual(result, target);
        });

        it('throws when target is not a semantic JSON value', () => {
            assert.throws(
                () => applyJsonMergePatch({ bad: undefined }, { ok: true }),
                /Target document must be a valid JSON value/
            );
        });

        it('throws when target depth exceeds the safety limit', () => {
            assert.throws(
                () => applyJsonMergePatch(buildDeepObject(MAX_JSON_MERGE_PATCH_DEPTH + 1), { ok: true }),
                /Target document exceeds maximum depth of 128/
            );
        });

        it('throws when patch depth exceeds the safety limit', () => {
            assert.throws(
                () => applyJsonMergePatch({ ok: true }, buildDeepObject(MAX_JSON_MERGE_PATCH_DEPTH + 1)),
                /JSON Merge Patch document exceeds maximum depth of 128/
            );
        });

        it('throws deterministic errors for cyclic target and patch values', () => {
            assert.throws(
                () => applyJsonMergePatch(buildCyclicObject(), { ok: true }),
                /Target document must not contain cyclic references/
            );
            assert.throws(
                () => applyJsonMergePatch({ ok: true }, buildCyclicArray() as unknown as JsonMergePatchDocument),
                /JSON Merge Patch document must not contain cyclic references/
            );
        });

        it('applies __proto__, constructor, and prototype keys without prototype pollution', () => {
            const target = { keep: true };
            const patch = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"marker":1}},"prototype":{"safe":true}}') as JsonMergePatchDocument;

            const result = applyJsonMergePatch(target, patch) as Record<string, unknown>;

            assert.equal(({} as Record<string, unknown>).polluted, undefined);
            assert.equal(Object.prototype.hasOwnProperty.call(result, '__proto__'), true);
            assert.equal(Object.prototype.hasOwnProperty.call(result, 'constructor'), true);
            assert.equal(Object.prototype.hasOwnProperty.call(result, 'prototype'), true);
            assert.deepEqual(result.keep, true);
        });

        it('applies patches at the depth safety limit boundary', () => {
            const target = {
                keep: true,
            };
            const patch = buildDeepObject(MAX_JSON_MERGE_PATCH_DEPTH);

            const result = applyJsonMergePatch(target, patch);

            assert.deepEqual(result, {
                keep: true,
                ...(patch as Record<string, unknown>),
            });
            assert.notEqual(result, patch);
            assert.deepEqual(target, { keep: true });
        });
    });

    // RFC 7396 Appendix A vectors.
    describe('appendix A examples', () => {
        const vectors: Array<{ original: unknown; patch: JsonMergePatchDocument; expected: unknown }> = [
            { original: { a: 'b' }, patch: { a: 'c' }, expected: { a: 'c' } },
            { original: { a: 'b' }, patch: { b: 'c' }, expected: { a: 'b', b: 'c' } },
            { original: { a: 'b' }, patch: { a: null }, expected: {} },
            { original: { a: 'b', b: 'c' }, patch: { a: null }, expected: { b: 'c' } },
            { original: { a: ['b'] }, patch: { a: 'c' }, expected: { a: 'c' } },
            { original: { a: 'c' }, patch: { a: ['b'] }, expected: { a: ['b'] } },
            {
                original: { a: { b: 'c' } },
                patch: { a: { b: 'd', c: null } },
                expected: { a: { b: 'd' } },
            },
            {
                original: { a: [{ b: 'c' }] },
                patch: { a: [1] },
                expected: { a: [1] },
            },
            { original: ['a', 'b'], patch: ['c', 'd'], expected: ['c', 'd'] },
            { original: { a: 'b' }, patch: ['c'], expected: ['c'] },
            { original: { a: 'foo' }, patch: null, expected: null },
            { original: { a: 'foo' }, patch: 'bar', expected: 'bar' },
            { original: { e: null }, patch: { a: 1 }, expected: { e: null, a: 1 } },
            { original: [1, 2], patch: { a: 'b', c: null }, expected: { a: 'b' } },
            { original: {}, patch: { a: { bb: { ccc: null } } }, expected: { a: { bb: {} } } },
        ];

        for (const [index, vector] of vectors.entries()) {
            it(`A.${index + 1} vector`, () => {
                const result = applyJsonMergePatch(vector.original, vector.patch);
                assert.deepEqual(result, vector.expected);
            });
        }
    });
});
