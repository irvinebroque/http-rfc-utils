import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseUseAsDictionary,
    formatUseAsDictionary,
    validateUseAsDictionary,
    parseAvailableDictionary,
    formatAvailableDictionary,
    parseDictionaryId,
    formatDictionaryId,
    matchesDictionary,
    selectBestDictionary,
    mergeDictionaryVary,
} from '../src/compression-dictionary.js';
import type { StoredDictionary } from '../src/types.js';

function digest(seed: number): Uint8Array {
    return Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256);
}

function storedDictionary(overrides: Partial<StoredDictionary> = {}): StoredDictionary {
    return {
        match: '/app/*',
        matchDest: [],
        id: '',
        type: 'raw',
        url: 'https://example.test/dict',
        hash: digest(0),
        fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides,
    };
}

// RFC 9842 §2.1: Use-As-Dictionary is an SF Dictionary with required match string.
describe('Use-As-Dictionary (RFC 9842 Section 2.1)', () => {
    it('parses defaults for optional members', () => {
        assert.deepEqual(parseUseAsDictionary('match="/app/*"'), {
            match: '/app/*',
            matchDest: [],
            id: '',
            type: 'raw',
        });
    });

    it('returns null when required match is missing', () => {
        assert.equal(parseUseAsDictionary('id="dictionary-1", type=raw'), null);
    });

    // RFC 9842 §2.1.2: match-dest is an inner list of strings.
    it('rejects invalid match-dest member shape', () => {
        assert.equal(parseUseAsDictionary('match="/app/*", match-dest="document"'), null);
        assert.equal(parseUseAsDictionary('match="/app/*", match-dest=("document";a=1)'), null);
    });

    // RFC 9842 §2.1.4: unknown type tokens are parseable.
    it('parses unknown type tokens but leaves usability decisions to matching', () => {
        assert.deepEqual(parseUseAsDictionary('match="/app/*", type=custom'), {
            match: '/app/*',
            matchDest: [],
            id: '',
            type: 'custom',
        });
    });

    it('formats known members and omits default optional members', () => {
        assert.equal(
            formatUseAsDictionary({
                match: '/app/*',
                matchDest: ['script'],
                id: 'dictionary-1',
                type: 'raw',
            }),
            'match="/app/*", match-dest=("script"), id="dictionary-1"',
        );
    });
});

// RFC 9842 §2.1.1 and §2.2.2: same-origin + URL pattern validation and matching.
describe('validateUseAsDictionary and matchesDictionary (RFC 9842 Sections 2.1.1 and 2.2.2)', () => {
    it('enforces same-origin and rejects regexp-group patterns', () => {
        assert.equal(
            validateUseAsDictionary(
                { match: '/app/*', matchDest: [], id: '', type: 'raw' },
                'https://example.test/dict',
            ),
            true,
        );

        assert.equal(
            validateUseAsDictionary(
                { match: 'https://other.test/*', matchDest: [], id: '', type: 'raw' },
                'https://example.test/dict',
            ),
            false,
        );

        assert.equal(
            validateUseAsDictionary(
                { match: '/app/:name(.*)', matchDest: [], id: '', type: 'raw' },
                'https://example.test/dict',
            ),
            false,
        );
    });

    it('matches same-origin URLs and applies match-dest constraints', () => {
        const dictionary = storedDictionary({ matchDest: ['script'] });

        assert.equal(
            matchesDictionary(dictionary, 'https://example.test/app/main.js', {
                requestDestination: 'script',
            }),
            true,
        );
        assert.equal(
            matchesDictionary(dictionary, 'https://example.test/app/main.js', {
                requestDestination: 'document',
            }),
            false,
        );
        assert.equal(matchesDictionary(dictionary, 'https://other.test/app/main.js'), false);
    });

    // RFC 9842 §2.1.4: unsupported type must not be used unless caller opts in.
    it('treats unknown type as unusable by default', () => {
        const dictionary = storedDictionary({ type: 'custom' });
        assert.equal(matchesDictionary(dictionary, 'https://example.test/app/main.js'), false);
        assert.equal(
            matchesDictionary(dictionary, 'https://example.test/app/main.js', {
                allowUnsupportedType: true,
            }),
            true,
        );
    });
});

