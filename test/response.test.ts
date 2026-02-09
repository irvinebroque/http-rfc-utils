import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    optionsResponse,
    headResponse,
    jsonResponse,
    csvResponse,
    redirectResponse,
    simpleJsonResponse,
    noContentResponse,
    textResponse,
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

    // RFC 5789 §3.1: Accept-Patch advertises supported patch document media types.
    it('optionsResponse can advertise Accept-Patch for OPTIONS', () => {
        const response = optionsResponse(['GET', 'HEAD', 'OPTIONS'], {
            acceptPatch: [
                {
                    type: 'application',
                    subtype: 'json-patch+json',
                    parameters: [],
                },
            ],
        });

        assert.equal(response.status, 204);
        assert.equal(response.headers.get('Accept-Patch'), 'application/json-patch+json');
        assert.match(response.headers.get('Allow') ?? '', /PATCH/);
    });

    // RFC 5789 §3.1: Accept-Patch is optional for OPTIONS responses.
    it('optionsResponse omits Accept-Patch when not configured', () => {
        const response = optionsResponse(['GET', 'HEAD', 'OPTIONS']);

        assert.equal(response.status, 204);
        assert.equal(response.headers.get('Accept-Patch'), null);
        assert.equal(response.headers.get('Allow'), 'GET, HEAD, OPTIONS');
    });

    // RFC 9110 §5.6.2: method names are tokens.
    it('rejects invalid method tokens in optionsResponse', () => {
        assert.throws(() => {
            optionsResponse(['GET', 'BAD\nMETHOD']);
        }, /control characters|valid header token/);
    });

    // RFC 9110 §9.3.2: HEAD responses send headers without a payload body.
    it('headResponse returns headers and no response body', async () => {
        const response = headResponse({
            'ETag': '"abc"',
            'X-Test': 'yes',
        });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('ETag'), '"abc"');
        assert.equal(response.headers.get('X-Test'), 'yes');
        assert.equal(await response.text(), '');
    });

    // RFC 6266 §4 + RFC 8288 §3: CSV responses can carry download metadata and pagination links.
    it('csvResponse builds CSV payload and metadata headers', async () => {
        const response = csvResponse(
            [{ id: 1, name: 'Ada' }],
            '"etag-csv"',
            new Date('2026-01-01T00:00:00.000Z'),
            {
                self: 'https://example.com/items?cursor=abc&limit=1',
                first: 'https://example.com/items?cursor=abc&limit=1',
                last: 'https://example.com/items?cursor=abc&limit=1',
            },
            1,
        );

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'text/csv; charset=utf-8');
        assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="data.csv"');
        assert.equal(response.headers.get('ETag'), '"etag-csv"');
        assert.equal(response.headers.get('X-Total-Count'), '1');
        assert.ok(response.headers.get('Link'));
        assert.equal(await response.text(), 'id,name\n1,Ada');
    });

    // RFC 9110 §15.4.3: redirection responses provide a Location target URI.
    it('redirectResponse defaults to 302 and sets Location', () => {
        const response = redirectResponse('https://example.com/next');

        assert.equal(response.status, 302);
        assert.equal(response.headers.get('Location'), 'https://example.com/next');
    });

    // RFC 9110 §15.3.1/§15.3.5: empty success responses are valid for 200/201/204.
    it('noContentResponse supports default and explicit success status codes', async () => {
        const defaultResponse = noContentResponse();
        const createdResponse = noContentResponse(201);

        assert.equal(defaultResponse.status, 204);
        assert.equal(await defaultResponse.text(), '');
        assert.equal(createdResponse.status, 201);
        assert.equal(await createdResponse.text(), '');
    });

    // RFC 9110 §8.3: text responses should provide an explicit Content-Type.
    it('textResponse supports default and custom content-type values', async () => {
        const defaultResponse = textResponse('hello');
        const customResponse = textResponse('ok', 'text/markdown; charset=utf-8');

        assert.equal(defaultResponse.status, 200);
        assert.equal(defaultResponse.headers.get('Content-Type'), 'text/plain; charset=utf-8');
        assert.equal(await defaultResponse.text(), 'hello');

        assert.equal(customResponse.headers.get('Content-Type'), 'text/markdown; charset=utf-8');
        assert.equal(await customResponse.text(), 'ok');
    });

    // RFC 9110 §5.5: reject CR/LF and CTLs in serialized response headers.
    it('rejects control bytes in dynamic header values', () => {
        assert.throws(() => {
            simpleJsonResponse({ ok: true }, '"good"\r\nInjected: true');
        }, /control characters/);

        assert.throws(() => {
            redirectResponse('https://example.com\nInjected: true');
        }, /control characters/);
    });
});
