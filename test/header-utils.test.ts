import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    TOKEN_CHARS,
    QVALUE_REGEX,
    assertNoCtl,
    assertHeaderToken,
    isEmptyHeader,
    splitQuotedValue,
    splitListValue,
    unquote,
    escapeQuotedString,
    quoteString,
    quoteIfNeeded,
    parseQValue,
    parseQParameter,
} from '../src/header-utils.js';

// RFC 9110 §5.6.2: token character set.
describe('TOKEN_CHARS', () => {
    it('matches valid token strings', () => {
        assert.ok(TOKEN_CHARS.test('token'));
        assert.ok(TOKEN_CHARS.test('application'));
        assert.ok(TOKEN_CHARS.test('Content-Type'));
        assert.ok(TOKEN_CHARS.test('x-custom-header'));
        assert.ok(TOKEN_CHARS.test("!#$%&'*+-.^_`|~"));
        assert.ok(TOKEN_CHARS.test('abc123'));
    });

    it('rejects invalid token strings', () => {
        assert.ok(!TOKEN_CHARS.test(''));
        assert.ok(!TOKEN_CHARS.test('hello world'));
        assert.ok(!TOKEN_CHARS.test('hello"world'));
        assert.ok(!TOKEN_CHARS.test('hello=world'));
        assert.ok(!TOKEN_CHARS.test('hello;world'));
        assert.ok(!TOKEN_CHARS.test('hello,world'));
        assert.ok(!TOKEN_CHARS.test('(parentheses)'));
    });
});

// RFC 9110 §12.4.2: qvalue grammar.
describe('QVALUE_REGEX', () => {
    it('matches valid q-values', () => {
        assert.ok(QVALUE_REGEX.test('0'));
        assert.ok(QVALUE_REGEX.test('1'));
        assert.ok(QVALUE_REGEX.test('0.5'));
        assert.ok(QVALUE_REGEX.test('0.9'));
        assert.ok(QVALUE_REGEX.test('0.123'));
        assert.ok(QVALUE_REGEX.test('1.0'));
        assert.ok(QVALUE_REGEX.test('1.000'));
        assert.ok(QVALUE_REGEX.test('0.'));
    });

    it('rejects invalid q-values', () => {
        assert.ok(!QVALUE_REGEX.test(''));
        assert.ok(!QVALUE_REGEX.test('2'));
        assert.ok(!QVALUE_REGEX.test('1.1'));
        assert.ok(!QVALUE_REGEX.test('0.1234'));
        assert.ok(!QVALUE_REGEX.test('-0.5'));
        assert.ok(!QVALUE_REGEX.test('abc'));
        assert.ok(!QVALUE_REGEX.test('1.001'));
    });
});

// RFC 9110 §5.5: field-content excludes CR/LF and other CTLs in serialized values.
describe('assertNoCtl', () => {
    it('accepts visible ASCII and HTAB', () => {
        assert.doesNotThrow(() => assertNoCtl('hello\tworld', 'test'));
    });

    it('rejects CR/LF, NUL, and DEL', () => {
        assert.throws(() => assertNoCtl('a\rb', 'test'), /control characters/);
        assert.throws(() => assertNoCtl('a\nb', 'test'), /control characters/);
        assert.throws(() => assertNoCtl('a\u0000b', 'test'), /control characters/);
        assert.throws(() => assertNoCtl('a\u007fb', 'test'), /control characters/);
    });
});

// RFC 9110 §5.6.2: header parameter names are tokens.
describe('assertHeaderToken', () => {
    it('accepts valid token names', () => {
        assert.doesNotThrow(() => assertHeaderToken('x-custom', 'token'));
        assert.doesNotThrow(() => assertHeaderToken('error_description', 'token'));
    });

    it('rejects invalid token names', () => {
        assert.throws(() => assertHeaderToken('bad key', 'token'), /valid header token/);
        assert.throws(() => assertHeaderToken('bad=key', 'token'), /valid header token/);
    });
});

