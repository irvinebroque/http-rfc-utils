import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
    parseSfDict,
    parseSfItem,
    parseSfList,
    serializeSfDict,
    serializeSfItem,
    serializeSfList,
} from '../src/structured-fields.js';
import { SfDate, SfDisplayString, SfToken } from '../src/types.js';
import type { SfBareItem, SfDictionary, SfInnerList, SfItem, SfList } from '../src/types.js';

type CorpusHeaderType = 'item' | 'list' | 'dictionary';

type CorpusTypeObject = {
    __type: 'token' | 'date' | 'displaystring' | 'binary';
    value: string | number;
};

type CorpusBareItem = number | string | boolean | CorpusTypeObject;
type CorpusParams = Array<[string, CorpusBareItem]>;
type CorpusItem = [CorpusBareItem, CorpusParams];
type CorpusInnerList = [CorpusItem[], CorpusParams];
type CorpusList = Array<CorpusItem | CorpusInnerList>;
type CorpusDictionary = Array<[string, CorpusItem | CorpusInnerList]>;

interface CorpusTestCase {
    name: string;
    raw: string[];
    header_type: CorpusHeaderType;
    expected?: CorpusItem | CorpusList | CorpusDictionary;
    canonical?: string[];
    must_fail?: boolean;
    can_fail?: boolean;
}

function parseCorpusFixture(fileName: string): CorpusTestCase[] {
    const filePath = join(process.cwd(), 'test', 'fixtures', 'structured-field-tests', fileName);
    const fixtureText = readFileSync(filePath, 'utf8');
    return JSON.parse(fixtureText) as CorpusTestCase[];
}

function toCanonicalFieldValue(raw: string[]): string {
    return raw.join(', ');
}

function fromCorpusBareItem(value: CorpusBareItem): SfBareItem {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }

    if (value.__type === 'token' && typeof value.value === 'string') {
        return new SfToken(value.value);
    }

    if (value.__type === 'date' && typeof value.value === 'number') {
        return new SfDate(value.value);
    }

    if (value.__type === 'displaystring' && typeof value.value === 'string') {
        return new SfDisplayString(value.value);
    }

    if (value.__type === 'binary' && typeof value.value === 'string') {
        return new Uint8Array(Buffer.from(value.value, 'base64'));
    }

    throw new Error(`Unsupported corpus bare item type: ${value.__type}`);
}

function fromCorpusParams(params: CorpusParams): Record<string, SfBareItem> | undefined {
    if (params.length === 0) {
        return undefined;
    }

    const result: Record<string, SfBareItem> = {};
    for (const [key, value] of params) {
        result[key] = fromCorpusBareItem(value);
    }
    return result;
}

function fromCorpusItem(item: CorpusItem): SfItem {
    const [bareItem, params] = item;
    const sfItem: SfItem = { value: fromCorpusBareItem(bareItem) };
    const sfParams = fromCorpusParams(params);
    if (sfParams) {
        sfItem.params = sfParams;
    }
    return sfItem;
}

function isCorpusInnerList(value: CorpusItem | CorpusInnerList): value is CorpusInnerList {
    return Array.isArray(value[0]);
}

function fromCorpusInnerList(innerList: CorpusInnerList): SfInnerList {
    const [items, params] = innerList;
    const sfInnerList: SfInnerList = { items: items.map(fromCorpusItem) };
    const sfParams = fromCorpusParams(params);
    if (sfParams) {
        sfInnerList.params = sfParams;
    }
    return sfInnerList;
}

function fromCorpusList(list: CorpusList): SfList {
    return list.map(member => {
        if (isCorpusInnerList(member)) {
            return fromCorpusInnerList(member);
        }
        return fromCorpusItem(member);
    });
}

function fromCorpusDictionary(dict: CorpusDictionary): SfDictionary {
    const result: SfDictionary = {};
    for (const [key, value] of dict) {
        if (isCorpusInnerList(value)) {
            result[key] = fromCorpusInnerList(value);
        } else {
            result[key] = fromCorpusItem(value);
        }
    }
    return result;
}

describe('Structured Fields corpus compliance (RFC 9651 §3.3.8, §4.1.11, §4.2.10)', () => {
    const cases = parseCorpusFixture('display-string.json');

    for (const testCase of cases) {
        it(`httpwg corpus: ${testCase.name}`, () => {
            const input = toCanonicalFieldValue(testCase.raw);

            if (testCase.header_type === 'item') {
                const parsed = parseSfItem(input);
                if (testCase.must_fail) {
                    assert.equal(parsed, null);
                    return;
                }

                if (testCase.can_fail && parsed === null) {
                    return;
                }

                assert.ok(parsed);
                assert.ok(testCase.expected);
                assert.deepEqual(parsed, fromCorpusItem(testCase.expected as CorpusItem));

                const canonical = toCanonicalFieldValue(testCase.canonical ?? testCase.raw);
                assert.equal(serializeSfItem(parsed), canonical);
                return;
            }

            if (testCase.header_type === 'list') {
                const parsed = parseSfList(input);
                if (testCase.must_fail) {
                    assert.equal(parsed, null);
                    return;
                }

                if (testCase.can_fail && parsed === null) {
                    return;
                }

                assert.ok(parsed);
                assert.ok(testCase.expected);
                assert.deepEqual(parsed, fromCorpusList(testCase.expected as CorpusList));

                const canonical = toCanonicalFieldValue(testCase.canonical ?? testCase.raw);
                assert.equal(serializeSfList(parsed), canonical);
                return;
            }

            const parsed = parseSfDict(input);
            if (testCase.must_fail) {
                assert.equal(parsed, null);
                return;
            }

            if (testCase.can_fail && parsed === null) {
                return;
            }

            assert.ok(parsed);
            assert.ok(testCase.expected);
            assert.deepEqual(parsed, fromCorpusDictionary(testCase.expected as CorpusDictionary));

            const canonical = toCanonicalFieldValue(testCase.canonical ?? testCase.raw);
            assert.equal(serializeSfDict(parsed), canonical);
        });
    }
});
