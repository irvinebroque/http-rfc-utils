/**
 * Compression Dictionary Transport utilities per RFC 9842.
 * RFC 9842 §2, §2.1, §2.2, §2.3, §6.1, §6.2.
 * @see https://www.rfc-editor.org/rfc/rfc9842.html#section-2
 */

import { mergeVary } from './headers.js';
import { parseSfDict, parseSfItem, serializeSfDict, serializeSfItem } from './structured-fields.js';
import {
    hasNoSfParams,
    isSfItem,
    isSfTokenText,
    normalizeOptionalHeaderValue,
} from './structured-field-helpers.js';
import { SfToken } from './types.js';
import type {
    DictionaryMatchOptions,
    SfDictionary,
    StoredDictionary,
    UseAsDictionary,
} from './types.js';

const MAX_DICTIONARY_ID_LENGTH = 1024;
const SHA256_DIGEST_BYTES = 32;
const DEFAULT_DICTIONARY_TYPE = 'raw';
const SCHEME_RE = /^[A-Za-z][A-Za-z\d+\-.]*:/;

function hasRegExpGroups(match: string): boolean {
    // RFC 9842 §2.1.1: URL Pattern values with regexp groups are unusable.
    return match.includes('(') || match.includes(')');
}

function toNonNegativeTimestamp(date: Date): number {
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function isSupportedDictionaryType(type: string, options?: DictionaryMatchOptions): boolean {
    if (options?.allowUnsupportedType) {
        return true;
    }

    const supportedTypes = options?.supportedTypes ?? [DEFAULT_DICTIONARY_TYPE];
    return supportedTypes.some((supported) => supported === type);
}

function wildcardMatch(pattern: string, candidate: string): boolean {
    let patternIndex = 0;
    let candidateIndex = 0;
    let lastStarPatternIndex = -1;
    let lastStarCandidateIndex = -1;

    while (candidateIndex < candidate.length) {
        if (patternIndex < pattern.length && pattern.charCodeAt(patternIndex) === 42) {
            lastStarPatternIndex = patternIndex;
            patternIndex += 1;
            lastStarCandidateIndex = candidateIndex;
            continue;
        }

        if (patternIndex < pattern.length && pattern.charCodeAt(patternIndex) === candidate.charCodeAt(candidateIndex)) {
            patternIndex += 1;
            candidateIndex += 1;
            continue;
        }

        if (lastStarPatternIndex !== -1) {
            patternIndex = lastStarPatternIndex + 1;
            lastStarCandidateIndex += 1;
            candidateIndex = lastStarCandidateIndex;
            continue;
        }

        return false;
    }

    while (patternIndex < pattern.length && pattern.charCodeAt(patternIndex) === 42) {
        patternIndex += 1;
    }

    return patternIndex === pattern.length;
}

function buildPatternTarget(match: string, requestUrl: URL): string {
    if (SCHEME_RE.test(match) || match.startsWith('//')) {
        const absolutePattern = new URL(match, requestUrl);
        return `${absolutePattern.protocol}//${absolutePattern.host}${absolutePattern.pathname}${absolutePattern.search}`;
    }

    return match;
}

function validateDictionaryIdLength(value: string): boolean {
    return value.length <= MAX_DICTIONARY_ID_LENGTH;
}

/**
 * Parse a Use-As-Dictionary field value.
 */
// RFC 9842 §2.1: Use-As-Dictionary is a Structured Field Dictionary.
export function parseUseAsDictionary(header: string): UseAsDictionary | null {
    const normalized = normalizeOptionalHeaderValue(header);
    if (!normalized) {
        return null;
    }

    const dict = parseSfDict(normalized);
    if (!dict) {
        return null;
    }

    const matchMember = dict.match;
    if (!matchMember || !isSfItem(matchMember) || typeof matchMember.value !== 'string' || !hasNoSfParams(matchMember)) {
        return null;
    }

    const parsed: UseAsDictionary = {
        match: matchMember.value,
        matchDest: [],
        id: '',
        type: DEFAULT_DICTIONARY_TYPE,
    };

    if (parsed.match.trim() === '') {
        return null;
    }

    const matchDestMember = dict['match-dest'];
    if (matchDestMember !== undefined) {
        if (!('items' in matchDestMember) || matchDestMember.params) {
            return null;
        }

        const destinations: string[] = [];
        for (const item of matchDestMember.items) {
            if (!hasNoSfParams(item) || typeof item.value !== 'string') {
                return null;
            }
            if (item.value.length === 0) {
                return null;
            }
            destinations.push(item.value);
        }
        parsed.matchDest = destinations;
    }

    const idMember = dict.id;
    if (idMember !== undefined) {
        if (!isSfItem(idMember) || typeof idMember.value !== 'string' || !hasNoSfParams(idMember)) {
            return null;
        }
        if (!validateDictionaryIdLength(idMember.value)) {
            return null;
        }
        parsed.id = idMember.value;
    }

    const typeMember = dict.type;
    if (typeMember !== undefined) {
        if (!isSfItem(typeMember) || !(typeMember.value instanceof SfToken) || !hasNoSfParams(typeMember)) {
            return null;
        }
        parsed.type = typeMember.value.value;
    }

    return parsed;
}

/**
 * Format a Use-As-Dictionary field value.
 */
// RFC 9842 §2.1: serialize known members as a Structured Field Dictionary.
export function formatUseAsDictionary(value: UseAsDictionary): string {
    if (!value.match || value.match.trim() === '') {
        throw new Error('Invalid Use-As-Dictionary match value');
    }

    if (!validateDictionaryIdLength(value.id)) {
        throw new Error('Invalid Use-As-Dictionary id length; expected <=1024 characters');
    }

    if (!isSfTokenText(value.type)) {
        throw new Error('Invalid Use-As-Dictionary type token');
    }

    const dict: SfDictionary = {
        match: { value: value.match },
    };

    if (value.matchDest.length > 0) {
        dict['match-dest'] = {
            items: value.matchDest.map((destination) => {
                if (destination.length === 0) {
                    throw new Error('Invalid Use-As-Dictionary match-dest value');
                }
                return { value: destination };
            }),
        };
    }

    if (value.id.length > 0) {
        dict.id = { value: value.id };
    }

    if (value.type !== DEFAULT_DICTIONARY_TYPE) {
        dict.type = { value: new SfToken(value.type) };
    }

    return serializeSfDict(dict);
}

/**
 * Validate Use-As-Dictionary matching constraints for a dictionary URL.
 */
// RFC 9842 §2.1.1: match must be same-origin for dictionary URL and contain no regexp groups.
export function validateUseAsDictionary(value: UseAsDictionary, dictionaryUrl: string): boolean {
    if (!value.match || value.match.trim() === '') {
        return false;
    }

    if (hasRegExpGroups(value.match)) {
        return false;
    }

    if (!validateDictionaryIdLength(value.id)) {
        return false;
    }

    if (!isSfTokenText(value.type)) {
        return false;
    }

    for (const destination of value.matchDest) {
        if (!destination || destination.trim() === '') {
            return false;
        }
    }

    try {
        const dictionary = new URL(dictionaryUrl);
        const matchUrl = new URL(value.match, dictionary);
        return dictionary.origin === matchUrl.origin;
    } catch {
        return false;
    }
}

/**
 * Parse an Available-Dictionary field value.
 */
// RFC 9842 §2.2: Available-Dictionary is a single SF Byte Sequence.
export function parseAvailableDictionary(header: string): Uint8Array | null {
    const normalized = normalizeOptionalHeaderValue(header);
    if (!normalized) {
        return null;
    }

    const item = parseSfItem(normalized);
    if (!item || item.params || !(item.value instanceof Uint8Array)) {
        return null;
    }

    if (item.value.length !== SHA256_DIGEST_BYTES) {
        return null;
    }

    return item.value;
}

/**
 * Format an Available-Dictionary field value.
 */
// RFC 9842 §2.2: Available-Dictionary carries a SHA-256 digest byte sequence.
export function formatAvailableDictionary(hash: Uint8Array): string {
    if (!(hash instanceof Uint8Array) || hash.length !== SHA256_DIGEST_BYTES) {
        throw new Error('Invalid Available-Dictionary digest; expected 32 bytes');
    }

    return serializeSfItem({ value: hash });
}

/**
 * Parse a Dictionary-ID field value.
 */
// RFC 9842 §2.3: Dictionary-ID is a Structured Field String with <=1024 chars.
export function parseDictionaryId(header: string): string | null {
    const normalized = normalizeOptionalHeaderValue(header);
    if (!normalized) {
        return null;
    }

    const item = parseSfItem(normalized);
    if (!item || item.params || typeof item.value !== 'string') {
        return null;
    }

    return validateDictionaryIdLength(item.value) ? item.value : null;
}

/**
 * Format a Dictionary-ID field value.
 */
// RFC 9842 §2.3: Dictionary-ID serialization as SF String.
export function formatDictionaryId(id: string): string {
    if (!validateDictionaryIdLength(id)) {
        throw new Error('Invalid Dictionary-ID length; expected <=1024 characters');
    }

    return serializeSfItem({ value: id });
}

/**
 * Check if a stored dictionary matches an outbound request.
 */
// RFC 9842 §2.2.2: destination, origin, and URL pattern matching for dictionary use.
export function matchesDictionary(
    dictionary: StoredDictionary,
    requestUrl: string,
    options: DictionaryMatchOptions = {},
): boolean {
    if (!validateUseAsDictionary(dictionary, dictionary.url)) {
        return false;
    }

    if (!isSupportedDictionaryType(dictionary.type, options)) {
        return false;
    }

    let request: URL;
    let baseDictionaryUrl: URL;
    try {
        request = new URL(requestUrl);
        baseDictionaryUrl = new URL(dictionary.url);
    } catch {
        return false;
    }

    if (request.origin !== baseDictionaryUrl.origin) {
        return false;
    }

    const supportsRequestDestination = options.supportsRequestDestination ?? true;
    if (supportsRequestDestination && dictionary.matchDest.length > 0) {
        if (!options.requestDestination) {
            return false;
        }
        if (!dictionary.matchDest.includes(options.requestDestination)) {
            return false;
        }
    }

    try {
        const patternTarget = buildPatternTarget(dictionary.match, request);
        const candidate = SCHEME_RE.test(dictionary.match) || dictionary.match.startsWith('//')
            ? `${request.protocol}//${request.host}${request.pathname}${request.search}`
            : dictionary.match.includes('?')
                ? `${request.pathname}${request.search}`
                : request.pathname;

        return wildcardMatch(patternTarget, candidate);
    } catch {
        return false;
    }
}

/**
 * Select the single best matching dictionary for an outbound request.
 */
// RFC 9842 §2.2.3: destination precedence, then longest match, then most recently fetched.
export function selectBestDictionary(
    dictionaries: readonly StoredDictionary[],
    requestUrl: string,
    options: DictionaryMatchOptions = {},
): StoredDictionary | null {
    const supportsRequestDestination = options.supportsRequestDestination ?? true;

    let best: StoredDictionary | null = null;
    let bestDestinationPrecedence = -1;
    let bestMatchLength = -1;
    let bestFetchedAt = -1;

    for (const dictionary of dictionaries) {
        if (!matchesDictionary(dictionary, requestUrl, options)) {
            continue;
        }

        const destinationPrecedence = supportsRequestDestination
            ? (dictionary.matchDest.length > 0 ? 1 : 0)
            : 0;
        const matchLength = dictionary.match.length;
        const fetchedAt = toNonNegativeTimestamp(dictionary.fetchedAt);

        const isBetterDestination = destinationPrecedence > bestDestinationPrecedence;
        const isBetterLength = destinationPrecedence === bestDestinationPrecedence
            && matchLength > bestMatchLength;
        const isMoreRecent = destinationPrecedence === bestDestinationPrecedence
            && matchLength === bestMatchLength
            && fetchedAt > bestFetchedAt;

        if (!best || isBetterDestination || isBetterLength || isMoreRecent) {
            best = dictionary;
            bestDestinationPrecedence = destinationPrecedence;
            bestMatchLength = matchLength;
            bestFetchedAt = fetchedAt;
        }
    }

    return best;
}

/**
 * Merge dictionary-negotiation Vary members.
 */
// RFC 9842 §6.2: dictionary-compressed cacheable responses vary on encoding and dictionary hash.
export function mergeDictionaryVary(existing: string | null): string {
    return mergeVary(existing, ['accept-encoding', 'available-dictionary']);
}
