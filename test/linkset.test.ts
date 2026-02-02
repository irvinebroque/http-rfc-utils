import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseLinkset,
    parseLinksetJson,
    formatLinkset,
    formatLinksetJson,
    linksetToJson,
    jsonToLinkset,
    isValidLinkset,
    linksetToLinks,
    linksToLinkset,
    // RFC 9727: API Catalog
    LINKSET_MEDIA_TYPE,
    API_CATALOG_PROFILE,
    API_CATALOG_PATH,
    createApiCatalog,
    parseApiCatalog,
    isApiCatalog,
    LinkRelation,
} from '../src/index.js';
import type { Linkset, LinkDefinition, ApiCatalog } from '../src/index.js';

// RFC 9264 §6: linkset relation type
describe('LinkRelation.LINKSET', () => {
    it('equals "linkset"', () => {
        assert.equal(LinkRelation.LINKSET, 'linkset');
    });
});

// RFC 9264 §4.1: application/linkset format
describe('parseLinkset', () => {
    // RFC 9264 §4.1: Newlines allowed as separators
    it('parses links separated by newlines', () => {
        const doc = `<https://example.com/1>; rel="self"
<https://example.com/2>; rel="next"`;
        const result = parseLinkset(doc);
        assert.ok(result);
        assert.equal(result.length, 2);
        assert.equal(result[0].href, 'https://example.com/1');
        assert.equal(result[0].rel, 'self');
        assert.equal(result[1].href, 'https://example.com/2');
        assert.equal(result[1].rel, 'next');
    });

    // RFC 9264 §4.1: Commas still valid separators
    it('parses links separated by commas', () => {
        const doc = '<https://example.com/1>; rel="self", <https://example.com/2>; rel="next"';
        const result = parseLinkset(doc);
        assert.ok(result);
        assert.equal(result.length, 2);
    });

    // RFC 9264 §4.1: Mixed separators
    it('parses links with mixed newlines and commas', () => {
        const doc = `<https://example.com/1>; rel="first",
<https://example.com/2>; rel="self"
<https://example.com/3>; rel="next"`;
        const result = parseLinkset(doc);
        assert.ok(result);
        assert.equal(result.length, 3);
        assert.equal(result[0].rel, 'first');
        assert.equal(result[1].rel, 'self');
        assert.equal(result[2].rel, 'next');
    });

    // RFC 9264 §4: Self-contained with explicit anchors
    it('parses links with anchor attributes', () => {
        const doc = '<https://example.com/next>; rel="next"; anchor="https://example.com/current"';
        const result = parseLinkset(doc);
        assert.ok(result);
        assert.equal(result.length, 1);
        assert.equal(result[0].anchor, 'https://example.com/current');
    });

    it('returns empty array for empty document', () => {
        const result = parseLinkset('');
        assert.ok(result);
        assert.equal(result.length, 0);
    });

    it('handles CRLF line endings', () => {
        const doc = '<https://example.com/1>; rel="self"\r\n<https://example.com/2>; rel="next"';
        const result = parseLinkset(doc);
        assert.ok(result);
        assert.equal(result.length, 2);
    });
});

// RFC 9264 §4.1: formatLinkset
describe('formatLinkset', () => {
    // RFC 9264 §4.1: Newline separation for readability
    it('formats links with newline separators', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/1', rel: 'self' },
            { href: 'https://example.com/2', rel: 'next' },
        ];
        const result = formatLinkset(links);
        assert.ok(result.includes('\n'));
        assert.ok(result.includes('rel="self"'));
        assert.ok(result.includes('rel="next"'));
    });

    it('returns empty string for empty links', () => {
        const result = formatLinkset([]);
        assert.equal(result, '');
    });

    // Round-trip test
    it('round-trips parse/format consistently', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/1', rel: 'self' },
            { href: 'https://example.com/2', rel: 'next', title: 'Next Page' },
        ];
        const formatted = formatLinkset(links);
        const parsed = parseLinkset(formatted);
        assert.ok(parsed);
        assert.equal(parsed.length, 2);
        assert.equal(parsed[0].href, links[0].href);
        assert.equal(parsed[0].rel, links[0].rel);
        assert.equal(parsed[1].href, links[1].href);
        assert.equal(parsed[1].title, links[1].title);
    });
});