// RFC 9842 §2.2: Available-Dictionary is an SF Byte Sequence of SHA-256 bytes.
describe('Available-Dictionary (RFC 9842 Section 2.2)', () => {
    it('round-trips a 32-byte digest', () => {
        const input = digest(10);
        const header = formatAvailableDictionary(input);
        assert.deepEqual(parseAvailableDictionary(header), input);
    });

    it('rejects wrong item type and wrong digest length', () => {
        assert.equal(parseAvailableDictionary('"not-bytes"'), null);
        assert.equal(parseAvailableDictionary(':AQI=:'), null);
        assert.throws(() => formatAvailableDictionary(new Uint8Array([1, 2, 3])), /32 bytes/);
    });
});

// RFC 9842 §2.3: Dictionary-ID is an SF String up to 1024 chars.
describe('Dictionary-ID (RFC 9842 Section 2.3)', () => {
    it('parses and formats valid IDs', () => {
        assert.equal(parseDictionaryId('"dictionary-12345"'), 'dictionary-12345');
        assert.equal(formatDictionaryId('dictionary-12345'), '"dictionary-12345"');
    });

    it('enforces 1024-character limit', () => {
        const max = 'a'.repeat(1024);
        const tooLong = 'a'.repeat(1025);

        assert.equal(parseDictionaryId(`"${max}"`), max);
        assert.equal(parseDictionaryId(`"${tooLong}"`), null);
        assert.throws(() => formatDictionaryId(tooLong), /1024/);
    });
});

// RFC 9842 §2.2.3: precedence is match-dest, then longest match, then recency.
describe('selectBestDictionary (RFC 9842 Section 2.2.3)', () => {
    it('uses deterministic multiple-match precedence', () => {
        const dictionaries: StoredDictionary[] = [
            storedDictionary({
                match: '/app/*',
                matchDest: [],
                fetchedAt: new Date('2026-01-04T00:00:00.000Z'),
            }),
            storedDictionary({
                match: '/app/*',
                matchDest: ['script'],
                fetchedAt: new Date('2026-01-02T00:00:00.000Z'),
            }),
            storedDictionary({
                match: '/app/v2/*',
                matchDest: ['script'],
                fetchedAt: new Date('2026-01-03T00:00:00.000Z'),
            }),
            storedDictionary({
                match: '/app/v2/*',
                matchDest: ['script'],
                fetchedAt: new Date('2026-01-05T00:00:00.000Z'),
            }),
        ];

        const selected = selectBestDictionary(dictionaries, 'https://example.test/app/v2/main.js', {
            requestDestination: 'script',
        });

        assert.equal(selected, dictionaries[3]);
    });

    it('ignores destination precedence when destination support is unavailable', () => {
        const dictionaries: StoredDictionary[] = [
            storedDictionary({
                match: '/app/*',
                matchDest: ['script'],
                fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
            }),
            storedDictionary({
                match: '/app/v2/*',
                matchDest: [],
                fetchedAt: new Date('2026-01-02T00:00:00.000Z'),
            }),
        ];

        const selected = selectBestDictionary(dictionaries, 'https://example.test/app/v2/main.js', {
            supportsRequestDestination: false,
        });

        assert.equal(selected, dictionaries[1]);
    });
});

// RFC 9842 §6.2: dictionary-compressed responses vary by encoding and dictionary hash.
describe('mergeDictionaryVary (RFC 9842 Section 6.2)', () => {
    it('adds accept-encoding and available-dictionary to Vary', () => {
        assert.equal(
            mergeDictionaryVary('Accept'),
            'Accept, accept-encoding, available-dictionary',
        );
    });

    it('de-duplicates case-insensitively and preserves wildcard', () => {
        assert.equal(
            mergeDictionaryVary('Available-Dictionary, ACCEPT-ENCODING'),
            'Available-Dictionary, ACCEPT-ENCODING',
        );
        assert.equal(mergeDictionaryVary('*'), '*');
    });
});
