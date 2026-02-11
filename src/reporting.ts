/**
 * Reporting API helpers.
 * W3C Reporting API §2.2, §2.4, §3.2, §3.3, §3.6.
 * @see https://www.w3.org/TR/reporting-1/
 */

import { parseSfDict, serializeSfDict } from './structured-fields.js';
import { isSfItem, normalizeOptionalHeaderValue } from './structured-field-helpers.js';
import type {
    ProcessReportingEndpointsOptions,
    ReportingEndpoint,
    ReportingEndpointDefinition,
    ReportingReport,
    ReportingSerializationOptions,
    ReportingSerializedReport,
} from './types.js';

export type {
    ReportingEndpoint,
    ReportingEndpointDefinition,
    ProcessReportingEndpointsOptions,
    ReportingReportBody,
    ReportingReport,
    ReportingSerializedReport,
    ReportingSerializationOptions,
} from './types.js';

export const REPORTS_MEDIA_TYPE = 'application/reports+json';

const SF_KEY_PATTERN = /^[a-z*][a-z0-9_\-.*]*$/;
const TEXT_ENCODER = new TextEncoder();

/**
 * Parse a Reporting-Endpoints dictionary field-value.
 */
// W3C Reporting API §3.2: dictionary members are endpoint-name => URI-reference string.
export function parseReportingEndpoints(value: string | null | undefined): ReportingEndpoint[] {
    const normalized = normalizeOptionalHeaderValue(value);
    if (normalized === null) {
        return [];
    }

    const dictionary = parseSfDict(normalized);
    if (dictionary === null) {
        return [];
    }

    const endpoints: ReportingEndpoint[] = [];

    for (const [name, member] of Object.entries(dictionary)) {
        if (!isSfItem(member) || typeof member.value !== 'string') {
            continue;
        }

        if (!isValidUriReference(member.value)) {
            continue;
        }

        endpoints.push({
            name,
            url: member.value,
            failures: 0,
        });
    }

    return endpoints;
}

/**
 * Format Reporting-Endpoints dictionary field-value.
 */
// W3C Reporting API §3.2: endpoint member values are string URI-references.
export function formatReportingEndpoints(endpoints: readonly ReportingEndpointDefinition[]): string {
    if (!Array.isArray(endpoints)) {
        throw new Error('Reporting endpoints must be an array');
    }

    const seenNames = new Set<string>();
    const dictionary: Record<string, { value: string }> = {};

    for (let index = 0; index < endpoints.length; index++) {
        const endpoint = endpoints[index];
        if (!isRecord(endpoint)) {
            throw new Error(`Reporting endpoint at index ${index} must be an object`);
        }

        const { name, url } = endpoint;

        if (typeof name !== 'string' || name.length === 0) {
            throw new Error(`Reporting endpoint at index ${index} must include a non-empty name`);
        }
        if (!SF_KEY_PATTERN.test(name)) {
            throw new Error(`Reporting endpoint name "${name}" must be a valid Structured Field key`);
        }
        if (seenNames.has(name)) {
            throw new Error(`Reporting endpoint name "${name}" must be unique`);
        }

        if (typeof url !== 'string' || url.length === 0) {
            throw new Error(`Reporting endpoint "${name}" must include a non-empty url`);
        }
        if (!isValidUriReference(url)) {
            throw new Error(`Reporting endpoint "${name}" has an invalid URI-reference`);
        }

        seenNames.add(name);
        dictionary[name] = { value: url };
    }

    return serializeSfDict(dictionary);
}

/**
 * Process Reporting-Endpoints against a response URL.
 */
// W3C Reporting API §3.3: resolve URI-references against response URL and keep only trustworthy origins.
export function processReportingEndpointsForResponse(
    reportingEndpoints: string | null | undefined,
    responseUrl: string | URL,
    options: ProcessReportingEndpointsOptions = {},
): ReportingEndpoint[] {
    const parsedResponseUrl = parseUrl(responseUrl);
    if (!parsedResponseUrl) {
        return [];
    }

    const isTrustworthy = options.isOriginPotentiallyTrustworthy ?? isPotentiallyTrustworthyOrigin;
    const isResponseTrustworthy = isTrustworthy(parsedResponseUrl);
    if (options.responseIsHttpsModern !== true && !isResponseTrustworthy) {
        return [];
    }

    const parsedEndpoints = parseReportingEndpoints(reportingEndpoints);
    const resolvedEndpoints: ReportingEndpoint[] = [];

    for (const endpoint of parsedEndpoints) {
        let resolvedUrl: URL;
        try {
            resolvedUrl = new URL(endpoint.url, parsedResponseUrl);
        } catch {
            continue;
        }

        if (!isTrustworthy(resolvedUrl)) {
            continue;
        }

        resolvedEndpoints.push({
            name: endpoint.name,
            url: resolvedUrl.toString(),
            failures: 0,
        });
    }

    return resolvedEndpoints;
}

/**
 * Strip URL credentials and fragments for reports.
 */
