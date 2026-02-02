import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseJsonPointer,
    formatJsonPointer,
    evaluateJsonPointer,
    toUriFragment,
    fromUriFragment,
    isValidJsonPointer,
} from '../src/json-pointer.js';

// RFC 6901 §3-7: JSON Pointer syntax, evaluation, and URI fragment representation.
describe('RFC 6901 JSON Pointer', () => {
    // RFC 6901 §3: Syntax
    describe('parseJsonPointer', () => {
        // RFC 6901 §3: Empty string is valid, references entire document
        it('parses empty string to empty array', () => {
            const result = parseJsonPointer('');
            assert.deepEqual(result, []);
        });

        // RFC 6901 §3: json-pointer = *( "/" reference-token )
        it('parses simple pointer with single token', () => {
            const result = parseJsonPointer('/foo');
            assert.deepEqual(result, ['foo']);
        });

        it('parses pointer with multiple tokens', () => {
            const result = parseJsonPointer('/foo/bar/baz');
            assert.deepEqual(result, ['foo', 'bar', 'baz']);
        });

        // RFC 6901 §3: Empty reference token (empty key)
        it('parses pointer with empty token', () => {
            const result = parseJsonPointer('/');
            assert.deepEqual(result, ['']);
        });

        it('parses pointer with multiple empty tokens', () => {
            const result = parseJsonPointer('//');
            assert.deepEqual(result, ['', '']);
        });

        // RFC 6901 §3: escaped = "~" ( "0" / "1" )
        it('decodes ~0 to tilde', () => {
            const result = parseJsonPointer('/a~0b');
            assert.deepEqual(result, ['a~b']);
        });

        it('decodes ~1 to slash', () => {
            const result = parseJsonPointer('/a~1b');
            assert.deepEqual(result, ['a/b']);
        });

        // RFC 6901 §4: Decode ~1 before ~0 to avoid ~01 becoming /
        it('decodes ~01 to ~1 not /', () => {
            const result = parseJsonPointer('/~01');
            assert.deepEqual(result, ['~1']);
        });

        it('decodes ~10 to /0', () => {
            const result = parseJsonPointer('/~10');
            assert.deepEqual(result, ['/0']);
        });

        it('handles multiple escapes in one token', () => {
            const result = parseJsonPointer('/~0~1~0~1');
            assert.deepEqual(result, ['~/~/']);
        });

        // RFC 6901 §3: Invalid escape is error
        it('returns null for invalid escape ~2', () => {
            const result = parseJsonPointer('/~2');
            assert.equal(result, null);
        });

        it('returns null for invalid escape ~a', () => {
            const result = parseJsonPointer('/~a');
            assert.equal(result, null);
        });

        it('returns null for trailing tilde', () => {
            const result = parseJsonPointer('/foo~');
            assert.equal(result, null);
        });

        it('returns null for tilde at end of pointer', () => {
            const result = parseJsonPointer('/~');
            assert.equal(result, null);
        });

        // RFC 6901 §3: Must start with / if non-empty
        it('returns null for pointer not starting with /', () => {
            const result = parseJsonPointer('foo');
            assert.equal(result, null);
        });

        it('returns null for pointer starting with space', () => {
            const result = parseJsonPointer(' /foo');
            assert.equal(result, null);
        });

        // RFC 6901 §3: Array index tokens
        it('parses numeric tokens', () => {
            const result = parseJsonPointer('/0/1/2');
            assert.deepEqual(result, ['0', '1', '2']);
        });

        it('parses - token (append reference)', () => {
            const result = parseJsonPointer('/foo/-');
            assert.deepEqual(result, ['foo', '-']);
        });
    });

    // RFC 6901 §3: formatJsonPointer
    describe('formatJsonPointer', () => {
        it('formats empty array to empty string', () => {
            const result = formatJsonPointer([]);
            assert.equal(result, '');
        });

        it('formats single token', () => {
            const result = formatJsonPointer(['foo']);
            assert.equal(result, '/foo');
        });

        it('formats multiple tokens', () => {
            const result = formatJsonPointer(['foo', 'bar', 'baz']);
            assert.equal(result, '/foo/bar/baz');
        });

        it('encodes tilde as ~0', () => {
            const result = formatJsonPointer(['a~b']);
            assert.equal(result, '/a~0b');
        });

        it('encodes slash as ~1', () => {
            const result = formatJsonPointer(['a/b']);
            assert.equal(result, '/a~1b');
        });

        it('encodes in correct order (~ before /)', () => {
            const result = formatJsonPointer(['~1']);
            assert.equal(result, '/~01');
        });

        it('formats empty token', () => {
            const result = formatJsonPointer(['']);
            assert.equal(result, '/');
        });

        it('round-trips with parseJsonPointer', () => {
            const tokens = ['foo', 'a/b', 'c~d', '', '0'];
            const pointer = formatJsonPointer(tokens);
            const parsed = parseJsonPointer(pointer);
            assert.deepEqual(parsed, tokens);
        });
    });

    // RFC 6901 §4: Evaluation
    describe('evaluateJsonPointer', () => {
        // RFC 6901 §5: Example document from spec
        const doc = {
            foo: ['bar', 'baz'],
            '': 0,
            'a/b': 1,
            'c%d': 2,
            'e^f': 3,
            'g|h': 4,
            'i\\j': 5,
            'k"l': 6,
            ' ': 7,
            'm~n': 8,
        };

        // RFC 6901 §5: Examples from spec
        it('evaluates "" to whole document', () => {
            const result = evaluateJsonPointer('', doc);
            assert.equal(result, doc);
        });

        it('evaluates /foo to array', () => {
            const result = evaluateJsonPointer('/foo', doc);
            assert.deepEqual(result, ['bar', 'baz']);
        });

        it('evaluates /foo/0 to "bar"', () => {
            const result = evaluateJsonPointer('/foo/0', doc);
            assert.equal(result, 'bar');
        });

        it('evaluates /foo/1 to "baz"', () => {
            const result = evaluateJsonPointer('/foo/1', doc);
            assert.equal(result, 'baz');
        });

        it('evaluates / to 0 (empty key)', () => {
            const result = evaluateJsonPointer('/', doc);
            assert.equal(result, 0);
        });

        it('evaluates /a~1b to 1', () => {
            const result = evaluateJsonPointer('/a~1b', doc);
            assert.equal(result, 1);
        });

        it('evaluates /c%d to 2', () => {
            const result = evaluateJsonPointer('/c%d', doc);
            assert.equal(result, 2);
        });

        it('evaluates /e^f to 3', () => {
            const result = evaluateJsonPointer('/e^f', doc);
            assert.equal(result, 3);
        });

        it('evaluates /g|h to 4', () => {
            const result = evaluateJsonPointer('/g|h', doc);
            assert.equal(result, 4);
        });

        it('evaluates /i\\j to 5', () => {
            const result = evaluateJsonPointer('/i\\j', doc);
            assert.equal(result, 5);
        });

        it('evaluates /k"l to 6', () => {
            const result = evaluateJsonPointer('/k"l', doc);
            assert.equal(result, 6);
        });

        it('evaluates / (space key) to 7', () => {
            const result = evaluateJsonPointer('/ ', doc);
            assert.equal(result, 7);
        });

        it('evaluates /m~0n to 8', () => {
            const result = evaluateJsonPointer('/m~0n', doc);
            assert.equal(result, 8);
        });

        // RFC 6901 §4: Array index validation
        it('returns undefined for leading zero index', () => {
            const result = evaluateJsonPointer('/foo/01', { foo: ['a', 'b'] });
            assert.equal(result, undefined);
        });

        it('returns undefined for leading zeros', () => {
            const result = evaluateJsonPointer('/foo/007', { foo: new Array(10) });
            assert.equal(result, undefined);
        });

        it('allows 0 as array index', () => {
            const result = evaluateJsonPointer('/0', ['first', 'second']);
            assert.equal(result, 'first');
        });

        // RFC 6901 §4: "-" references nonexistent element after last
        it('returns undefined for - index', () => {
            const result = evaluateJsonPointer('/foo/-', doc);
            assert.equal(result, undefined);
        });

        it('returns undefined for - on empty array', () => {
            const result = evaluateJsonPointer('/-', []);
            assert.equal(result, undefined);
        });

        // RFC 6901 §4: Non-numeric token against array
        it('returns undefined for non-numeric array index', () => {
            const result = evaluateJsonPointer('/foo/bar', doc);
            assert.equal(result, undefined);
        });

        it('returns undefined for negative array index', () => {
            const result = evaluateJsonPointer('/-1', ['a', 'b']);
            assert.equal(result, undefined);
        });

        // RFC 6901 §4: Nonexistent value
        it('returns undefined for missing key', () => {
            const result = evaluateJsonPointer('/notfound', doc);
            assert.equal(result, undefined);
        });

        it('returns undefined for path through missing key', () => {
            const result = evaluateJsonPointer('/missing/deep', doc);
            assert.equal(result, undefined);
        });

        it('returns undefined for array index out of bounds', () => {
            const result = evaluateJsonPointer('/foo/99', doc);
            assert.equal(result, undefined);
        });

        // RFC 6901 §4: Traversing through primitives
        it('returns undefined when traversing through primitive', () => {
            const result = evaluateJsonPointer('//foo', doc); // `` is 0, which is primitive
            assert.equal(result, undefined);
        });

        it('returns undefined when traversing through null', () => {
            const result = evaluateJsonPointer('/a/b', { a: null });
            assert.equal(result, undefined);
        });

        // RFC 6901 §7: Invalid pointer syntax
        it('returns undefined for invalid pointer syntax', () => {
            const result = evaluateJsonPointer('/~2', doc);
            assert.equal(result, undefined);
        });

        // Nested structures
        it('evaluates deep nested path', () => {
            const nested = { a: { b: { c: { d: 'deep' } } } };
            const result = evaluateJsonPointer('/a/b/c/d', nested);
            assert.equal(result, 'deep');
        });

        it('evaluates mixed object and array path', () => {
            const mixed = { items: [{ name: 'first' }, { name: 'second' }] };
            const result = evaluateJsonPointer('/items/1/name', mixed);
            assert.equal(result, 'second');
        });

        // Edge cases
        it('handles document being an array', () => {
            const result = evaluateJsonPointer('/0', ['root']);
            assert.equal(result, 'root');
        });

        it('handles document being a primitive', () => {
            const result = evaluateJsonPointer('', 'primitive');
            assert.equal(result, 'primitive');
        });

        it('returns undefined for pointer on primitive document', () => {
            const result = evaluateJsonPointer('/foo', 'primitive');
            assert.equal(result, undefined);
        });
    });

    // RFC 6901 §6: URI Fragment Identifier Representation
    describe('toUriFragment', () => {
        it('converts empty pointer to #', () => {
            const result = toUriFragment('');
            assert.equal(result, '#');
        });

        it('converts simple pointer', () => {
            const result = toUriFragment('/foo/bar');
            assert.equal(result, '#/foo/bar');
        });

        it('converts pointer with array index', () => {
            const result = toUriFragment('/foo/0');
            assert.equal(result, '#/foo/0');
        });

        // RFC 6901 §6: Examples from spec
        it('percent-encodes % character', () => {
            const result = toUriFragment('/c%d');
            assert.equal(result, '#/c%25d');
        });

        it('percent-encodes ^ character', () => {
            const result = toUriFragment('/e^f');
            assert.equal(result, '#/e%5Ef');
        });

        it('percent-encodes | character', () => {
            const result = toUriFragment('/g|h');
            assert.equal(result, '#/g%7Ch');
        });

        it('percent-encodes \\ character', () => {
            const result = toUriFragment('/i\\j');
            assert.equal(result, '#/i%5Cj');
        });

        it('percent-encodes " character', () => {
            const result = toUriFragment('/k"l');
            assert.equal(result, '#/k%22l');
        });

        it('percent-encodes space', () => {
            const result = toUriFragment('/ ');
            assert.equal(result, '#/%20');
        });

        it('preserves tilde escapes', () => {
            const result = toUriFragment('/m~0n');
            assert.equal(result, '#/m~0n');
        });

        it('preserves slash escapes', () => {
            const result = toUriFragment('/a~1b');
            assert.equal(result, '#/a~1b');
        });
    });

    describe('fromUriFragment', () => {
        it('parses # to empty pointer', () => {
            const result = fromUriFragment('#');
            assert.equal(result, '');
        });

        it('parses simple fragment', () => {
            const result = fromUriFragment('#/foo/bar');
            assert.equal(result, '/foo/bar');
        });

        it('handles fragment without # prefix', () => {
            const result = fromUriFragment('/foo/bar');
            assert.equal(result, '/foo/bar');
        });

        it('decodes percent-encoded characters', () => {
            const result = fromUriFragment('#/c%25d');
            assert.equal(result, '/c%d');
        });

        it('decodes percent-encoded space', () => {
            const result = fromUriFragment('#/%20');
            assert.equal(result, '/ ');
        });

        it('returns null for invalid percent-encoding', () => {
            const result = fromUriFragment('#/%ZZ');
            assert.equal(result, null);
        });

        it('returns null for invalid pointer after decoding', () => {
            const result = fromUriFragment('#/~2');
            assert.equal(result, null);
        });

        it('round-trips with toUriFragment', () => {
            const pointer = '/foo/a b/c%d';
            const fragment = toUriFragment(pointer);
            const decoded = fromUriFragment(fragment);
            assert.equal(decoded, pointer);
        });
    });

    // RFC 6901 §3: Validation
    describe('isValidJsonPointer', () => {
        it('returns true for empty pointer', () => {
            assert.equal(isValidJsonPointer(''), true);
        });

        it('returns true for valid pointer', () => {
            assert.equal(isValidJsonPointer('/foo/bar'), true);
        });

        it('returns true for pointer with escapes', () => {
            assert.equal(isValidJsonPointer('/a~0b/c~1d'), true);
        });

        it('returns false for pointer not starting with /', () => {
            assert.equal(isValidJsonPointer('foo'), false);
        });

        it('returns false for invalid escape', () => {
            assert.equal(isValidJsonPointer('/~2'), false);
        });

        it('returns false for trailing tilde', () => {
            assert.equal(isValidJsonPointer('/foo~'), false);
        });
    });
});
