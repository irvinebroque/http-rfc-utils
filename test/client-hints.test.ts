import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseAcceptCH,
    formatAcceptCH,
    filterClientHints,
    mergeClientHintsVary,
} from '../src/client-hints.js';

describe('Accept-CH (RFC 8942 Section 3.1)', () => {
    it('parses an sf-list of tokens (RFC 8942 Section 3.1)', () => {
        const parsed = parseAcceptCH('sec-ch-ua, sec-ch-ua-platform');
        assert.deepEqual(parsed, ['sec-ch-ua', 'sec-ch-ua-platform']);
    });

    it('rejects inner lists (RFC 8942 Section 3.1)', () => {
        const parsed = parseAcceptCH('("sec-ch-ua")');
        assert.equal(parsed, null);
    });

    it('rejects tokens with parameters (RFC 8942 Section 3.1)', () => {
        const parsed = parseAcceptCH('sec-ch-ua;v=1');
        assert.equal(parsed, null);
    });

    it('formats Accept-CH with tokens (RFC 8942 Section 3.1)', () => {
        const formatted = formatAcceptCH(['sec-ch-ua', 'sec-ch-ua-platform']);
        assert.equal(formatted, 'sec-ch-ua, sec-ch-ua-platform');
    });

    it('filters unsupported hints (RFC 8942 Section 2.2)', () => {
        const filtered = filterClientHints(
            ['sec-ch-ua', 'sec-ch-ua-platform', 'unknown-hint'],
            ['sec-ch-ua', 'sec-ch-ua-platform']
        );
        assert.deepEqual(filtered, ['sec-ch-ua', 'sec-ch-ua-platform']);
    });

    it('merges hints into Vary (RFC 8942 Section 3.2)', () => {
        const merged = mergeClientHintsVary('Accept-Encoding', ['Sec-CH-UA', 'Sec-CH-UA-Platform']);
        assert.equal(merged, 'Accept-Encoding, Sec-CH-UA, Sec-CH-UA-Platform');
    });
});
