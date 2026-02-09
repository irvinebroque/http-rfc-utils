import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, it } from 'node:test';
import {
    parseSfDict,
    parseSfItem,
    parseSfList,
    serializeSfDict,
    serializeSfItem,
    serializeSfList,
} from '../../src/structured-fields.js';
import { formatLinkHeader, parseLinkHeader } from '../../src/link.js';
import { formatForwarded, parseForwarded } from '../../src/forwarded.js';
import { formatContentDisposition, parseContentDisposition } from '../../src/content-disposition.js';
import {
    compileJsonPath,
    isValidJsonPath,
    parseJsonPath,
    queryJsonPath,
    queryJsonPathNodes,
} from '../../src/jsonpath.js';
import { formatSignature, formatSignatureInput, parseSignature, parseSignatureInput } from '../../src/http-signatures.js';
import { formatSetCookie, parseSetCookie } from '../../src/cookie.js';
import { simpleJsonResponse } from '../../src/response.js';
import {
    buildCorsHeaders,
    buildCorsHeadersForOrigin,
    buildStrictCorsHeadersForOrigin,
    isOriginAllowed,
} from '../../src/cors.js';
import {
    formatSecurityTxt,
    parseSecurityTxt,
    validateSecurityTxt,
} from '../../src/security-txt.js';
import {
    formatHostMeta,
    formatHostMetaJson,
    parseHostMeta,
    parseHostMetaJson,
    tryParseHostMetaJson,
} from '../../src/host-meta.js';
import {
    formatJrd,
    parseJrd,
    tryParseJrd,
    validateJrd,
} from '../../src/webfinger.js';
import {
    formatTraceparent,
    formatTracestate,
    parseTraceparent,
    parseTracestate,
} from '../../src/trace-context.js';
import { CachePresets } from '../../src/cache.js';
import type {
    CorsOptions,
    DispositionParams,
    ForwardedElement,
    HostMeta,
    HostMetaLink,
    LinkDefinition,
    SecurityTxt,
    SetCookie,
    Signature,
    SignatureComponent,
    SignatureInput,
    SignatureParams,
    WebFingerLink,
    WebFingerResponse,
} from '../../src/types.js';
import { assertNoControlBytes, assertNullPrototypeRecord } from './invariants.js';
import { runFuzzTarget, withCorpusMutations } from './fast-check-harness.js';
import type { FuzzTarget } from './fast-check-harness.js';

const LOWER_ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
const TOKEN_TAIL_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('');
const SAFE_VALUE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~:/?&=+*%(),;@"[]{}!$| '.split('');
const TRACESTATE_VALUE_CHARS = SAFE_VALUE_CHARS.filter((char) => char !== ',' && char !== '=');
const HEX_CHARS = '0123456789abcdef'.split('');
const HEADER_TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const DERIVED_COMPONENTS = [
    '@method',
    '@target-uri',
    '@authority',
    '@scheme',
    '@request-target',
    '@path',
    '@query',
    '@query-param',
    '@status',
] as const;

const RESERVED_LINK_KEYS = new Set([
    'href',
    'rel',
    'titlelang',
    'hreflang',
    'type',
    'title',
    'media',
    'anchor',
    'rev',
]);

const SAMPLE_DOCUMENT = {
    store: {
        book: [
            { title: 'Sayings of the Century', price: 8.95, author: 'Nigel Rees' },
            { title: 'Sword of Honour', price: 12.99, author: 'Evelyn Waugh' },
            { title: 'Moby Dick', price: 8.99, author: 'Herman Melville' },
        ],
        bicycle: { color: 'red', price: 399 },
    },
    threshold: 10,
};

function stringFromChars(
    chars: readonly string[],
    constraints: { minLength?: number; maxLength: number },
): fc.Arbitrary<string> {
    return fc.array(fc.constantFrom(...chars), constraints).map((parts) => parts.join(''));
}

function hasDefinedProperties(record: Record<string, unknown>): boolean {
    return Object.values(record).some((value) => value !== undefined);
}

function compactRecord<T extends Record<string, unknown>>(record: T): T | undefined {
    return hasDefinedProperties(record) ? record : undefined;
}

function hexArbitrary(length: number): fc.Arbitrary<string> {
    return stringFromChars(HEX_CHARS, {
        minLength: length,
        maxLength: length,
    });
}

function nonZeroHexArbitrary(length: number): fc.Arbitrary<string> {
    return hexArbitrary(length).filter((value) => !/^0+$/.test(value));
}

function isSafeLinkParamName(name: string): boolean {
    if (name.endsWith('*')) {
        const baseName = name.slice(0, -1);
        return HEADER_TOKEN_RE.test(baseName);
    }

    return HEADER_TOKEN_RE.test(name);
}

function containsControlBytes(value: string): boolean {
    return /[\u0000-\u001f\u007f]/.test(value);
}

function isFormatSafeLink(link: LinkDefinition): boolean {
    for (const [key, value] of Object.entries(link)) {
        if (value === undefined) {
            continue;
        }

        if (!RESERVED_LINK_KEYS.has(key.toLowerCase()) && !isSafeLinkParamName(key)) {
            return false;
        }

        if (typeof value === 'string') {
            if (/[\u0000-\u001f\u007f]/.test(value)) {
                return false;
            }
            continue;
        }

        if (!Array.isArray(value)) {
            return false;
        }

        if (value.some((entry) => /[\u0000-\u001f\u007f]/.test(entry))) {
            return false;
        }
    }

    return true;
}

function hasSafeForwardedExtensions(element: ForwardedElement): boolean {
    if (!element.extensions) {
        return true;
    }

    for (const key of Object.keys(element.extensions)) {
        if (!HEADER_TOKEN_RE.test(key)) {
            return false;
        }
    }

    return true;
}

const tokenArbitrary = fc.tuple(
    fc.constantFrom(...LOWER_ALPHA),
    stringFromChars(TOKEN_TAIL_CHARS, { maxLength: 10 }),
).map(([head, tail]) => `${head}${tail}`);

const safeValueArbitrary = stringFromChars(SAFE_VALUE_CHARS, { maxLength: 64 });

const languageTagArbitrary = fc.tuple(
    fc.constantFrom(...LOWER_ALPHA),
    fc.constantFrom(...LOWER_ALPHA),
).map(([a, b]) => `${a}${b}`);

