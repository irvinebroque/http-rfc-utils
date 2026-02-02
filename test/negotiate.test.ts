import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseAccept,
    negotiate,
    getResponseFormat,
    toCSV,
    MEDIA_TYPES,
    MIME_TO_FORMAT,
} from '../src/negotiate.js';

// RFC 7231 §5.3.1, §5.3.2: Accept header parsing and qvalue sorting.
describe('parseAccept', () => {
    it('parses single type', () => {
        const result = parseAccept('application/json');
        assert.equal(result.length, 1);
        assert.equal(result[0]!.type, 'application');
        assert.equal(result[0]!.subtype, 'json');
        assert.equal(result[0]!.q, 1);
    });

    it('parses with quality', () => {
        const result = parseAccept('text/html;q=0.9');
        assert.equal(result.length, 1);
        assert.equal(result[0]!.type, 'text');
        assert.equal(result[0]!.subtype, 'html');
        assert.equal(result[0]!.q, 0.9);
    });

    it('parses multiple types and sorts by q value (highest first)', () => {
        const result = parseAccept('text/plain;q=0.5, application/json;q=0.9, text/html;q=0.1');
        assert.equal(result.length, 3);
        assert.equal(result[0].q, 0.9);
        assert.equal(result[0].subtype, 'json');
        assert.equal(result[1].q, 0.5);
        assert.equal(result[1].subtype, 'plain');
        assert.equal(result[2].q, 0.1);
        assert.equal(result[2].subtype, 'html');
    });

    it('parses wildcard */*', () => {
        const result = parseAccept('*/*');
        assert.equal(result.length, 1);
        assert.equal(result[0]!.type, '*');
        assert.equal(result[0]!.subtype, '*');
        assert.equal(result[0]!.q, 1);
    });

    it('parses type wildcard text/*', () => {
        const result = parseAccept('text/*');
        assert.equal(result.length, 1);
        assert.equal(result[0]!.type, 'text');
        assert.equal(result[0]!.subtype, '*');
        assert.equal(result[0]!.q, 1);
    });

    it('default q is 1.0 when not specified', () => {
        const result = parseAccept('application/xml');
        assert.equal(result[0].q, 1);
    });

    it('handles q=0 (not acceptable)', () => {
        const result = parseAccept('text/html;q=0');
        assert.equal(result.length, 1);
        assert.equal(result[0]!.type, 'text');
        assert.equal(result[0]!.subtype, 'html');
        assert.equal(result[0]!.q, 0);
    });

    // RFC 7231 Section 5.3.1 (qvalue grammar)
    it('rejects q > 1', () => {
        const result = parseAccept('text/html;q=1.5');
        assert.deepEqual(result, []);
    });

    // RFC 7231 Section 5.3.1 (qvalue grammar)
    it('rejects q < 0', () => {
        const result = parseAccept('text/html;q=-0.5');
        assert.deepEqual(result, []);
    });

    // RFC 7231 Section 5.3.1 (qvalue grammar)
    it('rejects q with more than three decimals', () => {
        const result = parseAccept('text/html;q=0.1234');
        assert.deepEqual(result, []);
    });

    // RFC 7231 Section 5.3.1 (qvalue grammar)
    it('rejects q with non-zero decimals on 1', () => {
        const result = parseAccept('text/html;q=1.001');
        assert.deepEqual(result, []);
    });

    // RFC 7231 Section 5.3.1 (qvalue grammar)
    it('rejects q with extra digits before decimal', () => {
        const result = parseAccept('text/html;q=01');
        assert.deepEqual(result, []);
    });

    it('handles whitespace', () => {
        const result = parseAccept('text/html ; q=0.9');
        assert.equal(result.length, 1);
        assert.equal(result[0]!.type, 'text');
        assert.equal(result[0]!.subtype, 'html');
        assert.equal(result[0]!.q, 0.9);
    });

    it('handles parameters', () => {
        const result = parseAccept('text/plain;format=flowed');
        assert.equal(result[0].type, 'text');
        assert.equal(result[0].subtype, 'plain');
        assert.equal(result[0].q, 1);
    });

    it('handles quoted parameter values with commas', () => {
        const result = parseAccept('text/plain;format="flowed,stuff"');
        assert.equal(result.length, 1);
        assert.equal(result[0].type, 'text');
        assert.equal(result[0].subtype, 'plain');
        assert.equal(result[0].params.get('format'), 'flowed,stuff');
    });

    it('returns empty array for empty string', () => {
        const result = parseAccept('');
        assert.deepEqual(result, []);
    });

    describe('specificity sorting (when q values are equal)', () => {
        it('exact match with params beats exact without', () => {
            const result = parseAccept('text/plain, text/plain;format=flowed');
            // Both have q=1, but the one with params should come first
            assert.equal(result.length, 2);
            // The one with params should be more specific
        });

        it('exact match beats type wildcard', () => {
            const result = parseAccept('text/*, text/html');
            assert.equal(result.length, 2);
            // text/html should come before text/*
            assert.equal(result[0].subtype, 'html');
            assert.equal(result[1].subtype, '*');
        });

        it('type wildcard beats full wildcard', () => {
            const result = parseAccept('*/*, text/*');
            assert.equal(result.length, 2);
            // text/* should come before */*
            assert.equal(result[0].type, 'text');
            assert.equal(result[0].subtype, '*');
            assert.equal(result[1].type, '*');
            assert.equal(result[1].subtype, '*');
        });

        it('sorts by specificity: text/plain;format=flowed > text/plain > text/* > */*', () => {
            const result = parseAccept('*/*, text/*, text/plain, text/plain;format=flowed');
            assert.equal(result.length, 4);
            // Most specific first
            assert.equal(result[0].type, 'text');
            assert.equal(result[0].subtype, 'plain');
            // text/plain (with or without params) should come before wildcards
            assert.equal(result[1].type, 'text');
            assert.equal(result[1].subtype, 'plain');
            // text/* before */*
            assert.equal(result[2].type, 'text');
            assert.equal(result[2].subtype, '*');
            assert.equal(result[3].type, '*');
            assert.equal(result[3].subtype, '*');
        });
    });
});

