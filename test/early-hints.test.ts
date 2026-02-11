/**
 * Tests for early hints behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LinkDefinition } from '../src/types.js';
import {
    EARLY_HINTS_STATUS,
    parseEarlyHintsLinks,
    formatEarlyHintsLinks,
    validateEarlyHintsLinks,
    extractPreloadLinks,
    mergeEarlyHintsLinks,
} from '../src/early-hints.js';

describe('EARLY_HINTS_STATUS (RFC 8297 Section 2)', () => {
    it('exposes the informational status code 103', () => {
        assert.equal(EARLY_HINTS_STATUS, 103);
    });
});

// RFC 8297 Section 2: servers can send one or more 103 responses with Link headers.
describe('parseEarlyHintsLinks (RFC 8297 Section 2)', () => {
    it('parses a single Link field value', () => {
        const parsed = parseEarlyHintsLinks('<https://cdn.example/app.css>; rel="preload"; as="style"');

        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].href, 'https://cdn.example/app.css');
        assert.equal(parsed[0].rel, 'preload');
        assert.equal(parsed[0].as, 'style');
    });

    it('parses repeated Link field values across batches', () => {
        const parsed = parseEarlyHintsLinks([
            '<https://cdn.example/app.css>; rel="preload"; as="style"',
            '<https://cdn.example/app.js>; rel="modulepreload"',
            '<https://cdn.example/font.woff2>; rel="preload"; as="font"',
        ]);

        assert.equal(parsed.length, 3);
        assert.equal(parsed[0].href, 'https://cdn.example/app.css');
        assert.equal(parsed[1].rel, 'modulepreload');
        assert.equal(parsed[2].as, 'font');
    });

    it('returns an empty list for malformed values', () => {
        assert.deepEqual(parseEarlyHintsLinks('not-a-link-field'), []);
        assert.deepEqual(parseEarlyHintsLinks(['<https://cdn.example/app.css>; rel="preload"', 'bad']), []);
    });

    it('returns an empty list when a single field mixes valid and malformed members', () => {
        assert.deepEqual(
            parseEarlyHintsLinks('<https://cdn.example/app.css>; rel="preload", garbage'),
            []
        );

        assert.deepEqual(
            parseEarlyHintsLinks('<https://cdn.example/app.css>; rel="preload", <https://cdn.example/app.js'),
            []
        );
    });

    it('returns an empty list when repeated fields mix valid and malformed values', () => {
        assert.deepEqual(
            parseEarlyHintsLinks([
                '<https://cdn.example/app.css>; rel="preload"',
                '<https://cdn.example/app.js>; rel="modulepreload", garbage',
            ]),
            []
        );
    });

    it('returns an empty list for nullish or empty input', () => {
        assert.deepEqual(parseEarlyHintsLinks(null), []);
        assert.deepEqual(parseEarlyHintsLinks(undefined), []);
        assert.deepEqual(parseEarlyHintsLinks('   '), []);
    });
});

describe('validateEarlyHintsLinks (RFC 8297 Section 2)', () => {
    it('accepts valid Early Hints links', () => {
        assert.doesNotThrow(() => {
            validateEarlyHintsLinks([
                { href: 'https://cdn.example/app.css', rel: 'preload', as: 'style' },
                { href: 'https://cdn.example/app.js', rel: 'modulepreload' },
            ]);
        });
    });

    it('throws for semantic-invalid link values', () => {
        assert.throws(() => {
            validateEarlyHintsLinks([{ href: '', rel: 'preload' }]);
        }, /non-empty href/);

        assert.throws(() => {
            validateEarlyHintsLinks([{ href: 'https://cdn.example/app.css', rel: 'preload', 'bad key': 'x' }]);
        }, /valid header token/);
    });

    it('supports preload-only strict validation', () => {
        assert.doesNotThrow(() => {
            validateEarlyHintsLinks([{ href: 'https://cdn.example/app.css', rel: 'preload' }], { preloadOnly: true });
        });

        assert.throws(() => {
            validateEarlyHintsLinks([{ href: 'https://cdn.example/app.js', rel: 'modulepreload' }], { preloadOnly: true });
        }, /rel=preload/);
    });
});

describe('formatEarlyHintsLinks (RFC 8297 Section 2)', () => {
    it('formats Link values for 103 responses', () => {
        const header = formatEarlyHintsLinks([
            { href: 'https://cdn.example/app.css', rel: 'preload', as: 'style' },
            { href: 'https://cdn.example/app.js', rel: 'modulepreload' },
        ]);

        assert.equal(
            header,
            '<https://cdn.example/app.css>; rel="preload"; as=style, <https://cdn.example/app.js>; rel="modulepreload"'
        );
    });

    it('throws for semantic-invalid formatting input', () => {
        assert.throws(() => {
            formatEarlyHintsLinks([]);
        }, /at least one/);

        assert.throws(() => {
            formatEarlyHintsLinks([{ href: 'https://cdn.example/app.js', rel: 'modulepreload' }], { preloadOnly: true });
        }, /rel=preload/);
    });

    it('round-trips parse and format for valid values', () => {
        const original: LinkDefinition[] = [
            { href: 'https://cdn.example/app.css', rel: 'preload', as: 'style' },
            { href: 'https://cdn.example/font.woff2', rel: 'preload', as: 'font', crossorigin: '' },
        ];

        const serialized = formatEarlyHintsLinks(original);
        const parsed = parseEarlyHintsLinks(serialized);

        assert.equal(parsed.length, 2);
        assert.equal(parsed[0].href, original[0].href);
        assert.equal(parsed[0].rel, original[0].rel);
        assert.equal(parsed[1].as, 'font');
    });
});

// RFC 8297 Section 2: preload links are a common optimization use for Early Hints.
describe('extractPreloadLinks (RFC 8297 Section 2)', () => {
    it('returns only links that include rel=preload', () => {
        const extracted = extractPreloadLinks([
            { href: 'https://cdn.example/app.css', rel: 'preload', as: 'style' },
            { href: 'https://cdn.example/app.js', rel: 'modulepreload' },
            { href: 'https://cdn.example/font.woff2', rel: 'preload alternate', as: 'font' },
        ]);

        assert.equal(extracted.length, 2);
        assert.equal(extracted[0].href, 'https://cdn.example/app.css');
        assert.equal(extracted[1].href, 'https://cdn.example/font.woff2');
    });

    it('strict mode rejects non-preload links', () => {
        assert.throws(() => {
            extractPreloadLinks([
                { href: 'https://cdn.example/app.css', rel: 'preload' },
                { href: 'https://cdn.example/app.js', rel: 'modulepreload' },
            ], { strict: true });
        }, /rel=preload/);
    });
});

// RFC 8297 Section 2: clients can receive multiple 103 responses before the final response.
describe('mergeEarlyHintsLinks (RFC 8297 Section 2)', () => {
    it('merges multiple batches, dedupes deterministically, and preserves first-seen order', () => {
        const merged = mergeEarlyHintsLinks(
            [
                { href: 'https://cdn.example/app.css', rel: 'preload', as: 'style' },
                { href: 'https://cdn.example/app.js', rel: 'modulepreload' },
            ],
            [
                { href: 'https://cdn.example/app.css', rel: 'preload', as: 'style' },
                { href: 'https://cdn.example/font.woff2', rel: 'preload', as: 'font' },
            ]
        );

        assert.equal(merged.length, 3);
        assert.equal(merged[0].href, 'https://cdn.example/app.css');
        assert.equal(merged[1].href, 'https://cdn.example/app.js');
        assert.equal(merged[2].href, 'https://cdn.example/font.woff2');
    });

    it('dedupes semantically equivalent entries with different key insertion order', () => {
        const first: LinkDefinition = {
            href: 'https://cdn.example/app.css',
            rel: 'preload',
            as: 'style',
            media: 'screen',
        };

        const second: LinkDefinition = {
            href: 'https://cdn.example/app.css',
            rel: 'preload',
            media: 'screen',
            as: 'style',
        };

        const merged = mergeEarlyHintsLinks([first], [second]);
        assert.equal(merged.length, 1);
    });

    it('dedupes equivalent relation tokens with different token order', () => {
        const merged = mergeEarlyHintsLinks(
            [{ href: 'https://cdn.example/app.css', rel: 'preload alternate', as: 'style' }],
            [{ href: 'https://cdn.example/app.css', rel: 'alternate preload', as: 'style' }]
        );

        assert.equal(merged.length, 1);
    });

    it('throws for semantic-invalid links in strict merge helper', () => {
        assert.throws(() => {
            mergeEarlyHintsLinks([{ href: '', rel: 'preload' }]);
        }, /non-empty href/);
    });
});
