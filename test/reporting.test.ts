/**
 * Tests for Reporting API utilities.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    REPORTS_MEDIA_TYPE,
    parseReportingEndpoints,
    formatReportingEndpoints,
    processReportingEndpointsForResponse,
    stripUrlForReport,
    serializeReports,
    formatReportsJson,
    parseReportsJson,
} from '../src/reporting.js';

describe('Reporting API (W3C Reporting API Sections 2.2, 2.4, 3.2, 3.3, 3.6)', () => {
    // W3C Reporting API §2.2 and §10.2: reports are delivered as application/reports+json.
    it('exports the reports media type constant', () => {
        assert.equal(REPORTS_MEDIA_TYPE, 'application/reports+json');
    });

    // W3C Reporting API §3.2: Reporting-Endpoints is an SF dictionary of string URI-references.
    describe('parseReportingEndpoints and formatReportingEndpoints', () => {
        it('parses valid dictionary string members and ignores invalid members', () => {
            const parsed = parseReportingEndpoints(
                'default="https://collector.example/reports", rel="/report", flag=?1, with-param="https://example.test/x";v=1, bad="http://[::1"'
            );

            assert.deepEqual(parsed, [
                {
                    name: 'default',
                    url: 'https://collector.example/reports',
                    failures: 0,
                },
                {
                    name: 'rel',
                    url: '/report',
                    failures: 0,
                },
                {
                    name: 'with-param',
                    url: 'https://example.test/x',
                    failures: 0,
                },
            ]);
        });

        it('returns an empty list for nullish or syntax-invalid field-values', () => {
            assert.deepEqual(parseReportingEndpoints(null), []);
            assert.deepEqual(parseReportingEndpoints(undefined), []);
            assert.deepEqual(parseReportingEndpoints('default="https://example.test",'), []);
            assert.deepEqual(parseReportingEndpoints('not a structured field dictionary'), []);
        });

        it('formats endpoint definitions as an SF dictionary', () => {
            const header = formatReportingEndpoints([
                { name: 'default', url: 'https://collector.example/reports' },
                { name: 'csp', url: '/csp' },
            ]);

            assert.equal(header, 'default="https://collector.example/reports", csp="/csp"');
            assert.deepEqual(parseReportingEndpoints(header), [
                { name: 'default', url: 'https://collector.example/reports', failures: 0 },
                { name: 'csp', url: '/csp', failures: 0 },
            ]);
        });

        it('throws for semantic-invalid formatting input', () => {
            assert.throws(
                () => formatReportingEndpoints([{ name: 'Invalid Name', url: 'https://collector.example' }]),
                /valid Structured Field key/
            );
            assert.throws(
                () => formatReportingEndpoints([{ name: 'ok', url: 'http://[::1' }]),
                /invalid URI-reference/
            );
            assert.throws(
                () => formatReportingEndpoints([
                    { name: 'dup', url: 'https://collector.example/a' },
                    { name: 'dup', url: 'https://collector.example/b' },
                ]),
                /must be unique/
            );
        });
    });

    // W3C Reporting API §3.3: endpoint URL references are resolved against response URL and non-trustworthy endpoints are ignored.
    describe('processReportingEndpointsForResponse', () => {
        it('resolves endpoint URI-references against the response URL', () => {
            const processed = processReportingEndpointsForResponse(
                'default="/reports", alt="https://collector.example/endpoint"',
                'https://app.example/path/page.html'
            );

            assert.deepEqual(processed, [
                {
                    name: 'default',
                    url: 'https://app.example/reports',
                    failures: 0,
                },
                {
                    name: 'alt',
                    url: 'https://collector.example/endpoint',
                    failures: 0,
                },
            ]);
        });

        it('filters non-trustworthy endpoint origins and untrustworthy responses', () => {
            const fromInsecureResponse = processReportingEndpointsForResponse(
                'secure="https://collector.example/reports"',
                'http://insecure.example/page'
            );
            assert.deepEqual(fromInsecureResponse, []);

            const fromModernHttpsState = processReportingEndpointsForResponse(
                'secure="https://collector.example/reports", loopback="http://localhost:8080/r", insecure="http://collector.example/reports"',
                'http://insecure.example/page',
                { responseIsHttpsModern: true }
            );

            assert.deepEqual(fromModernHttpsState, [
                {
                    name: 'secure',
                    url: 'https://collector.example/reports',
                    failures: 0,
                },
                {
                    name: 'loopback',
                    url: 'http://localhost:8080/r',
                    failures: 0,
                },
            ]);
        });
    });

    // W3C Reporting API §3.6 and §8.1: report URLs strip credentials/fragments and non-http(s) URLs reduce to scheme.
    describe('stripUrlForReport', () => {
        it('strips credentials and fragments from http(s) URLs', () => {
            const stripped = stripUrlForReport('https://user:pass@example.test/path?x=1#fragment');
            assert.equal(stripped, 'https://example.test/path?x=1');
        });

        it('returns scheme for non-http(s) URLs and null for invalid URLs', () => {
            assert.equal(stripUrlForReport('data:text/plain,ok'), 'data');
            assert.equal(stripUrlForReport('mailto:dev@example.test'), 'mailto');
            assert.equal(stripUrlForReport('not a url'), null);
        });
    });

    // W3C Reporting API §2.4: serialization emits age/type/url/user_agent/body and increments attempts.
    describe('serializeReports and formatReportsJson', () => {
        it('formats delivery JSON and increments attempts with deterministic now', () => {
            const reports = [
                {
                    body: { blocked: 'https://evil.example/script.js' },
                    url: 'https://app.example/page',
                    userAgent: 'ua/1.0',
                    destination: 'default',
                    type: 'csp-violation',
                    timestamp: 1000,
                    attempts: 0,
                },
            ];

            const json = formatReportsJson(reports, { now: 1600 });
            const parsed = JSON.parse(json) as unknown[];
            assert.deepEqual(parsed, [
                {
                    age: 600,
                    type: 'csp-violation',
                    url: 'https://app.example/page',
                    user_agent: 'ua/1.0',
                    body: { blocked: 'https://evil.example/script.js' },
                },
            ]);
            assert.equal(reports[0]?.attempts, 1);
        });

        it('serializes to UTF-8 bytes and increments attempts per serialization', () => {
            const reports = [
                {
                    body: null,
                    url: 'https://app.example/',
                    userAgent: 'ua/2.0',
                    destination: 'default',
                    type: 'network-error',
                    timestamp: 2000,
                    attempts: 0,
                },
            ];

            const first = serializeReports(reports, { now: 2400 });
            assert.equal(reports[0]?.attempts, 1);

            const json = new TextDecoder().decode(first);
            assert.deepEqual(JSON.parse(json), [
                {
                    age: 400,
                    type: 'network-error',
                    url: 'https://app.example/',
                    user_agent: 'ua/2.0',
                    body: null,
                },
            ]);

            serializeReports(reports, { now: 2500 });
            assert.equal(reports[0]?.attempts, 2);
        });
    });

    describe('parseReportsJson', () => {
        it('parses valid application/reports+json payloads', () => {
            const parsed = parseReportsJson(
                '[{"age":10,"type":"csp-violation","url":"https://app.example/","user_agent":"ua/1.0","body":{"x":1}}]'
            );

            assert.deepEqual(parsed, [
                {
                    age: 10,
                    type: 'csp-violation',
                    url: 'https://app.example/',
                    user_agent: 'ua/1.0',
                    body: { x: 1 },
                },
            ]);
        });

        it('returns null for malformed JSON or invalid payload shape', () => {
            assert.equal(parseReportsJson('{ bad json'), null);
            assert.equal(parseReportsJson('{"age":1}'), null);
            assert.equal(parseReportsJson('[{"age":-1,"type":"x","url":"https://a","user_agent":"ua","body":null}]'), null);
            assert.equal(parseReportsJson('[{"age":1,"type":"x","url":"https://a","user_agent":"ua","body":[]}]'), null);
        });

        it('round-trips formatted report payload', () => {
            const reports = [
                {
                    body: { detail: 'ok' },
                    url: 'https://app.example/resource',
                    userAgent: 'ua/3.0',
                    destination: 'default',
                    type: 'test',
                    timestamp: 3000,
                    attempts: 0,
                },
            ];

            const json = formatReportsJson(reports, { now: 3500 });
            const parsed = parseReportsJson(json);

            assert.deepEqual(parsed, [
                {
                    age: 500,
                    type: 'test',
                    url: 'https://app.example/resource',
                    user_agent: 'ua/3.0',
                    body: { detail: 'ok' },
                },
            ]);
        });
    });
});