const domainLabelArbitrary = stringFromChars(ALPHANUMERIC, {
    minLength: 1,
    maxLength: 8,
});

const pathSegmentArbitrary = stringFromChars(TOKEN_TAIL_CHARS, {
    minLength: 1,
    maxLength: 8,
});

const queryFragmentArbitrary = stringFromChars(
    [...ALPHANUMERIC, '-', '_', '&', '='],
    { minLength: 1, maxLength: 16 },
);

const uriArbitrary = fc.tuple(
    domainLabelArbitrary,
    domainLabelArbitrary,
    fc.array(pathSegmentArbitrary, { minLength: 1, maxLength: 3 }),
    fc.option(queryFragmentArbitrary, { nil: undefined }),
).map(([left, right, segments, query]) => {
    const base = `https://${left}.${right}/${segments.join('/')}`;
    return query === undefined ? base : `${base}?${query}`;
});

const etagArbitrary = stringFromChars(ALPHANUMERIC, {
    minLength: 1,
    maxLength: 12,
}).map((value) => `"${value}"`);

const sfStringArbitrary = safeValueArbitrary.map((value) => {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
});
const sfIntegerArbitrary = fc.integer({ min: -5_000, max: 5_000 }).map((value) => String(value));
const sfBooleanArbitrary = fc.constantFrom('?0', '?1');
const sfBareArbitrary = fc.oneof(sfStringArbitrary, sfIntegerArbitrary, sfBooleanArbitrary, tokenArbitrary);
const sfParamArbitrary = fc.tuple(tokenArbitrary, sfBareArbitrary).map(([key, value]) => `;${key}=${value}`);
const sfItemArbitrary = fc.tuple(sfBareArbitrary, fc.array(sfParamArbitrary, { maxLength: 2 }))
    .map(([bare, params]) => `${bare}${params.join('')}`);
const sfListArbitrary = fc.array(sfItemArbitrary, { minLength: 1, maxLength: 4 }).map((items) => items.join(', '));
const sfDictArbitrary = fc.array(fc.tuple(tokenArbitrary, sfItemArbitrary), { minLength: 1, maxLength: 4 })
    .map((entries) => entries.map(([key, value]) => `${key}=${value}`).join(', '));
const structuredFieldGrammarArbitrary = fc.oneof(sfItemArbitrary, sfListArbitrary, sfDictArbitrary);

const linkExtensionKeyArbitrary = tokenArbitrary.filter((key) => !RESERVED_LINK_KEYS.has(key));
const linkExtensionValueArbitrary: fc.Arbitrary<string | string[]> = fc.oneof(
    safeValueArbitrary,
    fc.array(safeValueArbitrary, { minLength: 1, maxLength: 2 }),
);

const linkBaseArbitrary = fc.record({
    href: uriArbitrary,
    rel: tokenArbitrary,
    type: fc.option(safeValueArbitrary, { nil: undefined }),
    title: fc.option(safeValueArbitrary, { nil: undefined }),
    media: fc.option(safeValueArbitrary, { nil: undefined }),
    anchor: fc.option(uriArbitrary, { nil: undefined }),
    rev: fc.option(tokenArbitrary, { nil: undefined }),
    hreflang: fc.option(
        fc.oneof(
            languageTagArbitrary,
            fc.array(languageTagArbitrary, { minLength: 1, maxLength: 3 }),
        ),
        { nil: undefined },
    ),
});

const linkDefinitionArbitrary: fc.Arbitrary<LinkDefinition> = fc
    .tuple(
        linkBaseArbitrary,
        fc.dictionary(linkExtensionKeyArbitrary, linkExtensionValueArbitrary, { maxKeys: 3 }),
    )
    .map(([base, extensions]) => ({ ...base, ...extensions }));

const linkHeaderGrammarArbitrary = fc
    .array(linkDefinitionArbitrary, { minLength: 1, maxLength: 3 })
    .map((links) => formatLinkHeader(links));

const forwardedElementArbitrary: fc.Arbitrary<ForwardedElement> = fc.record({
    for: fc.option(safeValueArbitrary, { nil: undefined }),
    by: fc.option(safeValueArbitrary, { nil: undefined }),
    host: fc.option(uriArbitrary, { nil: undefined }),
    proto: fc.option(fc.constantFrom('http', 'https', 'ws', 'wss'), { nil: undefined }),
    extensions: fc.option(fc.dictionary(tokenArbitrary, safeValueArbitrary, { maxKeys: 3 }), { nil: undefined }),
});

const forwardedElementsArbitrary = fc.array(forwardedElementArbitrary, {
    minLength: 1,
    maxLength: 4,
});

const forwardedGrammarArbitrary = forwardedElementsArbitrary.map((elements) => formatForwarded(elements));

const extendedParamValueArbitrary = fc.record({
    value: safeValueArbitrary,
    language: fc.option(languageTagArbitrary, { nil: undefined }),
});

const dispositionParamKeyArbitrary = tokenArbitrary.filter((key) => {
    return key !== 'filename' && key !== 'filenamestar';
});

const dispositionParamsArbitrary: fc.Arbitrary<DispositionParams> = fc
    .record({
        filename: fc.option(safeValueArbitrary, { nil: undefined }),
        filenameStar: fc.option(extendedParamValueArbitrary, { nil: undefined }),
        extraString: fc.dictionary(dispositionParamKeyArbitrary, safeValueArbitrary, { maxKeys: 2 }),
        extraExtended: fc.dictionary(dispositionParamKeyArbitrary, extendedParamValueArbitrary, { maxKeys: 2 }),
    })
    .map(({ filename, filenameStar, extraString, extraExtended }) => {
        const params: DispositionParams = {};

        if (filename !== undefined) {
            params.filename = filename;
        }
        if (filenameStar !== undefined) {
            params.filenameStar = filenameStar;
        }

        for (const [key, value] of Object.entries(extraString)) {
            params[key] = value;
        }
        for (const [key, value] of Object.entries(extraExtended)) {
            params[key] = value;
        }

        return params;
    });

const contentDispositionGrammarArbitrary = fc.tuple(tokenArbitrary, dispositionParamsArbitrary)
    .map(([type, params]) => formatContentDisposition(type, params));

