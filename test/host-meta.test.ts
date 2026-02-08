import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseHostMeta,
    formatHostMeta,
    parseHostMetaJson,
    formatHostMetaJson,
} from '../src/host-meta.js';
import type { HostMeta } from '../src/types.js';

// RFC 6415 §2-3: Host Metadata in XRD and JSON formats.
describe('RFC 6415 Host Metadata', () => {
    const sampleHostMeta: HostMeta = {
        links: [
            {
                rel: 'lrdd',
                type: 'application/jrd+json',
                template: 'https://example.com/.well-known/webfinger?resource={uri}',
            },
        ],
    };

    // RFC 6415 §2: XRD format.
    describe('parseHostMeta (XML)', () => {
        it('parses a basic XRD document', () => {
            const xml = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">',
                '  <Link rel="lrdd" type="application/jrd+json" template="https://example.com/.well-known/webfinger?resource={uri}"/>',
                '</XRD>',
            ].join('\n');

            const result = parseHostMeta(xml);
            assert.equal(result.links.length, 1);
            assert.equal(result.links[0].rel, 'lrdd');
            assert.equal(result.links[0].type, 'application/jrd+json');
            assert.equal(result.links[0].template, 'https://example.com/.well-known/webfinger?resource={uri}');
        });

        it('parses multiple links', () => {
            const xml = [
                '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">',
                '  <Link rel="lrdd" template="https://example.com/webfinger?r={uri}"/>',
                '  <Link rel="alternate" href="https://example.com/" type="text/html"/>',
                '</XRD>',
            ].join('\n');

            const result = parseHostMeta(xml);
            assert.equal(result.links.length, 2);
            assert.equal(result.links[0].rel, 'lrdd');
            assert.equal(result.links[1].rel, 'alternate');
            assert.equal(result.links[1].href, 'https://example.com/');
        });

        it('parses Property elements', () => {
            const xml = [
                '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">',
                '  <Property type="http://example.com/ns/name">Example</Property>',
                '  <Property type="http://example.com/ns/empty"/>',
                '  <Link rel="lrdd" template="https://example.com/wf?r={uri}"/>',
                '</XRD>',
            ].join('\n');

            const result = parseHostMeta(xml);
            assert.ok(result.properties);
            assert.equal(result.properties['http://example.com/ns/name'], 'Example');
            assert.equal(result.properties['http://example.com/ns/empty'], null);
        });

        it('decodes XML entities', () => {
            const xml = [
                '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">',
                '  <Link rel="lrdd" template="https://example.com/wf?resource={uri}&amp;format=json"/>',
                '</XRD>',
            ].join('\n');

            const result = parseHostMeta(xml);
            assert.equal(result.links[0].template, 'https://example.com/wf?resource={uri}&format=json');
        });
    });

    // RFC 6415 §2: XRD formatting.
    describe('formatHostMeta (XML)', () => {
        it('formats a basic host-meta document', () => {
            const xml = formatHostMeta(sampleHostMeta);
            assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
            assert.ok(xml.includes('xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0"'));
            assert.ok(xml.includes('rel="lrdd"'));
            assert.ok(xml.includes('type="application/jrd+json"'));
            assert.ok(xml.includes('template="https://example.com/.well-known/webfinger?resource={uri}"'));
        });

        it('formats properties', () => {
            const config: HostMeta = {
                links: [],
                properties: {
                    'http://example.com/ns/name': 'Test',
                    'http://example.com/ns/null': null,
                },
            };
            const xml = formatHostMeta(config);
            assert.ok(xml.includes('<Property type="http://example.com/ns/name">Test</Property>'));
            assert.ok(xml.includes('<Property type="http://example.com/ns/null"/>'));
        });

        it('encodes XML entities in values', () => {
            const config: HostMeta = {
                links: [{
                    rel: 'lrdd',
                    template: 'https://example.com/wf?resource={uri}&format=json',
                }],
            };
            const xml = formatHostMeta(config);
            assert.ok(xml.includes('&amp;format=json'));
        });

        it('round-trips through parse/format', () => {
            const xml = formatHostMeta(sampleHostMeta);
            const reparsed = parseHostMeta(xml);
            assert.equal(reparsed.links.length, sampleHostMeta.links.length);
            assert.equal(reparsed.links[0].rel, sampleHostMeta.links[0].rel);
            assert.equal(reparsed.links[0].template, sampleHostMeta.links[0].template);
        });
    });

    // RFC 6415 §3: JSON format.
    describe('parseHostMetaJson', () => {
        it('parses a basic JSON document', () => {
            const json = JSON.stringify({
                links: [{
                    rel: 'lrdd',
                    type: 'application/jrd+json',
                    template: 'https://example.com/.well-known/webfinger?resource={uri}',
                }],
            });

            const result = parseHostMetaJson(json);
            assert.equal(result.links.length, 1);
            assert.equal(result.links[0].rel, 'lrdd');
            assert.equal(result.links[0].type, 'application/jrd+json');
        });

        it('parses with properties', () => {
            const json = JSON.stringify({
                properties: { 'http://example.com/ns/name': 'Test' },
                links: [{ rel: 'lrdd', href: 'https://example.com/' }],
            });

            const result = parseHostMetaJson(json);
            assert.ok(result.properties);
            assert.equal(result.properties['http://example.com/ns/name'], 'Test');
        });

        it('handles empty links array', () => {
            const json = JSON.stringify({ links: [] });
            const result = parseHostMetaJson(json);
            assert.equal(result.links.length, 0);
        });
    });

    describe('formatHostMetaJson', () => {
        it('formats a basic JSON document', () => {
            const json = formatHostMetaJson(sampleHostMeta);
            const parsed = JSON.parse(json);
            assert.equal(parsed.links.length, 1);
            assert.equal(parsed.links[0].rel, 'lrdd');
        });

        it('includes properties when present', () => {
            const config: HostMeta = {
                links: [{ rel: 'lrdd', href: 'https://example.com/' }],
                properties: { 'http://example.com/ns/name': 'Test' },
            };
            const json = formatHostMetaJson(config);
            const parsed = JSON.parse(json);
            assert.equal(parsed.properties['http://example.com/ns/name'], 'Test');
        });

        it('omits properties when not present', () => {
            const json = formatHostMetaJson(sampleHostMeta);
            const parsed = JSON.parse(json);
            assert.equal(parsed.properties, undefined);
        });

        it('round-trips through parse/format', () => {
            const json = formatHostMetaJson(sampleHostMeta);
            const reparsed = parseHostMetaJson(json);
            assert.equal(reparsed.links.length, sampleHostMeta.links.length);
            assert.equal(reparsed.links[0].rel, sampleHostMeta.links[0].rel);
        });
    });
});
