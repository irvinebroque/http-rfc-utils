/**
 * Fetch Metadata request header utilities.
 * W3C Fetch Metadata §2, §5.1.
 * @see https://www.w3.org/TR/fetch-metadata/
 */

import { mergeVary } from './headers.js';
import { getHeaderValue, type HeaderGetterInput } from './header-utils.js';
import { parseSfItem, serializeSfItem } from './structured-fields.js';
import { SfToken } from './types.js';
import type {
    FetchMetadata,
    FetchMetadataPolicy,
    FetchMetadataPolicyDecision,
} from './types.js';

const SEC_FETCH_DEST_VALUES = new Set<NonNullable<FetchMetadata['dest']>>([
    'audio',
    'audioworklet',
    'document',
    'embed',
    'empty',
    'font',
    'frame',
    'iframe',
    'image',
    'manifest',
    'object',
    'paintworklet',
    'report',
    'script',
    'serviceworker',
    'sharedworker',
    'style',
    'track',
    'video',
    'webidentity',
    'worker',
    'xslt',
]);

const SEC_FETCH_MODE_VALUES = new Set<NonNullable<FetchMetadata['mode']>>([
    'cors',
    'navigate',
    'no-cors',
    'same-origin',
    'websocket',
]);

const SEC_FETCH_SITE_VALUES = new Set<NonNullable<FetchMetadata['site']>>([
    'cross-site',
    'same-origin',
    'same-site',
    'none',
]);

type FetchMetadataHeaderInput = HeaderGetterInput;
type FetchMetadataVaryToken = 'dest' | 'mode' | 'site' | 'user';

const FETCH_METADATA_VARY_HEADERS: Record<FetchMetadataVaryToken, string> = {
    dest: 'Sec-Fetch-Dest',
    mode: 'Sec-Fetch-Mode',
    site: 'Sec-Fetch-Site',
    user: 'Sec-Fetch-User',
};

function parseKnownToken<T extends string>(
    value: string | null | undefined,
    allowed: ReadonlySet<T>,
): T | null {
    if (value == null || value.trim() === '') {
        return null;
    }

    const item = parseSfItem(value.trim());
    if (!item || item.params) {
        return null;
    }

    if (!(item.value instanceof SfToken)) {
        return null;
    }

    const token = item.value.value as T;
    if (!allowed.has(token)) {
        return null;
    }

    return token;
}

/**
 * Parse Sec-Fetch-Dest as an SF token.
 */
// W3C Fetch Metadata §2.1: Sec-Fetch-Dest is a Structured Field token.
export function parseSecFetchDest(value: string | null | undefined): NonNullable<FetchMetadata['dest']> | null {
    return parseKnownToken(value, SEC_FETCH_DEST_VALUES);
}

/**
 * Format Sec-Fetch-Dest as an SF token.
 */
export function formatSecFetchDest(value: NonNullable<FetchMetadata['dest']>): string {
    if (!SEC_FETCH_DEST_VALUES.has(value)) {
        throw new Error('Invalid Sec-Fetch-Dest token');
    }

    return serializeSfItem({ value: new SfToken(value) });
}

/**
 * Parse Sec-Fetch-Mode as an SF token.
 */
// W3C Fetch Metadata §2.2: Sec-Fetch-Mode is a Structured Field token.
export function parseSecFetchMode(value: string | null | undefined): NonNullable<FetchMetadata['mode']> | null {
    return parseKnownToken(value, SEC_FETCH_MODE_VALUES);
}

/**
 * Format Sec-Fetch-Mode as an SF token.
 */
export function formatSecFetchMode(value: NonNullable<FetchMetadata['mode']>): string {
    if (!SEC_FETCH_MODE_VALUES.has(value)) {
        throw new Error('Invalid Sec-Fetch-Mode token');
    }

    return serializeSfItem({ value: new SfToken(value) });
}

/**
 * Parse Sec-Fetch-Site as an SF token.
 */
// W3C Fetch Metadata §2.3: Sec-Fetch-Site is a Structured Field token.
export function parseSecFetchSite(value: string | null | undefined): NonNullable<FetchMetadata['site']> | null {
    return parseKnownToken(value, SEC_FETCH_SITE_VALUES);
}

/**
 * Format Sec-Fetch-Site as an SF token.
 */