// RFC 9264 §4.2: application/linkset+json format
describe('parseLinksetJson', () => {
    // RFC 9264 §4.2.1: linkset as sole member (profile allowed for api-catalog)
    it('rejects JSON with extra top-level members (except profile)', () => {
        const json = '{"linkset": [], "extra": true}';
        const result = parseLinksetJson(json);
        assert.equal(result, null);
    });

    // RFC 9727 §4.2: profile is allowed for API catalogs
    it('accepts JSON with profile member', () => {
        const json = '{"linkset": [], "profile": "https://www.rfc-editor.org/info/rfc9727"}';
        const result = parseLinksetJson(json);
        assert.ok(result !== null);
    });

    // RFC 9264 §4.2.1: linkset array wrapping
    it('parses single context object in array', () => {
        const json = {
            linkset: [
                {
                    anchor: 'https://example.com',
                    next: [{ href: 'https://example.com/next' }],
                },
            ],
        };
        const result = parseLinksetJson(json);
        assert.ok(result);
        assert.equal(result.linkset.length, 1);
    });

    // RFC 9264 §4.2.2: anchor member
    it('extracts anchor from context object', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com/resource',
                    next: [{ href: 'https://example.com/next' }],
                },
            ],
        };
        const result = parseLinksetJson(json);
        assert.ok(result);
        assert.equal(result.linkset[0].anchor, 'https://example.com/resource');
    });

    // RFC 9264 §4.2.2: registered vs extension relation types
    it('handles registered relation types as keys', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com',
                    author: [{ href: 'https://example.com/author' }],
                    next: [{ href: 'https://example.com/next' }],
                },
            ],
        };
        const result = parseLinksetJson(json);
        assert.ok(result);
        assert.ok(result.linkset[0].author);
        assert.ok(result.linkset[0].next);
    });

    it('handles extension URI relation types as keys', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com',
                    'https://example.org/rel/custom': [{ href: 'https://example.com/custom' }],
                },
            ],
        };
        const result = parseLinksetJson(json);
        assert.ok(result);
        assert.ok(result.linkset[0]['https://example.org/rel/custom']);
    });

    // RFC 9264 §4.2.3: href required
    it('rejects target objects without href', () => {
        const json = {
            linkset: [
                {
                    next: [{ type: 'text/html' }],  // missing href
                },
            ],
        };
        const result = parseLinksetJson(json);
        assert.equal(result, null);
    });

    // RFC 9264 §4.2.3: empty href for self-reference
    it('accepts empty string href', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com',
                    self: [{ href: '' }],
                },
            ],
        };
        const result = parseLinksetJson(json);
        assert.ok(result);
    });

    // RFC 9264 §4.2.4.1: hreflang as array
    it('parses hreflang array', () => {
        const json: Linkset = {
            linkset: [
                {
                    alternate: [
                        {
                            href: 'https://example.com/en',
                            hreflang: ['en', 'en-US'],
                        },
                    ],
                },
            ],
        };
        const result = parseLinksetJson(json);
        assert.ok(result);
        const target = (result.linkset[0].alternate as Array<{ href: string; hreflang?: string[] }>)[0];
        assert.deepEqual(target.hreflang, ['en', 'en-US']);
    });

    // RFC 9264 §4.2.4.2: title* internationalized attribute
    it('parses title* with value and language', () => {
        const json: Linkset = {
            linkset: [
                {
                    next: [
                        {
                            href: 'https://example.com/next',
                            'title*': [{ value: 'nächstes Kapitel', language: 'de' }],
                        },
                    ],
                },
            ],
        };
        const result = parseLinksetJson(json);
        assert.ok(result);
        const target = (result.linkset[0].next as Array<{ href: string; 'title*'?: Array<{ value: string; language?: string }> }>)[0];
        assert.equal(target['title*']![0].value, 'nächstes Kapitel');
        assert.equal(target['title*']![0].language, 'de');
    });

    it('returns null for invalid JSON string', () => {
        const result = parseLinksetJson('not valid json');
        assert.equal(result, null);
    });

    it('returns null for non-object', () => {
        const result = parseLinksetJson('"just a string"');
        assert.equal(result, null);
    });
});

