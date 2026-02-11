/**
 * Tests for JSON canonicalization behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CanonicalJsonValue } from '../src/types.js';
import {
    formatCanonicalJson,
    formatCanonicalJsonUtf8,
    validateCanonicalJson,
    parseCanonicalJson,
} from '../src/json-canonicalization.js';

describe('RFC 8785 JSON Canonicalization Scheme (§3.2)', () => {
    // RFC 8785 Section 3.2.1 and Section 3.2.2: no whitespace and ECMAScript primitive serialization.
    it('formats primitives and objects without insignificant whitespace', () => {
        const value: CanonicalJsonValue = {
            numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
            string: '\u20ac$\u000f\nA\'B"\\\\"/',
            literals: [null, true, false],
        };

        assert.equal(
            formatCanonicalJson(value),
            '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}'
        );
    });

    // RFC 8785 Section 3.2.3: recursive object sorting by UTF-16 code units.
    it('sorts object keys recursively and preserves array element order', () => {
        const value: CanonicalJsonValue = {
            z: 1,
            a: {
                bb: 2,
                aa: 1,
            },
            arr: [
                { b: 2, a: 1 },
                { d: 4, c: 3 },
            ],
        };

        assert.equal(
            formatCanonicalJson(value),
            '{"a":{"aa":1,"bb":2},"arr":[{"a":1,"b":2},{"c":3,"d":4}],"z":1}'
        );
    });

    // RFC 8785 Section 3.2.3 multilingual key ordering vector.
    it('orders multilingual keys using UTF-16 code unit comparison', () => {
        const value: CanonicalJsonValue = {
            '\u20ac': 'Euro Sign',
            '\r': 'Carriage Return',
            '\ufb33': 'Hebrew Letter Dalet With Dagesh',
            '1': 'One',
            '\ud83d\ude00': 'Emoji: Grinning Face',
            '\u0080': 'Control',
            '\u00f6': 'Latin Small Letter O With Diaeresis',
        };

        const canonical = formatCanonicalJson(value);
        const expectedValueOrder = [
            'Carriage Return',
            'One',
            'Control',
            'Latin Small Letter O With Diaeresis',
            'Euro Sign',
            'Emoji: Grinning Face',
            'Hebrew Letter Dalet With Dagesh',
        ];

        let previousIndex = -1;
        for (const label of expectedValueOrder) {
            const marker = `"${label}"`;
            const markerIndex = canonical.indexOf(marker);
            assert.ok(markerIndex > previousIndex, `missing or misordered marker: ${label}`);
            previousIndex = markerIndex;
        }
    });

    // RFC 8785 Section 3.2.2.2 and 3.2.2.3: reject lone surrogates and non-finite numbers.
    describe('validateCanonicalJson', () => {
        it('throws on lone surrogate string data', () => {
            assert.throws(() => validateCanonicalJson('bad\ud800'), /lone surrogate/);

            assert.throws(
                () => formatCanonicalJson({ '\ud800': 'bad' } as unknown as CanonicalJsonValue),
                /lone surrogate/
            );
        });

        it('throws on NaN and Infinity values', () => {
            assert.throws(() => validateCanonicalJson(Number.NaN), /finite JSON numbers/);
            assert.throws(
                () => formatCanonicalJson(Number.POSITIVE_INFINITY as CanonicalJsonValue),
                /finite JSON numbers/
            );
        });

        it('throws deterministic errors for cyclic arrays and objects', () => {
            const cyclicArray: unknown[] = [];
            cyclicArray.push(cyclicArray);
            assert.throws(
                () => validateCanonicalJson(cyclicArray),
                { message: '$[0] contains a cyclic reference' }
            );

            const cyclicObject: Record<string, unknown> = {};
            cyclicObject.self = cyclicObject;
            assert.throws(
                () => formatCanonicalJson(cyclicObject as CanonicalJsonValue),
                { message: '$."self" contains a cyclic reference' }
            );
        });
    });

    // RFC 8785 Section 3.2.4: UTF-8 bytes are generated from canonical JSON text.
    it('returns UTF-8 bytes for canonical JSON text', () => {
        const value: CanonicalJsonValue = {
            literals: [null, true, false],
            numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
            string: '\u20ac$\u000f\nA\'B"\\\\"/',
        };

        const bytes = formatCanonicalJsonUtf8(value);
        const hex = bytesToHex(bytes);

        assert.equal(
            hex,
            '7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a5b3333333333333333332e333333333333332c31652b33302c342e352c302e3030322c31652d32375d2c22737472696e67223a22e282ac245c75303030665c6e4127425c225c5c5c5c5c222f227d'
        );
    });

    // RFC 8785 Section 3.2.1-3.2.3: parser accepts only canonical JSON text.
    describe('parseCanonicalJson', () => {
        it('returns null for invalid JSON text', () => {
            assert.equal(parseCanonicalJson('{'), null);
        });

        it('returns null for non-canonical text forms', () => {
            assert.equal(parseCanonicalJson('{"b":1,"a":2}'), null);
            assert.equal(parseCanonicalJson('{"a":1, "b":2}'), null);
            assert.equal(parseCanonicalJson('{"a":"\\/"}'), null);
            assert.equal(parseCanonicalJson('{"a":1,"a":2}'), null);
            assert.equal(parseCanonicalJson('"\\ud800"'), null);
        });

        it('returns parsed value for canonical text', () => {
            const input: CanonicalJsonValue = {
                z: 3,
                a: { d: 2, b: 1 },
                arr: [{ y: 2, x: 1 }],
            };

            const canonical = formatCanonicalJson(input);
            const parsed = parseCanonicalJson(canonical);

            assert.deepEqual(parsed, {
                a: { b: 1, d: 2 },
                arr: [{ x: 1, y: 2 }],
                z: 3,
            });
        });
    });
});

function bytesToHex(bytes: Uint8Array): string {
    let hex = '';
    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
}
