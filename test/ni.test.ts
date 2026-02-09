import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    compareNiUris,
    computeNiDigest,
    formatNiUri,
    formatNiUrlSegment,
    fromWellKnownNiUrl,
    parseNiUri,
    parseNiUrlSegment,
    toWellKnownNiUrl,
    verifyNiDigest,
} from '../src/ni.js';

const HELLO_WORLD_NI_DIGEST = 'f4OxZX_x_FO5LcGBSKHWXfwtSx-j1ncoSt3SABJtkGk';

// RFC 6920 §3 and §8.1: NI URI syntax and examples.
describe('RFC 6920 NI URI parsing and formatting', () => {
    it('parses and formats ni URI without authority (RFC 6920 §8.1)', () => {
        const uri = `ni:///sha-256;${HELLO_WORLD_NI_DIGEST}`;
        const parsed = parseNiUri(uri);

        assert.ok(parsed);
        assert.equal(parsed.algorithm, 'sha-256');
        assert.equal(parsed.value, HELLO_WORLD_NI_DIGEST);
        assert.equal(parsed.authority, undefined);
        assert.equal(formatNiUri(parsed), uri);
    });

    it('parses and formats ni URI with authority (RFC 6920 §8.1)', () => {
        const uri = `ni://example.com/sha-256;${HELLO_WORLD_NI_DIGEST}`;
        const parsed = parseNiUri(uri);

        assert.ok(parsed);
        assert.equal(parsed.authority, 'example.com');
        assert.equal(formatNiUri(parsed), uri);
    });

    // RFC 6920 §5: alg-val URL segment format.
    it('parses and formats URL segment form', () => {
        const segment = `sha-256;${HELLO_WORLD_NI_DIGEST}`;
        const parsed = parseNiUrlSegment(segment);

        assert.ok(parsed);
        assert.equal(parsed.algorithm, 'sha-256');
        assert.equal(parsed.value, HELLO_WORLD_NI_DIGEST);
        assert.equal(formatNiUrlSegment(parsed), segment);
    });

    it('rejects malformed hierarchy and segment syntax (RFC 6920 §3)', () => {
        assert.equal(parseNiUri(`ni:///sha-256;${HELLO_WORLD_NI_DIGEST}/extra`), null);
        assert.equal(parseNiUri(`ni://example.com`), null);
        assert.equal(parseNiUri(`ni:/sha-256;${HELLO_WORLD_NI_DIGEST}`), null);
        assert.equal(parseNiUri(`ni:///sha-256;${HELLO_WORLD_NI_DIGEST}#frag`), null);

        assert.equal(parseNiUrlSegment('sha-256'), null);
        assert.equal(parseNiUrlSegment('sha-256;abc;def'), null);
        assert.equal(parseNiUrlSegment('sha/256;abc'), null);
    });
});

// RFC 6920 §2 and §10: matching rules and malformed non-matching behavior.
describe('RFC 6920 NI identity comparison', () => {
    it('ignores authority and query parameters for identity checks (RFC 6920 §2)', () => {
        const a = `ni:///sha-256;${HELLO_WORLD_NI_DIGEST}`;
        const b = `ni://example.com/sha-256;${HELLO_WORLD_NI_DIGEST}?ct=text%2Fplain&foo=bar`;

        const result = compareNiUris(a, b);
        assert.deepEqual(result, {
            matches: true,
            leftValid: true,
            rightValid: true,
        });
    });

    it('treats full and truncated digests as non-equivalent (RFC 6920 §2, §10)', () => {
        const full = `ni:///sha-256;${HELLO_WORLD_NI_DIGEST}`;
        const truncated = 'ni:///sha-256-32;f4OxZQ';

        const result = compareNiUris(full, truncated);
        assert.equal(result.matches, false);
        assert.equal(result.leftValid, true);
        assert.equal(result.rightValid, true);
    });

    it('treats malformed names as non-matching (RFC 6920 §10)', () => {
        const valid = `ni:///sha-256;${HELLO_WORLD_NI_DIGEST}`;
        const malformed = 'ni:///sha-256;not valid!';

        const result = compareNiUris(valid, malformed);
        assert.deepEqual(result, {
            matches: false,
            leftValid: true,
            rightValid: false,
        });
    });
});