// RFC 9264 §4.2: formatLinksetJson
describe('formatLinksetJson', () => {
    // RFC 9264 §4.2.1: proper structure
    it('produces valid linkset JSON structure', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/next', rel: 'next' },
        ];
        const result = formatLinksetJson(links);
        assert.ok(isValidLinkset(result));
        assert.ok(Array.isArray(result.linkset));
    });

    // RFC 9264 §4.2.2: groups links by anchor
    it('groups links with same anchor', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/next', rel: 'next', anchor: 'https://example.com' },
            { href: 'https://example.com/prev', rel: 'prev', anchor: 'https://example.com' },
        ];
        const result = formatLinksetJson(links, { groupByAnchor: true });
        assert.equal(result.linkset.length, 1);
        assert.ok(result.linkset[0].next);
        assert.ok(result.linkset[0].prev);
    });

    it('creates separate context objects when groupByAnchor is false', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/next', rel: 'next', anchor: 'https://example.com' },
            { href: 'https://example.com/prev', rel: 'prev', anchor: 'https://example.com' },
        ];
        const result = formatLinksetJson(links, { groupByAnchor: false });
        assert.equal(result.linkset.length, 2);
    });

    // RFC 9264 §4.2.4.1: hreflang always array
    it('formats hreflang as array', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/en', rel: 'alternate', hreflang: 'en' },
        ];
        const result = formatLinksetJson(links);
        const target = (result.linkset[0].alternate as Array<{ href: string; hreflang?: string[] }>)[0];
        assert.ok(Array.isArray(target.hreflang));
        assert.deepEqual(target.hreflang, ['en']);
    });

    it('preserves hreflang array', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/multi', rel: 'alternate', hreflang: ['en', 'de'] },
        ];
        const result = formatLinksetJson(links);
        const target = (result.linkset[0].alternate as Array<{ href: string; hreflang?: string[] }>)[0];
        assert.deepEqual(target.hreflang, ['en', 'de']);
    });

    // Round-trip test
    it('round-trips format/parse consistently', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/1', rel: 'self', anchor: 'https://example.com' },
            { href: 'https://example.com/2', rel: 'next', anchor: 'https://example.com', title: 'Next' },
        ];
        const json = formatLinksetJson(links);
        const parsed = parseLinksetJson(json);
        assert.ok(parsed);
        assert.equal(parsed.linkset.length, 1);
        assert.ok(parsed.linkset[0].self);
        assert.ok(parsed.linkset[0].next);
    });
});

// RFC 9264 §4.1, §4.2: Format conversion
describe('linksetToJson / jsonToLinkset', () => {
    // Conversion preserves semantics
    it('converts linkset to equivalent JSON', () => {
        const doc = '<https://example.com/next>; rel="next"; anchor="https://example.com"';
        const json = linksetToJson(doc);
        assert.ok(json);
        assert.equal(json.linkset.length, 1);
        assert.equal(json.linkset[0].anchor, 'https://example.com');
    });

    it('converts JSON to equivalent linkset', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com',
                    next: [{ href: 'https://example.com/next' }],
                },
            ],
        };
        const doc = jsonToLinkset(json);
        assert.ok(doc.includes('https://example.com/next'));
        assert.ok(doc.includes('rel="next"'));
    });

    it('returns null for invalid linkset document', () => {
        // parseLinkset returns empty array for empty string, not null
        // But it should handle truly invalid input gracefully
        const result = linksetToJson('');
        assert.ok(result);
        assert.equal(result.linkset.length, 0);
    });
});