describe('isEmptyHeader', () => {
    it('returns true for null', () => {
        assert.equal(isEmptyHeader(null), true);
    });

    it('returns true for undefined', () => {
        assert.equal(isEmptyHeader(undefined), true);
    });

    it('returns true for empty string', () => {
        assert.equal(isEmptyHeader(''), true);
    });

    it('returns true for whitespace-only string', () => {
        assert.equal(isEmptyHeader('   '), true);
        assert.equal(isEmptyHeader('\t\n'), true);
    });

    it('returns false for non-empty string', () => {
        assert.equal(isEmptyHeader('value'), false);
        assert.equal(isEmptyHeader('  value  '), false);
    });
});

// RFC 9110 §5.6.4: quoted-string handling in header values.
describe('splitQuotedValue', () => {
    it('splits simple values by comma', () => {
        const result = splitQuotedValue('a, b, c', ',');
        assert.deepEqual(result, ['a', ' b', ' c']);
    });

    it('splits simple values by semicolon', () => {
        const result = splitQuotedValue('a; b; c', ';');
        assert.deepEqual(result, ['a', ' b', ' c']);
    });

    it('preserves commas inside quoted strings', () => {
        const result = splitQuotedValue('a, "hello, world", c', ',');
        assert.deepEqual(result, ['a', ' "hello, world"', ' c']);
    });

    it('handles escaped quotes inside quoted strings', () => {
        const result = splitQuotedValue('a, "say \\"hello\\"", c', ',');
        assert.deepEqual(result, ['a', ' "say \\"hello\\""', ' c']);
    });

    it('handles escaped backslashes inside quoted strings', () => {
        const result = splitQuotedValue('a, "path\\\\file", c', ',');
        assert.deepEqual(result, ['a', ' "path\\\\file"', ' c']);
    });

    it('handles empty input', () => {
        const result = splitQuotedValue('', ',');
        assert.deepEqual(result, ['']);
    });

    it('handles input with no delimiters', () => {
        const result = splitQuotedValue('single', ',');
        assert.deepEqual(result, ['single']);
    });

    it('handles multiple adjacent delimiters', () => {
        const result = splitQuotedValue('a,,b', ',');
        assert.deepEqual(result, ['a', '', 'b']);
    });

    it('handles unclosed quotes gracefully', () => {
        const result = splitQuotedValue('a, "unclosed, b', ',');
        // The unclosed quote treats rest of string as quoted
        assert.deepEqual(result, ['a', ' "unclosed, b']);
    });
});

describe('splitListValue', () => {
    it('splits comma-separated values', () => {
        const result = splitListValue('a, b, c');
        assert.deepEqual(result, ['a', 'b', 'c']);
    });

    it('trims whitespace from parts', () => {
        const result = splitListValue('  a  ,  b  ,  c  ');
        assert.deepEqual(result, ['a', 'b', 'c']);
    });

    it('filters empty parts', () => {
        const result = splitListValue('a,, b,,c,');
        assert.deepEqual(result, ['a', 'b', 'c']);
    });

    it('handles empty input', () => {
        const result = splitListValue('');
        assert.deepEqual(result, []);
    });

    it('handles single value', () => {
        const result = splitListValue('single');
        assert.deepEqual(result, ['single']);
    });
});

// RFC 9110 §5.6.4: quoted-string unescaping.
describe('unquote', () => {
    it('unquotes a simple quoted string', () => {
        assert.equal(unquote('"hello"'), 'hello');
    });

    it('returns unquoted value as-is (trimmed)', () => {
        assert.equal(unquote('hello'), 'hello');
        assert.equal(unquote('  hello  '), 'hello');
    });

    it('unescapes backslash-quote', () => {
        assert.equal(unquote('"say \\"hello\\""'), 'say "hello"');
    });

    it('unescapes backslash-backslash', () => {
        assert.equal(unquote('"path\\\\file"'), 'path\\file');
    });

    it('unescapes any character after backslash', () => {
        assert.equal(unquote('"a\\bc"'), 'abc');
    });

    it('handles empty quoted string', () => {
        assert.equal(unquote('""'), '');
    });

    it('handles quoted string with only quotes', () => {
        assert.equal(unquote('"\\""'), '"');
    });

    it('handles missing end quote', () => {
        // Doesn't match quoted-string pattern, returns trimmed
        assert.equal(unquote('"hello'), '"hello');
    });

    it('handles missing start quote', () => {
        assert.equal(unquote('hello"'), 'hello"');
    });

    it('handles single quote character', () => {
        assert.equal(unquote('"'), '"');
    });

    it('handles whitespace around quoted string', () => {
        assert.equal(unquote('  "hello"  '), 'hello');
    });
});