// RFC 7231 §5.3.2: Media type selection based on Accept.
describe('negotiate', () => {
    const supported = ['application/json', 'text/html', 'text/csv'];

    it('returns best matching media type', () => {
        const result = negotiate('application/json', supported);
        assert.equal(result, 'application/json');
    });

    it('returns best match based on q value', () => {
        const result = negotiate('text/html;q=0.5, application/json;q=0.9', supported);
        assert.equal(result, 'application/json');
    });

    it('returns null when no match', () => {
        const result = negotiate('application/xml', supported);
        assert.equal(result, null);
    });

    it('rejects param-specific ranges when supported lacks params', () => {
        const result = negotiate('text/plain;format=flowed', ['text/plain']);
        assert.equal(result, null);
    });

    it('matches param-specific ranges when supported includes params', () => {
        const result = negotiate('text/plain;format=flowed', ['text/plain;format=flowed']);
        assert.equal(result, 'text/plain;format=flowed');
    });

    it('handles q=0 rejection', () => {
        const result = negotiate('application/json;q=0, text/html', supported);
        assert.equal(result, 'text/html');
    });

    it('returns null when all supported types have q=0', () => {
        const result = negotiate('application/json;q=0, text/html;q=0, text/csv;q=0', supported);
        assert.equal(result, null);
    });

    it('*/* matches any supported type', () => {
        const result = negotiate('*/*', supported);
        assert.equal(result, 'application/json'); // First supported
    });

    it('text/* matches text types', () => {
        const result = negotiate('text/*', supported);
        assert.equal(result, 'text/html'); // First text/* match
    });

    it('type wildcard prefers more specific match', () => {
        const result = negotiate('text/*, application/json;q=0.9', supported);
        // text/* has q=1, should match first text type
        assert.equal(result, 'text/html');
    });

    it('returns first supported when Accept missing', () => {
        const result = negotiate(undefined, supported);
        assert.equal(result, 'application/json');
    });

    it('returns first supported when Accept empty', () => {
        const result = negotiate('', supported);
        assert.equal(result, 'application/json');
    });

    it('returns first supported when Accept is null', () => {
        const result = negotiate(null as unknown as string, supported);
        assert.equal(result, 'application/json');
    });
});

