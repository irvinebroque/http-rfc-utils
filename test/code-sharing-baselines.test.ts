/**
 * Baseline characterization tests for deep code-sharing refactors.
 * RFC 7616 (Digest), OpenAPI v3.1.1 runtime expressions/callbacks, RFC 3986/RFC 8187 percent-decoding.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
    computeA1,
    computeA2,
    computeDigestResponse,
    formatDigestAuthorization,
    formatDigestChallenge,
    parseAuthorization,
    parseDigestAuthorization,
    parseDigestChallenge,
    parseWWWAuthenticate,
} from '../src/auth.js';
import { decodeExtValue } from '../src/ext-value.js';
import { decodePercentComponent } from '../src/internal-uri-encoding.js';
import {
    extractOpenApiPathParams,
    materializeOpenApiLinkValues,
    resolveOpenApiCallbackUrl,
} from '../src/openapi.js';
import { percentDecode } from '../src/uri.js';
import type {
    DigestChallenge,
    DigestCredentials,
    OpenApiRuntimeEvaluationContext,
} from '../src/types.js';

interface DigestParseCase {
    name: string;
    header: string;
    expected: Record<string, unknown> | null;
}

interface DigestFixture {
    parseChallenge: DigestParseCase[];
    formatChallenge: {
        input: DigestChallenge;
        expected: string;
    };
    parseAuthorization: DigestParseCase[];
    formatAuthorization: {
        input: DigestCredentials;
        expected: string;
    };
    errorMessages: {
        computeA1MissingSessionInputs: string;
        computeA2AuthIntUnsupported: string;
        computeDigestResponseMissingQopCoupling: string;
    };
}

interface OpenApiIssue {
    code: string;
    path: string;
    message: string;
    expression: string;
}

interface OpenApiFixture {
    context: OpenApiRuntimeEvaluationContext;
    materialize: {
        link: Record<string, unknown>;
        expected: {
            parameters: Record<string, unknown>;
            requestBody: unknown;
            issues: OpenApiIssue[];
        };
    };
    materializeStrictError: {
        link: Record<string, unknown>;
        expectedMessage: string;
    };
    callback: {
        malformedTemplate: {
            key: string;
            issues: OpenApiIssue[];
        };
        unresolvedDirectExpression: {
            key: string;
            issues: OpenApiIssue[];
        };
    };
}

interface PercentCase {
    name: string;
    input: string;
    expected: string | null;
}

interface PercentFixture {
    decodePercentComponent: PercentCase[];
    percentDecode: PercentCase[];
    decodeExtValue: Array<{
        name: string;
        input: string;
        expected: {
            charset: string;
            language: string | null;
            value: string;
        } | null;
    }>;
    openApiPathParams: {
        template: string;
        path: string;
        decodeTrueExpected: Record<string, string> | null;
        decodeFalseExpected: Record<string, string> | null;
    };
}

function readFixture<T>(fileName: string): T {
    const fixturePath = join(process.cwd(), 'test', 'fixtures', 'code-sharing', fileName);
    return JSON.parse(readFileSync(fixturePath, 'utf8')) as T;
}

// RFC 7616 §3.3-§3.5: Digest parse/format behavior and error text are baseline-locked before helper extraction.
describe('code-sharing baseline: digest parse/format + error text', () => {
    const fixture = readFixture<DigestFixture>('digest-baseline.json');

    for (const testCase of fixture.parseChallenge) {
        it(`parseDigestChallenge: ${testCase.name}`, () => {
            const parsedChallenges = parseWWWAuthenticate(testCase.header);
            assert.ok(parsedChallenges[0]);
            const parsed = parseDigestChallenge(parsedChallenges[0]!);
            assert.deepEqual(parsed, testCase.expected);
        });
    }

    it('formatDigestChallenge emits current canonical parameter ordering', () => {
        const formatted = formatDigestChallenge(fixture.formatChallenge.input);
        assert.equal(formatted, fixture.formatChallenge.expected);
    });

    for (const testCase of fixture.parseAuthorization) {
        it(`parseDigestAuthorization: ${testCase.name}`, () => {
            const parsedAuthorization = parseAuthorization(testCase.header);
            assert.ok(parsedAuthorization);
            const parsed = parseDigestAuthorization(parsedAuthorization!);
            assert.deepEqual(parsed, testCase.expected);
        });
    }

    it('formatDigestAuthorization emits username* and token quoting behavior', () => {
        const formatted = formatDigestAuthorization(fixture.formatAuthorization.input);
        assert.equal(formatted, fixture.formatAuthorization.expected);
    });

    it('computeA1 session validation keeps exact error text', async () => {
        await assert.rejects(
            async () => computeA1('user', 'realm', 'password', 'MD5-sess'),
            new Error(fixture.errorMessages.computeA1MissingSessionInputs),
        );
    });

    it('computeA2 auth-int guard keeps exact error text', () => {
        assert.throws(
            () => computeA2('GET', '/resource', 'auth-int'),
            new Error(fixture.errorMessages.computeA2AuthIntUnsupported),
        );
    });

    it('computeDigestResponse qop coupling keeps exact error text', async () => {
        await assert.rejects(
            async () => computeDigestResponse({
                username: 'user',
                password: 'password',
                realm: 'realm',
                method: 'GET',
                uri: '/resource',
                nonce: 'nonce',
                qop: 'auth',
            }),
            new Error(fixture.errorMessages.computeDigestResponseMissingQopCoupling),
        );
    });
});

// OpenAPI v3.1.1 Link/Callback runtime expression resolution: issue arrays and messages are baseline-locked.
describe('code-sharing baseline: openapi runtime-expression and callback issues', () => {
    const fixture = readFixture<OpenApiFixture>('openapi-runtime-baseline.json');

    it('materializeOpenApiLinkValues preserves issue order/messages in tolerant mode', () => {
        const result = materializeOpenApiLinkValues(
            fixture.materialize.link,
            fixture.context,
        );

        assert.deepEqual(result.parameters, fixture.materialize.expected.parameters);
        assert.equal(result.requestBody, undefined);
        assert.deepEqual(result.issues, fixture.materialize.expected.issues);
    });

    it('materializeOpenApiLinkValues strict mode throws first sorted issue message', () => {
        assert.throws(
            () => materializeOpenApiLinkValues(
                fixture.materializeStrictError.link,
                fixture.context,
                { mode: 'strict' },
            ),
            new Error(fixture.materializeStrictError.expectedMessage),
        );
    });

    it('resolveOpenApiCallbackUrl keeps malformed-template issue text', () => {
        const result = resolveOpenApiCallbackUrl(
            fixture.callback.malformedTemplate.key,
            fixture.context,
        );

        assert.equal(result.url, undefined);
        assert.deepEqual(result.issues, fixture.callback.malformedTemplate.issues);
    });

    it('resolveOpenApiCallbackUrl keeps unresolved direct expression issue text', () => {
        const result = resolveOpenApiCallbackUrl(
            fixture.callback.unresolvedDirectExpression.key,
            fixture.context,
        );

        assert.equal(result.url, undefined);
        assert.deepEqual(result.issues, fixture.callback.unresolvedDirectExpression.issues);
    });
});

// RFC 3986 §2.1 + RFC 8187 §3.2.1: strict-vs-lenient percent-decoding outcomes are baseline-locked.
describe('code-sharing baseline: percent-decoding strict and lenient outcomes', () => {
    const fixture = readFixture<PercentFixture>('percent-decoding-baseline.json');

    for (const testCase of fixture.decodePercentComponent) {
        it(`decodePercentComponent: ${testCase.name}`, () => {
            assert.equal(decodePercentComponent(testCase.input), testCase.expected);
        });
    }

    for (const testCase of fixture.percentDecode) {
        it(`percentDecode: ${testCase.name}`, () => {
            assert.equal(percentDecode(testCase.input), testCase.expected);
        });
    }

    for (const testCase of fixture.decodeExtValue) {
        it(`decodeExtValue: ${testCase.name}`, () => {
            const decoded = decodeExtValue(testCase.input);
            if (testCase.expected === null) {
                assert.equal(decoded, null);
                return;
            }

            assert.ok(decoded);
            assert.deepEqual(decoded, {
                charset: testCase.expected.charset,
                value: testCase.expected.value,
                ...(testCase.expected.language !== null ? { language: testCase.expected.language } : {}),
            });
        });
    }

    it('extractOpenApiPathParams preserves decodePathSegments strict-vs-lenient behavior', () => {
        const strictResult = extractOpenApiPathParams(
            fixture.openApiPathParams.template,
            fixture.openApiPathParams.path,
        );
        assert.deepEqual(strictResult, fixture.openApiPathParams.decodeTrueExpected);

        const lenientResult = extractOpenApiPathParams(
            fixture.openApiPathParams.template,
            fixture.openApiPathParams.path,
            { decodePathSegments: false },
        );
        assert.deepEqual(lenientResult, fixture.openApiPathParams.decodeFalseExpected);
    });
});
