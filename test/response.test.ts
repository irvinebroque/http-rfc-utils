import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    jsonResponse,
    simpleJsonResponse,
} from '../src/response.js';

describe('response helpers', () => {
    it('jsonResponse builds headers and valid JSON body', async () => {
        const response = jsonResponse(
            [{ id: 1 }],
            {
                totalCount: 1,
                pageSize: 1,
                timestamp: '2026-01-01T00:00:00.000Z',
            },
            {
                self: 'https://example.com/items?cursor=abc&limit=1',
                first: 'https://example.com/items?cursor=abc&limit=1',
                last: 'https://example.com/items?cursor=abc&limit=1',
            },
            '"etag"',
            new Date('2026-01-01T00:00:00.000Z'),
            1
        );

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'application/json');
        assert.equal(response.headers.get('ETag'), '"etag"');

        const body = await response.json();
        assert.deepEqual(body, {
            data: [{ id: 1 }],
            meta: {
                totalCount: 1,
                pageSize: 1,
                timestamp: '2026-01-01T00:00:00.000Z',
            },
        });
    });

    it('simpleJsonResponse returns compact JSON by default', async () => {
        const response = simpleJsonResponse({ a: 1, b: 2 });
        const body = await response.text();
        assert.equal(body, '{"a":1,"b":2}');
    });
});