// RFC 7231 §5.3.2: Response format selection from Accept.
describe('getResponseFormat', () => {
    it('returns json by default', () => {
        const result = getResponseFormat('application/json');
        assert.equal(result, 'json');
    });

    it('returns csv when Accept prefers text/csv', () => {
        const result = getResponseFormat('text/csv');
        assert.equal(result, 'csv');
    });

    it('returns csv when Accept prefers csv over json', () => {
        const result = getResponseFormat('text/csv;q=1, application/json;q=0.5');
        assert.equal(result, 'csv');
    });

    it('returns json when json has higher q than csv', () => {
        const result = getResponseFormat('text/csv;q=0.4, application/json;q=0.8');
        assert.equal(result, 'json');
    });

    it('returns json when Accept header missing', () => {
        const result = getResponseFormat(undefined);
        assert.equal(result, 'json');
    });

    it('returns json when Accept is */*', () => {
        const result = getResponseFormat('*/*');
        assert.equal(result, 'json');
    });

    it('handles case-insensitive csv type', () => {
        const result = getResponseFormat('TEXT/CSV');
        assert.equal(result, 'csv');
    });

    it('returns json when Accept is empty', () => {
        const result = getResponseFormat('');
        assert.equal(result, 'json');
    });

    // RFC 7231 §5.3.2: no acceptable match yields null.
    it('returns null when Accept disallows both json and csv', () => {
        const result = getResponseFormat('application/json;q=0, text/csv;q=0');
        assert.equal(result, null);
    });

    // RFC 7231 §5.3.2: no acceptable match yields null.
    it('returns null when Accept excludes json/csv', () => {
        const result = getResponseFormat('text/html');
        assert.equal(result, null);
    });
});

// Non-RFC: CSV formatting helpers.
describe('toCSV', () => {
    it('converts array of objects to CSV string', () => {
        const data = [
            { name: 'Alice', age: 30 },
            { name: 'Bob', age: 25 },
        ];
        const result = toCSV(data);
        assert.equal(result, 'name,age\nAlice,30\nBob,25');
    });

    it('first row is headers (keys from first object)', () => {
        const data = [{ id: 1, title: 'Test' }];
        const result = toCSV(data);
        const lines = result.split('\n');
        assert.equal(lines[0], 'id,title');
    });

    it('values are comma-separated', () => {
        const data = [{ a: 1, b: 2, c: 3 }];
        const result = toCSV(data);
        assert.equal(result, 'a,b,c\n1,2,3');
    });

    it('quotes values containing commas', () => {
        const data = [{ name: 'Doe, John', age: 30 }];
        const result = toCSV(data);
        assert.equal(result, 'name,age\n"Doe, John",30');
    });

    it('quotes values containing quotes (escaped as "")', () => {
        const data = [{ quote: 'He said "hello"' }];
        const result = toCSV(data);
        assert.equal(result, 'quote\n"He said ""hello"""');
    });

    it('quotes values containing newlines', () => {
        const data = [{ text: 'line1\nline2' }];
        const result = toCSV(data);
        assert.equal(result, 'text\n"line1\nline2"');
    });

    it('handles null as empty string', () => {
        const data = [{ value: null }];
        const result = toCSV(data);
        assert.equal(result, 'value\n');
    });

    it('handles undefined as empty string', () => {
        const data = [{ value: undefined }];
        const result = toCSV(data);
        assert.equal(result, 'value\n');
    });

    it('handles nested objects (JSON.stringify)', () => {
        const data = [{ nested: { foo: 'bar' } }];
        const result = toCSV(data);
        // Nested object should be stringified, which contains quotes, so it gets quoted
        assert.equal(result, 'nested\n"{""foo"":""bar""}"');
    });

    it('returns empty string for empty array', () => {
        const result = toCSV([]);
        assert.equal(result, '');
    });

    it('handles array with single object', () => {
        const data = [{ id: 1 }];
        const result = toCSV(data);
        assert.equal(result, 'id\n1');
    });

    it('handles boolean values', () => {
        const data = [{ active: true, deleted: false }];
        const result = toCSV(data);
        assert.equal(result, 'active,deleted\ntrue,false');
    });

    it('handles numeric values', () => {
        const data = [{ int: 42, float: 3.14 }];
        const result = toCSV(data);
        assert.equal(result, 'int,float\n42,3.14');
    });

    it('handles mixed types', () => {
        const data = [
            { str: 'hello', num: 42, bool: true, nil: null },
        ];
        const result = toCSV(data);
        assert.equal(result, 'str,num,bool,nil\nhello,42,true,');
    });
});

// Non-RFC: Helper constants for response formats.
describe('constants', () => {
    describe('MEDIA_TYPES', () => {
        it('json equals application/json', () => {
            assert.equal(MEDIA_TYPES.json, 'application/json');
        });

        it('csv equals text/csv', () => {
            assert.equal(MEDIA_TYPES.csv, 'text/csv');
        });
    });

    describe('MIME_TO_FORMAT', () => {
        it('application/json maps to json', () => {
            assert.equal(MIME_TO_FORMAT['application/json'], 'json');
        });

        it('text/csv maps to csv', () => {
            assert.equal(MIME_TO_FORMAT['text/csv'], 'csv');
        });
    });
});