// W3C Reporting API §3.6: strip username/password/fragment and return scheme for non-http(s).
export function stripUrlForReport(url: string | URL): string | null {
    const parsed = parseUrl(url);
    if (!parsed) {
        return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return parsed.protocol.slice(0, -1);
    }

    const stripped = new URL(parsed.toString());
    stripped.hash = '';
    stripped.username = '';
    stripped.password = '';

    return stripped.toString();
}

/**
 * Serialize report objects to JSON bytes for delivery.
 */
// W3C Reporting API §2.4: delivery payload includes age/type/url/user_agent/body and increments attempts.
export function serializeReports(
    reports: ReportingReport[],
    options: ReportingSerializationOptions = {},
): Uint8Array {
    return TEXT_ENCODER.encode(formatReportsJson(reports, options));
}

/**
 * Format report objects as JSON text for delivery.
 */
// W3C Reporting API §2.4: JSON payload shape and attempts increment semantics.
export function formatReportsJson(
    reports: ReportingReport[],
    options: ReportingSerializationOptions = {},
): string {
    if (!Array.isArray(reports)) {
        throw new Error('Reports must be an array');
    }

    const now = getNow(options.now);
    const collection: ReportingSerializedReport[] = [];

    for (let index = 0; index < reports.length; index++) {
        const report = reports[index];
        validateReport(report, index);

        const age = Math.max(0, now - report.timestamp);
        collection.push({
            age,
            type: report.type,
            url: report.url,
            user_agent: report.userAgent,
            body: report.body,
        });

        report.attempts += 1;
    }

    return JSON.stringify(collection);
}

/**
 * Parse an application/reports+json payload.
 */
// W3C Reporting API §2.4 + §10.2: parse JSON payload array with report delivery members.
export function parseReportsJson(value: string): ReportingSerializedReport[] | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return null;
    }

    if (!Array.isArray(parsed)) {
        return null;
    }

    const reports: ReportingSerializedReport[] = [];

    for (const report of parsed) {
        if (!isRecord(report)) {
            return null;
        }

        const age = report.age;
        const type = report.type;
        const url = report.url;
        const userAgent = report.user_agent;
        const body = report.body;

        if (typeof age !== 'number' || !Number.isFinite(age) || age < 0) {
            return null;
        }
        if (typeof type !== 'string' || type.length === 0) {
            return null;
        }
        if (typeof url !== 'string' || url.length === 0) {
            return null;
        }
        if (typeof userAgent !== 'string') {
            return null;
        }
        if (body !== null && !isRecord(body)) {
            return null;
        }

        reports.push({
            age,
            type,
            url,
            user_agent: userAgent,
            body,
        });
    }

    return reports;
}

function validateReport(report: ReportingReport, index: number): void {
    if (!isRecord(report)) {
        throw new Error(`Report at index ${index} must be an object`);
    }
    if (typeof report.type !== 'string' || report.type.length === 0) {
        throw new Error(`Report at index ${index} must include a non-empty type`);
    }
    if (typeof report.url !== 'string' || report.url.length === 0) {
        throw new Error(`Report at index ${index} must include a non-empty url`);
    }
    if (typeof report.userAgent !== 'string') {
        throw new Error(`Report at index ${index} must include a userAgent string`);
    }
    if (typeof report.destination !== 'string' || report.destination.length === 0) {
        throw new Error(`Report at index ${index} must include a non-empty destination`);
    }
    if (!Number.isFinite(report.timestamp)) {
        throw new Error(`Report at index ${index} must include a finite timestamp`);
    }
    if (!Number.isInteger(report.attempts) || report.attempts < 0) {
        throw new Error(`Report at index ${index} must include a non-negative integer attempts counter`);
    }
    if (report.body !== null && !isRecord(report.body)) {
        throw new Error(`Report at index ${index} body must be an object or null`);
    }
}

function parseUrl(value: string | URL): URL | null {
    try {
        return value instanceof URL ? new URL(value.toString()) : new URL(value);
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidUriReference(value: string): boolean {
    try {
        new URL(value, 'https://base.example');
        return true;
    } catch {
        return false;
    }
}

function getNow(now: number | Date | undefined): number {
    if (typeof now === 'number') {
        if (!Number.isFinite(now)) {
            throw new Error('Serialization "now" must be a finite number');
        }
        return now;
    }

    if (now instanceof Date) {
        const timestamp = now.getTime();
        if (!Number.isFinite(timestamp)) {
            throw new Error('Serialization "now" date must be valid');
        }
        return timestamp;
    }

    return Date.now();
}

function isPotentiallyTrustworthyOrigin(url: URL): boolean {
    const protocol = url.protocol.toLowerCase();
    if (protocol === 'https:' || protocol === 'wss:' || protocol === 'file:') {
        return true;
    }

    if (protocol !== 'http:' && protocol !== 'ws:') {
        return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return true;
    }

    if (hostname === '::1' || hostname === '[::1]') {
        return true;
    }

    const parts = hostname.split('.');
    if (parts.length !== 4) {
        return false;
    }

    const octets: number[] = [];
    for (const part of parts) {
        if (!/^[0-9]+$/.test(part)) {
            return false;
        }

        const octet = Number.parseInt(part, 10);
        if (octet < 0 || octet > 255) {
            return false;
        }
        octets.push(octet);
    }

    return octets[0] === 127;
}
