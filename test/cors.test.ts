import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCorsHeaders,
    buildPreflightHeaders,
    buildCorsHeadersForOrigin,
    buildStrictCorsHeadersForOrigin,
    isOriginAllowed,
    corsHeaders,
} from '../src/cors.js';

// Non-RFC (Fetch/CORS): CORS header rules.
describe('buildCorsHeaders', () => {
    it('throws when credentials true and origin is undefined', () => {
        assert.throws(() => {
            buildCorsHeaders({ credentials: true });
        }, /wildcard or undefined origin/i);
    });

    it('throws when credentials true and origin is wildcard', () => {
        assert.throws(() => {
            buildCorsHeaders({ credentials: true, origin: '*' });
        }, /wildcard or undefined origin/i);
    });

    it('throws when multiple origins are passed to Access-Control-Allow-Origin', () => {
        assert.throws(() => {
            buildCorsHeaders({ origin: ['https://example.com', 'https://other.com'] });
        }, /multiple origins are not valid/i);
    });

    it('returns permissive defaults when options are omitted', () => {
        const headers = buildCorsHeaders();

        assert.equal(headers['Access-Control-Allow-Origin'], '*');
        assert.equal(headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
        assert.equal(headers['Access-Control-Max-Age'], '86400');
    });

    it('builds explicit single-origin CORS headers', () => {
        const headers = buildCorsHeaders({
            origin: 'https://example.com',
            methods: ['GET', 'POST'],
            allowHeaders: ['Content-Type', 'Authorization'],
            exposeHeaders: ['ETag'],
            credentials: true,
            maxAge: 600,
        });

        assert.equal(headers['Access-Control-Allow-Origin'], 'https://example.com');
        assert.equal(headers['Access-Control-Allow-Methods'], 'GET, POST');
        assert.equal(headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization');
        assert.equal(headers['Access-Control-Expose-Headers'], 'ETag');
        assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
        assert.equal(headers['Access-Control-Max-Age'], '600');
    });
});

// Non-RFC (Fetch/CORS): Preflight response requirements.
describe('buildPreflightHeaders', () => {
    it('includes max-age by default for preflight responses', () => {
        const headers = buildPreflightHeaders({ origin: 'https://example.com' });

        assert.equal(headers['Access-Control-Allow-Origin'], 'https://example.com');
        assert.equal(headers['Access-Control-Max-Age'], '86400');
    });

    it('preserves explicit max-age for preflight responses', () => {
        const headers = buildPreflightHeaders({
            origin: 'https://example.com',
            maxAge: 120,
        });

        assert.equal(headers['Access-Control-Max-Age'], '120');
    });
});

// Non-RFC (Fetch/CORS): Origin echoing and Vary: Origin.
describe('buildCorsHeadersForOrigin', () => {
    it('echoes allowed origin and sets Vary: Origin', () => {
        const headers = buildCorsHeadersForOrigin('https://example.com', {
            origin: ['https://example.com', 'https://other.com'],
            credentials: true,
        });

        assert.equal(headers['Access-Control-Allow-Origin'], 'https://example.com');
        assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
        assert.equal(headers['Vary'], 'Origin');
    });

    it('merges Origin into an existing Vary header', () => {
        const headers = buildCorsHeadersForOrigin('https://example.com', {
            origin: ['https://example.com'],
            vary: 'Accept-Encoding',
        });

        assert.equal(headers['Vary'], 'Accept-Encoding, Origin');
    });

    it('dedupes Origin in Vary case-insensitively', () => {
        const headers = buildCorsHeadersForOrigin('https://example.com', {
            origin: ['https://example.com'],
            vary: 'Accept-Encoding, origin',
        });

        assert.equal(headers['Vary'], 'Accept-Encoding, origin');
    });

    it('preserves wildcard Vary when merging Origin', () => {
        const headers = buildCorsHeadersForOrigin('https://example.com', {
            origin: ['https://example.com'],
            vary: '*',
        });

        assert.equal(headers['Vary'], '*');
    });

    it('returns default headers when no options are provided', () => {
        const headers = buildCorsHeadersForOrigin('https://example.com');

        assert.equal(headers['Access-Control-Allow-Origin'], '*');
        assert.equal(headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
    });

    it('returns wildcard headers when origin policy is wildcard', () => {
        const headers = buildCorsHeadersForOrigin('https://example.com', {
            origin: '*',
            methods: ['GET', 'POST'],
        });

        assert.equal(headers['Access-Control-Allow-Origin'], '*');
        assert.equal(headers['Vary'], undefined);
    });

    it('returns empty headers when request origin is missing', () => {
        const headers = buildCorsHeadersForOrigin(null, {
            origin: ['https://example.com'],
        });

        assert.deepEqual(headers, {});
    });

    it('returns empty headers for disallowed origin', () => {
        const headers = buildCorsHeadersForOrigin('https://blocked.com', {
            origin: ['https://example.com'],
        });

        assert.deepEqual(headers, {});
    });
});

// Non-RFC (Fetch/CORS): strict production-oriented helper.
describe('buildStrictCorsHeadersForOrigin', () => {
    it('echoes allowlisted origin with restrictive defaults and Vary', () => {
        const headers = buildStrictCorsHeadersForOrigin('https://api.example.com', [
            'https://api.example.com',
        ]);

        assert.equal(headers['Access-Control-Allow-Origin'], 'https://api.example.com');
        assert.equal(headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS');
        assert.equal(headers['Access-Control-Allow-Headers'], 'Content-Type, Accept');
        assert.equal(headers['Access-Control-Max-Age'], '600');
        assert.equal(headers['Vary'], 'Origin');
    });

    it('returns empty headers for non-allowlisted origins', () => {
        const headers = buildStrictCorsHeadersForOrigin('https://blocked.example.com', [
            'https://api.example.com',
        ]);

        assert.deepEqual(headers, {});
    });

    it('rejects wildcard origins in strict allowlists', () => {
        assert.throws(() => {
            buildStrictCorsHeadersForOrigin('https://api.example.com', ['*']);
        }, /does not allow wildcard origins/i);
    });
});

// Non-RFC (Fetch/CORS): utility helpers and legacy aliases.
describe('CORS helpers', () => {
    it('isOriginAllowed supports wildcard, allowlist, and strict origin checks', () => {
        assert.equal(isOriginAllowed('https://example.com'), true);
        assert.equal(isOriginAllowed('https://example.com', { origin: '*' }), true);
        assert.equal(isOriginAllowed('https://example.com', { origin: ['https://example.com'] }), true);
        assert.equal(isOriginAllowed('https://example.com', { origin: ['https://other.com'] }), false);
        assert.equal(isOriginAllowed('https://example.com', { origin: 'https://example.com' }), true);
        assert.equal(isOriginAllowed('https://example.com', { origin: 'https://other.com' }), false);
    });

    it('corsHeaders returns a defensive copy of defaults', () => {
        const first = corsHeaders();
        const second = corsHeaders();

        first['Access-Control-Allow-Origin'] = 'https://mutated.example';

        assert.equal(second['Access-Control-Allow-Origin'], '*');
    });
});
