import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    WELL_KNOWN_PREFIX,
    buildWellKnownPath,
    buildWellKnownUri,
    isWellKnownPath,
    isWellKnownUri,
    parseWellKnownPath,
    validateWellKnownSuffix,
} from '../src/well-known.js';

// RFC 8615 §3: top-level `/.well-known/` prefix and single-segment suffix.
describe('RFC 8615 well-known path utilities', () => {
    it('exposes the RFC-defined prefix constant', () => {
        assert.equal(WELL_KNOWN_PREFIX, '/.well-known/');
    });

    it('accepts valid top-level well-known paths (RFC 8615 §3)', () => {
        assert.equal(isWellKnownPath('/.well-known/security.txt'), true);
        assert.equal(isWellKnownPath('/.well-known/change-password'), true);
    });

    it('rejects nested and multi-segment path forms (RFC 8615 §3)', () => {
        assert.equal(isWellKnownPath('/foo/.well-known/security.txt'), false);
        assert.equal(isWellKnownPath('/.well-known/ni/sha-256'), false);
        assert.equal(isWellKnownPath('/.well-known/'), false);
    });

    // RFC 3986 §3.3: segment-nz uses pchar; slash is not allowed inside one segment.
    it('validates suffix against segment-nz-like constraints', () => {
        assert.equal(validateWellKnownSuffix('security.txt'), true);
        assert.equal(validateWellKnownSuffix('foo:bar@v1'), true);
        assert.equal(validateWellKnownSuffix('token%2Fvalue'), true);

        assert.equal(validateWellKnownSuffix(''), false);
        assert.equal(validateWellKnownSuffix('foo/bar'), false);
        assert.equal(validateWellKnownSuffix('bad suffix'), false);
        assert.equal(validateWellKnownSuffix('bad%zz'), false);
    });

    it('parses valid paths and returns null for invalid forms', () => {
        assert.deepEqual(parseWellKnownPath('/.well-known/security.txt'), {
            prefix: '/.well-known/',
            suffix: 'security.txt',
            path: '/.well-known/security.txt',
        });

        assert.equal(parseWellKnownPath('/foo/.well-known/security.txt'), null);
        assert.equal(parseWellKnownPath('/.well-known/security.txt/extra'), null);
    });
});

// RFC 8615 §3: resources are rooted at the origin's top-level `/.well-known/` path.
describe('RFC 8615 URI helpers', () => {
    it('identifies valid absolute HTTP(S) well-known URIs', () => {
        assert.equal(isWellKnownUri('https://example.com/.well-known/security.txt'), true);
        assert.equal(isWellKnownUri('http://example.com/.well-known/change-password?flow=start'), true);
    });

    it('rejects non-http(s), nested, and malformed URIs', () => {
        assert.equal(isWellKnownUri('ni:///sha-256;abc'), false);
        assert.equal(isWellKnownUri('https://example.com/foo/.well-known/security.txt'), false);
        assert.equal(isWellKnownUri('not a uri'), false);
    });

    it('builds strict well-known paths and URIs', () => {
        assert.equal(buildWellKnownPath('security.txt'), '/.well-known/security.txt');
        assert.equal(buildWellKnownUri('https://example.com', 'security.txt'), 'https://example.com/.well-known/security.txt');
        assert.equal(buildWellKnownUri('https://example.com/api/v1?x=1', 'change-password'), 'https://example.com/.well-known/change-password');
    });

    it('throws for invalid builder inputs', () => {
        assert.throws(() => buildWellKnownPath('foo/bar'));
        assert.throws(() => buildWellKnownPath(''));
        assert.throws(() => buildWellKnownUri('mailto:ops@example.com', 'security.txt'));
        assert.throws(() => buildWellKnownUri('https://example.com', 'bad suffix'));
    });
});
