import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SfDisplayString } from '../src/types.js';
import {
    parseLinkTemplateHeader,
    formatLinkTemplateHeader,
    expandLinkTemplate,
    resolveTemplateVariableUri,
} from '../src/link-template.js';

// RFC 9652 §2: Link-Template is an SF List of Strings with parameters.
describe('parseLinkTemplateHeader', () => {
    it('parses sf-string members and constrained string parameters', () => {
        const parsed = parseLinkTemplateHeader('"/{username}"; rel="item"; anchor="#me"; var-base="/vars/"; title="Profile"');
        assert.ok(parsed);
        assert.equal(parsed.length, 1);
        assert.deepEqual(parsed[0], {
            template: '/{username}',
            rel: 'item',
            anchor: '#me',
            varBase: '/vars/',
            params: {
                title: 'Profile',
            },
        });
    });

    // RFC 9652 §2 + RFC 9651 §3.1: invalid SF syntax fails parsing.
    it('returns null for invalid structured field syntax', () => {
        assert.equal(parseLinkTemplateHeader('"/users/{id}"; rel="item",'), null);
    });

    // RFC 9652 §2: each list member must be an SF String.
    it('returns null when a member bare item is not an SF string', () => {
        assert.equal(parseLinkTemplateHeader('token; rel="item"'), null);
    });

    // RFC 9652 §2: rel/anchor/var-base values MUST be Strings.
    it('returns null when rel, anchor, or var-base are not SF strings', () => {
        assert.equal(parseLinkTemplateHeader('"/users/{id}"; rel=?1'), null);
        assert.equal(parseLinkTemplateHeader('"/users/{id}"; anchor=:AQI=:'), null);
        assert.equal(parseLinkTemplateHeader('"/users/{id}"; var-base=123'), null);
    });

    // RFC 9652 §2: other target attributes are preserved for forward compatibility.
    it('preserves unknown parameters including Display String values', () => {
        const parsed = parseLinkTemplateHeader('"/author"; rel="author"; title=%"Bj%c3%b6rn"; x-priority=1');
        assert.ok(parsed);
        assert.equal(parsed.length, 1);
        assert.ok(parsed[0].params?.title instanceof SfDisplayString);
        assert.equal((parsed[0].params?.title as SfDisplayString).value, 'Björn');
        assert.equal(parsed[0].params?.['x-priority'], 1);
    });
});

describe('formatLinkTemplateHeader', () => {
    // RFC 9652 §2: non-ASCII target attributes MUST use Display String.
    it('serializes non-ASCII target attributes as Display Strings', () => {
        const value = formatLinkTemplateHeader([
            {
                template: '/author',
                rel: 'author',
                params: {
                    title: 'Björn Järnsida',
                },
            },
        ]);

        assert.equal(value, '"/author";rel="author";title=%"Bj%c3%b6rn J%c3%a4rnsida"');
    });

    it('round-trips through parseLinkTemplateHeader', () => {
        const formatted = formatLinkTemplateHeader([
            {
                template: '/widgets/{widget_id}',
                rel: 'https://example.org/rel/widget',
                varBase: 'https://example.org/vars/',
                params: { type: 'application/json' },
            },
        ]);

        const parsed = parseLinkTemplateHeader(formatted);
        assert.ok(parsed);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].template, '/widgets/{widget_id}');
        assert.equal(parsed[0].rel, 'https://example.org/rel/widget');
        assert.equal(parsed[0].varBase, 'https://example.org/vars/');
        assert.equal(parsed[0].params?.type, 'application/json');
    });
});

describe('expandLinkTemplate', () => {
    // RFC 9652 §2: both target and anchor can contain URI Templates.
    it('expands target and anchor templates and resolves against context', () => {
        const expanded = expandLinkTemplate(
            {
                template: '/books/{book_id}/author',
                rel: 'author',
                anchor: '#{book_id}',
                params: { title: 'Author' },
            },
            { book_id: '42' },
            'https://api.example.test/books'
        );

        assert.deepEqual(expanded, {
            href: 'https://api.example.test/books/42/author',
            rel: 'author',
            anchor: 'https://api.example.test/books#42',
            params: { title: 'Author' },
            variableUris: {
                book_id: 'book_id',
            },
        });
    });

    // RFC 9652 §2.1: variable names resolve via var-base then context when needed.
    it('computes variable URIs using var-base and context', () => {
        const expanded = expandLinkTemplate(
            {
                template: '/widgets/{widget_id}',
                varBase: '/vars/',
            },
            { widget_id: 'abc' },
            'https://example.org/'
        );

        assert.equal(expanded.variableUris.widget_id, 'https://example.org/vars/widget_id');
    });
});

describe('resolveTemplateVariableUri', () => {
    // RFC 9652 §2.1 example: absolute var-base yields global variable URI.
    it('resolves against an absolute var-base URI', () => {
        const variableUri = resolveTemplateVariableUri('widget_id', 'https://example.org/vars/');
        assert.equal(variableUri, 'https://example.org/vars/widget_id');
    });

    // RFC 9652 §2.1 example: relative var-base can be further resolved against context.
    it('resolves relative var-base using context URI in a second step', () => {
        const variableUri = resolveTemplateVariableUri('widget_id', '/vars/', 'https://example.org/');
        assert.equal(variableUri, 'https://example.org/vars/widget_id');
    });
});
