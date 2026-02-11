/**
 * Tests for jsonpath behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseJsonPath,
    queryJsonPath,
    queryJsonPathNodes,
    isValidJsonPath,
    formatNormalizedPath,
    compileJsonPath,
} from '../src/jsonpath.js';
import { Lexer } from '../src/jsonpath/lexer.js';

// RFC 9535 §1.5: Example JSON value (bookstore)
const bookstore = {
    store: {
        book: [
            { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
            { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
            { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
            { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
        ],
        bicycle: { color: 'red', price: 399 },
    },
};

interface JsonPathBookResult {
    title: string;
    price: number;
}

function assertBookResult(value: unknown): asserts value is JsonPathBookResult {
    assert.ok(typeof value === 'object' && value !== null);
    const record = value as Record<string, unknown>;
    assert.equal(typeof record.title, 'string');
    assert.equal(typeof record.price, 'number');
}

// RFC 9535 §2.1: JSONPath Syntax and Semantics
describe('RFC 9535 JSONPath', () => {
    // RFC 9535 §2.1: Well-formedness and validity
    describe('parseJsonPath', () => {
        // RFC 9535 §2.2.1: root-identifier = "$"
        it('parses root identifier', () => {
            const ast = parseJsonPath('$');
            assert.ok(ast !== null);
            assert.equal(ast.type, 'query');
            assert.equal(ast.root, '$');
            assert.deepEqual(ast.segments, []);
        });

        it('returns null for query not starting with $', () => {
            assert.equal(parseJsonPath('store'), null);
            assert.equal(parseJsonPath('@.foo'), null);
            assert.equal(parseJsonPath(''), null);
        });

        // RFC 9535 §2.5.1: Child segment shorthand (.name)
        it('parses dot notation', () => {
            const ast = parseJsonPath('$.store.book');
            assert.ok(ast !== null);
            assert.equal(ast.segments.length, 2);
            assert.equal(ast.segments[0].type, 'child');
            assert.equal(ast.segments[1].type, 'child');
        });

        // RFC 9535 §2.5.1: Bracketed selection
        it('parses bracket notation', () => {
            const ast = parseJsonPath("$['store']['book']");
            assert.ok(ast !== null);
            assert.equal(ast.segments.length, 2);
        });

        // RFC 9535 §2.3.1.1: String literals with escapes
        it('parses escaped strings', () => {
            const ast = parseJsonPath("$['a\\'b']");
            assert.ok(ast !== null);
            const selector = ast.segments[0].selectors[0];
            assert.equal(selector.type, 'name');
            if (selector.type === 'name') {
                assert.equal(selector.name, "a'b");
            }
        });

        it('parses double-quoted strings', () => {
            const ast = parseJsonPath('$["hello"]');
            assert.ok(ast !== null);
            const selector = ast.segments[0].selectors[0];
            assert.equal(selector.type, 'name');
            if (selector.type === 'name') {
                assert.equal(selector.name, 'hello');
            }
        });

        // RFC 9535 §2.3.1.1: Unicode escapes
        it('parses unicode escapes', () => {
            const ast = parseJsonPath('$["\\u0041"]');  // \u0041 = 'A'
            assert.ok(ast !== null);
            const selector = ast.segments[0].selectors[0];
            if (selector.type === 'name') {
                assert.equal(selector.name, 'A');
            }
        });

        // RFC 9535 §2.1: Integer validation (I-JSON range)
        it('rejects integers outside I-JSON range', () => {
            assert.equal(parseJsonPath('$[9007199254740992]'), null); // > 2^53-1
            assert.equal(parseJsonPath('$[-9007199254740992]'), null); // < -(2^53-1)
        });

        // RFC 9535 §2.3.3.1: Leading zeros not allowed
        it('rejects leading zeros in indices', () => {
            assert.equal(parseJsonPath('$[01]'), null);
            assert.equal(parseJsonPath('$[007]'), null);
        });

        // RFC 9535 §2.3.4: Slice selector
        it('parses slice selector', () => {
            const ast = parseJsonPath('$[1:3]');
            assert.ok(ast !== null);
            const selector = ast.segments[0].selectors[0];
            assert.equal(selector.type, 'slice');
            if (selector.type === 'slice') {
                assert.equal(selector.start, 1);
                assert.equal(selector.end, 3);
            }
        });

        it('parses slice with step', () => {
            const ast = parseJsonPath('$[::2]');
            assert.ok(ast !== null);
            const selector = ast.segments[0].selectors[0];
            assert.equal(selector.type, 'slice');
            if (selector.type === 'slice') {
                assert.equal(selector.start, undefined);
                assert.equal(selector.end, undefined);
                assert.equal(selector.step, 2);
            }
        });

        // RFC 9535 §2.3.5: Filter selector
        it('parses filter selector', () => {
            const ast = parseJsonPath('$[?@.price < 10]');
            assert.ok(ast !== null);
            const selector = ast.segments[0].selectors[0];
            assert.equal(selector.type, 'filter');
        });

        // RFC 9535 §2.5.2: Descendant segment
        it('parses descendant segment', () => {
            const ast = parseJsonPath('$..author');
            assert.ok(ast !== null);
            assert.equal(ast.segments[0].type, 'descendant');
        });

        // RFC 9535 §2.3.2: Wildcard selector
        it('parses wildcard selector', () => {
            const ast = parseJsonPath('$[*]');
            assert.ok(ast !== null);
            const selector = ast.segments[0].selectors[0];
            assert.equal(selector.type, 'wildcard');
        });

        it('parses dot wildcard', () => {
            const ast = parseJsonPath('$.*');
            assert.ok(ast !== null);
            const selector = ast.segments[0].selectors[0];
            assert.equal(selector.type, 'wildcard');
        });

        // RFC 9535 §2.5.1.1: Dot shorthand does not allow whitespace after ".".
        it('rejects whitespace in dot shorthand', () => {
            assert.equal(parseJsonPath('$. foo'), null);
            assert.equal(parseJsonPath('$.\nfoo'), null);
            assert.equal(parseJsonPath('$.. foo'), null);
            assert.equal(parseJsonPath('$..\t*'), null);
        });

        // RFC 9535 §2.5.1.1: Bracket notation still allows surrounding whitespace.
        it('keeps bracket-notation whitespace tolerance', () => {
            assert.ok(parseJsonPath('$ [ "store" ]') !== null);
            assert.ok(parseJsonPath('$ [ 0 ]') !== null);
        });

        // RFC 9535 §2.3.1.1: control characters in string literals must be escaped.
        it('rejects raw control characters inside strings', () => {
            const rawNewline = "$['line" + String.fromCharCode(0x0A) + "break']";
            const rawTab = "$['tab" + String.fromCharCode(0x09) + "char']";
            const rawCarriageReturn = "$['carriage" + String.fromCharCode(0x0D) + "return']";

            assert.equal(parseJsonPath(rawNewline), null);
            assert.equal(parseJsonPath(rawTab), null);
            assert.equal(parseJsonPath(rawCarriageReturn), null);
        });

        it('accepts escaped control characters inside strings', () => {
            assert.ok(parseJsonPath(`$['line\\nbreak']`) !== null);
            assert.ok(parseJsonPath(`$['tab\\tchar']`) !== null);
            assert.ok(parseJsonPath(`$['carriage\\rreturn']`) !== null);
            assert.ok(parseJsonPath(`$['nul\\u0000']`) !== null);
            assert.ok(parseJsonPath(`$['unit\\u001F']`) !== null);
        });

        it('reports control-character lexer failure near offending position', () => {
            const rawNewline = "$['bad" + String.fromCharCode(0x0A) + "line']";
            assert.throws(
                () => new Lexer(rawNewline),
                /Invalid string at position [0-9]+/
            );
        });

        // RFC 9535 §2.3.5.1 + resilience hardening: parser must reject pathological expression nesting.
        it('rejects deeply nested parenthesized filter expressions', () => {
            const depth = 80;
            const query = `$[?${'('.repeat(depth)}@.a == 1${')'.repeat(depth)}]`;
            assert.equal(parseJsonPath(query), null);
        });

        // RFC 9535 §2.4 + resilience hardening: parser must bound nested function-expression depth.
        it('rejects deeply nested function expressions', () => {
            const depth = 80;
            const query = `$[?${'length('.repeat(depth)}@${')'.repeat(depth)} == 0]`;
            assert.equal(parseJsonPath(query), null);
        });
    });

    // RFC 9535 §2.1.1: isValidJsonPath
    describe('isValidJsonPath', () => {
        it('returns true for valid queries', () => {
            assert.equal(isValidJsonPath('$'), true);
            assert.equal(isValidJsonPath('$.store'), true);
            assert.equal(isValidJsonPath('$..author'), true);
            assert.equal(isValidJsonPath('$[0]'), true);
            assert.equal(isValidJsonPath('$[?@.price < 10]'), true);
        });

        it('returns false for invalid queries', () => {
            assert.equal(isValidJsonPath(''), false);
            assert.equal(isValidJsonPath('store'), false);
            assert.equal(isValidJsonPath('@.foo'), false);
            assert.equal(isValidJsonPath('$[01]'), false);
        });
    });

    // RFC 9535 §1.5, Table 2: Examples from spec
    describe('queryJsonPath - RFC examples', () => {
        // RFC 9535 Table 2: $.store.book[*].author
        it('selects all book authors', () => {
            const result = queryJsonPath('$.store.book[*].author', bookstore);
            assert.deepEqual(result, [
                'Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien'
            ]);
        });

        // RFC 9535 Table 2: $..author
        it('selects all authors (descendant)', () => {
            const result = queryJsonPath('$..author', bookstore);
            assert.deepEqual(result, [
                'Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien'
            ]);
        });

        // RFC 9535 Table 2: $.store.*
        it('selects all store members', () => {
            const result = queryJsonPath('$.store.*', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 2); // book array and bicycle object
        });

        // RFC 9535 Table 2: $.store..price
        it('selects all prices in store', () => {
            const result = queryJsonPath('$.store..price', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 5); // 4 books + 1 bicycle
            assert.ok(result.includes(8.95));
            assert.ok(result.includes(399));
        });

        // RFC 9535 Table 2: $..book[2]
        it('selects third book', () => {
            const result = queryJsonPath('$..book[2]', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 1);
            const [book] = result;
            assertBookResult(book);
            assert.equal(book.title, 'Moby Dick');
        });

        // RFC 9535 Table 2: $..book[2].author
        it('selects third book author', () => {
            const result = queryJsonPath('$..book[2].author', bookstore);
            assert.deepEqual(result, ['Herman Melville']);
        });

        // RFC 9535 Table 2: $..book[2].publisher
        it('returns empty for missing member', () => {
            const result = queryJsonPath('$..book[2].publisher', bookstore);
            assert.deepEqual(result, []);
        });

        // RFC 9535 Table 2: $..book[-1]
        it('selects last book', () => {
            const result = queryJsonPath('$..book[-1]', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 1);
            const [book] = result;
            assertBookResult(book);
            assert.equal(book.title, 'The Lord of the Rings');
        });

        // RFC 9535 Table 2: $..book[0,1]
        it('selects first two books with union', () => {
            const result = queryJsonPath('$..book[0,1]', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 2);
            const [first, second] = result;
            assertBookResult(first);
            assertBookResult(second);
            assert.equal(first.title, 'Sayings of the Century');
            assert.equal(second.title, 'Sword of Honour');
        });

        // RFC 9535 Table 2: $..book[:2]
        it('selects first two books with slice', () => {
            const result = queryJsonPath('$..book[:2]', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 2);
            const [first, second] = result;
            assertBookResult(first);
            assertBookResult(second);
            assert.equal(first.title, 'Sayings of the Century');
            assert.equal(second.title, 'Sword of Honour');
        });

        // RFC 9535 Table 2: $..book[?@.isbn]
        it('selects books with ISBN', () => {
            const result = queryJsonPath('$..book[?@.isbn]', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 2);
            // Moby Dick and The Lord of the Rings have ISBNs
        });

        // RFC 9535 Table 2: $..book[?@.price<10]
        it('selects books cheaper than 10', () => {
            const result = queryJsonPath('$..book[?@.price<10]', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 2);
            result.forEach(book => {
                assertBookResult(book);
                assert.ok(book.price < 10);
            });
        });

        // RFC 9535 Table 2: $..*
        it('selects all descendants', () => {
            const result = queryJsonPath('$..*', bookstore);
            assert.ok(result !== null);
            assert.ok(result.length > 10);
        });
    });

    // RFC 9535 §2.2: Root identifier
    describe('Root Identifier', () => {
        // RFC 9535 §2.2.3: Examples
        it('returns entire document for $', () => {
            const doc = { k: 'v' };
            const result = queryJsonPath('$', doc);
            assert.deepEqual(result, [doc]);
        });
    });

    // RFC 9535 §2.3.3: Index selector
    describe('Index Selector', () => {
        const arr = ['a', 'b', 'c'];

        // RFC 9535 §2.3.3.2: Non-negative index
        it('selects by positive index', () => {
            assert.deepEqual(queryJsonPath('$[0]', arr), ['a']);
            assert.deepEqual(queryJsonPath('$[1]', arr), ['b']);
            assert.deepEqual(queryJsonPath('$[2]', arr), ['c']);
        });

        // RFC 9535 §2.3.3.2: Negative index
        it('selects by negative index', () => {
            assert.deepEqual(queryJsonPath('$[-1]', arr), ['c']);
            assert.deepEqual(queryJsonPath('$[-2]', arr), ['b']);
            assert.deepEqual(queryJsonPath('$[-3]', arr), ['a']);
        });

        // RFC 9535 §2.3.3.2: Out of range returns empty
        it('returns empty for out of range index', () => {
            assert.deepEqual(queryJsonPath('$[10]', arr), []);
            assert.deepEqual(queryJsonPath('$[-10]', arr), []);
        });

        // RFC 9535 §2.3.3.2: Non-array returns empty
        it('returns empty for non-array', () => {
            assert.deepEqual(queryJsonPath('$[0]', { a: 1 }), []);
            assert.deepEqual(queryJsonPath('$[0]', 'string'), []);
            assert.deepEqual(queryJsonPath('$[0]', 42), []);
        });
    });

    // RFC 9535 §2.3.4: Array slice selector
    describe('Slice Selector', () => {
        const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

        // RFC 9535 §2.3.4.2.1: step of 0
        it('returns empty for step=0', () => {
            assert.deepEqual(queryJsonPath('$[::0]', arr), []);
        });

        // RFC 9535 §2.3.4.2: Basic slicing
        it('slices with start:end', () => {
            assert.deepEqual(queryJsonPath('$[1:3]', arr), [1, 2]);
        });

        it('slices with start only', () => {
            assert.deepEqual(queryJsonPath('$[7:]', arr), [7, 8, 9]);
        });

        it('slices with end only', () => {
            assert.deepEqual(queryJsonPath('$[:3]', arr), [0, 1, 2]);
        });

        it('slices with step', () => {
            assert.deepEqual(queryJsonPath('$[1:5:2]', arr), [1, 3]);
        });

        // RFC 9535 §2.3.4.2: Negative step reverses
        it('reverses with negative step', () => {
            assert.deepEqual(queryJsonPath('$[::-1]', [0, 1, 2]), [2, 1, 0]);
        });

        // RFC 9535 §2.3.4.3: Examples from spec
        it('handles 5:1:-2', () => {
            assert.deepEqual(queryJsonPath('$[5:1:-2]', arr), [5, 3]);
        });

        // RFC 9535 §2.3.4.2: Negative indices in slice
        it('handles negative start', () => {
            assert.deepEqual(queryJsonPath('$[-3:]', arr), [7, 8, 9]);
        });

        it('handles negative end', () => {
            assert.deepEqual(queryJsonPath('$[:-2]', [0, 1, 2, 3, 4]), [0, 1, 2]);
        });
    });

    // RFC 9535 §2.3.2: Wildcard selector
    describe('Wildcard Selector', () => {
        // RFC 9535 §2.3.2.2: Select all children of array
        it('selects all array elements', () => {
            assert.deepEqual(queryJsonPath('$[*]', [1, 2, 3]), [1, 2, 3]);
        });

        // RFC 9535 §2.3.2.2: Select all children of object
        it('selects all object values', () => {
            const result = queryJsonPath('$[*]', { a: 1, b: 2 });
            assert.ok(result !== null);
            assert.equal(result.length, 2);
            assert.ok(result.includes(1));
            assert.ok(result.includes(2));
        });

        // RFC 9535 §2.3.2.2: Primitive returns empty
        it('returns empty for primitives', () => {
            assert.deepEqual(queryJsonPath('$[*]', 'string'), []);
            assert.deepEqual(queryJsonPath('$[*]', 42), []);
            assert.deepEqual(queryJsonPath('$[*]', true), []);
            assert.deepEqual(queryJsonPath('$[*]', null), []);
        });

        // RFC 9535 §2.3.2.3: Multiple wildcards preserve duplicates
        it('preserves duplicates with multiple wildcards', () => {
            const result = queryJsonPath('$[*,*]', [1, 2]);
            assert.ok(result !== null);
            assert.equal(result.length, 4); // Each element selected twice
        });
    });

    // RFC 9535 §2.3.1: Name selector
    describe('Name Selector', () => {
        // RFC 9535 §2.3.1.2: Select member by name
        it('selects object member by name', () => {
            assert.deepEqual(queryJsonPath("$['foo']", { foo: 'bar' }), ['bar']);
        });

        it('selects with dot notation', () => {
            assert.deepEqual(queryJsonPath('$.foo', { foo: 'bar' }), ['bar']);
        });

        // RFC 9535 §2.3.1.2: Missing member returns empty
        it('returns empty for missing member', () => {
            assert.deepEqual(queryJsonPath('$.missing', { foo: 'bar' }), []);
        });

        // RFC 9535 §2.3.1.2: Non-object returns empty
        it('returns empty for non-object', () => {
            assert.deepEqual(queryJsonPath('$.foo', [1, 2, 3]), []);
            assert.deepEqual(queryJsonPath('$.foo', 'string'), []);
        });

        // RFC 9535 §2.3.1.3: Special characters in names
        it('handles special characters in names', () => {
            assert.deepEqual(queryJsonPath("$['j j']", { 'j j': 3 }), [3]);
            assert.deepEqual(queryJsonPath("$['k.k']", { 'k.k': 4 }), [4]);
        });

        // RFC 9535 §2.3.1.2: No Unicode normalization
        it('compares strings without normalization', () => {
            // é as single character vs e + combining accent
            const doc = { '\u00e9': 1 }; // é
            assert.deepEqual(queryJsonPath("$['\\u00e9']", doc), [1]);
            // Different encoding should not match
            assert.deepEqual(queryJsonPath("$['e\\u0301']", doc), []); // e + ́
        });
    });

    // RFC 9535 §2.3.5: Filter selector
    describe('Filter Selector', () => {
        // RFC 9535 §2.3.5.2.2: Comparison operators
        it('filters with == comparison', () => {
            const data = [{ a: 1 }, { a: 2 }, { a: 3 }];
            assert.deepEqual(queryJsonPath('$[?@.a == 2]', data), [{ a: 2 }]);
        });

        it('filters with != comparison', () => {
            const data = [{ a: 1 }, { a: 2 }];
            assert.deepEqual(queryJsonPath('$[?@.a != 1]', data), [{ a: 2 }]);
        });

        it('filters with < comparison', () => {
            const data = [{ a: 1 }, { a: 5 }, { a: 10 }];
            assert.deepEqual(queryJsonPath('$[?@.a < 5]', data), [{ a: 1 }]);
        });

        it('filters with <= comparison', () => {
            const data = [{ a: 1 }, { a: 5 }, { a: 10 }];
            assert.deepEqual(queryJsonPath('$[?@.a <= 5]', data), [{ a: 1 }, { a: 5 }]);
        });

        it('filters with > comparison', () => {
            const data = [{ a: 1 }, { a: 5 }, { a: 10 }];
            assert.deepEqual(queryJsonPath('$[?@.a > 5]', data), [{ a: 10 }]);
        });

        it('filters with >= comparison', () => {
            const data = [{ a: 1 }, { a: 5 }, { a: 10 }];
            assert.deepEqual(queryJsonPath('$[?@.a >= 5]', data), [{ a: 5 }, { a: 10 }]);
        });

        it('filters with string comparison', () => {
            const data = [{ name: 'foo' }, { name: 'bar' }];
            assert.deepEqual(queryJsonPath('$[?@.name == "bar"]', data), [{ name: 'bar' }]);
        });

        // RFC 9535 §2.3.5.2: Logical operators
        it('combines with && (and)', () => {
            const data = [{ a: 1, b: 2 }, { a: 2, b: 3 }, { a: 1, b: 3 }];
            assert.deepEqual(
                queryJsonPath('$[?@.a == 1 && @.b == 2]', data),
                [{ a: 1, b: 2 }]
            );
        });

        it('combines with || (or)', () => {
            const data = [{ a: 1 }, { a: 2 }, { a: 3 }];
            assert.deepEqual(
                queryJsonPath('$[?@.a == 1 || @.a == 3]', data),
                [{ a: 1 }, { a: 3 }]
            );
        });

        it('handles negation with !', () => {
            const data = [{ a: 1 }, { a: 2 }];
            assert.deepEqual(queryJsonPath('$[?!(@.a == 1)]', data), [{ a: 2 }]);
        });

        // RFC 9535 §2.3.5.2: Existence test
        it('tests for existence', () => {
            const data = [{ a: 1 }, { b: 2 }];
            assert.deepEqual(queryJsonPath('$[?@.a]', data), [{ a: 1 }]);
        });

        it('existence test with null value', () => {
            const data = [{ a: null }, { b: 2 }];
            // null is a value, so @.a exists
            assert.deepEqual(queryJsonPath('$[?@.a]', data), [{ a: null }]);
        });

        // RFC 9535 §2.3.5.2: Root reference in filter
        it('references root with $', () => {
            const data = { threshold: 10, items: [{ v: 5 }, { v: 15 }] };
            assert.deepEqual(
                queryJsonPath('$.items[?@.v > $.threshold]', data),
                [{ v: 15 }]
            );
        });

        // RFC 9535 §2.3.5.2.2: Type comparison
        it('compares different types as not equal', () => {
            const data = [{ a: '1' }, { a: 1 }];
            assert.deepEqual(queryJsonPath('$[?@.a == 1]', data), [{ a: 1 }]);
            assert.deepEqual(queryJsonPath('$[?@.a == "1"]', data), [{ a: '1' }]);
        });

        // RFC 9535 §2.3.5.2.2: null comparison
        it('compares null correctly', () => {
            const data = [{ a: null }, { a: 1 }];
            assert.deepEqual(queryJsonPath('$[?@.a == null]', data), [{ a: null }]);
        });

        // RFC 9535 §2.3.5.2.2: boolean comparison
        it('compares booleans correctly', () => {
            const data = [{ a: true }, { a: false }];
            assert.deepEqual(queryJsonPath('$[?@.a == true]', data), [{ a: true }]);
            assert.deepEqual(queryJsonPath('$[?@.a == false]', data), [{ a: false }]);
        });

        // RFC 9535 §2.3.5.1 + RFC 8259 §6: JSON numeric literals in filters.
        it('supports fraction and exponent number literals in comparisons', () => {
            const data = [{ n: 1.5 }, { n: -0.001 }, { n: 6.02e23 }];
            assert.deepEqual(queryJsonPath('$[?@.n == 1.5]', data), [{ n: 1.5 }]);
            assert.deepEqual(queryJsonPath('$[?@.n == -0.1E-2]', data), [{ n: -0.001 }]);
            assert.deepEqual(queryJsonPath('$[?@.n == 6.02e23]', data), [{ n: 6.02e23 }]);
        });

        it('rejects malformed numeric literals in filters', () => {
            assert.equal(parseJsonPath('$[?@.n == 01]'), null);
            assert.equal(parseJsonPath('$[?@.n == 1.]'), null);
            assert.equal(parseJsonPath('$[?@.n == .5]'), null);
            assert.equal(parseJsonPath('$[?@.n == 1e]'), null);
            assert.equal(parseJsonPath('$[?@.n == 1e+]'), null);
            assert.equal(parseJsonPath('$[?@.n == +1]'), null);
        });

        it('keeps integer index grammar strict while widening filter numbers', () => {
            assert.equal(parseJsonPath('$[1e2]'), null);
            assert.equal(parseJsonPath('$[1.5]'), null);
            assert.ok(parseJsonPath('$[?@.n == 1e2]') !== null);
        });

        // RFC 9535 §2.3.5.1: comparable uses singular-query, not general filter-query.
        it('rejects non-singular queries in comparison positions', () => {
            assert.equal(parseJsonPath('$[?@.* == 1]'), null);
            assert.equal(parseJsonPath('$[?@..a == 1]'), null);
            assert.equal(parseJsonPath('$[?@[0,1] == 1]'), null);
            assert.equal(parseJsonPath('$[?@[:2] == 1]'), null);
        });

        it('allows the same non-singular queries in existence tests', () => {
            assert.ok(parseJsonPath('$[?@.*]') !== null);
            assert.ok(parseJsonPath('$[?@..a]') !== null);
            assert.ok(parseJsonPath('$[?@[0,1]]') !== null);
            assert.ok(parseJsonPath('$[?@[:2]]') !== null);
        });

        it('does not coerce multi-node query results into singular comparisons', () => {
            const data = [{ a: [1, 2] }, { a: [1] }];
            assert.equal(queryJsonPath('$[?@.a[*] == 1]', data), null);
        });
    });

    // RFC 9535 §2.4: Function extensions
    describe('Function Extensions', () => {
        // RFC 9535 §2.4.4: length()
        describe('length()', () => {
            it('returns string length', () => {
                const data = [{ name: 'foo' }, { name: 'barbaz' }];
                assert.deepEqual(queryJsonPath('$[?length(@.name) > 3]', data), [{ name: 'barbaz' }]);
            });

            it('returns array length', () => {
                const data = { items: [1, 2, 3] };
                assert.deepEqual(queryJsonPath('$[?length(@.items) == 3]', [data]), [data]);
            });

            it('returns object member count', () => {
                const data = [{ obj: { a: 1, b: 2 } }, { obj: { a: 1 } }];
                assert.deepEqual(queryJsonPath('$[?length(@.obj) == 2]', data), [{ obj: { a: 1, b: 2 } }]);
            });

            it('rejects length() with node-list argument', () => {
                assert.equal(parseJsonPath('$[?length(@.obj[*]) == 2]'), null);
            });
        });

        // RFC 9535 §2.4.5: count()
        describe('count()', () => {
            it('returns nodelist length', () => {
                const data = { items: [1, 2, 3] };
                assert.deepEqual(queryJsonPath('$[?count(@.items[*]) > 2]', [data]), [data]);
            });

            it('returns 0 for empty nodelist', () => {
                const data = { items: [] };
                assert.deepEqual(queryJsonPath('$[?count(@.items[*]) == 0]', [data]), [data]);
            });

            it('rejects count() with value-typed argument', () => {
                assert.equal(parseJsonPath('$[?count("items") > 0]'), null);
            });
        });

        // RFC 9535 §2.4.6: match()
        describe('match()', () => {
            it('performs full regex match', () => {
                const data = [{ s: 'foo' }, { s: 'foobar' }];
                assert.deepEqual(queryJsonPath('$[?match(@.s, "foo")]', data), [{ s: 'foo' }]);
            });

            it('anchors match at start and end', () => {
                const data = [{ s: 'foo' }, { s: 'xfoox' }];
                assert.deepEqual(queryJsonPath('$[?match(@.s, "foo")]', data), [{ s: 'foo' }]);
            });

            it('supports regex patterns', () => {
                const data = [{ s: 'foo' }, { s: 'bar' }, { s: 'baz' }];
                assert.deepEqual(queryJsonPath('$[?match(@.s, "ba.")]', data), [{ s: 'bar' }, { s: 'baz' }]);
            });

            // RFC 9535 §2.4.6: Invalid regex patterns evaluate to false.
            it('returns false for invalid regex patterns', () => {
                const data = [{ s: 'foo' }, { s: 'bar' }];
                assert.deepEqual(queryJsonPath('$[?match(@.s, "(")]', data), []);
                // Repeat to ensure behavior is stable across repeated evaluations.
                assert.deepEqual(queryJsonPath('$[?match(@.s, "(")]', data), []);
            });

            it('rejects quantified overlapping alternation patterns by default', () => {
                const data = [{ s: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }];
                const result = queryJsonPath('$[?match(@.s, "(a|aa)+$")]', data);
                assert.equal(result, null);
            });

            it('rejects match() with node-list arguments', () => {
                assert.equal(parseJsonPath('$[?match(@.s[*], "foo")]'), null);
                assert.equal(parseJsonPath('$[?match(@.s, @.p[*])]'), null);
            });
        });

        // RFC 9535 §2.4.7: search()
        describe('search()', () => {
            it('performs partial regex match', () => {
                const data = [{ s: 'foo' }, { s: 'foobar' }];
                assert.deepEqual(queryJsonPath('$[?search(@.s, "foo")]', data), [{ s: 'foo' }, { s: 'foobar' }]);
            });

            it('finds pattern anywhere in string', () => {
                const data = [{ s: 'xfoox' }, { s: 'bar' }];
                assert.deepEqual(queryJsonPath('$[?search(@.s, "foo")]', data), [{ s: 'xfoox' }]);
            });

            it('rejects quantified overlapping alternation variants by default', () => {
                const data = [{ s: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }];
                const result = queryJsonPath('$[?search(@.s, "(ab|a)+$")]', data);
                assert.equal(result, null);
            });

            it('allows opted-out unsafe regex policy', () => {
                const data = [{ s: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }];
                const result = queryJsonPath(
                    '$[?search(@.s, "(a|aa)+$")]',
                    data,
                    { rejectUnsafeRegex: false }
                );
                assert.notEqual(result, null);
            });

            it('keeps safe quantified alternation behavior', () => {
                const data = [{ s: 'catdog' }, { s: 'cat' }, { s: 'wolf' }];
                assert.deepEqual(
                    queryJsonPath('$[?match(@.s, "(cat|dog)+")]', data),
                    [{ s: 'catdog' }, { s: 'cat' }]
                );
            });

            it('rejects search() with node-list arguments', () => {
                assert.equal(parseJsonPath('$[?search(@.s[*], "foo")]'), null);
            });
        });

        // RFC 9535 §2.4.8: value()
        describe('value()', () => {
            it('extracts singular value', () => {
                const data = [{ a: { b: 1 } }, { a: { b: 2 } }];
                assert.deepEqual(queryJsonPath('$[?value(@.a.b) == 1]', data), [{ a: { b: 1 } }]);
            });

            it('accepts node-list argument and returns null when non-singular', () => {
                const data = [{ a: [1, 2] }, { a: [1] }];
                assert.deepEqual(queryJsonPath('$[?value(@.a[*]) == 1]', data), [{ a: [1] }]);
            });
        });

        it('rejects non-logical function expressions as filter test-expr', () => {
            assert.equal(parseJsonPath('$[?length(@.name)]'), null);
            assert.equal(parseJsonPath('$[?count(@.items[*])]'), null);
            assert.equal(parseJsonPath('$[?value(@.name)]'), null);
        });
    });

    // RFC 9535 §2.5.2: Descendant segment
    describe('Descendant Segment', () => {
        const nested = { a: { b: { c: 1 } }, d: { b: { c: 2 } } };

        it('finds all matching descendants', () => {
            assert.deepEqual(queryJsonPath('$..c', nested), [1, 2]);
        });

        it('finds nested arrays', () => {
            const data = { a: [{ b: 1 }, { b: 2 }] };
            assert.deepEqual(queryJsonPath('$..b', data), [1, 2]);
        });

        it('combines with wildcard', () => {
            const data = { a: { x: 1 }, b: { x: 2 } };
            const result = queryJsonPath('$..*', data);
            assert.ok(result !== null);
            assert.ok(result.length >= 4); // a, b, x:1, x:2
        });
    });

    // RFC 9535 §2.6: Semantics of null
    describe('null Semantics', () => {
        it('null is a valid value', () => {
            assert.deepEqual(queryJsonPath('$.a', { a: null }), [null]);
        });

        it('null compares equal to null', () => {
            const data = [{ a: null }, { a: 1 }];
            assert.deepEqual(queryJsonPath('$[?@.a == null]', data), [{ a: null }]);
        });

        it('null does not equal missing', () => {
            const data = [{ a: null }, {}];
            const result = queryJsonPath('$[?@.a == null]', data);
            assert.ok(result !== null);
            assert.equal(result.length, 1);
            assert.deepEqual(result[0], { a: null });
        });
    });

    // RFC 9535 §2.7: Normalized paths
    describe('Normalized Paths', () => {
        it('formats normalized path with strings', () => {
            assert.equal(formatNormalizedPath(['store', 'book']), "$['store']['book']");
        });

        it('formats normalized path with indices', () => {
            assert.equal(formatNormalizedPath(['store', 'book', 0]), "$['store']['book'][0]");
        });

        it('formats empty path', () => {
            assert.equal(formatNormalizedPath([]), '$');
        });

        it('escapes single quotes', () => {
            assert.equal(formatNormalizedPath(["a'b"]), "$['a\\'b']");
        });

        it('escapes backslashes', () => {
            assert.equal(formatNormalizedPath(['a\\b']), "$['a\\\\b']");
        });

        it('escapes all control character classes', () => {
            assert.equal(formatNormalizedPath(['x\n\r\t']), "$['x\\n\\r\\t']");
            assert.equal(formatNormalizedPath(['\u0000\u001F']), "$['\\u0000\\u001F']");
            assert.equal(formatNormalizedPath(['\b\f']), "$['\\b\\f']");
        });

        it('escapes mixed quotes, slashes, and controls deterministically', () => {
            assert.equal(
                formatNormalizedPath(["a'b\\c\n\u0001"]),
                "$['a\\'b\\\\c\\n\\u0001']"
            );
        });

        it('is stable for already escaped-looking input values', () => {
            assert.equal(formatNormalizedPath(['\\n']), "$['\\\\n']");
            assert.equal(formatNormalizedPath(["\\'"]), "$['\\\\\\'']");
        });

        it('returns paths with nodes', () => {
            const result = queryJsonPathNodes('$.store.book[0].title', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 1);
            assert.equal(result[0].path, "$['store']['book'][0]['title']");
            assert.equal(result[0].value, 'Sayings of the Century');
        });

        it('returns multiple paths', () => {
            const result = queryJsonPathNodes('$.store.book[*].author', bookstore);
            assert.ok(result !== null);
            assert.equal(result.length, 4);
            assert.equal(result[0].path, "$['store']['book'][0]['author']");
            assert.equal(result[1].path, "$['store']['book'][1]['author']");
        });

        // RFC 9535 §2.7: Descendant queries still produce normalized paths.
        it('returns normalized paths for descendant wildcard matches', () => {
            const doc = { a: { b: 1 }, c: [{ d: 2 }] };
            const result = queryJsonPathNodes('$..*', doc);
            assert.ok(result !== null);

            const paths = result.map((node) => node.path);
            assert.ok(paths.includes("$['a']"));
            assert.ok(paths.includes("$['a']['b']"));
            assert.ok(paths.includes("$['c']"));
            assert.ok(paths.includes("$['c'][0]"));
            assert.ok(paths.includes("$['c'][0]['d']"));
        });
    });

    // RFC 9535 §2.1.2: Nodelist semantics
    describe('Nodelist Semantics', () => {
        // RFC 9535 §2.1.2: Duplicate nodes not removed
        it('preserves duplicate nodes', () => {
            const result = queryJsonPath('$[*,*]', [1, 2]);
            assert.ok(result !== null);
            assert.equal(result.length, 4); // Each element selected twice
        });

        // RFC 9535 §2.1.2: Empty nodelist is valid
        it('returns empty array for no matches', () => {
            assert.deepEqual(queryJsonPath('$.missing', { a: 1 }), []);
        });
    });

    // compileJsonPath
    describe('compileJsonPath', () => {
        it('compiles and executes query', () => {
            const fn = compileJsonPath('$.store.book[*].author');
            assert.ok(fn !== null);
            assert.deepEqual(fn(bookstore), [
                'Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien'
            ]);
        });

        it('returns null for invalid query', () => {
            assert.equal(compileJsonPath('invalid'), null);
        });

        it('can be reused', () => {
            const fn = compileJsonPath('$[0]');
            assert.ok(fn !== null);
            assert.deepEqual(fn([1, 2, 3]), [1]);
            assert.deepEqual(fn(['a', 'b']), ['a']);
        });
    });

    // Error handling
    describe('Error Handling', () => {
        it('returns null for invalid query', () => {
            assert.equal(queryJsonPath('invalid', {}), null);
        });

        it('throws with throwOnError option', () => {
            assert.throws(() => {
                queryJsonPath('invalid', {}, { throwOnError: true });
            });
        });

        // RFC 9535 §2.5.2 + security hardening: descendant traversal must terminate on cyclic graphs.
        it('terminates descendant traversal on cyclic object graphs', () => {
            const cyclic: { name: string; self?: unknown } = { name: 'root' };
            cyclic.self = cyclic;

            const result = queryJsonPath('$..name', cyclic);
            assert.deepEqual(result, ['root']);
        });

        // RFC 9535 §2.3.5.2.2 + resilience hardening: equality must be cycle-safe.
        it('compares cyclic objects without recursion overflow', () => {
            const left: Record<string, unknown> = { a: 1 };
            left.self = left;

            const right: Record<string, unknown> = { a: 1 };
            right.self = right;

            const nonEqualRight: Record<string, unknown> = { a: 2 };
            nonEqualRight.self = nonEqualRight;

            const data = [
                { left, right },
                { left, right: nonEqualRight },
            ];

            const result = queryJsonPath('$[?@.left == @.right]', data);
            assert.deepEqual(result, [{ left, right }]);
        });

        // RFC 9535 §2.5.2 + implementation limits: bounded traversal depth.
        it('returns null when maxDepth is exceeded', () => {
            const doc = { a: { b: { c: 1 } } };
            assert.equal(queryJsonPath('$..c', doc, { maxDepth: 1 }), null);
        });

        // RFC 9535 §2.4.7 + security hardening: regex safety policy for attacker-controlled patterns.
        it('returns null for unsafe regex patterns under default policy', () => {
            const data = [{ s: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }];
            const result = queryJsonPath('$[?search(@.s, "(a+)+$")]', data);
            assert.equal(result, null);
        });

        it('throws for unsafe regex patterns when throwOnError is true', () => {
            const data = [{ s: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }];
            assert.throws(() => {
                queryJsonPath('$[?search(@.s, "(a|aa)+$")]', data, { throwOnError: true });
            }, /unsafe regular expression pattern/);
        });

        // RFC 9535 §2.4.6-§2.4.7 + implementation limits: regex input and pattern budgets.
        it('returns null when regex pattern/input limits are exceeded', () => {
            const data = [{ s: 'abcdef' }];
            assert.equal(
                queryJsonPath('$[?search(@.s, "abc")]', data, { maxRegexInputLength: 3 }),
                null
            );
            assert.equal(
                queryJsonPath('$[?search(@.s, "abcdef")]', data, { maxRegexPatternLength: 3 }),
                null
            );
        });

        it('throws on limit breaches when throwOnError is true', () => {
            const doc = { a: [1, 2, 3, 4] };
            assert.throws(() => {
                queryJsonPath('$..*', doc, {
                    maxNodesVisited: 1,
                    throwOnError: true,
                });
            }, /maxNodesVisited/);
        });

        it('fails closed on comparison limit breaches and throws in throw mode', () => {
            const mkCycle = (value: number): Record<string, unknown> => {
                const root: Record<string, unknown> = { value };
                root.self = root;
                return root;
            };

            const data = [{ left: mkCycle(1), right: mkCycle(1) }];
            const query = '$[?@.left == @.right]';

            assert.equal(
                queryJsonPath(query, data, { maxNodesVisited: 4 }),
                null
            );

            assert.throws(() => {
                queryJsonPath(query, data, {
                    maxNodesVisited: 4,
                    throwOnError: true,
                });
            }, /maxNodesVisited/);
        });

        it('treats parser depth-limit invalid queries as throwOnError parse failures', () => {
            const depth = 80;
            const query = `$[?${'('.repeat(depth)}@.a == 1${')'.repeat(depth)}]`;
            assert.throws(() => {
                queryJsonPath(query, [{ a: 1 }], { throwOnError: true });
            }, /Invalid JSONPath query/);
        });
    });
});
