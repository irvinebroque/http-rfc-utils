import { Bench } from 'tinybench';
import { cacheControl, parseCacheControl } from '../src/cache.js';
import { formatCacheStatus, parseCacheStatus } from '../src/cache-status.js';
import { formatContentDisposition, parseContentDisposition } from '../src/content-disposition.js';
import { buildCookieHeader, parseCookie, parseSetCookie } from '../src/cookie.js';
import { negotiateEncoding, parseAcceptEncoding } from '../src/encoding.js';
import { evaluateFetchMetadataPolicy, parseFetchMetadata } from '../src/fetch-metadata.js';
import { formatForwarded, parseForwarded } from '../src/forwarded.js';
import { parseHostMeta, parseHostMetaJson } from '../src/host-meta.js';
import { evaluateJsonPointer, fromUriFragment, parseJsonPointer, toUriFragment } from '../src/json-pointer.js';
import { queryJsonPathNodes } from '../src/jsonpath.js';
import { negotiateLanguage, parseAcceptLanguage } from '../src/language.js';
import { formatLinkHeader, parseLinkHeader } from '../src/link.js';
import { parseApiCatalog, parseLinksetJson } from '../src/linkset.js';
import { getResponseFormat, negotiate } from '../src/negotiate.js';
import { formatPrefer, parsePrefer } from '../src/prefer.js';
import { formatPriority, parsePriority } from '../src/priority.js';
import { formatProxyStatus, parseProxyStatus } from '../src/proxy-status.js';
import { evaluateRange, parseRange } from '../src/range.js';
import { parseRobotsTxt, isAllowed } from '../src/robots.js';
import { parseSecurityTxt, validateSecurityTxt } from '../src/security-txt.js';
import { applySorting } from '../src/sorting.js';
import { parseSfDict, parseSfList, serializeSfDict, serializeSfList } from '../src/structured-fields.js';
import { formatTargetedCacheControl, parseTargetedCacheControl } from '../src/targeted-cache-control.js';
import { addOrUpdateTracestate, parseTraceparent, parseTracestate } from '../src/trace-context.js';
import { normalizeUri, percentDecode } from '../src/uri.js';
import { compileUriTemplate, expandUriTemplate } from '../src/uri-template.js';
import { buildWellKnownUri, isWellKnownUri, parseWellKnownPath } from '../src/well-known.js';
import { filterByRel, parseJrd } from '../src/webfinger.js';

interface BenchmarkCase {
    name: string;
    run: () => void | Promise<void>;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
}

function requireValue<T>(value: T | null | undefined, message: string): T {
    if (value === null || value === undefined) {
        throw new Error(message);
    }

    return value;
}

function buildTree(depth: number, width: number): unknown {
    if (depth === 0) {
        return { value: 1 };
    }

    const out: Record<string, unknown> = {};
    for (let i = 0; i < width; i++) {
        out[`k${i}`] = buildTree(depth - 1, width);
    }
    return out;
}

const benchmarkTimeMs = parsePositiveInteger(process.env.BENCH_TIME_MS, 120);
const benchmarkWarmupMs = parsePositiveInteger(process.env.BENCH_WARMUP_MS, 40);
const cliFilter = process.argv.slice(2).join(' ').trim().toLowerCase();
const envFilter = (process.env.BENCH_FILTER ?? '').trim().toLowerCase();
const benchmarkFilter = cliFilter || envFilter;

const sortingData = Array.from({ length: 20000 }, (_, index) => ({
    id: index,
    user: {
        profile: {
            score: Math.floor(Math.sin(index) * 100000),
            rank: index % 127,
        },
        name: `User${20000 - index}`,
    },
}));

const acceptParts: string[] = [];
for (let i = 0; i < 40; i++) {
    acceptParts.push(`application/vnd.perf.${i}+json;v=${i % 3};q=${((100 - i) / 100).toFixed(2)}`);
}
acceptParts.push('application/json;q=0.8', 'text/csv;q=0.5', '*/*;q=0.1');
const acceptHeader = acceptParts.join(', ');
const supportedMediaTypes = Array.from({ length: 150 }, (_, index) => (
    `application/vnd.perf.${index}+json;v=${index % 3}`
)).concat(['application/json', 'text/csv']);

