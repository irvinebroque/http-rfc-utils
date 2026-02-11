/**
 * Tests for Content Security Policy (CSP) subset utilities.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    formatContentSecurityPolicy,
    formatContentSecurityPolicyReportOnly,
    formatCspSourceList,
    parseContentSecurityPolicies,
    parseContentSecurityPolicy,
    parseContentSecurityPolicyReportOnly,
    parseCspSourceList,
    validateContentSecurityPolicy,
    validateCspSourceList,
} from '../src/csp.js';

// W3C CSP3 Section 2.2.1 + Section 3.1 define serialized-policy parsing and delivery.
describe('parseContentSecurityPolicy (W3C CSP3 Sections 2.2.1 and 3.1)', () => {
    it('parses supported directives and ignores unknown directives', () => {
        const parsed = parseContentSecurityPolicy(
            "default-src 'self'; script-src 'self' https://cdn.example; unknown-src https://future.example; report-to csp-endpoint",
        );

        assert.deepEqual(parsed, {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.example'],
            reportTo: 'csp-endpoint',
        });
    });

    // W3C CSP3 Section 2.2.1: duplicate directives are ignored after the first occurrence.
    it('keeps the first supported directive occurrence when duplicates are present', () => {
        const parsed = parseContentSecurityPolicy("script-src 'self'; script-src https://cdn.example");
        assert.deepEqual(parsed, { scriptSrc: ["'self'"] });
    });

    it('returns an empty object for syntactically valid policies that only contain unknown directives', () => {
        const parsed = parseContentSecurityPolicy('future-directive value');
        assert.deepEqual(parsed, {});
    });

    it('returns null for malformed supported directives', () => {
        assert.equal(parseContentSecurityPolicy('script-src'), null);
        assert.equal(parseContentSecurityPolicy("script-src 'none' https://cdn.example"), null);
        assert.equal(parseContentSecurityPolicy("frame-ancestors 'unsafe-inline'"), null);
        assert.equal(parseContentSecurityPolicy("report-to bad endpoint"), null);
    });

    it('returns null for empty or nullish values', () => {
        assert.equal(parseContentSecurityPolicy(''), null);
        assert.equal(parseContentSecurityPolicy('   '), null);
        assert.equal(parseContentSecurityPolicy(null), null);
        assert.equal(parseContentSecurityPolicy(undefined), null);
    });
});

// W3C CSP3 Section 3.2 uses the same serialized-policy grammar for report-only delivery.
describe('report-only CSP helpers (W3C CSP3 Section 3.2)', () => {
    it('parses report-only values with the enforce parser semantics', () => {
        const parsed = parseContentSecurityPolicyReportOnly("script-src 'self'; report-uri /csp-report");
        assert.deepEqual(parsed, {
            scriptSrc: ["'self'"],
            reportUri: ['/csp-report'],
        });
    });

    it('formats report-only values with the same serialized policy output', () => {
        const formatted = formatContentSecurityPolicyReportOnly({
            defaultSrc: ["'self'"],
            reportTo: 'endpoint',
        });
        assert.equal(formatted, "default-src 'self'; report-to endpoint");
    });
});

// W3C CSP3 Section 2.2.2 + Section 3.1/3.2 define parsing of serialized policy lists.
describe('parseContentSecurityPolicies (W3C CSP3 Sections 2.2.2, 3.1, and 3.2)', () => {
    it('parses serialized policy lists from comma-delimited values', () => {
        const parsed = parseContentSecurityPolicies("script-src 'self', object-src 'none'");
        assert.deepEqual(parsed, [
            { scriptSrc: ["'self'"] },
            { objectSrc: ["'none'"] },
        ]);
    });

    it('parses multiple header values and skips unsupported-only policies', () => {
        const parsed = parseContentSecurityPolicies([
            "default-src 'self'",
            'future-only abc',
            "img-src data: https://img.example",
        ]);
        assert.deepEqual(parsed, [
            { defaultSrc: ["'self'"] },
            { imgSrc: ['data:', 'https://img.example'] },
        ]);
    });

    it('returns an empty list when any serialized policy is malformed', () => {
        assert.deepEqual(parseContentSecurityPolicies(["script-src 'self'", 'report-to bad endpoint']), []);
        assert.deepEqual(parseContentSecurityPolicies('script-src'), []);
    });
});

// W3C CSP3 Section 2.3.1 defines serialized-source-list grammar.
describe('parseCspSourceList (W3C CSP3 Section 2.3.1)', () => {
    it('parses keyword, nonce, hash, scheme, and host expressions', () => {
        const parsed = parseCspSourceList(
            "'self' 'nonce-aBc123+/=' 'sha256-AbCdEf123+/=' https: https://cdn.example *.assets.example:8443/path",
        );

        assert.deepEqual(parsed, [
            "'self'",
            "'nonce-aBc123+/='",
            "'sha256-AbCdEf123+/='",
            'https:',
            'https://cdn.example',
            '*.assets.example:8443/path',
        ]);
    });

    it('returns null for invalid source list syntax', () => {
        assert.equal(parseCspSourceList("'none' https://cdn.example"), null);
        assert.equal(parseCspSourceList("'unsafe inline'"), null);
        assert.equal(parseCspSourceList('https://cdn.example,https://other.example'), null);
        assert.equal(parseCspSourceList(null), null);
        assert.equal(parseCspSourceList('   '), null);
    });
});

describe('validateCspSourceList and formatCspSourceList', () => {
    it('validates and formats strict source lists', () => {
        const validated = validateCspSourceList(["'self'", 'https://cdn.example']);
        assert.deepEqual(validated, ["'self'", 'https://cdn.example']);
        assert.equal(formatCspSourceList(validated), "'self' https://cdn.example");
    });

    it('throws for semantic-invalid source lists', () => {
        assert.throws(() => validateCspSourceList([]), /at least one source expression/);
        assert.throws(() => validateCspSourceList(["'none'", 'https://cdn.example']), /cannot combine 'none'/);
        assert.throws(() => formatCspSourceList(["'bad-keyword'"]), /is invalid/);
    });
});

// W3C CSP3 Section 2.3 + Section 6.5 define directive value classes used in this subset.
describe('validateContentSecurityPolicy and formatContentSecurityPolicy', () => {
    it('validates and formats supported directives in deterministic order', () => {
        const policy = validateContentSecurityPolicy({
            scriptSrc: ["'self'", 'https://cdn.example'],
            defaultSrc: ["'self'"],
            reportUri: ['/csp-report', 'https://report.example/csp'],
            reportTo: 'csp-endpoint',
        });

        const formatted = formatContentSecurityPolicy(policy);
        assert.equal(
            formatted,
            "default-src 'self'; script-src 'self' https://cdn.example; report-uri /csp-report https://report.example/csp; report-to csp-endpoint",
        );
    });

    // W3C CSP3 Section 6.4.2 frame-ancestors uses restricted ancestor-source expressions.
    it('rejects frame-ancestors expressions that are outside ancestor-source', () => {
        assert.throws(
            () => validateContentSecurityPolicy({ frameAncestors: ["'unsafe-inline'"] }),
            /frameAncestors source expression at index 0 is invalid/,
        );
    });

    it('throws for unknown directive keys and empty policies', () => {
        assert.throws(
            () => validateContentSecurityPolicy({ futureDirective: ['value'] } as never),
            /Unsupported Content Security Policy directive key/,
        );
        assert.throws(() => formatContentSecurityPolicy({}), /must contain at least one supported directive/);
    });

    it('round-trips a formatted policy through parsing for supported subset directives', () => {
        const original = {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.example'],
            objectSrc: ["'none'"],
            reportTo: 'csp-endpoint',
        };

        const formatted = formatContentSecurityPolicy(original);
        const reparsed = parseContentSecurityPolicy(formatted);
        assert.deepEqual(reparsed, original);
    });
});
