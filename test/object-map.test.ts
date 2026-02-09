import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createObjectMap, hasOwnKey } from '../src/object-map.js';

// Non-RFC: internal helper coverage for dynamic key maps.
describe('object-map helpers', () => {
    it('checks own keys on null-prototype maps', () => {
        const map = createObjectMap<string>();
        map.alpha = 'a';

        assert.equal(hasOwnKey(map, 'alpha'), true);
        assert.equal(hasOwnKey(map, 'toString'), false);
    });

    it('narrows dynamic keys for typed records', () => {
        const record = { alpha: 'a', beta: 'b' } as const;
        const dynamicKey: string = 'alpha';

        if (!hasOwnKey(record, dynamicKey)) {
            assert.fail('expected "alpha" to be recognized as an own key');
        }

        const value: string = record[dynamicKey];
        assert.equal(value, 'a');
    });
});