const languageParts: string[] = [];
for (let i = 0; i < 60; i++) {
    languageParts.push(`x-perf-${i};q=${((100 - (i % 50)) / 100).toFixed(2)}`);
}
languageParts.push('de-DE;q=0.97', 'fr-CA;q=0.98', 'en-US;q=0.99', '*;q=0.10');
const acceptLanguageHeader = languageParts.join(', ');
const supportedLanguages = Array.from({ length: 180 }, (_, index) => `x-target-${index}`).concat([
    'de-DE',
    'fr-CA',
    'en-US',
]);
const parsedLanguageRanges = parseAcceptLanguage(acceptLanguageHeader);

const acceptEncodingHeader = 'zstd;q=1, br;q=0.95, gzip;q=0.85, deflate;q=0.7, identity;q=0.5, *;q=0.1';
const supportedEncodings = ['compress', 'x-custom', 'deflate', 'gzip', 'br', 'identity', 'zstd'];
const parsedEncodingRanges = parseAcceptEncoding(acceptEncodingHeader);

const jsonPathDocument = buildTree(6, 5);
const jsonPointerPath = '/k0/k0/k0/k0/k0/k0/value';
const jsonPointerFragment = toUriFragment(jsonPointerPath);

let robotsText = 'User-agent: *\n';
for (let i = 0; i < 500; i++) {
    robotsText += `Allow: /public/${i}/*\n`;
    robotsText += `Disallow: /private/${i}/*\n`;
}
const robotsConfig = parseRobotsTxt(robotsText);

const apiCatalogJson = JSON.stringify({
    profile: 'https://www.rfc-editor.org/info/rfc9727',
    linkset: Array.from({ length: 400 }, (_, i) => ({
        anchor: `https://api.example.com/${i}`,
        item: [{ href: `https://api.example.com/${i}/resource`, type: 'application/json' }],
    })),
});

const linksetJson = JSON.stringify({
    linkset: Array.from({ length: 300 }, (_, i) => ({
        anchor: `https://api.example.com/${i}`,
        item: [
            {
                href: `https://api.example.com/${i}/resource`,
                type: 'application/json',
                title: `Resource ${i}`,
            },
        ],
        'service-doc': [
            {
                href: `https://docs.example.com/${i}`,
                type: 'text/html',
            },
        ],
    })),
});

const linkHeaderParts: string[] = [];
for (let i = 0; i < 180; i++) {
    linkHeaderParts.push(
        `<https://api.example.com/resources/${i}>; rel="item"; type="application/json"; title="Resource ${i}"`
    );
}
linkHeaderParts.push(
    '<https://api.example.com/resources?page=1>; rel="first"',
    '<https://api.example.com/resources?page=90>; rel="last"'
);
const linkHeader = linkHeaderParts.join(', ');
const parsedLinks = parseLinkHeader(linkHeader);

const cacheControlHeader = [
    'public',
    'max-age=86400',
    's-maxage=7200',
    'stale-while-revalidate=120',
    'stale-if-error=86400',
    'immutable',
    'no-cache="set-cookie"',
].join(', ');

const targetedCacheControlHeader = ['public', 'max-age=300', 'stale-while-revalidate=30', 'stale-if-error=120'].join(', ');

const targetedCacheControlValue = {
    public: true,
    maxAge: 300,
    staleWhileRevalidate: 30,
    staleIfError: 120,
    immutable: true,
};

const preferParts: string[] = [];
for (let i = 0; i < 80; i++) {
    preferParts.push(`x-perf-${i}=v${i};priority=${i % 5}`);
}
preferParts.push('respond-async', 'wait=10', 'return=representation');
const preferHeader = preferParts.join(', ');
const parsedPrefer = parsePrefer(preferHeader);