export function formatSecFetchSite(value: NonNullable<FetchMetadata['site']>): string {
    if (!SEC_FETCH_SITE_VALUES.has(value)) {
        throw new Error('Invalid Sec-Fetch-Site token');
    }

    return serializeSfItem({ value: new SfToken(value) });
}

/**
 * Parse Sec-Fetch-User as an SF boolean.
 */
// W3C Fetch Metadata §2.4: Sec-Fetch-User is a Structured Field boolean.
export function parseSecFetchUser(value: string | null | undefined): boolean | null {
    if (value == null || value.trim() === '') {
        return null;
    }

    const item = parseSfItem(value.trim());
    if (!item || item.params) {
        return null;
    }

    if (typeof item.value !== 'boolean') {
        return null;
    }

    return item.value;
}

/**
 * Format Sec-Fetch-User as an SF boolean.
 */
export function formatSecFetchUser(value = true): string {
    return serializeSfItem({ value: Boolean(value) });
}

/**
 * Parse all Fetch Metadata request headers.
 */
export function parseFetchMetadata(input: FetchMetadataHeaderInput): FetchMetadata {
    const metadata: FetchMetadata = {};

    const dest = parseSecFetchDest(getHeaderValue(input, 'Sec-Fetch-Dest'));
    if (dest !== null) {
        metadata.dest = dest;
    }

    const mode = parseSecFetchMode(getHeaderValue(input, 'Sec-Fetch-Mode'));
    if (mode !== null) {
        metadata.mode = mode;
    }

    const site = parseSecFetchSite(getHeaderValue(input, 'Sec-Fetch-Site'));
    if (site !== null) {
        metadata.site = site;
    }

    const user = parseSecFetchUser(getHeaderValue(input, 'Sec-Fetch-User'));
    if (user !== null) {
        metadata.user = user;
    }

    return metadata;
}

/**
 * Evaluate a server-side Fetch Metadata policy decision.
 */
export function evaluateFetchMetadataPolicy(
    metadata: FetchMetadata,
    policy: FetchMetadataPolicy = {},
): FetchMetadataPolicyDecision {
    const strict = policy.strict === true;

    // W3C Fetch Metadata §5: permissive mode prevents accidental breakage when
    // headers are missing or stripped in transit.
    if (!strict) {
        return { allow: true, reason: 'permissive-default' };
    }

    if (!metadata.site) {
        return { allow: false, reason: 'missing-site' };
    }

    const allowSameOrigin = policy.allowSameOrigin ?? true;
    const allowSameSite = policy.allowSameSite ?? true;
    const allowNone = policy.allowNone ?? true;

    if (metadata.site === 'same-origin') {
        return allowSameOrigin
            ? { allow: true, reason: 'same-origin' }
            : { allow: false, reason: 'site-blocked' };
    }

    if (metadata.site === 'same-site') {
        return allowSameSite
            ? { allow: true, reason: 'same-site' }
            : { allow: false, reason: 'site-blocked' };
    }

    if (metadata.site === 'none') {
        return allowNone
            ? { allow: true, reason: 'none' }
            : { allow: false, reason: 'site-blocked' };
    }

    const allowCrossSite = policy.allowCrossSite ?? false;
    if (allowCrossSite) {
        return { allow: true, reason: 'cross-site' };
    }

    const allowTopLevelNavigation = policy.allowTopLevelNavigation ?? true;
    // W3C Fetch Metadata §5 guidance typically allows cross-site top-level
    // navigations while denying cross-site subresource requests.
    const isTopLevelNavigation = metadata.mode === 'navigate' && metadata.dest === 'document';

    if (allowTopLevelNavigation && isTopLevelNavigation) {
        const requiresUser = policy.requireUserActivationForCrossSiteNavigation ?? false;
        if (!requiresUser || metadata.user === true) {
            return { allow: true, reason: 'cross-site-top-level-navigation' };
        }
    }

    return { allow: false, reason: 'cross-site-blocked' };
}

/**
 * Merge Fetch Metadata headers into a Vary value.
 */
// W3C Fetch Metadata §5.1: responses that vary by Fetch Metadata should send Vary.
export function fetchMetadataVary(
    existing: string | null,
    include: FetchMetadataVaryToken[] = ['dest', 'mode', 'site', 'user'],
): string {
    const headers = include.map((token) => FETCH_METADATA_VARY_HEADERS[token]);
    return mergeVary(existing, headers);
}