const traceparentGrammarArbitrary = fc.record({
    traceId: nonZeroHexArbitrary(32),
    parentId: nonZeroHexArbitrary(16),
    traceFlags: hexArbitrary(2),
}).map(({ traceId, parentId, traceFlags }) => `00-${traceId}-${parentId}-${traceFlags}`);

const tracestateKeyArbitrary = fc.tuple(
    fc.constantFrom(...LOWER_ALPHA),
    stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789_*/-'.split(''), { maxLength: 12 }),
).map(([head, tail]) => `${head}${tail}`);

const tracestateValueArbitrary = stringFromChars(TRACESTATE_VALUE_CHARS, { maxLength: 32 });

const tracestateEntriesArbitrary = fc.uniqueArray(
    fc.record({
        key: tracestateKeyArbitrary,
        value: tracestateValueArbitrary,
    }),
    {
        minLength: 1,
        maxLength: 6,
        selector: (entry) => entry.key,
    },
);

const tracestateGrammarArbitrary = tracestateEntriesArbitrary.map((entries) => formatTracestate(entries));

const jsonPathSegmentArbitrary = fc.oneof(
    tokenArbitrary.map((name) => `.${name}`),
    tokenArbitrary.map((name) => `['${name}']`),
    fc.constant('.*'),
    fc.constant('[*]'),
    fc.integer({ min: -3, max: 6 }).map((index) => `[${index}]`),
    tokenArbitrary.map((name) => `..${name}`),
    fc.tuple(tokenArbitrary, fc.integer({ min: -10, max: 20 })).map(([name, value]) => `[?@.${name} < ${value}]`),
    fc.tuple(tokenArbitrary, tokenArbitrary).map(([name, value]) => `[?@.${name} == "${value}"]`),
);

const jsonPathGrammarArbitrary = fc.array(jsonPathSegmentArbitrary, { maxLength: 4 })
    .map((segments) => `$${segments.join('')}`);

const signatureComponentParamsArbitrary: fc.Arbitrary<SignatureComponent['params']> = fc
    .record({
        sf: fc.option(fc.constant(true), { nil: undefined }),
        key: fc.option(tokenArbitrary, { nil: undefined }),
        bs: fc.option(fc.constant(true), { nil: undefined }),
        req: fc.option(fc.constant(true), { nil: undefined }),
        tr: fc.option(fc.constant(true), { nil: undefined }),
    })
    .map((params) => compactRecord(params) as SignatureComponent['params']);

const signatureComponentArbitrary: fc.Arbitrary<SignatureComponent> = fc
    .record({
        name: fc.oneof(fc.constantFrom(...DERIVED_COMPONENTS), tokenArbitrary),
        params: fc.option(signatureComponentParamsArbitrary, { nil: undefined }),
    })
    .map(({ name, params }) => {
        if (params === undefined) {
            return { name };
        }
        return { name, params };
    });

const signatureParamsArbitrary: fc.Arbitrary<SignatureParams> = fc
    .record({
        created: fc.option(fc.integer({ min: 0, max: 4_102_444_800 }), { nil: undefined }),
        expires: fc.option(fc.integer({ min: 0, max: 4_102_444_800 }), { nil: undefined }),
        nonce: fc.option(safeValueArbitrary, { nil: undefined }),
        alg: fc.option(tokenArbitrary, { nil: undefined }),
        keyid: fc.option(tokenArbitrary, { nil: undefined }),
        tag: fc.option(tokenArbitrary, { nil: undefined }),
    })
    .map((params) => compactRecord(params) as SignatureParams);

const signatureInputArbitrary: fc.Arbitrary<SignatureInput> = fc
    .record({
        label: tokenArbitrary,
        components: fc.array(signatureComponentArbitrary, { maxLength: 4 }),
        params: fc.option(signatureParamsArbitrary, { nil: undefined }),
    })
    .map(({ label, components, params }) => {
        if (params === undefined) {
            return { label, components };
        }
        return { label, components, params };
    });

const signatureInputsArbitrary = fc.uniqueArray(signatureInputArbitrary, {
    minLength: 1,
    maxLength: 3,
    selector: (input) => input.label,
});

const signatureInputGrammarArbitrary = signatureInputsArbitrary
    .map((inputs) => formatSignatureInput(inputs));

const signatureArbitrary: fc.Arbitrary<Signature> = fc.record({
    label: tokenArbitrary,
    value: fc.uint8Array({ maxLength: 24 }),
});

const signaturesArbitrary = fc.uniqueArray(signatureArbitrary, {
    minLength: 1,
    maxLength: 3,
    selector: (signature) => signature.label,
});

const signatureGrammarArbitrary = signaturesArbitrary.map((signatures) => formatSignature(signatures));

const cookieAttributesArbitrary: fc.Arbitrary<SetCookie['attributes']> = fc
    .record({
        expires: fc.option(
            fc.date({
                min: new Date('2020-01-01T00:00:00.000Z'),
                max: new Date('2035-01-01T00:00:00.000Z'),
            }),
            { nil: undefined },
        ),
        maxAge: fc.option(fc.integer({ min: -3_600, max: 86_400 }), { nil: undefined }),
        domain: fc.option(domainLabelArbitrary.map((label) => `${label}.example`), { nil: undefined }),
        path: fc.option(pathSegmentArbitrary.map((segment) => `/${segment}`), { nil: undefined }),
        secure: fc.option(fc.boolean(), { nil: undefined }),
        httpOnly: fc.option(fc.boolean(), { nil: undefined }),
        extensions: fc.option(
            fc.dictionary(tokenArbitrary, fc.option(safeValueArbitrary, { nil: undefined }), { maxKeys: 2 }),
            { nil: undefined },
        ),
    })
    .map((attributes) => compactRecord(attributes) as SetCookie['attributes']);

const setCookieArbitrary: fc.Arbitrary<SetCookie> = fc
    .record({
        name: tokenArbitrary,
        value: safeValueArbitrary,
        attributes: fc.option(cookieAttributesArbitrary, { nil: undefined }),
    })
    .map(({ name, value, attributes }) => {
        if (attributes === undefined) {
            return { name, value };
        }
        return { name, value, attributes };
    });

