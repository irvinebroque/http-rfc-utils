import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCorsHeaders,
    buildCorsHeadersForOrigin,
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

    it('returns empty headers for disallowed origin', () => {
        const headers = buildCorsHeadersForOrigin('https://blocked.com', {
            origin: ['https://example.com'],
        });

        assert.deepEqual(headers, {});
    });
});
