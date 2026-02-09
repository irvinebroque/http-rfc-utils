import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseSecFetchDest,
    formatSecFetchDest,
    parseSecFetchMode,
    formatSecFetchMode,
    parseSecFetchSite,
    formatSecFetchSite,
    parseSecFetchUser,
    formatSecFetchUser,
    parseFetchMetadata,
    evaluateFetchMetadataPolicy,
    fetchMetadataVary,
} from '../src/fetch-metadata.js';

// W3C Fetch Metadata §2.1: Sec-Fetch-Dest is an sf-token.
describe('Sec-Fetch-Dest (W3C Fetch Metadata Section 2.1)', () => {
    it('parses and formats known destination tokens', () => {
        assert.equal(parseSecFetchDest('document'), 'document');
        assert.equal(formatSecFetchDest('iframe'), 'iframe');
    });

    it('ignores unknown token values for forward compatibility', () => {
        assert.equal(parseSecFetchDest('future-dest'), null);
    });

    it('rejects non-token values', () => {
        assert.equal(parseSecFetchDest('"document"'), null);
    });
});

// W3C Fetch Metadata §2.2: Sec-Fetch-Mode is an sf-token.
describe('Sec-Fetch-Mode (W3C Fetch Metadata Section 2.2)', () => {
    it('parses and formats known mode tokens', () => {
        assert.equal(parseSecFetchMode('no-cors'), 'no-cors');
        assert.equal(formatSecFetchMode('navigate'), 'navigate');
    });

    it('ignores unknown token values for forward compatibility', () => {
        assert.equal(parseSecFetchMode('future-mode'), null);
    });
});

// W3C Fetch Metadata §2.3: Sec-Fetch-Site is an sf-token.
describe('Sec-Fetch-Site (W3C Fetch Metadata Section 2.3)', () => {
    it('parses and formats known site tokens', () => {
        assert.equal(parseSecFetchSite('cross-site'), 'cross-site');
        assert.equal(formatSecFetchSite('same-origin'), 'same-origin');
    });

    it('ignores unknown token values for forward compatibility', () => {
        assert.equal(parseSecFetchSite('partner-site'), null);
    });
});

// W3C Fetch Metadata §2.4: Sec-Fetch-User is an sf-boolean.
describe('Sec-Fetch-User (W3C Fetch Metadata Section 2.4)', () => {
    it('parses and formats boolean values', () => {
        assert.equal(parseSecFetchUser('?1'), true);
        assert.equal(parseSecFetchUser('?0'), false);
        assert.equal(formatSecFetchUser(true), '?1');
        assert.equal(formatSecFetchUser(false), '?0');
    });

    it('rejects non-boolean values', () => {
        assert.equal(parseSecFetchUser('1'), null);
    });
});

// W3C Fetch Metadata §2: unknown values should be ignorable.
describe('parseFetchMetadata (W3C Fetch Metadata Section 2)', () => {
    it('parses known headers and omits unknown token values', () => {
        const parsed = parseFetchMetadata({
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'future-mode',
            'sec-fetch-site': 'same-site',
            'sec-fetch-user': '?1',
        });

        assert.deepEqual(parsed, {
            dest: 'document',
            site: 'same-site',
            user: true,
        });
    });

    it('parses from Request headers', () => {
        const request = new Request('https://example.test', {
            headers: {
                'Sec-Fetch-Dest': 'iframe',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'cross-site',
            },
        });

        assert.deepEqual(parseFetchMetadata(request), {
            dest: 'iframe',
            mode: 'navigate',
            site: 'cross-site',
        });
    });
});

// W3C Fetch Metadata §5: deployment guidance should remain permissive by default.
describe('evaluateFetchMetadataPolicy (W3C Fetch Metadata Section 5)', () => {
    it('uses permissive default mode', () => {
        const decision = evaluateFetchMetadataPolicy({ site: 'cross-site', mode: 'no-cors' });
        assert.deepEqual(decision, { allow: true, reason: 'permissive-default' });
    });

    it('denies missing site in strict mode', () => {
        const decision = evaluateFetchMetadataPolicy({}, { strict: true });
        assert.deepEqual(decision, { allow: false, reason: 'missing-site' });
    });

    it('allows same-origin in strict mode', () => {
        const decision = evaluateFetchMetadataPolicy({ site: 'same-origin' }, { strict: true });
        assert.deepEqual(decision, { allow: true, reason: 'same-origin' });
    });

    it('blocks cross-site subresource requests in strict mode', () => {
        const decision = evaluateFetchMetadataPolicy(
            { site: 'cross-site', mode: 'no-cors', dest: 'image' },
            { strict: true },
        );
        assert.deepEqual(decision, { allow: false, reason: 'cross-site-blocked' });
    });

    it('allows cross-site top-level navigations in strict mode', () => {
        const decision = evaluateFetchMetadataPolicy(
            { site: 'cross-site', mode: 'navigate', dest: 'document' },
            { strict: true },
        );
        assert.deepEqual(decision, { allow: true, reason: 'cross-site-top-level-navigation' });
    });

    it('treats cross-site iframe navigations as non-top-level in strict mode', () => {
        const decision = evaluateFetchMetadataPolicy(
            { site: 'cross-site', mode: 'navigate', dest: 'iframe' },
            { strict: true },
        );
        assert.deepEqual(decision, { allow: false, reason: 'cross-site-blocked' });
    });
});

// W3C Fetch Metadata §5.1: responses that depend on metadata should vary on relevant headers.
describe('fetchMetadataVary (W3C Fetch Metadata Section 5.1)', () => {
    it('merges all Fetch Metadata request headers by default', () => {
        const vary = fetchMetadataVary('Accept-Encoding');
        assert.equal(
            vary,
            'Accept-Encoding, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site, Sec-Fetch-User',
        );
    });

    it('supports a relevant subset and de-duplicates case-insensitively', () => {
        const vary = fetchMetadataVary('sec-fetch-site, Accept', ['site', 'mode']);
        assert.equal(vary, 'sec-fetch-site, Accept, Sec-Fetch-Mode');
    });
});