const setCookieGrammarArbitrary = setCookieArbitrary.map((cookie) => formatSetCookie(cookie));

const simpleJsonInputArbitrary = fc.record({
    data: fc.jsonValue(),
    etag: fc.option(etagArbitrary, { nil: undefined }),
    lastModified: fc.option(
        fc.date({
            min: new Date('2020-01-01T00:00:00.000Z'),
            max: new Date('2035-01-01T00:00:00.000Z'),
        }),
        { nil: undefined },
    ),
});

const originArbitrary = fc.tuple(domainLabelArbitrary, domainLabelArbitrary)
    .map(([left, right]) => `https://${left}.${right}.example`);

const corsMethodArbitrary = fc.constantFrom('GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE');
const corsHeaderNameArbitrary = fc.constantFrom(
    'Content-Type',
    'Accept',
    'Authorization',
    'If-None-Match',
    'X-Trace-Id',
);

const corsOptionsArbitrary: fc.Arbitrary<CorsOptions> = fc
    .record({
        origin: fc.option(
            fc.oneof(
                fc.constant('*'),
                originArbitrary,
                fc.uniqueArray(originArbitrary, { minLength: 1, maxLength: 4 }),
            ),
            { nil: undefined },
        ),
        methods: fc.option(fc.uniqueArray(corsMethodArbitrary, { minLength: 1, maxLength: 6 }), { nil: undefined }),
        allowHeaders: fc.option(fc.uniqueArray(corsHeaderNameArbitrary, { minLength: 1, maxLength: 5 }), { nil: undefined }),
        exposeHeaders: fc.option(fc.uniqueArray(corsHeaderNameArbitrary, { minLength: 1, maxLength: 5 }), { nil: undefined }),
        vary: fc.option(
            fc.constantFrom('Origin', 'Accept-Encoding', 'Accept-Encoding, Origin', '*'),
            { nil: undefined },
        ),
        credentials: fc.option(fc.boolean(), { nil: undefined }),
        maxAge: fc.option(fc.integer({ min: 0, max: 86_400 }), { nil: undefined }),
    })
    .map((options) => {
        if (options.credentials && (options.origin === undefined || options.origin === '*')) {
            return {
                ...options,
                origin: 'https://api.example',
            };
        }

        return options;
    });

const corsSingleOriginOptionsArbitrary: fc.Arbitrary<CorsOptions> = corsOptionsArbitrary
    .filter((options) => !Array.isArray(options.origin));

const strictCorsOptionsArbitrary: fc.Arbitrary<Omit<CorsOptions, 'origin'>> = fc.record({
    methods: fc.option(fc.uniqueArray(corsMethodArbitrary, { minLength: 1, maxLength: 6 }), { nil: undefined }),
    allowHeaders: fc.option(fc.uniqueArray(corsHeaderNameArbitrary, { minLength: 1, maxLength: 5 }), { nil: undefined }),
    exposeHeaders: fc.option(fc.uniqueArray(corsHeaderNameArbitrary, { minLength: 1, maxLength: 5 }), { nil: undefined }),
    vary: fc.option(fc.constantFrom('Origin', 'Accept-Encoding', 'Accept-Encoding, Origin', '*'), { nil: undefined }),
    credentials: fc.option(fc.boolean(), { nil: undefined }),
    maxAge: fc.option(fc.integer({ min: 0, max: 86_400 }), { nil: undefined }),
});

const strictCorsInputArbitrary = fc.record({
    requestOrigin: fc.option(originArbitrary, { nil: null }),
    allowedOrigins: fc.uniqueArray(originArbitrary, { minLength: 1, maxLength: 4 }),
    options: strictCorsOptionsArbitrary,
});

const securityTxtUriArbitrary = fc.oneof(
    fc.tuple(tokenArbitrary, domainLabelArbitrary).map(([local, domain]) => `mailto:${local}@${domain}.example`),
    uriArbitrary,
);

const securityTxtArbitrary: fc.Arbitrary<SecurityTxt> = fc
    .record({
        contact: fc.array(securityTxtUriArbitrary, { minLength: 1, maxLength: 3 }),
        expires: fc.date({
            min: new Date('2026-01-01T00:00:00.000Z'),
            max: new Date('2035-01-01T00:00:00.000Z'),
        }),
        encryption: fc.option(fc.array(uriArbitrary, { minLength: 1, maxLength: 2 }), { nil: undefined }),
        acknowledgments: fc.option(fc.array(uriArbitrary, { minLength: 1, maxLength: 2 }), { nil: undefined }),
        preferredLanguages: fc.option(
            fc.array(languageTagArbitrary, { minLength: 1, maxLength: 3 }),
            { nil: undefined },
        ),
        canonical: fc.option(fc.array(uriArbitrary, { minLength: 1, maxLength: 2 }), { nil: undefined }),
        policy: fc.option(fc.array(uriArbitrary, { minLength: 1, maxLength: 2 }), { nil: undefined }),
        hiring: fc.option(fc.array(uriArbitrary, { minLength: 1, maxLength: 2 }), { nil: undefined }),
        extensions: fc.option(
            fc.dictionary(
                tokenArbitrary.map((token) => `x-${token}`),
                fc.array(safeValueArbitrary, { minLength: 1, maxLength: 2 }),
                { maxKeys: 3 },
            ),
            { nil: undefined },
        ),
    })
    .map((config) => {
        const result: SecurityTxt = {
            contact: config.contact,
            expires: config.expires,
        };

        if (config.encryption) {
            result.encryption = config.encryption;
        }
        if (config.acknowledgments) {
            result.acknowledgments = config.acknowledgments;
        }
        if (config.preferredLanguages) {
            result.preferredLanguages = config.preferredLanguages;
        }
        if (config.canonical) {
            result.canonical = config.canonical;
        }
        if (config.policy) {
            result.policy = config.policy;
        }
        if (config.hiring) {
            result.hiring = config.hiring;
        }
        if (config.extensions) {
            result.extensions = config.extensions;
        }

        return result;
    });

const securityTxtGrammarArbitrary = securityTxtArbitrary.map((config) => formatSecurityTxt(config));