// RFC 9110 §5.6.4: quoted-string escaping helpers.
describe('quoted-string helpers', () => {
    it('escapeQuotedString escapes backslashes and double quotes', () => {
        assert.equal(escapeQuotedString('say "hello"'), 'say \\"hello\\"');
        assert.equal(escapeQuotedString('path\\file'), 'path\\\\file');
    });

    it('quoteString wraps escaped values in double quotes', () => {
        assert.equal(quoteString('hello'), '"hello"');
        assert.equal(quoteString('a"b'), '"a\\"b"');
    });
});

// RFC 9110 §5.6.2, §5.6.4: token vs quoted-string formatting.
describe('quoteIfNeeded', () => {
    it('returns token values unquoted', () => {
        assert.equal(quoteIfNeeded('hello'), 'hello');
        assert.equal(quoteIfNeeded('Content-Type'), 'Content-Type');
        assert.equal(quoteIfNeeded('x-custom'), 'x-custom');
    });

    it('quotes values with spaces', () => {
        assert.equal(quoteIfNeeded('hello world'), '"hello world"');
    });

    it('quotes values with special characters', () => {
        assert.equal(quoteIfNeeded('a=b'), '"a=b"');
        assert.equal(quoteIfNeeded('a;b'), '"a;b"');
        assert.equal(quoteIfNeeded('a,b'), '"a,b"');
    });

    it('escapes quotes in values', () => {
        assert.equal(quoteIfNeeded('say "hello"'), '"say \\"hello\\""');
    });

    it('escapes backslashes in values', () => {
        assert.equal(quoteIfNeeded('path\\file'), '"path\\\\file"');
    });

    it('quotes empty string', () => {
        assert.equal(quoteIfNeeded(''), '""');
    });

    it('handles values with both quotes and backslashes', () => {
        assert.equal(quoteIfNeeded('a\\"b'), '"a\\\\\\"b"');
    });

    // RFC 9110 §5.5: reject CTLs to prevent header injection.
    it('rejects CR/LF and control bytes', () => {
        assert.throws(() => quoteIfNeeded('a\rb'), /control characters/);
        assert.throws(() => quoteIfNeeded('a\nb'), /control characters/);
        assert.throws(() => quoteIfNeeded('a\u0000b'), /control characters/);
        assert.throws(() => quoteIfNeeded('a\u007fb'), /control characters/);
    });
});

// RFC 9110 §12.4.2: qvalue parsing.
describe('parseQValue', () => {
    it('parses valid q-values', () => {
        assert.equal(parseQValue('0'), 0);
        assert.equal(parseQValue('1'), 1);
        assert.equal(parseQValue('0.5'), 0.5);
        assert.equal(parseQValue('0.9'), 0.9);
        assert.equal(parseQValue('0.123'), 0.123);
        assert.equal(parseQValue('1.0'), 1);
        assert.equal(parseQValue('1.000'), 1);
    });

    it('trims whitespace', () => {
        assert.equal(parseQValue('  0.5  '), 0.5);
    });

    it('returns null for invalid q-values', () => {
        assert.equal(parseQValue(''), null);
        assert.equal(parseQValue('2'), null);
        assert.equal(parseQValue('1.1'), null);
        assert.equal(parseQValue('0.1234'), null);
        assert.equal(parseQValue('-0.5'), null);
        assert.equal(parseQValue('abc'), null);
        assert.equal(parseQValue('1.001'), null);
    });
});

describe('parseQParameter', () => {
    it('parses valid q parameters', () => {
        assert.equal(parseQParameter('q=0.5'), 0.5);
        assert.equal(parseQParameter('Q=1.0'), 1);
    });

    it('returns undefined for non-q parameters', () => {
        assert.equal(parseQParameter('level=1'), undefined);
        assert.equal(parseQParameter('token'), undefined);
    });

    it('returns null for invalid q parameters', () => {
        assert.equal(parseQParameter('q=2'), null);
        assert.equal(parseQParameter('q=abc'), null);
    });
});
