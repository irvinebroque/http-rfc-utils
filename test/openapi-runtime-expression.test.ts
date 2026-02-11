/**
 * Tests for openapi runtime expression behavior.
 * Spec references are cited inline for each assertion group when applicable.
 * @see https://spec.openapis.org/oas/v3.1.1.html
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    evaluateOpenApiRuntimeExpression,
    formatOpenApiRuntimeExpression,
    isOpenApiRuntimeExpression,
    parseOpenApiRuntimeExpression,
} from '../src/openapi.js';

// OpenAPI Specification v3.1.1: Runtime Expression syntax and targets.
describe('OpenAPI runtime expression parser and formatter', () => {
    it('parses supported scalar and request/response targets', () => {
        assert.deepEqual(parseOpenApiRuntimeExpression('$url'), { type: 'url' });
        assert.deepEqual(parseOpenApiRuntimeExpression('$method'), { type: 'method' });
        assert.deepEqual(parseOpenApiRuntimeExpression('$statusCode'), { type: 'statusCode' });
        assert.deepEqual(parseOpenApiRuntimeExpression('$request.header.X-Trace-Id'), {
            type: 'request.header',
            name: 'X-Trace-Id',
        });
        assert.deepEqual(parseOpenApiRuntimeExpression('$request.body#/items/0/id'), {
            type: 'request.body',
            pointer: '/items/0/id',
        });
        assert.deepEqual(parseOpenApiRuntimeExpression('$response.body'), {
            type: 'response.body',
        });
        assert.deepEqual(parseOpenApiRuntimeExpression('$response.query.id'), {
            type: 'response.query',
            name: 'id',
        });
        assert.deepEqual(parseOpenApiRuntimeExpression('$response.path.orderId'), {
            type: 'response.path',
            name: 'orderId',
        });
    });

    it('returns null on malformed syntax', () => {
        assert.equal(parseOpenApiRuntimeExpression('request.header.X-Test'), null);
        assert.equal(parseOpenApiRuntimeExpression('$request.header.'), null);
        assert.equal(parseOpenApiRuntimeExpression('$request.body#not-a-pointer'), null);
    });

    it('formats runtime expressions and validates expression objects', () => {
        assert.equal(
            formatOpenApiRuntimeExpression({ type: 'request.query', name: 'petId' }),
            '$request.query.petId',
        );
        assert.throws(() => {
            formatOpenApiRuntimeExpression({ type: 'request.header', name: 'bad name' });
        }, /valid RFC 9110 token name/);
        assert.equal(isOpenApiRuntimeExpression('$response.header.Content-Type'), true);
        assert.equal(isOpenApiRuntimeExpression({ type: 'request.path', name: 'id' }), true);
        assert.equal(isOpenApiRuntimeExpression({ type: 'request.body', pointer: 'invalid' }), false);
    });
});

// OpenAPI Specification v3.1.1 + RFC 6901: body JSON Pointer evaluation and unresolved values.
describe('OpenAPI runtime expression evaluation', () => {
    const context = {
        request: {
            url: 'https://api.example.test/orders/42?expand=items',
            method: 'POST',
            path: { orderId: '42' },
            query: {
                expand: 'items',
            },
            headers: {
                'Content-Type': 'application/json',
                'X-Trace-Id': 'trace-123',
            },
            body: {
                order: {
                    id: 42,
                    items: [{ sku: 'A-1' }],
                },
            },
        },
        response: {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
            },
            body: {
                result: {
                    id: 'created-42',
                },
            },
            query: {
                region: 'us-east',
            },
            path: {
                jobId: 'abc123',
            },
        },
    } as const;

    it('resolves JSON Pointer body lookups', () => {
        assert.equal(evaluateOpenApiRuntimeExpression('$request.body#/order/id', context), 42);
        assert.equal(evaluateOpenApiRuntimeExpression('$request.body#/order/items/0/sku', context), 'A-1');
        assert.equal(evaluateOpenApiRuntimeExpression('$response.body#/result/id', context), 'created-42');
    });

    it('returns undefined for unresolved fields', () => {
        assert.equal(evaluateOpenApiRuntimeExpression('$request.query.missing', context), undefined);
        assert.equal(evaluateOpenApiRuntimeExpression('$request.path.missing', context), undefined);
        assert.equal(evaluateOpenApiRuntimeExpression('$response.body#/result/missing', context), undefined);
        assert.equal(evaluateOpenApiRuntimeExpression('$response.query.missing', context), undefined);
        assert.equal(evaluateOpenApiRuntimeExpression('$response.path.missing', context), undefined);
    });

    it('resolves response query/path values when present in context', () => {
        assert.equal(evaluateOpenApiRuntimeExpression('$response.query.region', context), 'us-east');
        assert.equal(evaluateOpenApiRuntimeExpression('$response.path.jobId', context), 'abc123');
    });

    it('tolerates missing request query/path context fields', () => {
        const minimalContext = {
            request: {
                url: 'https://api.example.test/orders/42',
                method: 'GET',
            },
        } as const;

        assert.equal(evaluateOpenApiRuntimeExpression('$request.query.id', minimalContext), undefined);
        assert.equal(evaluateOpenApiRuntimeExpression('$request.path.orderId', minimalContext), undefined);
    });

    it('only infers path values from matrix-style path segments', () => {
        const matrixContext = {
            request: {
                url: 'https://api.example.test/orders;orderId=42/items;sku=A-1',
                method: 'GET',
                path: '/orders;orderId=42/items;sku=A-1/legacy=value',
                query: {},
                headers: {},
            },
        } as const;

        assert.equal(evaluateOpenApiRuntimeExpression('$request.path.orderId', matrixContext), '42');
        assert.equal(evaluateOpenApiRuntimeExpression('$request.path.sku', matrixContext), 'A-1');
        assert.equal(evaluateOpenApiRuntimeExpression('$request.path.legacy', matrixContext), undefined);
    });

    it('skips malformed percent-encoded matrix parameters', () => {
        const matrixContext = {
            request: {
                url: 'https://api.example.test/orders;orderId=%E0%A4%A/items;sku=A-1',
                method: 'GET',
                path: '/orders;orderId=%E0%A4%A/items;sku=A-1',
                query: {},
                headers: {},
            },
        } as const;

        assert.equal(evaluateOpenApiRuntimeExpression('$request.path.orderId', matrixContext), undefined);
        assert.equal(evaluateOpenApiRuntimeExpression('$request.path.sku', matrixContext), 'A-1');
    });

    it('uses case-insensitive header lookup by default and allows strict matching', () => {
        assert.equal(
            evaluateOpenApiRuntimeExpression('$request.header.content-type', context),
            'application/json',
        );
        assert.equal(
            evaluateOpenApiRuntimeExpression(
                '$request.header.content-type',
                context,
                { caseInsensitiveHeaders: false },
            ),
            undefined,
        );
    });
});