const hostMetaLinkArbitrary: fc.Arbitrary<HostMetaLink> = fc.record({
    rel: tokenArbitrary,
    type: fc.option(safeValueArbitrary, { nil: undefined }),
    href: fc.option(uriArbitrary, { nil: undefined }),
    template: fc.option(
        uriArbitrary.map((uri) => `${uri}{?resource}`),
        { nil: undefined },
    ),
});

const hostMetaArbitrary: fc.Arbitrary<HostMeta> = fc
    .record({
        links: fc.array(hostMetaLinkArbitrary, { maxLength: 4 }),
        properties: fc.option(
            fc.dictionary(
                uriArbitrary,
                fc.oneof(safeValueArbitrary, fc.constant(null)),
                { maxKeys: 3 },
            ),
            { nil: undefined },
        ),
    })
    .map(({ links, properties }) => {
        if (properties === undefined) {
            return { links };
        }

        return {
            links,
            properties,
        };
    });

const hostMetaXmlGrammarArbitrary = hostMetaArbitrary.map((config) => formatHostMeta(config));
const hostMetaJsonGrammarArbitrary = hostMetaArbitrary.map((config) => formatHostMetaJson(config));

const webFingerLinkArbitrary: fc.Arbitrary<WebFingerLink> = fc
    .record({
        rel: fc.oneof(tokenArbitrary, uriArbitrary),
        type: fc.option(safeValueArbitrary, { nil: undefined }),
        href: fc.option(uriArbitrary, { nil: undefined }),
        titles: fc.option(fc.dictionary(languageTagArbitrary, safeValueArbitrary, { maxKeys: 3 }), { nil: undefined }),
        properties: fc.option(
            fc.dictionary(uriArbitrary, fc.oneof(safeValueArbitrary, fc.constant(null)), { maxKeys: 3 }),
            { nil: undefined },
        ),
    })
    .map(({ rel, type, href, titles, properties }) => {
        const link: WebFingerLink = { rel };

        if (type !== undefined) {
            link.type = type;
        }
        if (href !== undefined) {
            link.href = href;
        }
        if (titles) {
            link.titles = titles;
        }
        if (properties) {
            link.properties = properties;
        }

        return link;
    });

const webFingerResponseArbitrary: fc.Arbitrary<WebFingerResponse> = fc
    .record({
        subject: fc.oneof(tokenArbitrary.map((token) => `acct:${token}@example.com`), uriArbitrary),
        aliases: fc.option(fc.array(uriArbitrary, { minLength: 1, maxLength: 3 }), { nil: undefined }),
        properties: fc.option(
            fc.dictionary(uriArbitrary, fc.oneof(safeValueArbitrary, fc.constant(null)), { maxKeys: 3 }),
            { nil: undefined },
        ),
        links: fc.option(fc.array(webFingerLinkArbitrary, { minLength: 1, maxLength: 4 }), { nil: undefined }),
    })
    .map(({ subject, aliases, properties, links }) => {
        const response: WebFingerResponse = { subject };

        if (aliases) {
            response.aliases = aliases;
        }
        if (properties) {
            response.properties = properties;
        }
        if (links) {
            response.links = links;
        }

        return response;
    });

const webFingerJrdGrammarArbitrary = webFingerResponseArbitrary.map((response) => formatJrd(response));

const parserInputMaxLength = process.env.FUZZ_PROFILE === 'full' ? 1_024 : 256;

function parserInputArbitrary(moduleName: string, grammarArbitrary: fc.Arbitrary<string>): fc.Arbitrary<string> {
    return withCorpusMutations(moduleName, grammarArbitrary, {
        maxLength: parserInputMaxLength,
        includeRandom: true,
    });
}

const parseSfItemTarget: FuzzTarget<string, ReturnType<typeof parseSfItem>> = {
    name: 'parse-sf-item',
    module: 'structured-fields',
    arbitrary: parserInputArbitrary('structured-fields', structuredFieldGrammarArbitrary),
    execute: (input) => parseSfItem(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        const serialized = serializeSfItem(result);
        assertNoControlBytes(serialized, 'Structured Field item serialization');
        assert.deepEqual(parseSfItem(serialized), result);
    },
};

const parseSfListTarget: FuzzTarget<string, ReturnType<typeof parseSfList>> = {
    name: 'parse-sf-list',
    module: 'structured-fields',
    arbitrary: parserInputArbitrary('structured-fields', structuredFieldGrammarArbitrary),
    execute: (input) => parseSfList(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        const serialized = serializeSfList(result);
        assertNoControlBytes(serialized, 'Structured Field list serialization');
        assert.deepEqual(parseSfList(serialized), result);
    },
};

const parseSfDictTarget: FuzzTarget<string, ReturnType<typeof parseSfDict>> = {
    name: 'parse-sf-dict',
    module: 'structured-fields',
    arbitrary: parserInputArbitrary('structured-fields', structuredFieldGrammarArbitrary),
    execute: (input) => parseSfDict(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        const serialized = serializeSfDict(result);
        assertNoControlBytes(serialized, 'Structured Field dictionary serialization');
        assert.deepEqual(parseSfDict(serialized), result);
    },
};

const parseLinkHeaderTarget: FuzzTarget<string, ReturnType<typeof parseLinkHeader>> = {
    name: 'parse-link-header',
    module: 'link',
    arbitrary: parserInputArbitrary('link', linkHeaderGrammarArbitrary),
    execute: (input) => parseLinkHeader(input),
    assertInvariant: (result) => {
        assert.ok(Array.isArray(result));
        for (const link of result) {
            assert.equal(typeof link.href, 'string');
            assert.equal(typeof link.rel, 'string');
        }

        const safeLinks = result.filter(isFormatSafeLink);
        if (safeLinks.length === 0) {
            return;
        }

        const serialized = formatLinkHeader(safeLinks);
        assertNoControlBytes(serialized, 'Link header serialization');
        const reparsed = parseLinkHeader(serialized);
        assert.ok(reparsed.length >= safeLinks.length);
    },
};

const formatLinkHeaderTarget: FuzzTarget<LinkDefinition[], string> = {
    name: 'format-link-header',
    module: 'link',
    arbitrary: fc.array(linkDefinitionArbitrary, { minLength: 1, maxLength: 4 }),
    execute: (links) => formatLinkHeader(links),
    assertInvariant: (result) => {
        assertNoControlBytes(result, 'Link header formatter output');
        const reparsed = parseLinkHeader(result);
        assert.ok(reparsed.length > 0);
    },
};