const forwardedParts: string[] = [];
for (let i = 0; i < 120; i++) {
    forwardedParts.push(`for=192.0.2.${i % 250};proto=https;host="api${i}.example.com";by=_edge${i}`);
}
const forwardedHeader = forwardedParts.join(', ');
const parsedForwarded = parseForwarded(forwardedHeader);

const contentDispositionHeader = [
    'attachment',
    'filename="quarterly-report-2026.csv"',
    "filename*=UTF-8''quarterly-report-2026.csv",
    'creation-date="Wed, 12 Feb 2025 16:29:00 GMT"',
    'size=1048576',
].join('; ');

const cookieHeader = Array.from({ length: 300 }, (_, index) => `k${index}=v${index}`).join('; ');
const setCookieHeader = ['session=rfc-perf-token', 'Path=/', 'HttpOnly', 'Secure', 'Max-Age=7200', 'SameSite=Lax'].join('; ');

const now = new Date('2026-02-01T00:00:00.000Z');
const storedCookies = Array.from({ length: 160 }, (_, index) => ({
    name: `c${index}`,
    value: `v${index}`,
    domain: 'example.com',
    path: index % 2 === 0 ? '/' : `/app/${index % 8}`,
    creationTime: new Date(1700000000000 + index * 1000),
    expires: new Date(now.getTime() + 60 * 60 * 1000),
    secureOnly: index % 3 === 0,
    httpOnly: index % 2 === 0,
    hostOnly: false,
}));

const cacheStatusParts: string[] = [];
for (let i = 0; i < 90; i++) {
    cacheStatusParts.push(`cache-${i};hit;ttl=${120 + (i % 60)};fwd=uri-miss;fwd-status=503;detail="stale-${i}"`);
}
const cacheStatusHeader = cacheStatusParts.join(', ');
const parsedCacheStatus = requireValue(parseCacheStatus(cacheStatusHeader), 'Invalid Cache-Status benchmark fixture');

const proxyStatusParts: string[] = [];
for (let i = 0; i < 60; i++) {
    proxyStatusParts.push(
        `proxy-${i};error=destination_unavailable;next-hop=origin-${i}.example.com;received-status=503;details="timeout-${i}"`
    );
}
const proxyStatusHeader = proxyStatusParts.join(', ');
const parsedProxyStatus = requireValue(parseProxyStatus(proxyStatusHeader), 'Invalid Proxy-Status benchmark fixture');

const priorityHeader = 'u=2, i';
const parsedPriority = requireValue(parsePriority(priorityHeader), 'Invalid Priority benchmark fixture');

const fetchMetadataHeaders = {
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
};
const parsedFetchMetadata = parseFetchMetadata(fetchMetadataHeaders);
const strictFetchPolicy = {
    strict: true,
    allowCrossSite: false,
    allowTopLevelNavigation: true,
    requireUserActivationForCrossSiteNavigation: true,
};

const traceparentHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
const tracestateHeader = Array.from({ length: 24 }, (_, index) => `vendor${index}=v${index}`).join(',');
const parsedTracestate = requireValue(parseTracestate(tracestateHeader), 'Invalid tracestate benchmark fixture');

const sfListHeader = Array.from({ length: 120 }, (_, index) => `${index};foo=?1;bar="${index}"`).join(', ');
const sfDictHeader = Array.from({ length: 120 }, (_, index) => `k${index}=${index};flag`).join(', ');
const parsedSfListValue = requireValue(parseSfList(sfListHeader), 'Invalid SF list benchmark fixture');
const parsedSfDictValue = requireValue(parseSfDict(sfDictHeader), 'Invalid SF dict benchmark fixture');

const rangeHeader = 'bytes=0-99,200-399,500-799,1000-1499,2000-2499,-128';
const rangeRequest = new Request('https://cdn.example.com/archive.bin', {
    method: 'GET',
    headers: {
        Range: rangeHeader,
        'If-Range': '"rfc-perf-etag"',
    },
});

