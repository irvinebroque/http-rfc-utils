import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseJrd,
    formatJrd,
    validateJrd,
    matchResource,
    filterByRel,
    JRD_CONTENT_TYPE,
} from '../src/webfinger.js';
import type { WebFingerResponse } from '../src/types.js';

// RFC 7033 §4: WebFinger JSON Resource Descriptor (JRD).
describe('RFC 7033 WebFinger', () => {
    const sampleJrd: WebFingerResponse = {
        subject: 'acct:bob@example.com',
        aliases: [
            'https://www.example.com/~bob/',
        ],
        properties: {
            'http://example.com/ns/role': 'employee',
        },
        links: [
            {
                rel: 'http://webfinger.net/rel/profile-page',
                type: 'text/html',
                href: 'https://www.example.com/~bob/',
            },
            {
                rel: 'http://webfinger.net/rel/avatar',
                type: 'image/jpeg',
                href: 'https://www.example.com/~bob/avatar.jpg',
            },
        ],
    };

    // RFC 7033 §4.2: Content-Type constant.
    describe('JRD_CONTENT_TYPE', () => {
        it('is application/jrd+json', () => {
            assert.equal(JRD_CONTENT_TYPE, 'application/jrd+json');
        });
    });

    describe('parseJrd', () => {
        it('parses a complete JRD document', () => {
            const json = JSON.stringify(sampleJrd);
            const result = parseJrd(json);
            assert.equal(result.subject, 'acct:bob@example.com');
            assert.deepEqual(result.aliases, ['https://www.example.com/~bob/']);
            assert.equal(result.properties?.['http://example.com/ns/role'], 'employee');
            assert.equal(result.links?.length, 2);
            assert.equal(result.links?.[0].rel, 'http://webfinger.net/rel/profile-page');
        });

        it('parses minimal JRD (subject only)', () => {
            const json = JSON.stringify({ subject: 'acct:alice@example.com' });
            const result = parseJrd(json);
            assert.equal(result.subject, 'acct:alice@example.com');
            assert.equal(result.aliases, undefined);
            assert.equal(result.links, undefined);
        });

        it('throws on missing subject', () => {
            assert.throws(() => parseJrd('{}'), /subject/);
        });

        it('parses links with titles and properties', () => {
            const json = JSON.stringify({
                subject: 'acct:test@example.com',
                links: [{
                    rel: 'self',
                    titles: { 'en': 'My Profile', 'fr': 'Mon profil' },
                    properties: { 'http://example.com/ns/verified': 'true' },
                }],
            });
            const result = parseJrd(json);
            assert.equal(result.links?.[0].titles?.['en'], 'My Profile');
            assert.equal(result.links?.[0].properties?.['http://example.com/ns/verified'], 'true');
        });
    });

    describe('formatJrd', () => {
        it('formats a complete JRD document', () => {
            const json = formatJrd(sampleJrd);
            const parsed = JSON.parse(json);
            assert.equal(parsed.subject, 'acct:bob@example.com');
            assert.equal(parsed.links.length, 2);
        });

        it('omits empty optional fields', () => {
            const response: WebFingerResponse = { subject: 'acct:test@example.com' };
            const json = formatJrd(response);
            const parsed = JSON.parse(json);
            assert.equal(parsed.subject, 'acct:test@example.com');
            assert.equal(parsed.aliases, undefined);
            assert.equal(parsed.links, undefined);
        });

        it('round-trips through parse/format', () => {
            const formatted = formatJrd(sampleJrd);
            const reparsed = parseJrd(formatted);
            assert.equal(reparsed.subject, sampleJrd.subject);
            assert.deepEqual(reparsed.aliases, sampleJrd.aliases);
            assert.equal(reparsed.links?.length, sampleJrd.links?.length);
        });
    });

    // RFC 7033 §4.4: Required members.
    describe('validateJrd', () => {
        it('returns no issues for valid JRD', () => {
            const issues = validateJrd(sampleJrd);
            assert.equal(issues.length, 0);
        });

        it('reports missing subject', () => {
            const response = { subject: '' } as WebFingerResponse;
            const issues = validateJrd(response);
            assert.ok(issues.some(i => i.includes('subject')));
        });

        it('reports link without rel', () => {
            const response: WebFingerResponse = {
                subject: 'acct:test@example.com',
                links: [{ rel: '' }],
            };
            const issues = validateJrd(response);
            assert.ok(issues.some(i => i.includes('rel')));
        });
    });

    // RFC 7033 §4.3: Resource matching.
    describe('matchResource', () => {
        it('matches by direct lookup', () => {
            const resources = new Map<string, WebFingerResponse>();
            resources.set('acct:bob@example.com', sampleJrd);
            const result = matchResource('acct:bob@example.com', resources);
            assert.ok(result);
            assert.equal(result.subject, 'acct:bob@example.com');
        });

        it('matches by subject', () => {
            const resources = new Map<string, WebFingerResponse>();
            resources.set('other-key', sampleJrd);
            const result = matchResource('acct:bob@example.com', resources);
            assert.ok(result);
        });

        it('matches by alias', () => {
            const resources = new Map<string, WebFingerResponse>();
            resources.set('acct:bob@example.com', sampleJrd);
            const result = matchResource('https://www.example.com/~bob/', resources);
            assert.ok(result);
        });

        it('returns null for no match', () => {
            const resources = new Map<string, WebFingerResponse>();
            resources.set('acct:bob@example.com', sampleJrd);
            const result = matchResource('acct:unknown@example.com', resources);
            assert.equal(result, null);
        });

        it('matches with trailing slash normalization', () => {
            const resources = new Map<string, WebFingerResponse>();
            resources.set('https://example.com', sampleJrd);
            const result = matchResource('https://example.com/', resources);
            assert.ok(result);
        });
    });

    // RFC 7033 §4.4: rel parameter filtering.
    describe('filterByRel', () => {
        it('returns all links when rels is empty', () => {
            const filtered = filterByRel(sampleJrd, []);
            assert.equal(filtered.links?.length, 2);
        });

        it('filters to matching rels', () => {
            const filtered = filterByRel(sampleJrd, ['http://webfinger.net/rel/avatar']);
            assert.equal(filtered.links?.length, 1);
            assert.equal(filtered.links?.[0].rel, 'http://webfinger.net/rel/avatar');
        });

        it('returns empty links for no match', () => {
            const filtered = filterByRel(sampleJrd, ['http://nonexistent.example/rel']);
            assert.equal(filtered.links?.length, 0);
        });

        it('preserves non-link fields', () => {
            const filtered = filterByRel(sampleJrd, ['http://webfinger.net/rel/avatar']);
            assert.equal(filtered.subject, sampleJrd.subject);
            assert.deepEqual(filtered.aliases, sampleJrd.aliases);
        });
    });
});