const parseForwardedTarget: FuzzTarget<string, ReturnType<typeof parseForwarded>> = {
    name: 'parse-forwarded',
    module: 'forwarded',
    arbitrary: parserInputArbitrary('forwarded', forwardedGrammarArbitrary),
    execute: (input) => parseForwarded(input),
    assertInvariant: (result) => {
        assert.ok(Array.isArray(result));
        for (const element of result) {
            if (element.extensions) {
                assertNullPrototypeRecord(element.extensions, 'Forwarded extensions');
            }
        }

        if (
            result.length === 0
            || result.some((element) => !hasSafeForwardedExtensions(element))
            || result.some((element) => [element.for, element.by, element.host, element.proto]
                .some((value) => value !== undefined && containsControlBytes(value)))
            || result.some((element) => {
                if (!element.extensions) {
                    return false;
                }

                return Object.values(element.extensions).some((value) => containsControlBytes(value));
            })
        ) {
            return;
        }

        const serialized = formatForwarded(result);
        assertNoControlBytes(serialized, 'Forwarded serialization');
    },
};

const formatForwardedTarget: FuzzTarget<ForwardedElement[], string> = {
    name: 'format-forwarded',
    module: 'forwarded',
    arbitrary: forwardedElementsArbitrary,
    execute: (elements) => formatForwarded(elements),
    assertInvariant: (result) => {
        assertNoControlBytes(result, 'Forwarded formatter output');
        assert.ok(Array.isArray(parseForwarded(result)));
    },
};

const parseContentDispositionTarget: FuzzTarget<string, ReturnType<typeof parseContentDisposition>> = {
    name: 'parse-content-disposition',
    module: 'content-disposition',
    arbitrary: parserInputArbitrary('content-disposition', contentDispositionGrammarArbitrary),
    execute: (input) => parseContentDisposition(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        assert.equal(typeof result.type, 'string');
        assertNullPrototypeRecord(result.params, 'Content-Disposition params');
    },
};

const formatContentDispositionTarget: FuzzTarget<{ type: string; params: DispositionParams }, string> = {
    name: 'format-content-disposition',
    module: 'content-disposition',
    arbitrary: fc.record({
        type: tokenArbitrary,
        params: dispositionParamsArbitrary,
    }),
    execute: ({ type, params }) => formatContentDisposition(type, params),
    assertInvariant: (result) => {
        assertNoControlBytes(result, 'Content-Disposition formatter output');
        assert.notEqual(parseContentDisposition(result), null);
    },
};

const parseTraceparentTarget: FuzzTarget<string, ReturnType<typeof parseTraceparent>> = {
    name: 'parse-traceparent',
    module: 'traceparent',
    arbitrary: parserInputArbitrary('traceparent', traceparentGrammarArbitrary),
    execute: (input) => parseTraceparent(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        assert.equal(formatTraceparent(result), `${result.version}-${result.traceId}-${result.parentId}-${result.traceFlags}`);
    },
};

const parseTracestateTarget: FuzzTarget<string, ReturnType<typeof parseTracestate>> = {
    name: 'parse-tracestate',
    module: 'tracestate',
    arbitrary: parserInputArbitrary('tracestate', tracestateGrammarArbitrary),
    execute: (input) => parseTracestate(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        const serialized = formatTracestate(result);
        assert.deepEqual(parseTracestate(serialized), result);
    },
};

const parseJsonPathTarget: FuzzTarget<
    string,
    {
        ast: ReturnType<typeof parseJsonPath>;
        values: ReturnType<typeof queryJsonPath>;
        nodes: ReturnType<typeof queryJsonPathNodes>;
    }
> = {
    name: 'parse-jsonpath',
    module: 'jsonpath',
    arbitrary: parserInputArbitrary('jsonpath', jsonPathGrammarArbitrary),
    execute: (input) => {
        const options = {
            maxNodesVisited: 10_000,
            maxDepth: 24,
            maxRegexPatternLength: 64,
            maxRegexInputLength: 64,
            rejectUnsafeRegex: true,
        };

        return {
            ast: parseJsonPath(input),
            values: queryJsonPath(input, SAMPLE_DOCUMENT, options),
            nodes: queryJsonPathNodes(input, SAMPLE_DOCUMENT, options),
        };
    },
    assertInvariant: (result, input) => {
        if (result.ast === null) {
            assert.equal(result.values, null);
            assert.equal(result.nodes, null);
            return;
        }

        assert.equal(isValidJsonPath(input), true);
        assert.notEqual(compileJsonPath(input), null);

        if (result.nodes !== null) {
            for (const node of result.nodes) {
                assert.ok(node.path.startsWith('$'));
            }
        }
    },
};

const parseSignatureInputTarget: FuzzTarget<string, ReturnType<typeof parseSignatureInput>> = {
    name: 'parse-signature-input',
    module: 'signature-input',
    arbitrary: parserInputArbitrary('signature-input', signatureInputGrammarArbitrary),
    execute: (input) => parseSignatureInput(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        const serialized = formatSignatureInput(result);
        const reparsed = parseSignatureInput(serialized);
        assert.notEqual(reparsed, null);
    },
};

const parseSignatureTarget: FuzzTarget<string, ReturnType<typeof parseSignature>> = {
    name: 'parse-signature',
    module: 'signature',
    arbitrary: parserInputArbitrary('signature', signatureGrammarArbitrary),
    execute: (input) => parseSignature(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        const serialized = formatSignature(result);
        const reparsed = parseSignature(serialized);
        assert.deepEqual(reparsed, result);
    },
};