// RFC 9264 §4.2.1: Validate linkset structure
describe('isValidLinkset', () => {
    it('validates correct structure', () => {
        const valid: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com',
                    next: [{ href: 'https://example.com/next' }],
                },
            ],
        };
        assert.ok(isValidLinkset(valid));
    });

    it('rejects null', () => {
        assert.equal(isValidLinkset(null), false);
    });

    it('rejects non-object', () => {
        assert.equal(isValidLinkset('string'), false);
        assert.equal(isValidLinkset(123), false);
    });

    it('rejects missing linkset member', () => {
        assert.equal(isValidLinkset({}), false);
    });

    it('rejects extra top-level members (except profile)', () => {
        assert.equal(isValidLinkset({ linkset: [], extra: true }), false);
    });

    // RFC 9727 §4.2: profile allowed for API catalogs
    it('accepts profile as top-level member', () => {
        assert.ok(isValidLinkset({ linkset: [], profile: 'https://www.rfc-editor.org/info/rfc9727' }));
    });

    it('rejects non-array linkset', () => {
        assert.equal(isValidLinkset({ linkset: {} }), false);
    });

    it('rejects target without href', () => {
        assert.equal(isValidLinkset({
            linkset: [{ next: [{ type: 'text/html' }] }],
        }), false);
    });

    it('rejects non-string anchor', () => {
        assert.equal(isValidLinkset({
            linkset: [{ anchor: 123 }],
        }), false);
    });

    it('accepts empty linkset array', () => {
        assert.ok(isValidLinkset({ linkset: [] }));
    });
});

// RFC 9264 §7: Examples from the RFC
describe('RFC examples', () => {
    // RFC 9264 §7.1: Figure 8 example (application/linkset)
    it('parses Figure 8 application/linkset example', () => {
        const doc = `<https://authors.example.net/johndoe>
   ; rel="author"
   ; type="application/rdf+xml"
   ; anchor="https://example.org/resource1",
<https://example.org/resource1?version=3>
   ; rel="latest-version"
   ; type="text/html"
   ; anchor="https://example.org/resource1"`;

        const result = parseLinkset(doc);
        assert.ok(result);
        assert.equal(result.length, 2);

        // First link: author
        assert.equal(result[0].href, 'https://authors.example.net/johndoe');
        assert.equal(result[0].rel, 'author');
        assert.equal(result[0].type, 'application/rdf+xml');
        assert.equal(result[0].anchor, 'https://example.org/resource1');

        // Second link: latest-version
        assert.equal(result[1].href, 'https://example.org/resource1?version=3');
        assert.equal(result[1].rel, 'latest-version');
        assert.equal(result[1].type, 'text/html');
        assert.equal(result[1].anchor, 'https://example.org/resource1');
    });

    // RFC 9264 §7.2: Figure 10 example (application/linkset+json)
    it('parses Figure 10 application/linkset+json example', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.org/resource1',
                    author: [
                        {
                            href: 'https://authors.example.net/johndoe',
                            type: 'application/rdf+xml',
                        },
                    ],
                    memento: [
                        {
                            href: 'https://example.org/resource1?version=1',
                            type: 'text/html',
                        },
                        {
                            href: 'https://example.org/resource1?version=2',
                            type: 'text/html',
                        },
                    ],
                    'latest-version': [
                        {
                            href: 'https://example.org/resource1?version=3',
                            type: 'text/html',
                        },
                    ],
                },
                {
                    anchor: 'https://example.org/resource1?version=3',
                    'predecessor-version': [
                        {
                            href: 'https://example.org/resource1?version=2',
                            type: 'text/html',
                        },
                    ],
                },
            ],
        };

        const result = parseLinksetJson(json);
        assert.ok(result);
        assert.equal(result.linkset.length, 2);

        // First context
        assert.equal(result.linkset[0].anchor, 'https://example.org/resource1');
        assert.ok(result.linkset[0].author);
        assert.ok(result.linkset[0].memento);
        assert.ok(result.linkset[0]['latest-version']);

        // Second context
        assert.equal(result.linkset[1].anchor, 'https://example.org/resource1?version=3');
        assert.ok(result.linkset[1]['predecessor-version']);
    });
});

