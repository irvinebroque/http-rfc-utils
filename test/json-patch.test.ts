/**
 * Tests for json patch behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    JSON_PATCH_MEDIA_TYPE,
    parseJsonPatch,
    tryParseJsonPatch,
    formatJsonPatch,
    validateJsonPatch,
    applyJsonPatch,
} from '../src/json-patch.js';

function createDeepObject(depth: number): Record<string, unknown> {
    const root: Record<string, unknown> = {};
    let cursor = root;

    for (let index = 0; index < depth; index++) {
        const next: Record<string, unknown> = {};
        cursor.nested = next;
        cursor = next;
    }

    cursor.leaf = true;
    return root;
}

function createCyclicObject(): Record<string, unknown> {
    const value: Record<string, unknown> = {};
    value.self = value;
    return value;
}

describe('JSON Patch (RFC 6902 Sections 3-6, Appendix A)', () => {
    // RFC 6902 §6: media type registration.
    it('exports the JSON Patch media type constant', () => {
        assert.equal(JSON_PATCH_MEDIA_TYPE, 'application/json-patch+json');
    });

    // RFC 6902 §3 and §4: patch document shape and required members.
    describe('parseJsonPatch and tryParseJsonPatch', () => {
        it('parses valid operations and ignores unknown members', () => {
            const parsed = parseJsonPatch([
                { op: 'add', path: '/a', value: 1, ignored: true },
                { op: 'copy', from: '/a', path: '/b', extra: { foo: 'bar' } },
            ]);

            assert.deepEqual(parsed, [
                { op: 'add', path: '/a', value: 1 },
                { op: 'copy', from: '/a', path: '/b' },
            ]);
        });

        it('returns null for invalid document root or invalid operation members', () => {
            assert.equal(parseJsonPatch({ op: 'add', path: '/a', value: 1 }), null);
            assert.equal(parseJsonPatch([{ op: 'add', path: 'not-a-pointer', value: 1 }]), null);
            assert.equal(parseJsonPatch([{ op: 'move', path: '/a' }]), null);
            assert.equal(parseJsonPatch([{ op: 'replace', path: '/a' }]), null);
            assert.equal(parseJsonPatch([{ op: 'unknown', path: '/a' }]), null);
        });

        it('returns null when parsing malformed JSON text', () => {
            assert.equal(tryParseJsonPatch('{ bad json'), null);
            assert.equal(tryParseJsonPatch('{"op":"add"}'), null);
        });

        it('returns null for cyclic and over-depth operation values', () => {
            const cyclic = createCyclicObject();
            const deep = createDeepObject(2_000);

            assert.equal(parseJsonPatch([{ op: 'add', path: '/a', value: cyclic }]), null);
            assert.equal(parseJsonPatch([{ op: 'add', path: '/a', value: deep }]), null);
        });
    });

    // RFC 6902 §4.4: move "from" MUST NOT be proper prefix of "path".
    describe('validateJsonPatch and formatJsonPatch', () => {
        it('throws for semantic-invalid move prefix constraints', () => {
            assert.throws(
                () => validateJsonPatch([{ op: 'move', from: '/a', path: '/a/b' }]),
                /proper prefix/
            );
        });

        it('formats a valid document and throws for invalid semantic content', () => {
            const patch = [
                { op: 'test', path: '/a', value: 1 },
                { op: 'replace', path: '/a', value: 2 },
            ] as const;

            const formatted = formatJsonPatch([...patch]);
            const parsedBack = tryParseJsonPatch(formatted);
            assert.deepEqual(parsedBack, patch);

            assert.throws(
                () => formatJsonPatch([{ op: 'add', path: '/a', value: Number.NaN }]),
                /valid JSON "value"/
            );
        });

        it('throws deterministic errors for cyclic and over-depth values', () => {
            const cyclic = createCyclicObject();
            const deep = createDeepObject(2_000);

            assert.throws(
                () => validateJsonPatch([{ op: 'add', path: '/a', value: cyclic }] as unknown as Parameters<typeof validateJsonPatch>[0]),
                /valid JSON "value"/
            );
            assert.throws(
                () => formatJsonPatch([{ op: 'add', path: '/a', value: deep }] as unknown as Parameters<typeof formatJsonPatch>[0]),
                /valid JSON "value"/
            );
        });
    });

    // RFC 6902 §3 and §5: sequential apply and first-error termination.
    describe('applyJsonPatch fail-fast and immutability', () => {
        it('applies operations sequentially and does not mutate input document', () => {
            const original = {
                a: 1,
                b: { nested: true },
                list: ['x'],
            };

            const result = applyJsonPatch(original, [
                { op: 'replace', path: '/a', value: 2 },
                { op: 'add', path: '/list/1', value: 'y' },
                { op: 'add', path: '/b/child', value: { ok: true } },
            ]);

            assert.deepEqual(result, {
                a: 2,
                b: { nested: true, child: { ok: true } },
                list: ['x', 'y'],
            });
            assert.deepEqual(original, {
                a: 1,
                b: { nested: true },
                list: ['x'],
            });
        });

        it('stops at first failing operation and leaves input untouched', () => {
            const original = { a: { b: 'c' } };

            assert.throws(
                () => applyJsonPatch(original, [
                    { op: 'replace', path: '/a/b', value: 42 },
                    { op: 'test', path: '/a/b', value: 'c' },
                ]),
                /failed "test"/
            );

            assert.deepEqual(original, { a: { b: 'c' } });
        });

        // RFC 6902 §4.4 and §5: move requires an existing "from" location.
        it('errors when move uses identical missing from/path location', () => {
            assert.throws(
                () => applyJsonPatch({}, [{ op: 'move', from: '/missing', path: '/missing' }]),
                /missing from object member "missing"/
            );
        });

        // RFC 6902 §4.5 and §5: copy reads from existing "from" and adds at "path".
        it('copies a value to a new location', () => {
            const result = applyJsonPatch({ foo: { bar: 1 } }, [
                { op: 'copy', from: '/foo/bar', path: '/copied' },
            ]);

            assert.deepEqual(result, { foo: { bar: 1 }, copied: 1 });
        });

        // RFC 6902 §4.5 and §5: copy fails when "from" does not exist.
        it('errors when copy source location is missing', () => {
            assert.throws(
                () => applyJsonPatch({ foo: { bar: 1 } }, [{ op: 'copy', from: '/foo/missing', path: '/copied' }]),
                /missing from object member "missing"/
            );
        });

        it('throws deterministic errors for cyclic and over-depth targets', () => {
            const cyclicTarget = createCyclicObject();
            const deepTarget = createDeepObject(2_000);

            assert.throws(
                () => applyJsonPatch(cyclicTarget, []),
                /Target document must be a valid JSON value/
            );
            assert.throws(
                () => applyJsonPatch(deepTarget, []),
                /Target document must be a valid JSON value/
            );
        });
    });

    // RFC 6902 Appendix A vectors.
    describe('appendix A examples', () => {
        // RFC 6902 Appendix A.1.
        it('A.1 adding an object member', () => {
            const result = applyJsonPatch({ foo: 'bar' }, [
                { op: 'add', path: '/baz', value: 'qux' },
            ]);
            assert.deepEqual(result, { foo: 'bar', baz: 'qux' });
        });

        // RFC 6902 Appendix A.2.
        it('A.2 adding an array element', () => {
            const result = applyJsonPatch({ foo: ['bar', 'baz'] }, [
                { op: 'add', path: '/foo/1', value: 'qux' },
            ]);
            assert.deepEqual(result, { foo: ['bar', 'qux', 'baz'] });
        });

        // RFC 6902 Appendix A.3.
        it('A.3 removing an object member', () => {
            const result = applyJsonPatch({ baz: 'qux', foo: 'bar' }, [
                { op: 'remove', path: '/baz' },
            ]);
            assert.deepEqual(result, { foo: 'bar' });
        });

        // RFC 6902 Appendix A.4.
        it('A.4 removing an array element', () => {
            const result = applyJsonPatch({ foo: ['bar', 'qux', 'baz'] }, [
                { op: 'remove', path: '/foo/1' },
            ]);
            assert.deepEqual(result, { foo: ['bar', 'baz'] });
        });

        // RFC 6902 Appendix A.5.
        it('A.5 replacing a value', () => {
            const result = applyJsonPatch({ baz: 'qux', foo: 'bar' }, [
                { op: 'replace', path: '/baz', value: 'boo' },
            ]);
            assert.deepEqual(result, { baz: 'boo', foo: 'bar' });
        });

        // RFC 6902 Appendix A.6.
        it('A.6 moving a value', () => {
            const result = applyJsonPatch({
                foo: { bar: 'baz', waldo: 'fred' },
                qux: { corge: 'grault' },
            }, [
                { op: 'move', from: '/foo/waldo', path: '/qux/thud' },
            ]);

            assert.deepEqual(result, {
                foo: { bar: 'baz' },
                qux: { corge: 'grault', thud: 'fred' },
            });
        });

        // RFC 6902 Appendix A.7.
        it('A.7 moving an array element', () => {
            const result = applyJsonPatch({ foo: ['all', 'grass', 'cows', 'eat'] }, [
                { op: 'move', from: '/foo/1', path: '/foo/3' },
            ]);

            assert.deepEqual(result, { foo: ['all', 'cows', 'eat', 'grass'] });
        });

        // RFC 6902 Appendix A.8.
        it('A.8 testing a value succeeds', () => {
            const input = { baz: 'qux', foo: ['a', 2, 'c'] };
            const result = applyJsonPatch(input, [
                { op: 'test', path: '/baz', value: 'qux' },
                { op: 'test', path: '/foo/1', value: 2 },
            ]);

            assert.deepEqual(result, input);
        });

        // RFC 6902 Appendix A.9.
        it('A.9 testing a value errors on mismatch', () => {
            assert.throws(
                () => applyJsonPatch({ baz: 'qux' }, [{ op: 'test', path: '/baz', value: 'bar' }]),
                /failed "test"/
            );
        });

        // RFC 6902 Appendix A.10.
        it('A.10 adding a nested member object', () => {
            const result = applyJsonPatch({ foo: 'bar' }, [
                { op: 'add', path: '/child', value: { grandchild: {} } },
            ]);

            assert.deepEqual(result, { foo: 'bar', child: { grandchild: {} } });
        });

        // RFC 6902 Appendix A.11.
        it('A.11 ignores unrecognized operation members', () => {
            const patch = parseJsonPatch([{ op: 'add', path: '/baz', value: 'qux', xyz: 123 }]);
            assert.ok(patch);
            const result = applyJsonPatch({ foo: 'bar' }, patch);
            assert.deepEqual(result, { foo: 'bar', baz: 'qux' });
        });

        // RFC 6902 Appendix A.12.
        it('A.12 errors when adding to a nonexistent target parent', () => {
            assert.throws(
                () => applyJsonPatch({ foo: 'bar' }, [{ op: 'add', path: '/baz/bat', value: 'qux' }]),
                /cannot resolve parent/
            );
        });

        // RFC 6902 Appendix A.14.
        it('A.14 uses correct ~ escape ordering', () => {
            const result = applyJsonPatch({ '/': 9, '~1': 10 }, [
                { op: 'test', path: '/~01', value: 10 },
            ]);
            assert.deepEqual(result, { '/': 9, '~1': 10 });
        });

        // RFC 6902 Appendix A.15.
        it('A.15 compares strings and numbers by JSON type', () => {
            assert.throws(
                () => applyJsonPatch({ '/': 9, '~1': 10 }, [{ op: 'test', path: '/~01', value: '10' }]),
                /failed "test"/
            );
        });

        // RFC 6902 Appendix A.16.
        it('A.16 appends array value with - index', () => {
            const result = applyJsonPatch({ foo: ['bar'] }, [
                { op: 'add', path: '/foo/-', value: ['abc', 'def'] },
            ]);
            assert.deepEqual(result, { foo: ['bar', ['abc', 'def']] });
        });
    });
});