const parseSetCookieTarget: FuzzTarget<string, ReturnType<typeof parseSetCookie>> = {
    name: 'parse-set-cookie',
    module: 'set-cookie',
    arbitrary: parserInputArbitrary('set-cookie', setCookieGrammarArbitrary),
    execute: (input) => parseSetCookie(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        if (result.attributes?.extensions) {
            assertNullPrototypeRecord(result.attributes.extensions, 'Set-Cookie extensions');
        }

        const extensions = result.attributes?.extensions;
        const unsafeExtension = extensions
            ? Object.entries(extensions).some(([key, value]) => {
                if (!HEADER_TOKEN_RE.test(key)) {
                    return true;
                }

                return value !== undefined && containsControlBytes(value);
            })
            : false;

        if (
            !HEADER_TOKEN_RE.test(result.name)
            || containsControlBytes(result.value)
            || (result.attributes?.domain !== undefined && containsControlBytes(result.attributes.domain))
            || (result.attributes?.path !== undefined && containsControlBytes(result.attributes.path))
            || unsafeExtension
        ) {
            return;
        }

        const serialized = formatSetCookie(result);
        assertNoControlBytes(serialized, 'Set-Cookie serialization');
        assert.notEqual(parseSetCookie(serialized), null);
    },
};

const formatSetCookieTarget: FuzzTarget<SetCookie, string> = {
    name: 'format-set-cookie',
    module: 'set-cookie',
    arbitrary: setCookieArbitrary,
    execute: (cookie) => formatSetCookie(cookie),
    assertInvariant: (result) => {
        assertNoControlBytes(result, 'Set-Cookie formatter output');
        assert.notEqual(parseSetCookie(result), null);
    },
};

const simpleJsonResponseTarget: FuzzTarget<
    { data: unknown; etag?: string; lastModified?: Date },
    Response
> = {
    name: 'response-simple-json',
    module: 'response',
    arbitrary: simpleJsonInputArbitrary,
    execute: ({ data, etag, lastModified }) => {
        return simpleJsonResponse(data, etag, lastModified, CachePresets.revalidate);
    },
    assertInvariant: (response) => {
        response.headers.forEach((value, name) => {
            assert.match(name, HEADER_TOKEN_RE);
            assertNoControlBytes(value, `Response header ${name}`);
        });
    },
};

const buildCorsHeadersTarget: FuzzTarget<CorsOptions, Record<string, string>> = {
    name: 'cors-build-headers',
    module: 'cors',
    arbitrary: corsSingleOriginOptionsArbitrary,
    execute: (options) => buildCorsHeaders(options),
    assertInvariant: (headers, input) => {
        for (const [name, value] of Object.entries(headers)) {
            assert.match(name, HEADER_TOKEN_RE);
            assertNoControlBytes(value, `CORS header ${name}`);
        }

        if (input.credentials) {
            assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
        }

        if (typeof input.origin === 'string') {
            assert.equal(headers['Access-Control-Allow-Origin'], input.origin);
        }
    },
};

const buildCorsHeadersForOriginTarget: FuzzTarget<
    { requestOrigin: string | null; options: CorsOptions },
    Record<string, string>
> = {
    name: 'cors-build-for-origin',
    module: 'cors',
    arbitrary: fc.record({
        requestOrigin: fc.option(originArbitrary, { nil: null }),
        options: corsOptionsArbitrary,
    }),
    execute: ({ requestOrigin, options }) => buildCorsHeadersForOrigin(requestOrigin, options),
    assertInvariant: (headers, input) => {
        for (const [name, value] of Object.entries(headers)) {
            assert.match(name, HEADER_TOKEN_RE);
            assertNoControlBytes(value, `CORS origin-aware header ${name}`);
        }

        const allowOrigin = headers['Access-Control-Allow-Origin'];
        if (allowOrigin !== undefined && allowOrigin !== '*') {
            assert.equal(allowOrigin, input.requestOrigin);
        }

        if (
            input.requestOrigin !== null
            && Array.isArray(input.options.origin)
            && isOriginAllowed(input.requestOrigin, input.options)
            && allowOrigin !== undefined
        ) {
            assert.match(headers['Vary'] ?? '', /origin/i);
        }
    },
};

const buildStrictCorsHeadersForOriginTarget: FuzzTarget<
    { requestOrigin: string | null; allowedOrigins: string[]; options: Omit<CorsOptions, 'origin'> },
    Record<string, string>
> = {
    name: 'cors-build-strict-for-origin',
    module: 'cors',
    arbitrary: strictCorsInputArbitrary,
    execute: ({ requestOrigin, allowedOrigins, options }) => {
        return buildStrictCorsHeadersForOrigin(requestOrigin, allowedOrigins, options);
    },
    assertInvariant: (headers, input) => {
        for (const [name, value] of Object.entries(headers)) {
            assert.match(name, HEADER_TOKEN_RE);
            assertNoControlBytes(value, `Strict CORS header ${name}`);
        }

        if (headers['Access-Control-Allow-Origin'] !== undefined) {
            assert.notEqual(input.requestOrigin, null);
            assert.equal(headers['Access-Control-Allow-Origin'], input.requestOrigin);
            assert.match(headers['Vary'] ?? '', /origin/i);
        }
    },
};

const parseSecurityTxtTarget: FuzzTarget<string, ReturnType<typeof parseSecurityTxt>> = {
    name: 'parse-security-txt',
    module: 'security-txt',
    arbitrary: parserInputArbitrary('security-txt', securityTxtGrammarArbitrary),
    execute: (input) => parseSecurityTxt(input),
    assertInvariant: (result) => {
        assert.ok(Array.isArray(result.contact));
        assert.ok(result.expires instanceof Date);
        assert.ok(Array.isArray(validateSecurityTxt(result)));

        if (result.extensions) {
            assertNullPrototypeRecord(result.extensions, 'security.txt extensions');
        }

        if (Number.isNaN(result.expires.getTime())) {
            return;
        }

        const formatted = formatSecurityTxt(result);
        assert.ok(formatted.endsWith('\r\n'));

        const reparsed = parseSecurityTxt(formatted);
        assert.deepEqual(reparsed.contact, result.contact);
        assert.equal(reparsed.expires.toISOString(), result.expires.toISOString());
    },
};

const formatSecurityTxtTarget: FuzzTarget<SecurityTxt, string> = {
    name: 'format-security-txt',
    module: 'security-txt',
    arbitrary: securityTxtArbitrary,
    execute: (config) => formatSecurityTxt(config),
    assertInvariant: (result, input) => {
        assert.ok(result.endsWith('\r\n'));

        const reparsed = parseSecurityTxt(result);
        assert.deepEqual(reparsed.contact, input.contact);
        assert.equal(reparsed.expires.toISOString(), input.expires.toISOString());
        assert.ok(Array.isArray(validateSecurityTxt(reparsed)));

        if (reparsed.extensions) {
            assertNullPrototypeRecord(reparsed.extensions, 'security.txt reparsed extensions');
        }
    },
};

