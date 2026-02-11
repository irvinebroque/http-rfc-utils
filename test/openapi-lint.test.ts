/**
 * Tests for OpenAPI lint diagnostics.
 * OpenAPI Specification v3.1.1: Paths, Components, Parameter Objects, and Specification Extensions.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lintOpenApiDocument } from '../src/openapi.js';

describe('lintOpenApiDocument', () => {
    it('reports duplicate operationId values and supports a clean document', () => {
        const withDuplicate = {
            paths: {
                '/pets': {
                    get: { operationId: 'listPets' },
                },
                '/dogs': {
                    get: { operationId: 'listPets' },
                },
            },
        };

        const duplicateDiagnostics = lintOpenApiDocument(withDuplicate);
        assert.deepEqual(
            duplicateDiagnostics
                .filter((diagnostic) => diagnostic.code === 'openapi-lint.duplicate-operation-id')
                .map((diagnostic) => diagnostic.path),
            [
                'paths["/dogs"].get.operationId',
                'paths["/pets"].get.operationId',
            ],
        );

        const clean = {
            paths: {
                '/pets': {
                    get: { operationId: 'listPets' },
                },
                '/dogs': {
                    get: { operationId: 'listDogs' },
                },
            },
        };

        assert.equal(
            lintOpenApiDocument(clean).some((diagnostic) => diagnostic.code === 'openapi-lint.duplicate-operation-id'),
            false,
        );
    });

    it('reports missing required path parameters for template placeholders', () => {
        const document = {
            paths: {
                '/pets/{petId}': {
                    get: {
                        parameters: [{ in: 'path', name: 'petId', required: false }],
                    },
                    post: {
                        parameters: [],
                    },
                },
                '/stores/{storeId}': {
                    get: {
                        parameters: [{ in: 'path', name: 'storeId', required: true }],
                    },
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document)
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.missing-required-path-param');

        assert.deepEqual(
            diagnostics.map((diagnostic) => diagnostic.path),
            [
                'paths["/pets/{petId}"].get.parameters[0]',
                'paths["/pets/{petId}"].post',
            ],
        );
    });

    it('resolves local parameter references for path placeholder rules', () => {
        const document = {
            components: {
                parameters: {
                    PetId: {
                        in: 'path',
                        name: 'petId',
                        required: true,
                    },
                    OwnerId: {
                        in: 'path',
                        name: 'ownerId',
                        required: true,
                    },
                },
            },
            paths: {
                '/pets/{petId}': {
                    get: {
                        parameters: [{ $ref: '#/components/parameters/PetId' }],
                    },
                    post: {
                        parameters: [{ $ref: '#/components/parameters/OwnerId' }],
                    },
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document);
        assert.equal(
            diagnostics.some((diagnostic) => diagnostic.code === 'openapi-lint.missing-required-path-param'),
            false,
        );

        const notInTemplateDiagnostics = diagnostics
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.path-param-not-in-template');
        assert.equal(notInTemplateDiagnostics.length, 1);
        assert.equal(notInTemplateDiagnostics[0]?.path, 'paths["/pets/{petId}"].post.parameters[0]');
    });

    it('avoids unresolved $ref false positives for missing path parameter placeholders', () => {
        const document = {
            paths: {
                '/pets/{petId}': {
                    get: {
                        parameters: [{ $ref: './shared.yaml#/components/parameters/PetId' }],
                    },
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document)
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.missing-required-path-param');
        assert.equal(diagnostics.length, 0);
    });

    it('reports path parameters not present in the template and accepts matching declarations', () => {
        const document = {
            paths: {
                '/pets/{petId}': {
                    parameters: [{ in: 'path', name: 'ownerId', required: true }],
                    get: {
                        parameters: [{ in: 'path', name: 'petId', required: true }],
                    },
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document)
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.path-param-not-in-template');
        assert.equal(diagnostics.length, 1);
        assert.equal(diagnostics[0]?.path, 'paths["/pets/{petId}"].parameters[0]');
    });

    it('reports parameter objects that include both schema and content', () => {
        const document = {
            paths: {
                '/pets/{petId}': {
                    get: {
                        parameters: [{
                            in: 'path',
                            name: 'petId',
                            required: true,
                            schema: { type: 'string' },
                            content: {
                                'application/json': {},
                            },
                        }],
                    },
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document)
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.parameter-schema-and-content');
        assert.equal(diagnostics.length, 1);
        assert.equal(diagnostics[0]?.path, 'paths["/pets/{petId}"].get.parameters[0]');

        const clean = {
            paths: {
                '/pets/{petId}': {
                    get: {
                        parameters: [{
                            in: 'path',
                            name: 'petId',
                            required: true,
                            schema: { type: 'string' },
                        }],
                    },
                },
            },
        };

        assert.equal(
            lintOpenApiDocument(clean).some((diagnostic) => diagnostic.code === 'openapi-lint.parameter-schema-and-content'),
            false,
        );
    });

    it('reports parameter content maps with more than one media type entry', () => {
        const document = {
            paths: {
                '/pets/{petId}': {
                    get: {
                        parameters: [{
                            in: 'query',
                            name: 'filter',
                            content: {
                                'application/json': {},
                                'application/xml': {},
                            },
                        }],
                    },
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document)
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.parameter-content-too-many-entries');
        assert.equal(diagnostics.length, 1);
        assert.equal(diagnostics[0]?.path, 'paths["/pets/{petId}"].get.parameters[0].content');
    });

    it('checks extension key prefixes and component key format', () => {
        const document = {
            'x-company': true,
            'X-team': true,
            xTeam: true,
            components: {
                schemas: {
                    'Pet Model': { type: 'object' },
                    'Pet_Model-1.0': { type: 'object' },
                },
            },
            paths: {
                '/pets': {
                    get: {
                        'x-feature': true,
                    },
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document);
        assert.deepEqual(
            diagnostics
                .filter((diagnostic) => diagnostic.code === 'openapi-lint.extension-prefix')
                .map((diagnostic) => diagnostic.path),
            [
                '["X-team"]',
                'xTeam',
            ],
        );

        const componentKeyDiagnostics = diagnostics
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.component-key-format');
        assert.equal(componentKeyDiagnostics.length, 1);
        assert.equal(componentKeyDiagnostics[0]?.path, 'components.schemas["Pet Model"]');
    });

    it('does not flag arbitrary map keys for extension-prefix linting', () => {
        const document = {
            xTeam: true,
            components: {
                schemas: {
                    xInternalModel: {
                        type: 'object',
                        properties: {
                            xInternalField: { type: 'string' },
                        },
                    },
                },
            },
            paths: {
                '/pets/{xId}': {
                    get: {
                        parameters: [{ in: 'path', name: 'xId', required: true }],
                    },
                },
            },
        };

        const extensionDiagnostics = lintOpenApiDocument(document)
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.extension-prefix');
        assert.deepEqual(
            extensionDiagnostics.map((diagnostic) => diagnostic.path),
            ['xTeam'],
        );
    });

    it('reports path template collisions with different parameter names', () => {
        const document = {
            paths: {
                '/pets/{id}': {
                    get: {},
                },
                '/pets/{petId}': {
                    get: {},
                },
                '/pets/mine': {
                    get: {},
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document)
            .filter((diagnostic) => diagnostic.code === 'openapi-lint.path-template-collision');

        assert.deepEqual(
            diagnostics.map((diagnostic) => diagnostic.path),
            [
                'paths["/pets/{id}"]',
                'paths["/pets/{petId}"]',
            ],
        );
    });

    it('supports rule filtering and severity overrides', () => {
        const document = {
            paths: {
                '/pets': {
                    get: { operationId: 'listPets' },
                },
                '/dogs': {
                    get: { operationId: 'listPets' },
                },
            },
            components: {
                schemas: {
                    'Pet Model': { type: 'object' },
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document, {
            enabled: {
                'component-key-format': true,
                'duplicate-operation-id': true,
                'extension-prefix': false,
            },
            severity: {
                'duplicate-operation-id': 'warning',
            },
        });

        assert.deepEqual(
            diagnostics.map((diagnostic) => diagnostic.code),
            [
                'openapi-lint.duplicate-operation-id',
                'openapi-lint.duplicate-operation-id',
                'openapi-lint.component-key-format',
            ],
        );
        assert.deepEqual(
            diagnostics.map((diagnostic) => diagnostic.severity),
            ['warning', 'warning', 'warning'],
        );
    });

    it('returns deterministic diagnostic ordering', () => {
        const document = {
            'X-debug': true,
            paths: {
                '/pets/{id}': {
                    get: {
                        operationId: 'getPet',
                        parameters: [{ in: 'path', name: 'petId', required: true }],
                    },
                },
                '/pets/{petId}': {
                    get: {
                        operationId: 'getPet',
                        parameters: [{ in: 'path', name: 'petId', required: false }],
                    },
                },
            },
            components: {
                schemas: {
                    'Pet Model': {},
                },
            },
        };

        const diagnostics = lintOpenApiDocument(document);
        assert.deepEqual(
            diagnostics.map((diagnostic) => diagnostic.code),
            [
                'openapi-lint.duplicate-operation-id',
                'openapi-lint.duplicate-operation-id',
                'openapi-lint.missing-required-path-param',
                'openapi-lint.missing-required-path-param',
                'openapi-lint.path-param-not-in-template',
                'openapi-lint.extension-prefix',
                'openapi-lint.component-key-format',
                'openapi-lint.path-template-collision',
                'openapi-lint.path-template-collision',
            ],
        );
    });

    it('does not throw for malformed input structures', () => {
        assert.doesNotThrow(() => {
            lintOpenApiDocument({
                paths: {
                    '/pets/{id}': {
                        get: {
                            parameters: [null, 'bad', { in: 'path' }],
                        },
                    },
                },
                components: null,
            });
        });
    });
});
