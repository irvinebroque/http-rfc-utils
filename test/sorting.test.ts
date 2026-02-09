import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseSortString,
    applySorting,
    compareValues,
    validateSortFields,
    buildSortString,
} from '../src/sorting.js';

describe('sorting helpers', () => {
    it('parseSortString parses directions correctly', () => {
        assert.deepEqual(parseSortString('name,-createdAt'), [
            { field: 'name', direction: 'asc' },
            { field: 'createdAt', direction: 'desc' },
        ]);
    });

    it('buildSortString round-trips parseSortString', () => {
        const fields = parseSortString('name,-createdAt');
        assert.equal(buildSortString(fields), 'name,-createdAt');
    });

    it('validateSortFields validates allowlist', () => {
        assert.equal(validateSortFields('name,-createdAt', ['name', 'createdAt']), true);
        assert.equal(validateSortFields('name,-unknown', ['name', 'createdAt']), false);
    });

    it('compareValues keeps nullish values last', () => {
        assert.equal(compareValues(undefined, 1, 'asc') > 0, true);
        assert.equal(compareValues(null, 1, 'desc') > 0, true);
    });

    it('applySorting sorts nested fields and tie-breakers', () => {
        const input = [
            { user: { profile: { score: 10 }, name: 'bravo' } },
            { user: { profile: { score: 20 }, name: 'alpha' } },
            { user: { profile: { score: 20 }, name: 'charlie' } },
        ];

        const sorted = applySorting(input, '-user.profile.score,user.name');

        assert.deepEqual(sorted.map((item) => item.user.name), ['alpha', 'charlie', 'bravo']);
    });

    it('applySorting preserves input order when sort is undefined', () => {
        const input = [{ id: 2 }, { id: 1 }];
        const sorted = applySorting(input, undefined);
        assert.equal(sorted, input);
    });
});