const parseHostMetaTarget: FuzzTarget<string, ReturnType<typeof parseHostMeta>> = {
    name: 'parse-host-meta',
    module: 'host-meta',
    arbitrary: parserInputArbitrary('host-meta', hostMetaXmlGrammarArbitrary),
    execute: (input) => parseHostMeta(input),
    assertInvariant: (result) => {
        assert.ok(Array.isArray(result.links));

        for (const link of result.links) {
            assert.equal(typeof link.rel, 'string');
        }

        if (result.properties) {
            assertNullPrototypeRecord(result.properties, 'Host-Meta properties');
        }

        const serialized = formatHostMeta(result);
        const reparsed = parseHostMeta(serialized);
        assert.ok(Array.isArray(reparsed.links));
    },
};

const tryParseHostMetaJsonTarget: FuzzTarget<string, ReturnType<typeof tryParseHostMetaJson>> = {
    name: 'try-parse-host-meta-json',
    module: 'host-meta-json',
    arbitrary: parserInputArbitrary('host-meta-json', hostMetaJsonGrammarArbitrary),
    execute: (input) => tryParseHostMetaJson(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        if (result.properties) {
            assertNullPrototypeRecord(result.properties, 'Host-Meta JSON properties');
        }

        const serialized = formatHostMetaJson(result);
        const reparsed = parseHostMetaJson(serialized);
        assert.deepEqual(reparsed, result);
    },
};

const tryParseJrdTarget: FuzzTarget<string, ReturnType<typeof tryParseJrd>> = {
    name: 'try-parse-jrd',
    module: 'webfinger',
    arbitrary: parserInputArbitrary('webfinger', webFingerJrdGrammarArbitrary),
    execute: (input) => tryParseJrd(input),
    assertInvariant: (result) => {
        if (result === null) {
            return;
        }

        assert.equal(typeof result.subject, 'string');
        assert.ok(Array.isArray(validateJrd(result)));

        if (result.properties) {
            assertNullPrototypeRecord(result.properties, 'WebFinger properties');
        }

        for (const link of result.links ?? []) {
            assert.equal(typeof link.rel, 'string');

            if (link.titles) {
                assertNullPrototypeRecord(link.titles, 'WebFinger link titles');
            }
            if (link.properties) {
                assertNullPrototypeRecord(link.properties, 'WebFinger link properties');
            }
        }

        const serialized = formatJrd(result);
        const reparsed = parseJrd(serialized);
        assert.equal(reparsed.subject, result.subject);
    },
};

describe('Security fuzzing campaign (RFC 8941, RFC 7239, RFC 6266, RFC 9535, RFC 9421, RFC 9116, RFC 7033, RFC 6415)', () => {
    it('fuzzes Structured Field item parser invariants', () => {
        runFuzzTarget(parseSfItemTarget);
    });

    it('fuzzes Structured Field list parser invariants', () => {
        runFuzzTarget(parseSfListTarget);
    });

    it('fuzzes Structured Field dictionary parser invariants', () => {
        runFuzzTarget(parseSfDictTarget);
    });

    it('fuzzes Link parser invariants', () => {
        runFuzzTarget(parseLinkHeaderTarget);
    });

    it('fuzzes Link formatter invariants', () => {
        runFuzzTarget(formatLinkHeaderTarget);
    });

    it('fuzzes Forwarded parser invariants', () => {
        runFuzzTarget(parseForwardedTarget);
    });

    it('fuzzes Forwarded formatter invariants', () => {
        runFuzzTarget(formatForwardedTarget);
    });

    it('fuzzes Content-Disposition parser invariants', () => {
        runFuzzTarget(parseContentDispositionTarget);
    });

    it('fuzzes Content-Disposition formatter invariants', () => {
        runFuzzTarget(formatContentDispositionTarget);
    });

    it('fuzzes traceparent parser invariants', () => {
        runFuzzTarget(parseTraceparentTarget);
    });

    it('fuzzes tracestate parser invariants', () => {
        runFuzzTarget(parseTracestateTarget);
    });

    it('fuzzes JSONPath parser and evaluator invariants', () => {
        runFuzzTarget(parseJsonPathTarget, {
            numRuns: process.env.FUZZ_PROFILE === 'full' ? 160 : 16,
        });
    });

    it('fuzzes Signature-Input parser invariants', () => {
        runFuzzTarget(parseSignatureInputTarget);
    });

    it('fuzzes Signature parser invariants', () => {
        runFuzzTarget(parseSignatureTarget);
    });

    it('fuzzes Set-Cookie parser invariants', () => {
        runFuzzTarget(parseSetCookieTarget);
    });

    it('fuzzes Set-Cookie formatter invariants', () => {
        runFuzzTarget(formatSetCookieTarget);
    });

    it('fuzzes response header composition invariants', () => {
        runFuzzTarget(simpleJsonResponseTarget);
    });

    it('fuzzes CORS base header composition invariants', () => {
        runFuzzTarget(buildCorsHeadersTarget);
    });

    it('fuzzes CORS origin-aware header composition invariants', () => {
        runFuzzTarget(buildCorsHeadersForOriginTarget);
    });

    it('fuzzes strict CORS allowlist header invariants', () => {
        runFuzzTarget(buildStrictCorsHeadersForOriginTarget);
    });

    it('fuzzes security.txt parser invariants', () => {
        runFuzzTarget(parseSecurityTxtTarget);
    });

    it('fuzzes security.txt formatter invariants', () => {
        runFuzzTarget(formatSecurityTxtTarget);
    });

    it('fuzzes Host-Meta XML parser invariants', () => {
        runFuzzTarget(parseHostMetaTarget);
    });

    it('fuzzes Host-Meta JSON parser invariants', () => {
        runFuzzTarget(tryParseHostMetaJsonTarget);
    });

    it('fuzzes WebFinger JRD parser invariants', () => {
        runFuzzTarget(tryParseJrdTarget);
    });
});