const unicodePathologicalDecodeInput = `%20${'e'.repeat(1000)}${'x'.repeat(1000)}%2F${'y'.repeat(1000)}`;
const normalizeUriInput = 'HTTP://Example.COM:80/a/../b/%7Euser?q=1#frag';

const uriTemplate = '/search{?q,lang,region,tags*}';
const compiledUriTemplate = requireValue(compileUriTemplate(uriTemplate), 'Invalid URI template benchmark fixture');
const uriTemplateVars = {
    q: 'cafe and restaurants',
    lang: 'en-US',
    region: 'us-east-1',
    tags: ['food', 'city', 'travel'],
};

let securityTxtDocument = 'Contact: mailto:security@example.com\nExpires: 2026-12-31T23:59:59.000Z\n';
for (let i = 0; i < 120; i++) {
    securityTxtDocument += `Canonical: https://example.com/.well-known/security-${i}.txt\n`;
    securityTxtDocument += `Policy: https://example.com/policy/${i}\n`;
}
const parsedSecurityTxt = parseSecurityTxt(securityTxtDocument);

const jrdJson = JSON.stringify({
    subject: 'acct:perf@example.com',
    aliases: ['https://example.com/@perf'],
    links: Array.from({ length: 320 }, (_, index) => ({
        rel: index % 2 === 0 ? 'self' : 'alternate',
        href: `https://example.com/resource/${index}`,
        type: 'application/json',
    })),
});
const parsedJrd = parseJrd(jrdJson);

const hostMetaXmlLinks = Array.from(
    { length: 260 },
    (_, index) => `  <Link rel="lrdd" type="application/jrd+json" template="https://example.com/.well-known/webfinger?resource={uri}&index=${index}"/>`
).join('\n');
const hostMetaXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">',
    hostMetaXmlLinks,
    '</XRD>',
].join('\n');

const hostMetaJson = JSON.stringify({
    links: Array.from({ length: 260 }, (_, index) => ({
        rel: 'lrdd',
        type: 'application/jrd+json',
        template: `https://example.com/.well-known/webfinger?resource={uri}&index=${index}`,
    })),
});

const wellKnownSuffixes = Array.from({ length: 120 }, (_, index) => `resource-${index}`);