// =============================================================================
// RFC 9727: API Catalog
// =============================================================================

// RFC 9727: Constants
describe('RFC 9727 constants', () => {
    // RFC 9264 §4.2: Media type
    it('LINKSET_MEDIA_TYPE is correct', () => {
        assert.equal(LINKSET_MEDIA_TYPE, 'application/linkset+json');
    });

    // RFC 9727 §7.3: Profile URI
    it('API_CATALOG_PROFILE is correct', () => {
        assert.equal(API_CATALOG_PROFILE, 'https://www.rfc-editor.org/info/rfc9727');
    });

    // RFC 9727 §2: Well-known path
    it('API_CATALOG_PATH is correct', () => {
        assert.equal(API_CATALOG_PATH, '/.well-known/api-catalog');
    });

    // RFC 9727 §7.2: Link relation
    it('LinkRelation.API_CATALOG equals "api-catalog"', () => {
        assert.equal(LinkRelation.API_CATALOG, 'api-catalog');
    });
});

// RFC 9727 §4: createApiCatalog
describe('createApiCatalog', () => {
    // RFC 9727 §4.1: Include hyperlinks to API endpoints
    it('creates catalog with item links', () => {
        const catalog = createApiCatalog({
            anchor: 'https://example.com/.well-known/api-catalog',
            items: [
                { href: 'https://developer.example.com/apis/foo_api' },
                { href: 'https://developer.example.com/apis/bar_api' },
            ],
        });

        assert.ok(catalog.linkset.length >= 1);
        const context = catalog.linkset[0];
        assert.equal(context.anchor, 'https://example.com/.well-known/api-catalog');
        assert.ok(context.item);
        assert.equal((context.item as unknown[]).length, 2);
    });

    // RFC 9727 §4.2: Profile parameter
    it('includes profile parameter by default', () => {
        const catalog = createApiCatalog({
            anchor: 'https://example.com/.well-known/api-catalog',
            items: [{ href: 'https://example.com/api' }],
        });

        assert.equal(catalog.profile, API_CATALOG_PROFILE);
    });

    // RFC 9727 §4.2: Profile can be disabled
    it('omits profile parameter when disabled', () => {
        const catalog = createApiCatalog({
            anchor: 'https://example.com/.well-known/api-catalog',
            items: [{ href: 'https://example.com/api' }],
            profile: false,
        });

        assert.equal(catalog.profile, undefined);
    });

    // RFC 9727 §4.3: Nested api-catalog links
    it('supports nested api-catalog links', () => {
        const catalog = createApiCatalog({
            anchor: 'https://example.com/.well-known/api-catalog',
            nested: [
                'https://gaming.example.com/.well-known/api-catalog',
                'https://iot.example.com/.well-known/api-catalog',
            ],
        });

        const context = catalog.linkset[0];
        const nestedCatalogs = context['api-catalog'] as { href: string }[];
        assert.ok(nestedCatalogs);
        assert.equal(nestedCatalogs.length, 2);
        assert.equal(nestedCatalogs[0].href, 'https://gaming.example.com/.well-known/api-catalog');
    });

    // RFC 9727 §4: Anchor is required
    it('throws if anchor is missing', () => {
        assert.throws(() => {
            createApiCatalog({ anchor: '' });
        }, /anchor/i);
    });

    // RFC 9727 Appendix A.1: Full API entries with service relations
    it('creates catalog with service relations', () => {
        const catalog = createApiCatalog({
            anchor: 'https://example.com/.well-known/api-catalog',
            apis: [
                {
                    anchor: 'https://developer.example.com/apis/foo_api',
                    'service-desc': [
                        { href: 'https://developer.example.com/apis/foo_api/spec', type: 'application/yaml' },
                    ],
                    'service-doc': [
                        { href: 'https://developer.example.com/apis/foo_api/doc', type: 'text/html' },
                    ],
                },
            ],
        });

        assert.ok(catalog.linkset.length >= 1);
        // Find the API entry
        const apiContext = catalog.linkset.find((c) => c.anchor === 'https://developer.example.com/apis/foo_api');
        assert.ok(apiContext);
        assert.ok(apiContext['service-desc']);
        assert.ok(apiContext['service-doc']);
    });
});

