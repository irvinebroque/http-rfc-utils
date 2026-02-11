/**
 * Tests for problem behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    createProblem,
    problemResponse,
    Problems,
} from '../src/problem.js';

// RFC 9457 §3.1, §3.2: Problem Details members and extensions.
describe('createProblem', () => {
    it('creates basic problem with required fields', () => {
        const problem = createProblem({
            status: 400,
            title: 'Bad Request',
            detail: 'Invalid input provided',
        });

        assert.equal(problem.status, 400);
        assert.equal(problem.title, 'Bad Request');
        assert.equal(problem.detail, 'Invalid input provided');
    });

    it('defaults type to about:blank', () => {
        const problem = createProblem({
            status: 404,
            title: 'Not Found',
            detail: 'Resource not found',
        });

        assert.equal(problem.type, 'about:blank');
    });

    it('includes custom type when provided', () => {
        const problem = createProblem({
            status: 400,
            title: 'Validation Error',
            detail: 'Email is invalid',
            type: 'https://example.com/problems/validation-error',
        });

        assert.equal(problem.type, 'https://example.com/problems/validation-error');
    });

    it('includes instance when provided', () => {
        const problem = createProblem({
            status: 404,
            title: 'Not Found',
            detail: 'User not found',
            instance: '/api/users/123',
        });

        assert.equal(problem.instance, '/api/users/123');
    });

    it('omits instance when not provided', () => {
        const problem = createProblem({
            status: 500,
            title: 'Internal Server Error',
            detail: 'Something went wrong',
        });

        assert.equal(problem.instance, undefined);
        assert.equal('instance' in problem, false);
    });

    it('spreads extension members into result', () => {
        const problem = createProblem({
            status: 422,
            title: 'Unprocessable Entity',
            detail: 'Validation failed',
            extensions: {
                errors: [
                    { field: 'email', message: 'Invalid format' },
                    { field: 'age', message: 'Must be positive' },
                ],
                traceId: 'abc-123',
            },
        });

        assert.deepEqual(problem.errors, [
            { field: 'email', message: 'Invalid format' },
            { field: 'age', message: 'Must be positive' },
        ]);
        assert.equal(problem.traceId, 'abc-123');
    });

    it('ignores __proto__ extension key and keeps safe keys', () => {
        const extensions = Object.create(null) as Record<string, unknown>;
        Object.defineProperty(extensions, '__proto__', {
            value: { polluted: true },
            enumerable: true,
            configurable: true,
            writable: true,
        });
        extensions.traceId = 'req-safe-123';

        const problem = createProblem({
            status: 400,
            title: 'Bad Request',
            detail: 'Invalid payload',
            extensions,
        });

        assert.equal(problem.traceId, 'req-safe-123');
        assert.equal(Object.prototype.hasOwnProperty.call(problem, '__proto__'), false);
        assert.equal('polluted' in ({} as Record<string, unknown>), false);
    });

    it('ignores constructor and prototype extension keys and keeps safe keys', () => {
        const extensions = Object.create(null) as Record<string, unknown>;
        Object.defineProperty(extensions, 'constructor', {
            value: 'malicious-constructor',
            enumerable: true,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(extensions, 'prototype', {
            value: 'malicious-prototype',
            enumerable: true,
            configurable: true,
            writable: true,
        });
        extensions.requestId = 'req-safe-456';

        const problem = createProblem({
            status: 400,
            title: 'Bad Request',
            detail: 'Invalid payload',
            extensions,
        });

        assert.equal(problem.requestId, 'req-safe-456');
        assert.equal(Object.prototype.hasOwnProperty.call(problem, 'constructor'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(problem, 'prototype'), false);
    });
});

// RFC 9457 §3.1, §3.2, §4.1: Problem Details response and media type.
// Non-RFC (Fetch/CORS): CORS headers on problem responses.
describe('problemResponse (new signature)', () => {
    it('creates Response with correct status code', () => {
        const response = problemResponse({
            status: 403,
            title: 'Forbidden',
            detail: 'Access denied',
        });

        assert.equal(response.status, 403);
    });

    it('sets Content-Type to application/problem+json', () => {
        const response = problemResponse({
            status: 400,
            title: 'Bad Request',
            detail: 'Invalid data',
        });

        assert.equal(response.headers.get('Content-Type'), 'application/problem+json');
    });

    it('body is valid JSON matching ProblemDetails structure', async () => {
        const response = problemResponse({
            status: 404,
            title: 'Not Found',
            detail: 'Resource does not exist',
            instance: '/api/items/456',
        });

        const body = await response.json();

        assert.equal(body.type, 'about:blank');
        assert.equal(body.title, 'Not Found');
        assert.equal(body.status, 404);
        assert.equal(body.detail, 'Resource does not exist');
        assert.equal(body.instance, '/api/items/456');
    });

    it('includes CORS headers', () => {
        const response = problemResponse({
            status: 400,
            title: 'Bad Request',
            detail: 'Invalid request',
        });

        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
        assert.ok(response.headers.get('Access-Control-Allow-Methods'));
        assert.ok(response.headers.get('Access-Control-Allow-Headers'));
    });

    it('includes extensions in body', async () => {
        const response = problemResponse({
            status: 429,
            title: 'Too Many Requests',
            detail: 'Rate limit exceeded',
            extensions: {
                retryAfter: 60,
                limit: 100,
                remaining: 0,
            },
        });

        const body = await response.json();

        assert.equal(body.retryAfter, 60);
        assert.equal(body.limit, 100);
        assert.equal(body.remaining, 0);
    });

    it('accepts custom CORS headers', () => {
        const response = problemResponse(
            {
                status: 400,
                title: 'Bad Request',
                detail: 'Invalid data',
            },
            {
                'Access-Control-Allow-Origin': 'https://example.com',
                'Access-Control-Allow-Credentials': 'true',
            }
        );

        assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
        assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
    });
});

// RFC 9457 §3.1, §4.1: Problem Details response and media type.
// Non-RFC (Fetch/CORS): CORS headers on problem responses.
describe('problemResponse (backward-compatible signature)', () => {
    it('works with basic three arguments', async () => {
        const response = problemResponse(400, 'Bad Request', 'Invalid input');

        assert.equal(response.status, 400);
        assert.equal(response.headers.get('Content-Type'), 'application/problem+json');

        const body = await response.json();
        assert.equal(body.status, 400);
        assert.equal(body.title, 'Bad Request');
        assert.equal(body.detail, 'Invalid input');
        assert.equal(body.type, 'about:blank');
    });

    it('includes instance when provided as fourth argument', async () => {
        const response = problemResponse(404, 'Not Found', 'Resource not found', '/api/items/123');

        const body = await response.json();
        assert.equal(body.instance, '/api/items/123');
    });

    it('includes CORS headers in backward-compatible mode', () => {
        const response = problemResponse(500, 'Internal Server Error', 'Something failed');

        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    });
});

// RFC 9457 §3.1: Problem Details members populated by helpers.
describe('Problems helpers', () => {
    it('badRequest returns 400 response', async () => {
        const response = Problems.badRequest('Invalid input');

        assert.equal(response.status, 400);
        const body = await response.json();
        assert.equal(body.title, 'Bad Request');
        assert.equal(body.detail, 'Invalid input');
    });

    it('unauthorized returns 401 response', async () => {
        const response = Problems.unauthorized('Missing authentication token');

        assert.equal(response.status, 401);
        const body = await response.json();
        assert.equal(body.title, 'Unauthorized');
        assert.equal(body.detail, 'Missing authentication token');
    });

    it('forbidden returns 403 response', async () => {
        const response = Problems.forbidden('Insufficient permissions');

        assert.equal(response.status, 403);
        const body = await response.json();
        assert.equal(body.title, 'Forbidden');
        assert.equal(body.detail, 'Insufficient permissions');
    });

    it('notFound returns 404 response', async () => {
        const response = Problems.notFound('User not found', '/api/users/999');

        assert.equal(response.status, 404);
        const body = await response.json();
        assert.equal(body.title, 'Not Found');
        assert.equal(body.detail, 'User not found');
        assert.equal(body.instance, '/api/users/999');
    });

    it('methodNotAllowed returns 405 with allowed array', async () => {
        const response = Problems.methodNotAllowed(
            'POST method not supported',
            ['GET', 'HEAD', 'OPTIONS'],
            '/api/items'
        );

        assert.equal(response.status, 405);
        const body = await response.json();
        assert.equal(body.title, 'Method Not Allowed');
        assert.equal(body.detail, 'POST method not supported');
        assert.deepEqual(body.allowed, ['GET', 'HEAD', 'OPTIONS']);
        assert.equal(body.instance, '/api/items');
    });

    it('conflict returns 409 response', async () => {
        const response = Problems.conflict('Resource already exists');

        assert.equal(response.status, 409);
        const body = await response.json();
        assert.equal(body.title, 'Conflict');
        assert.equal(body.detail, 'Resource already exists');
    });

    it('gone returns 410 response', async () => {
        const response = Problems.gone('Resource has been permanently deleted');

        assert.equal(response.status, 410);
        const body = await response.json();
        assert.equal(body.title, 'Gone');
        assert.equal(body.detail, 'Resource has been permanently deleted');
    });

    it('unprocessableEntity returns 422 response', async () => {
        const response = Problems.unprocessableEntity('Validation failed');

        assert.equal(response.status, 422);
        const body = await response.json();
        assert.equal(body.title, 'Unprocessable Entity');
        assert.equal(body.detail, 'Validation failed');
    });

    it('unprocessableEntity returns 422 with optional errors array', async () => {
        const errors = [
            { field: 'email', code: 'invalid_format' },
            { field: 'password', code: 'too_short' },
        ];
        const response = Problems.unprocessableEntity('Validation failed', errors);

        assert.equal(response.status, 422);
        const body = await response.json();
        assert.equal(body.title, 'Unprocessable Entity');
        assert.deepEqual(body.errors, errors);
    });

    it('tooManyRequests returns 429 response', async () => {
        const response = Problems.tooManyRequests('Rate limit exceeded');

        assert.equal(response.status, 429);
        const body = await response.json();
        assert.equal(body.title, 'Too Many Requests');
        assert.equal(body.detail, 'Rate limit exceeded');
    });

    it('tooManyRequests returns 429 with optional retryAfter', async () => {
        const response = Problems.tooManyRequests('Rate limit exceeded', 120);

        assert.equal(response.status, 429);
        const body = await response.json();
        assert.equal(body.title, 'Too Many Requests');
        assert.equal(body.retryAfter, 120);
    });

    it('internalServerError returns 500 response', async () => {
        const response = Problems.internalServerError('Unexpected error occurred');

        assert.equal(response.status, 500);
        const body = await response.json();
        assert.equal(body.title, 'Internal Server Error');
        assert.equal(body.detail, 'Unexpected error occurred');
    });

    it('serviceUnavailable returns 503 response', async () => {
        const response = Problems.serviceUnavailable('Service is under maintenance');

        assert.equal(response.status, 503);
        const body = await response.json();
        assert.equal(body.title, 'Service Unavailable');
        assert.equal(body.detail, 'Service is under maintenance');
    });

    it('serviceUnavailable returns 503 with optional retryAfter', async () => {
        const response = Problems.serviceUnavailable('Service is under maintenance', 300);

        assert.equal(response.status, 503);
        const body = await response.json();
        assert.equal(body.title, 'Service Unavailable');
        assert.equal(body.retryAfter, 300);
    });
});

// RFC 9457 §3.1, §3.2: Required members and extension placement.
describe('Response validation', () => {
    it('response body can be parsed as JSON', async () => {
        const response = problemResponse({
            status: 400,
            title: 'Bad Request',
            detail: 'Test detail',
        });

        const text = await response.clone().text();
        assert.doesNotThrow(() => JSON.parse(text));
    });

    it('response body has all required RFC 9457 fields', async () => {
        const response = problemResponse({
            status: 418,
            title: "I'm a Teapot",
            detail: 'Cannot brew coffee',
        });

        const body = await response.json();

        // Required RFC 9457 members
        assert.ok('type' in body, 'Missing type field');
        assert.ok('title' in body, 'Missing title field');
        assert.ok('status' in body, 'Missing status field');
        assert.ok('detail' in body, 'Missing detail field');

        // Type validations
        assert.equal(typeof body.type, 'string');
        assert.equal(typeof body.title, 'string');
        assert.equal(typeof body.status, 'number');
        assert.equal(typeof body.detail, 'string');
    });

    it('extension members appear at top level of body', async () => {
        const response = problemResponse({
            status: 400,
            title: 'Validation Error',
            detail: 'Multiple fields failed validation',
            extensions: {
                errors: [{ field: 'name', message: 'Required' }],
                requestId: 'req-abc-123',
                timestamp: '2024-01-01T00:00:00Z',
            },
        });

        const body = await response.json();

        // Extensions should be at top level, not nested
        assert.ok('errors' in body);
        assert.ok('requestId' in body);
        assert.ok('timestamp' in body);
        assert.equal(body.requestId, 'req-abc-123');
        assert.equal(body.timestamp, '2024-01-01T00:00:00Z');
        assert.deepEqual(body.errors, [{ field: 'name', message: 'Required' }]);

        // Should not have a nested extensions object
        assert.equal(body.extensions, undefined);
    });

    it('instance field is optional and only present when provided', async () => {
        const withInstance = problemResponse({
            status: 404,
            title: 'Not Found',
            detail: 'Item not found',
            instance: '/api/items/123',
        });

        const withoutInstance = problemResponse({
            status: 404,
            title: 'Not Found',
            detail: 'Item not found',
        });

        const bodyWith = await withInstance.json();
        const bodyWithout = await withoutInstance.json();

        assert.equal(bodyWith.instance, '/api/items/123');
        assert.equal('instance' in bodyWithout, false);
    });
});