// RFC 6920 §3: base64url without padding in val.
describe('RFC 6920 val encoding constraints', () => {
    it('rejects padded digest values (RFC 6920 §3)', () => {
        assert.equal(parseNiUri('ni:///sha-256;abcd='), null);
        assert.equal(parseNiUrlSegment('sha-256;abcd='), null);
    });

    it('rejects non-base64url digest values (RFC 6920 §3)', () => {
        assert.equal(parseNiUri('ni:///sha-256;abc+/'), null);
        assert.equal(parseNiUrlSegment('sha-256;abc+/'), null);
    });

    it('rejects invalid base64url lengths and non-canonical encodings (RFC 6920 §3)', () => {
        assert.equal(parseNiUrlSegment('sha-256;abcde'), null);
        assert.equal(parseNiUrlSegment('sha-256;AB'), null);
    });

    it('rejects known algorithm suites when digest length does not match', () => {
        assert.equal(parseNiUrlSegment(`sha-256-32;${HELLO_WORLD_NI_DIGEST}`), null);
        assert.throws(() => {
            formatNiUrlSegment({
                algorithm: 'sha-256-32',
                value: HELLO_WORLD_NI_DIGEST,
                digest: new Uint8Array([0xf4, 0x83, 0xb1, 0x65]),
            });
        }, /digest length does not match algorithm suite/);
    });
});

// RFC 6920 §3.1: ct= query attribute parsing.
describe('RFC 6920 query parsing', () => {
    it('parses ct query parameter name and decodes value (RFC 6920 §3.1)', () => {
        const parsed = parseNiUri(`ni:///sha-256;${HELLO_WORLD_NI_DIGEST}?ct=text%2Fplain&foo=bar`);
        assert.ok(parsed);
        assert.ok(parsed.query);
        assert.equal(parsed.query.ct, 'text/plain');
        assert.equal(parsed.query.foo, 'bar');
    });

    it('rejects malformed query pairs with empty parameter names (RFC 6920 §3.1)', () => {
        const parsed = parseNiUri(`ni:///sha-256;${HELLO_WORLD_NI_DIGEST}?=value`);
        assert.equal(parsed, null);
    });
});

// RFC 6920 §4: .well-known/ni mapping.
describe('RFC 6920 .well-known mapping', () => {
    it('maps ni URI to .well-known URL and back (RFC 6920 §4)', () => {
        const ni = `ni://example.com/sha-256;${HELLO_WORLD_NI_DIGEST}?ct=text%2Fplain`;
        const url = toWellKnownNiUrl(ni, { scheme: 'http' });
        assert.equal(url, `http://example.com/.well-known/ni/sha-256/${HELLO_WORLD_NI_DIGEST}?ct=text/plain`);

        const roundTrip = fromWellKnownNiUrl(url!);
        assert.ok(roundTrip);
        assert.equal(roundTrip.authority, 'example.com');
        assert.equal(roundTrip.algorithm, 'sha-256');
        assert.equal(roundTrip.value, HELLO_WORLD_NI_DIGEST);
        assert.equal(roundTrip.query?.ct, 'text/plain');
    });

    it('requires mapped authority when NI authority is absent (RFC 6920 §4)', () => {
        const ni = `ni:///sha-256;${HELLO_WORLD_NI_DIGEST}`;
        assert.equal(toWellKnownNiUrl(ni), null);
        assert.equal(
            toWellKnownNiUrl(ni, { scheme: 'https', authority: 'example.com' }),
            `https://example.com/.well-known/ni/sha-256/${HELLO_WORLD_NI_DIGEST}`
        );
    });

    it('rejects malformed .well-known URLs', () => {
        assert.equal(fromWellKnownNiUrl('ftp://example.com/.well-known/ni/sha-256/abc'), null);
        assert.equal(fromWellKnownNiUrl('https://example.com/.well-known/ni/sha-256'), null);
        assert.equal(fromWellKnownNiUrl('https://example.com/.well-known/ni/sha-256/abc/extra'), null);
        assert.equal(fromWellKnownNiUrl(`https://example.com/.well-known/ni/sha-256/${HELLO_WORLD_NI_DIGEST}?=bad`), null);
    });
});

// RFC 6920 §2 and §9.4: sha-256 mandatory and digest verification.
describe('RFC 6920 digest computation and verification', () => {
    it('computes RFC 6920 §8.1 Hello World digest', async () => {
        const computed = await computeNiDigest('Hello World!', 'sha-256');
        assert.equal(computed, HELLO_WORLD_NI_DIGEST);
    });

    it('verifies digest values for matching content', async () => {
        const ok = await verifyNiDigest('Hello World!', 'sha-256', HELLO_WORLD_NI_DIGEST);
        assert.equal(ok, true);
    });

    it('rejects digest values for non-matching content', async () => {
        const ok = await verifyNiDigest('Hello World?', 'sha-256', HELLO_WORLD_NI_DIGEST);
        assert.equal(ok, false);
    });

    it('rejects invalid digest values before verification', async () => {
        const ok = await verifyNiDigest('Hello World!', 'sha-256', 'abcde');
        assert.equal(ok, false);
    });
});
