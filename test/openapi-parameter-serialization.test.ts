/**
 * Tests for openapi parameter serialization behavior.
 * Spec references are cited inline for each assertion group when applicable.
 * @see https://spec.openapis.org/oas/v3.1.1.html
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    formatCookieParameter,
    formatHeaderParameter,
    formatPathParameter,
    formatQueryParameter,
    normalizeOpenApiParameterSpec,
    parseCookieParameter,
    parseHeaderParameter,
    parsePathParameter,
    parseQueryParameter,
} from '../src/openapi.js';

// OpenAPI Specification v3.1.1: Parameter Object style/explode defaults and style matrix.
describe('OpenAPI v3.1.1 Parameter serialization defaults and validation', () => {
    it('applies default style/explode/allowReserved for query parameters', () => {
        const normalized = normalizeOpenApiParameterSpec({
            name: 'id',
            in: 'query',
            valueType: 'primitive',
        });

        assert.deepEqual(normalized, {
            name: 'id',
            in: 'query',
            style: 'form',
            explode: true,
            allowReserved: false,
            valueType: 'primitive',
        });
    });

    it('applies default style/explode for path parameters', () => {
        const normalized = normalizeOpenApiParameterSpec({
            name: 'id',
            in: 'path',
            valueType: 'primitive',
        });

        assert.equal(normalized.style, 'simple');
        assert.equal(normalized.explode, false);
    });

    it('throws for semantic-invalid style/location combinations', () => {
        assert.throws(() => {
            normalizeOpenApiParameterSpec({
                name: 'x',
                in: 'header',
                style: 'matrix',
                valueType: 'primitive',
            });
        }, /unsupported style "matrix" for location "header"/);
    });

    it('throws for deepObject with explode=false', () => {
        assert.throws(() => {
            normalizeOpenApiParameterSpec({
                name: 'filter',
                in: 'query',
                style: 'deepObject',
                explode: false,
                valueType: 'object',
            });
        }, /deepObject requires explode=true/);
    });

    it('throws when allowReserved is used outside query parameters', () => {
        assert.throws(() => {
            normalizeOpenApiParameterSpec({
                name: 'id',
                in: 'path',
                allowReserved: true,
                valueType: 'primitive',
            });
        }, /allowReserved is only valid for query parameters/);
    });
});

// OpenAPI Specification v3.1.1: query style=form arrays and objects, explode true/false.
describe('OpenAPI query style=form', () => {
    it('formats and parses arrays with explode=true', () => {
        const spec = {
            name: 'id',
            in: 'query' as const,
            style: 'form' as const,
            explode: true,
            valueType: 'array' as const,
        };

        assert.equal(formatQueryParameter(spec, ['3', '4', '5']), 'id=3&id=4&id=5');
        assert.deepEqual(parseQueryParameter(spec, '?id=3&id=4&id=5'), ['3', '4', '5']);
    });

    it('formats and parses arrays with explode=false', () => {
        const spec = {
            name: 'id',
            in: 'query' as const,
            style: 'form' as const,
            explode: false,
            valueType: 'array' as const,
        };

        assert.equal(formatQueryParameter(spec, ['3', '4', '5']), 'id=3,4,5');
        assert.deepEqual(parseQueryParameter(spec, 'id=3,4,5'), ['3', '4', '5']);
    });

    it('round-trips explode=false arrays containing encoded commas', () => {
        const spec = {
            name: 'id',
            in: 'query' as const,
            style: 'form' as const,
            explode: false,
            valueType: 'array' as const,
        };

        const serialized = formatQueryParameter(spec, ['a,b', 'c']);
        assert.equal(serialized, 'id=a%2Cb,c');
        assert.deepEqual(parseQueryParameter(spec, serialized), ['a,b', 'c']);
    });

    it('formats objects with explode=true in deterministic key order', () => {
        const spec = {
            name: 'coords',
            in: 'query' as const,
            style: 'form' as const,
            explode: true,
            valueType: 'object' as const,
        };

        const serialized = formatQueryParameter(spec, { z: '2', a: '1' });
        assert.equal(serialized, 'a=1&z=2');
    });

    it('formats and parses objects with explode=false', () => {
        const spec = {
            name: 'coords',
            in: 'query' as const,
            style: 'form' as const,
            explode: false,
            valueType: 'object' as const,
        };

        assert.equal(formatQueryParameter(spec, { y: '20', x: '10' }), 'coords=x,10,y,20');
        assert.deepEqual(parseQueryParameter(spec, 'coords=x,10,y,20'), { x: '10', y: '20' });
    });
});

// OpenAPI Specification v3.1.1: query style=pipeDelimited array serialization.
describe('OpenAPI query style=pipeDelimited', () => {
    it('round-trips values containing encoded pipe characters', () => {
        const spec = {
            name: 'tags',
            in: 'query' as const,
            style: 'pipeDelimited' as const,
            explode: false,
            valueType: 'array' as const,
        };

        const serialized = formatQueryParameter(spec, ['a|b', 'c']);
        assert.equal(serialized, 'tags=a%7Cb|c');
        assert.deepEqual(parseQueryParameter(spec, serialized), ['a|b', 'c']);
    });
});

// OpenAPI v3.1.1 Parameter Object style=deepObject (Section 4.8.12.3) + RFC 3986 Section 2.1.
describe('OpenAPI query deepObject behavior', () => {
    it('formats deepObject with RFC3986-encoded bracket notation keys and parses it', () => {
        const spec = {
            name: 'filter',
            in: 'query' as const,
            style: 'deepObject' as const,
            explode: true,
            valueType: 'object' as const,
        };

        const serialized = formatQueryParameter(spec, { b: '2', a: '1' });
        assert.equal(serialized, 'filter%5Ba%5D=1&filter%5Bb%5D=2');
        assert.deepEqual(parseQueryParameter(spec, serialized), { a: '1', b: '2' });
    });

    it('accepts lowercase percent-hex bracket encoding in deepObject names', () => {
        const spec = {
            name: 'filter',
            in: 'query' as const,
            style: 'deepObject' as const,
            explode: true,
            valueType: 'object' as const,
        };

        assert.deepEqual(parseQueryParameter(spec, 'filter%5ba%5d=1'), { a: '1' });
    });

    it('accepts URLSearchParams and OpenApiQueryEntry[] input sources', () => {
        const spec = {
            name: 'tags',
            in: 'query' as const,
            style: 'form' as const,
            explode: true,
            valueType: 'array' as const,
        };

        const searchParams = new URLSearchParams('tags=red&tags=blue');
        assert.deepEqual(parseQueryParameter(spec, searchParams), ['red', 'blue']);

        const entries = [
            { name: 'tags', value: 'red' },
            { name: 'tags', value: 'blue' },
        ] as const;
        assert.deepEqual(parseQueryParameter(spec, entries), ['red', 'blue']);
    });

    it('does not double-decode URLSearchParams values', () => {
        const spec = {
            name: 'q',
            in: 'query' as const,
            style: 'form' as const,
            explode: true,
            valueType: 'primitive' as const,
        };

        const searchParams = new URLSearchParams('q=%25');
        assert.equal(parseQueryParameter(spec, searchParams), '%');
    });
});

// OpenAPI v3.1.1 Parameter Object allowReserved (Section 4.8.12.2) + RFC 3986 Sections 2.1 and 2.2.
describe('OpenAPI query allowReserved', () => {
    it('encodes reserved characters by default', () => {
        const spec = {
            name: 'q',
            in: 'query' as const,
            valueType: 'primitive' as const,
        };

        assert.equal(formatQueryParameter(spec, 'a/b?c=d'), 'q=a%2Fb%3Fc%3Dd');
    });

    it('preserves reserved characters when allowReserved=true', () => {
        const spec = {
            name: 'q',
            in: 'query' as const,
            allowReserved: true,
            valueType: 'primitive' as const,
        };

        assert.equal(formatQueryParameter(spec, 'a/b?c=d'), 'q=a/b?c=d');
    });

    it('applies allowReserved to values but still encodes parameter names and object keys', () => {
        const primitiveSpec = {
            name: 'q/name',
            in: 'query' as const,
            allowReserved: true,
            valueType: 'primitive' as const,
        };
        assert.equal(formatQueryParameter(primitiveSpec, 'a/b?c=d'), 'q%2Fname=a/b?c=d');

        const objectSpec = {
            name: 'coords',
            in: 'query' as const,
            style: 'form' as const,
            explode: true,
            allowReserved: true,
            valueType: 'object' as const,
        };
        assert.equal(formatQueryParameter(objectSpec, { 'x/y': 'a/b?c=d' }), 'x%2Fy=a/b?c=d');
    });

    it('preserves allowReserved behavior for query parameter values after shared encoding extraction', () => {
        const spec = {
            name: 'q',
            in: 'query' as const,
            allowReserved: true,
            valueType: 'primitive' as const,
        };

        assert.equal(formatQueryParameter(spec, '%2f:/?#[]@!$&\'()*+,;='), 'q=%252f:/?#[]@!$&\'()*+,;=');
    });
});

// OpenAPI Specification v3.1.1: path styles simple/label/matrix.
describe('OpenAPI path serialization', () => {
    it('formats and parses simple style arrays', () => {
        const spec = {
            name: 'id',
            in: 'path' as const,
            style: 'simple' as const,
            valueType: 'array' as const,
        };

        assert.equal(formatPathParameter(spec, ['3', '4', '5']), '3,4,5');
        assert.deepEqual(parsePathParameter(spec, '3,4,5'), ['3', '4', '5']);
    });

    it('formats label style object with explode=true', () => {
        const spec = {
            name: 'coords',
            in: 'path' as const,
            style: 'label' as const,
            explode: true,
            valueType: 'object' as const,
        };

        assert.equal(formatPathParameter(spec, { y: '20', x: '10' }), '.x=10.y=20');
    });

    it('parses simple style exploded objects as key=value pairs', () => {
        const spec = {
            name: 'coords',
            in: 'path' as const,
            style: 'simple' as const,
            explode: true,
            valueType: 'object' as const,
        };

        assert.deepEqual(parsePathParameter(spec, 'x=10,y=20'), { x: '10', y: '20' });
    });

    it('parses label style values with percent-decoding per component', () => {
        const spec = {
            name: 'coords',
            in: 'path' as const,
            style: 'label' as const,
            explode: false,
            valueType: 'array' as const,
        };

        assert.deepEqual(parsePathParameter(spec, '.a%2Cb,c'), ['a,b', 'c']);
    });

    it('formats matrix style object with explode=false', () => {
        const spec = {
            name: 'coords',
            in: 'path' as const,
            style: 'matrix' as const,
            explode: false,
            valueType: 'object' as const,
        };

        assert.equal(formatPathParameter(spec, { y: '20', x: '10' }), ';coords=x,10,y,20');
    });

    it('rejects extra matrix segments for non-exploded parameters', () => {
        const spec = {
            name: 'id',
            in: 'path' as const,
            style: 'matrix' as const,
            explode: false,
            valueType: 'primitive' as const,
        };

        assert.equal(parsePathParameter(spec, ';id=3;other=4'), null);
    });
});

// OpenAPI Specification v3.1.1: header style=simple.
describe('OpenAPI header serialization', () => {
    it('formats and parses exploded object key=value pairs', () => {
        const spec = {
            name: 'X-Coords',
            in: 'header' as const,
            style: 'simple' as const,
            explode: true,
            valueType: 'object' as const,
        };

        assert.equal(formatHeaderParameter(spec, { y: '20', x: '10' }), 'x=10,y=20');
        assert.deepEqual(parseHeaderParameter(spec, 'x=10,y=20'), { x: '10', y: '20' });
    });
});

// OpenAPI v3.1.1 Parameter Object parsing + RFC 3986 Section 2.1 percent-encoding validity.
describe('OpenAPI parser malformed syntax tolerance', () => {
    it('returns null for malformed query percent-encoding', () => {
        const spec = {
            name: 'q',
            in: 'query' as const,
            valueType: 'primitive' as const,
        };

        assert.equal(parseQueryParameter(spec, 'q=%E0%A4%A'), null);
    });

    it('returns null for malformed percent escapes in shared decode helper call paths', () => {
        const spec = {
            name: 'q',
            in: 'query' as const,
            valueType: 'primitive' as const,
        };

        assert.equal(parseQueryParameter(spec, 'q=%2'), null);
    });

    it('ignores malformed percent-encoding in unrelated query entries when parsing target parameter', () => {
        const primitiveSpec = {
            name: 'q',
            in: 'query' as const,
            valueType: 'primitive' as const,
        };
        assert.equal(parseQueryParameter(primitiveSpec, 'q=ok&bad=%E0%A4%A'), 'ok');

        const deepObjectSpec = {
            name: 'filter',
            in: 'query' as const,
            style: 'deepObject' as const,
            explode: true,
            valueType: 'object' as const,
        };
        assert.deepEqual(parseQueryParameter(deepObjectSpec, 'filter%5Ba%5D=1&bad=%E0%A4%A'), { a: '1' });
    });

    it('returns null for malformed deepObject key syntax', () => {
        const spec = {
            name: 'filter',
            in: 'query' as const,
            style: 'deepObject' as const,
            explode: true,
            valueType: 'object' as const,
        };

        assert.equal(parseQueryParameter(spec, 'filter[a=1'), null);
    });
});

// RFC 6265 + OpenAPI cookie parameters: parse named cookie pair.
describe('OpenAPI cookie parameter extraction', () => {
    it('formats cookie parameter and parses named cookie value', () => {
        const spec = {
            name: 'session',
            in: 'cookie' as const,
            valueType: 'primitive' as const,
        };

        assert.equal(formatCookieParameter(spec, 'abc123'), 'session=abc123');
        assert.equal(parseCookieParameter(spec, 'theme=dark; session=abc123; flag=1'), 'abc123');
    });

    it('returns null when named cookie does not exist', () => {
        const spec = {
            name: 'session',
            in: 'cookie' as const,
            valueType: 'primitive' as const,
        };

        assert.equal(parseCookieParameter(spec, 'theme=dark; flag=1'), null);
    });
});
