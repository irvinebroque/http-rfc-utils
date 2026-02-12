/**
 * Tests for openapi link callback behavior.
 * Spec references are cited inline for each assertion group when applicable.
 * @see https://spec.openapis.org/oas/v3.1.1.html
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    materializeOpenApiLinkValues,
    resolveOpenApiCallbackUrl,
} from '../src/openapi.js';

// OpenAPI Specification v3.1.1: Link Object runtime expression materialization.
describe('OpenAPI link value materialization', () => {
    const context = {
        request: {
            url: 'https://api.example.test/orders/42?expand=items',
            method: 'POST',
            path: { orderId: '42' },
            query: {
                expand: 'items',
            },
            headers: {
                'X-Trace-Id': 'trace-123',
            },
            body: {
                payload: {
                    customerId: 'c-100',
                },
            },
        },
        response: {
            status: 202,
            body: {
                id: 'response-9',
            },
        },
    } as const;

    it('resolves mixed literal and expression values', () => {
        const result = materializeOpenApiLinkValues(
            {
                parameters: {
                    orderId: '$request.path.orderId',
                    traceId: '$request.header.x-trace-id',
                    staticMode: 'preview',
                },
                requestBody: '$request.body#/payload/customerId',
            },
            context,
        );

        assert.deepEqual(result.parameters, {
            orderId: '42',
            staticMode: 'preview',
            traceId: 'trace-123',
        });
        assert.equal(result.requestBody, 'c-100');
        assert.deepEqual(result.issues, []);
    });

    it('collects deterministic issues for malformed and unresolved expressions', () => {
        const result = materializeOpenApiLinkValues(
            {
                parameters: {
                    malformed: '$request.body#missing-leading-slash',
                    missing: '$request.query.unknown',
                },
                requestBody: '$response.body#/missing',
            },
            context,
        );

        assert.equal(Object.prototype.hasOwnProperty.call(result.parameters, 'malformed'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(result.parameters, 'missing'), false);
        assert.equal(result.requestBody, undefined);
        assert.deepEqual(result.issues.map((issue) => issue.code), [
            'invalid-runtime-expression',
            'unresolved-runtime-expression',
            'unresolved-runtime-expression',
        ]);
        assert.deepEqual(result.issues.map((issue) => issue.path), [
            'parameters.malformed',
            'parameters.missing',
            'requestBody',
        ]);
    });

    it('supports embedded runtime expressions in string values', () => {
        const result = materializeOpenApiLinkValues(
            {
                parameters: {
                    callbackLabel: 'order-{$request.path.orderId}',
                },
            },
            context,
        );

        assert.equal(result.parameters.callbackLabel, 'order-42');
        assert.deepEqual(result.issues, []);
    });
});

// OpenAPI Specification v3.1.1: Callback key runtime expression substitution.
describe('OpenAPI callback URL resolution', () => {
    const context = {
        request: {
            url: 'https://api.example.test/orders/42',
            method: 'POST',
            path: { orderId: '42' },
            query: {
                tenant: 'acme',
                callbackUrl: 'https://hooks.example.test/from-query',
            },
            headers: {
                'X-Correlation-Id': 'corr-1',
            },
            body: {
                callbackHost: 'callbacks.example.test',
            },
        },
        response: {
            status: 204,
        },
    } as const;

    it('resolves callback keys containing {<expression>} placeholders', () => {
        const result = resolveOpenApiCallbackUrl(
            'https://{$request.body#/callbackHost}/events/{$request.path.orderId}?status={$statusCode}',
            context,
        );

        assert.equal(result.url, 'https://callbacks.example.test/events/42?status=204');
        assert.deepEqual(result.issues, []);
    });

    it('returns issues for malformed and unresolved callback expressions', () => {
        const malformed = resolveOpenApiCallbackUrl(
            'https://hooks.example.test/{request.path.orderId}',
            context,
        );
        assert.equal(malformed.url, undefined);
        assert.deepEqual(malformed.issues.map((issue) => issue.code), ['invalid-callback-expression']);

        const unresolved = resolveOpenApiCallbackUrl(
            'https://hooks.example.test/{$request.query.missing}',
            context,
        );
        assert.equal(unresolved.url, undefined);
        assert.deepEqual(unresolved.issues.map((issue) => issue.code), ['unresolved-callback-expression']);
    });

    it('resolves callback keys that are bare runtime expressions', () => {
        const resolved = resolveOpenApiCallbackUrl('$request.query.callbackUrl', context);
        assert.equal(resolved.url, 'https://hooks.example.test/from-query');
        assert.deepEqual(resolved.issues, []);

        const unresolved = resolveOpenApiCallbackUrl('$request.query.missing', context);
        assert.equal(unresolved.url, undefined);
        assert.deepEqual(unresolved.issues.map((issue) => issue.code), ['unresolved-callback-expression']);
    });
});