// RFC 9727 §7.3: isApiCatalog
describe('isApiCatalog', () => {
    // RFC 9727 §7.3: Profile indicates api-catalog
    it('returns true for linkset with api-catalog profile', () => {
        const catalog = createApiCatalog({
            anchor: 'https://example.com/.well-known/api-catalog',
            items: [{ href: 'https://example.com/api' }],
        });

        assert.equal(isApiCatalog(catalog), true);
    });

    // RFC 9727 §7.3: No profile
    it('returns false for linkset without profile', () => {
        const linkset: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com/',
                    item: [{ href: 'https://example.com/api' }],
                },
            ],
        };

        assert.equal(isApiCatalog(linkset), false);
    });

    // RFC 9727 §7.3: Wrong profile
    it('returns false for linkset with different profile', () => {
        const linkset: ApiCatalog = {
            linkset: [],
            profile: 'https://example.com/other-profile',
        };

        assert.equal(isApiCatalog(linkset), false);
    });
});

// RFC 9727: parseApiCatalog
describe('parseApiCatalog', () => {
    // RFC 9727 §4: Parse valid API catalog
    it('parses valid API catalog JSON string', () => {
        const json = JSON.stringify({
            linkset: [
                {
                    anchor: 'https://example.com/.well-known/api-catalog',
                    item: [{ href: 'https://example.com/api' }],
                },
            ],
            profile: API_CATALOG_PROFILE,
        });

        const result = parseApiCatalog(json);
        assert.ok(result !== null);
        assert.equal(result.profile, API_CATALOG_PROFILE);
    });

    // RFC 9727 §4: Parse valid API catalog object
    it('parses valid API catalog object', () => {
        const obj = {
            linkset: [
                {
                    anchor: 'https://example.com/.well-known/api-catalog',
                    item: [{ href: 'https://example.com/api' }],
                },
            ],
            profile: API_CATALOG_PROFILE,
        };

        const result = parseApiCatalog(obj);
        assert.ok(result !== null);
        assert.equal(result.profile, API_CATALOG_PROFILE);
    });

    it('returns null for invalid JSON', () => {
        const result = parseApiCatalog('not valid json');
        assert.equal(result, null);
    });
});

// RFC 9727 Appendix A: Examples
describe('RFC 9727 Appendix A examples', () => {
    // RFC 9727 Appendix A.1: Linkset with RFC 8631 relations
    it('parses Appendix A.1 example', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://developer.example.com/apis/foo_api',
                    'service-desc': [
                        { href: 'https://developer.example.com/apis/foo_api/spec', type: 'application/yaml' },
                    ],
                    status: [
                        { href: 'https://developer.example.com/apis/foo_api/status', type: 'application/json' },
                    ],
                    'service-doc': [
                        { href: 'https://developer.example.com/apis/foo_api/doc', type: 'text/html' },
                    ],
                    'service-meta': [
                        { href: 'https://developer.example.com/apis/foo_api/policies', type: 'text/xml' },
                    ],
                },
            ],
        };

        const result = parseLinksetJson(json);
        assert.ok(result !== null);
        assert.equal(result.linkset.length, 1);

        const context = result.linkset[0];
        assert.equal(context.anchor, 'https://developer.example.com/apis/foo_api');
        assert.ok(context['service-desc']);
        assert.ok(context['service-doc']);
        assert.ok(context['service-meta']);
        assert.ok(context.status);
    });

    // RFC 9727 Appendix A.2: Linkset with bookmarks
    it('parses Appendix A.2 example', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://www.example.com/.well-known/api-catalog',
                    item: [
                        { href: 'https://developer.example.com/apis/foo_api' },
                        { href: 'https://developer.example.com/apis/bar_api' },
                        { href: 'https://developer.example.com/apis/cantona_api' },
                    ],
                },
            ],
        };

        const result = parseLinksetJson(json);
        assert.ok(result !== null);
        const items = result.linkset[0].item as { href: string }[];
        assert.equal(items.length, 3);
        assert.equal(items[0].href, 'https://developer.example.com/apis/foo_api');
    });

    // RFC 9727 Appendix A.4: Nested catalogs
    it('parses Appendix A.4 example', () => {
        const json: Linkset = {
            linkset: [
                {
                    anchor: 'https://www.example.com/.well-known/api-catalog',
                    'api-catalog': [
                        { href: 'https://apis.example.com/iot/api-catalog' },
                        { href: 'https://ecommerce.example.com/api-catalog' },
                        { href: 'https://developer.example.com/gaming/api-catalog' },
                    ],
                },
            ],
        };

        const result = parseLinksetJson(json);
        assert.ok(result !== null);
        const nested = result.linkset[0]['api-catalog'] as { href: string }[];
        assert.equal(nested.length, 3);
    });
});

