/**
 * Tests for OpenAPI path matching and server resolution behavior.
 * OpenAPI Specification v3.1.1: Paths Object + Server Object precedence.
 * @see https://spec.openapis.org/oas/v3.1.1.html
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    compileOpenApiPathMatcher,
    extractOpenApiPathParams,
    listOpenApiServerCandidates,
    resolveOpenApiServerUrl,
} from '../src/openapi.js';
import type { OpenApiServerObject } from '../src/types.js';

// OpenAPI 3.1.1 Paths Object: concrete templates must win over templated paths.
describe('compileOpenApiPathMatcher', () => {
    const paths = {
        '/pets/{id}': {
            get: {
                operationId: 'getPetById',
            },
        },
        '/pets/mine': {
            get: {
                operationId: 'getMyPets',
            },
        },
        '/pets/{id}/owners/{ownerId}': {
            get: {
                operationId: 'getPetOwner',
            },
            post: {
                operationId: 'upsertPetOwner',
            },
        },
    } as const;

    it('prefers concrete path matches before templated matches', () => {
        const matcher = compileOpenApiPathMatcher(paths);
        const match = matcher.match('/pets/mine', 'GET');

        assert.ok(match);
        assert.equal(match.pathTemplate, '/pets/mine');
        assert.deepEqual(match.params, {});
        assert.equal(match.patternKind, 'concrete');
    });

    it('extracts path parameters for templated matches', () => {
        const matcher = compileOpenApiPathMatcher(paths);
        const match = matcher.match('/pets/abc/owners/u-1', 'get');

        assert.ok(match);
        assert.equal(match.pathTemplate, '/pets/{id}/owners/{ownerId}');
        assert.deepEqual(match.params, {
            id: 'abc',
            ownerId: 'u-1',
        });
    });

    it('filters by method when a method is provided', () => {
        const matcher = compileOpenApiPathMatcher(paths);

        const postMatch = matcher.match('/pets/abc/owners/u-1', 'POST');
        assert.ok(postMatch);
        assert.equal(postMatch.method, 'post');

        const deleteMatch = matcher.match('/pets/abc/owners/u-1', 'DELETE');
        assert.equal(deleteMatch, null);
    });

    it('returns deterministic ordering for matchAll', () => {
        const matcher = compileOpenApiPathMatcher(paths);
        const matches = matcher.matchAll('/pets/mine', 'GET');

        assert.deepEqual(matches.map((entry) => entry.pathTemplate), [
            '/pets/mine',
            '/pets/{id}',
        ]);
    });
});

// OpenAPI 3.1.1 Paths Object: path templating variable extraction.
describe('extractOpenApiPathParams', () => {
    it('returns params for matching templates', () => {
        const params = extractOpenApiPathParams('/stores/{storeId}/pets/{petId}', '/stores/s-1/pets/p-2');
        assert.deepEqual(params, {
            petId: 'p-2',
            storeId: 's-1',
        });
    });

    it('returns null for non-matching paths', () => {
        const params = extractOpenApiPathParams('/stores/{storeId}/pets/{petId}', '/stores/s-1/orders/o-2');
        assert.equal(params, null);
    });
});

// OpenAPI 3.1.1 Server Object: operation > path > root precedence.
describe('listOpenApiServerCandidates', () => {
    const document = {
        servers: [{ url: 'https://root.example.test/v1' }],
        paths: {
            '/pets/{id}': {
                servers: [{ url: 'https://path.example.test/v1' }],
                get: {
                    servers: [{ url: 'https://operation.example.test/v1' }],
                },
                post: {},
            },
        },
    } as const;

    it('selects operation servers when defined', () => {
        const candidates = listOpenApiServerCandidates(document, '/pets/{id}', 'GET');
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0]?.level, 'operation');
        assert.equal(candidates[0]?.server.url, 'https://operation.example.test/v1');
    });

    it('falls back to path servers when operation servers are absent', () => {
        const candidates = listOpenApiServerCandidates(document, '/pets/{id}', 'POST');
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0]?.level, 'path');
        assert.equal(candidates[0]?.server.url, 'https://path.example.test/v1');
    });

    it('treats explicit empty operation servers as an override', () => {
        const withEmptyOperationServers = {
            ...document,
            paths: {
                '/pets/{id}': {
                    ...document.paths['/pets/{id}'],
                    post: {
                        servers: [],
                    },
                },
            },
        } as const;

        const candidates = listOpenApiServerCandidates(withEmptyOperationServers, '/pets/{id}', 'POST');
        assert.deepEqual(candidates, []);
    });

    it('treats explicit empty path servers as an override', () => {
        const withEmptyPathServers = {
            ...document,
            paths: {
                '/pets/{id}': {
                    ...document.paths['/pets/{id}'],
                    servers: [],
                    post: {},
                },
            },
        } as const;

        const candidates = listOpenApiServerCandidates(withEmptyPathServers, '/pets/{id}', 'POST');
        assert.deepEqual(candidates, []);
    });

    it('falls back to root servers when path is missing', () => {
        const candidates = listOpenApiServerCandidates(document, '/orders/{id}', 'GET');
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0]?.level, 'root');
        assert.equal(candidates[0]?.server.url, 'https://root.example.test/v1');
    });

    it('uses OpenAPI default root server when root servers are missing', () => {
        const withoutRootServers = {
            paths: document.paths,
        };

        const candidates = listOpenApiServerCandidates(withoutRootServers, '/orders/{id}', 'GET');
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0]?.level, 'root');
        assert.equal(candidates[0]?.server.url, '/');
    });

    it('uses OpenAPI default root server when root servers are empty', () => {
        const withEmptyRootServers = {
            ...document,
            servers: [],
        };

        const candidates = listOpenApiServerCandidates(withEmptyRootServers, '/orders/{id}', 'GET');
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0]?.level, 'root');
        assert.equal(candidates[0]?.server.url, '/');
    });

    it('uses OpenAPI default root server when root server urls are blank', () => {
        const withBlankRootServers = {
            ...document,
            servers: [
                { url: '' },
                { url: '   ' },
            ],
        };

        const candidates = listOpenApiServerCandidates(withBlankRootServers, '/orders/{id}', 'GET');
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0]?.level, 'root');
        assert.equal(candidates[0]?.server.url, '/');
    });

    it('keeps operation and path overrides above root default fallback', () => {
        const withBlankRootServers = {
            ...document,
            servers: [
                { url: '   ' },
            ],
        };

        const operationCandidates = listOpenApiServerCandidates(withBlankRootServers, '/pets/{id}', 'GET');
        assert.equal(operationCandidates[0]?.level, 'operation');
        assert.equal(operationCandidates[0]?.server.url, 'https://operation.example.test/v1');

        const pathCandidates = listOpenApiServerCandidates(withBlankRootServers, '/pets/{id}', 'POST');
        assert.equal(pathCandidates[0]?.level, 'path');
        assert.equal(pathCandidates[0]?.server.url, 'https://path.example.test/v1');
    });
});

// OpenAPI 3.1.1 Server Variables: defaults, overrides, and enum validation.
describe('resolveOpenApiServerUrl', () => {
    it('uses operation-level variable overrides and validates enum mismatches', () => {
        const result = resolveOpenApiServerUrl({
            level: 'operation',
            server: {
                url: 'https://{env}.api.example.test/{version}',
                variables: {
                    env: {
                        default: 'dev',
                        enum: ['dev', 'prod'],
                    },
                    version: {
                        default: 'v1',
                        enum: ['v1', 'v2'],
                    },
                },
            },
            variableOverridesByLevel: {
                operation: {
                    env: 'prod',
                    version: 'v9',
                },
            },
        });

        assert.equal(result.url, 'https://prod.api.example.test/v9');
        assert.deepEqual(result.variables, {
            env: 'prod',
            version: 'v9',
        });
        assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code), ['openapi-server.enum-mismatch']);
    });

    it('resolves relative URLs against baseUrl', () => {
        const result = resolveOpenApiServerUrl({
            server: {
                url: '/{tenant}/api',
                variables: {
                    tenant: {
                        default: 'acme',
                    },
                },
            },
            baseUrl: 'https://gateway.example.test/root/openapi.json',
        });

        assert.equal(result.url, 'https://gateway.example.test/acme/api');
        assert.deepEqual(result.diagnostics, []);
    });

    it('reports missing defaults for unresolved server variables', () => {
        const result = resolveOpenApiServerUrl({
            server: {
                url: 'https://{region}.api.example.test',
                variables: {
                    region: {},
                },
            } as unknown as OpenApiServerObject,
        });

        assert.equal(result.url, 'https://{region}.api.example.test');
        assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code), ['openapi-server.missing-variable-default']);
    });

    it('does not leak operation-level overrides into root-level resolution', () => {
        const result = resolveOpenApiServerUrl({
            level: 'root',
            server: {
                url: 'https://{env}.api.example.test',
                variables: {
                    env: {
                        default: 'dev',
                    },
                },
            },
            variableOverridesByLevel: {
                operation: {
                    env: 'prod',
                },
            },
        });

        assert.equal(result.url, 'https://dev.api.example.test');
        assert.deepEqual(result.variables, {
            env: 'dev',
        });
        assert.deepEqual(result.diagnostics, []);
    });
});