const benchmarkCases: BenchmarkCase[] = [
    {
        name: 'sorting.applySorting nested fields',
        run: () => {
            applySorting(sortingData, '-user.profile.score,user.name,user.profile.rank');
        },
    },
    {
        name: 'negotiate.negotiate large matrix',
        run: () => {
            negotiate(acceptHeader, supportedMediaTypes);
        },
    },
    {
        name: 'negotiate.getResponseFormat',
        run: () => {
            getResponseFormat('application/json;q=1, text/csv;q=0.5, */*;q=0.1');
        },
    },
    {
        name: 'language.parseAcceptLanguage',
        run: () => {
            parseAcceptLanguage(acceptLanguageHeader);
        },
    },
    {
        name: 'language.negotiateLanguage',
        run: () => {
            negotiateLanguage(parsedLanguageRanges, supportedLanguages);
        },
    },
    {
        name: 'encoding.parseAcceptEncoding',
        run: () => {
            parseAcceptEncoding(acceptEncodingHeader);
        },
    },
    {
        name: 'encoding.negotiateEncoding',
        run: () => {
            negotiateEncoding(parsedEncodingRanges, supportedEncodings);
        },
    },
    {
        name: 'jsonpath.queryJsonPathNodes $..*',
        run: () => {
            queryJsonPathNodes('$..*', jsonPathDocument);
        },
    },
    {
        name: 'json-pointer.evaluateJsonPointer',
        run: () => {
            evaluateJsonPointer(jsonPointerPath, jsonPathDocument);
            parseJsonPointer(jsonPointerPath);
            fromUriFragment(jsonPointerFragment);
        },
    },
    {
        name: 'robots.isAllowed repeated checks',
        run: () => {
            isAllowed(robotsConfig, 'ExampleBot/1.0', '/private/499/secret');
        },
    },
    {
        name: 'linkset.parseApiCatalog large input',
        run: () => {
            parseApiCatalog(apiCatalogJson);
        },
    },
    {
        name: 'linkset.parseLinksetJson large input',
        run: () => {
            parseLinksetJson(linksetJson);
        },
    },
    {
        name: 'link.parseLinkHeader long header',
        run: () => {
            parseLinkHeader(linkHeader);
        },
    },
    {
        name: 'link.formatLinkHeader long list',
        run: () => {
            formatLinkHeader(parsedLinks);
        },
    },
    {
        name: 'cache.parseCacheControl directives',
        run: () => {
            parseCacheControl(cacheControlHeader);
        },
    },
    {
        name: 'cache.cacheControl formatter',
        run: () => {
            cacheControl({
                public: true,
                maxAge: 3600,
                sMaxAge: 600,
                staleWhileRevalidate: 30,
                staleIfError: 120,
                immutable: true,
                mustRevalidate: true,
            });
        },
    },
    {
        name: 'targeted-cache-control.parseTargetedCacheControl',
        run: () => {
            parseTargetedCacheControl(targetedCacheControlHeader);
        },
    },
    {
        name: 'targeted-cache-control.formatTargetedCacheControl',
        run: () => {
            formatTargetedCacheControl(targetedCacheControlValue);
        },
    },
    {
        name: 'prefer.parsePrefer long header',
        run: () => {
            parsePrefer(preferHeader);
        },
    },
    {
        name: 'prefer.formatPrefer long map',
        run: () => {
            formatPrefer(parsedPrefer);
        },
    },
    {
        name: 'forwarded.parseForwarded chain',
        run: () => {
            parseForwarded(forwardedHeader);
        },
    },
    {
        name: 'forwarded.formatForwarded chain',
        run: () => {
            formatForwarded(parsedForwarded);
        },
    },
    {
        name: 'content-disposition.parseContentDisposition',
        run: () => {
            parseContentDisposition(contentDispositionHeader);
        },
    },
    {
        name: 'content-disposition.formatContentDisposition',
        run: () => {
            formatContentDisposition('attachment', {
                filename: 'quarterly-report-2026.csv',
                filenameStar: {
                    value: 'quarterly-report-2026.csv',
                    language: 'en',
                },
                'x-report-id': 'rfc-perf',
            });
        },
    },
    {
        name: 'cookie.parseCookie many pairs',
        run: () => {
            parseCookie(cookieHeader);
        },
    },
    {
        name: 'cookie.parseSetCookie rich attrs',
        run: () => {
            parseSetCookie(setCookieHeader);
        },
    },
    {
        name: 'cookie.buildCookieHeader selection',
        run: () => {
            buildCookieHeader(storedCookies, 'https://example.com/app/5/dashboard', { now, isSecure: true });
        },
    },
    {
        name: 'cache-status.parseCacheStatus',
        run: () => {
            parseCacheStatus(cacheStatusHeader);
        },
    },
    {
        name: 'cache-status.formatCacheStatus',
        run: () => {
            formatCacheStatus(parsedCacheStatus);
        },
    },
    {
        name: 'proxy-status.parseProxyStatus',
        run: () => {
            parseProxyStatus(proxyStatusHeader);
        },
    },
    {
        name: 'proxy-status.formatProxyStatus',
        run: () => {
            formatProxyStatus(parsedProxyStatus);
        },
    },
    {
        name: 'priority.parsePriority',
        run: () => {
            parsePriority(priorityHeader);
        },
    },
    {
        name: 'priority.formatPriority',
        run: () => {
            formatPriority(parsedPriority);
        },
    },
    {
        name: 'fetch-metadata.parseFetchMetadata',
        run: () => {
            parseFetchMetadata(fetchMetadataHeaders);
        },
    },
    {
        name: 'fetch-metadata.evaluateFetchMetadataPolicy',
        run: () => {
            evaluateFetchMetadataPolicy(parsedFetchMetadata, strictFetchPolicy);
        },
    },
    {
        name: 'trace-context.parseTraceparent',
        run: () => {
            parseTraceparent(traceparentHeader);
        },
    },
    {
        name: 'trace-context.parseTracestate',
        run: () => {
            parseTracestate(tracestateHeader);
        },
    },
    {
        name: 'trace-context.addOrUpdateTracestate',
        run: () => {
            addOrUpdateTracestate(parsedTracestate, 'vendor-new', 'v-new', traceparentHeader);
        },
    },
    {
        name: 'structured-fields.parseSfList',
        run: () => {
            parseSfList(sfListHeader);
        },
    },
    {
        name: 'structured-fields.serializeSfList',
        run: () => {
            serializeSfList(parsedSfListValue);
        },
    },
    {
        name: 'structured-fields.parseSfDict',
        run: () => {
            parseSfDict(sfDictHeader);
        },
    },
    {
        name: 'structured-fields.serializeSfDict',
        run: () => {
            serializeSfDict(parsedSfDictValue);
        },
    },
    {
        name: 'range.parseRange',
        run: () => {
            parseRange(rangeHeader);
        },
    },
    {
        name: 'range.evaluateRange',
        run: () => {
            evaluateRange(rangeRequest, 5000, '"rfc-perf-etag"', new Date('2026-01-01T00:00:00.000Z'));
        },
    },
    {
        name: 'uri.percentDecode mixed input',
        run: () => {
            percentDecode(unicodePathologicalDecodeInput);
        },
    },
    {
        name: 'uri.normalizeUri',
        run: () => {
            normalizeUri(normalizeUriInput);
        },
    },
    {
        name: 'uri-template.expandUriTemplate',
        run: () => {
            expandUriTemplate(uriTemplate, uriTemplateVars);
        },
    },
    {
        name: 'uri-template.compiled.expand',
        run: () => {
            compiledUriTemplate.expand(uriTemplateVars);
        },
    },
    {
        name: 'security-txt.parseSecurityTxt',
        run: () => {
            parseSecurityTxt(securityTxtDocument);
        },
    },
    {
        name: 'security-txt.validateSecurityTxt',
        run: () => {
            validateSecurityTxt(parsedSecurityTxt);
        },
    },
    {
        name: 'webfinger.parseJrd',
        run: () => {
            parseJrd(jrdJson);
        },
    },
    {
        name: 'webfinger.filterByRel',
        run: () => {
            filterByRel(parsedJrd, ['self']);
        },
    },
    {
        name: 'host-meta.parseHostMeta XML',
        run: () => {
            parseHostMeta(hostMetaXml);
        },
    },
    {
        name: 'host-meta.parseHostMetaJson',
        run: () => {
            parseHostMetaJson(hostMetaJson);
        },
    },
    {
        name: 'well-known.path-and-uri utilities',
        run: () => {
            for (const suffix of wellKnownSuffixes) {
                parseWellKnownPath(`/.well-known/${suffix}`);
                const uri = buildWellKnownUri('https://example.com', suffix);
                isWellKnownUri(uri);
            }
        },
    },
];

const selectedCases = benchmarkFilter
    ? benchmarkCases.filter((benchmarkCase) => benchmarkCase.name.toLowerCase().includes(benchmarkFilter))
    : benchmarkCases;

if (selectedCases.length === 0) {
    console.error(`No benchmark cases matched filter "${benchmarkFilter}".`);
    process.exitCode = 1;
} else {
    const bench = new Bench({
        name: 'http-rfc-utils benchmark suite',
        time: benchmarkTimeMs,
        warmupTime: benchmarkWarmupMs,
    });

    for (const benchmarkCase of selectedCases) {
        bench.add(benchmarkCase.name, benchmarkCase.run);
    }

    console.log(`${bench.name}\n`);
    console.log(`cases: ${selectedCases.length}  time: ${benchmarkTimeMs}ms  warmup: ${benchmarkWarmupMs}ms`);
    if (benchmarkFilter) {
        console.log(`filter: "${benchmarkFilter}"`);
    }
    console.log('');

    await bench.run();
    console.table(bench.table());
}