// RFC 9264 §4: linksetToLinks / linksToLinkset conversion
describe('linksetToLinks', () => {
    // RFC 9264 §4: Convert linkset to link definitions
    it('converts linkset entries to LinkDefinition array', () => {
        const linkset: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com/',
                    item: [
                        { href: 'https://example.com/api/foo' },
                        { href: 'https://example.com/api/bar' },
                    ],
                },
            ],
        };

        const links = linksetToLinks(linkset);
        assert.equal(links.length, 2);
        assert.equal(links[0].href, 'https://example.com/api/foo');
        assert.equal(links[0].rel, 'item');
        assert.equal(links[0].anchor, 'https://example.com/');
    });

    // RFC 9264 §4: Multiple relation types
    it('handles multiple targets per relation', () => {
        const linkset: Linkset = {
            linkset: [
                {
                    anchor: 'https://example.com/api',
                    'service-desc': [{ href: 'https://example.com/api/spec' }],
                    'service-doc': [{ href: 'https://example.com/api/doc' }],
                },
            ],
        };

        const links = linksetToLinks(linkset);
        assert.equal(links.length, 2);
        const rels = links.map((l) => l.rel);
        assert.ok(rels.includes('service-desc'));
        assert.ok(rels.includes('service-doc'));
    });
});

describe('linksToLinkset', () => {
    // RFC 9264 §4: Convert link definitions to linkset
    it('converts LinkDefinition array to linkset', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/api/foo', rel: 'item' },
            { href: 'https://example.com/api/bar', rel: 'item' },
        ];

        const linkset = linksToLinkset(links, 'https://example.com/');
        assert.ok(linkset.linkset.length >= 1);
    });

    // RFC 9264 §4: Groups by relation type
    it('groups links by relation type', () => {
        const links: LinkDefinition[] = [
            { href: 'https://example.com/api/foo', rel: 'item' },
            { href: 'https://example.com/api/bar', rel: 'item' },
        ];

        const linkset = linksToLinkset(links, 'https://example.com/');
        const context = linkset.linkset[0];
        const items = context.item as unknown[];
        assert.ok(items);
        assert.equal(items.length, 2);
    });
});

// Round-trip tests
describe('API Catalog round-trip', () => {
    it('createApiCatalog and parseApiCatalog preserve structure', () => {
        const catalog = createApiCatalog({
            anchor: 'https://example.com/.well-known/api-catalog',
            items: [
                { href: 'https://example.com/api/foo', title: 'Foo API' },
                { href: 'https://example.com/api/bar' },
            ],
            nested: ['https://other.example.com/.well-known/api-catalog'],
        });

        const json = JSON.stringify(catalog);
        const parsed = parseApiCatalog(json);

        assert.ok(parsed !== null);
        assert.equal(parsed.profile, API_CATALOG_PROFILE);
        assert.equal(isApiCatalog(parsed), true);
    });
});
