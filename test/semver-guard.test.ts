/**
 * Tests for semver guard behavior.
 * Spec references are cited inline for each assertion group when applicable.
 * @see https://semver.org/
 */
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readChangesetIntent } from '../scripts/semver/changesetIntent.js';
import { compareApiDeclarations } from '../scripts/semver/compat.js';
import { evaluateSemverPolicy } from '../scripts/semver/policy.js';

const PACKAGE_NAME = '@irvinebroque/http-rfc-utils';
const SEMVER_FIXTURES_ROOT = path.join(process.cwd(), 'test', 'fixtures', 'semver');

function compareFixturePair(fixtureName: string) {
    const previousEntrypointPath = path.join(SEMVER_FIXTURES_ROOT, fixtureName, 'base.d.ts');
    const nextEntrypointPath = path.join(SEMVER_FIXTURES_ROOT, fixtureName, 'head.d.ts');

    return compareApiDeclarations({
        previousEntrypointPath,
        nextEntrypointPath,
    });
}

async function readIntentFromFixture(fileName: string) {
    const temporaryRepoRoot = await mkdtemp(path.join(os.tmpdir(), 'semver-changeset-fixture-'));

    try {
        const changesetDirectory = path.join(temporaryRepoRoot, '.changeset');
        await mkdir(changesetDirectory, { recursive: true });

        const sourcePath = path.join(SEMVER_FIXTURES_ROOT, 'changesets', fileName);
        const destinationPath = path.join(changesetDirectory, 'fixture.md');
        await copyFile(sourcePath, destinationPath);

        return await readChangesetIntent({
            repoRoot: temporaryRepoRoot,
            changedFiles: ['.changeset/fixture.md'],
            packageName: PACKAGE_NAME,
        });
    } finally {
        await rm(temporaryRepoRoot, { recursive: true, force: true });
    }
}

async function withAllowlistFile(
    content: string,
    callback: (allowlistPath: string) => Promise<void>
): Promise<void> {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'semver-allowlist-fixture-'));

    try {
        const allowlistPath = path.join(temporaryDirectory, 'allowlist.json');
        await writeFile(allowlistPath, content, 'utf8');
        await callback(allowlistPath);
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}

// SemVer 2.0.0 item 8: incompatible public API changes require a major bump.
describe('semver API compatibility fixtures (SemVer 2.0.0 item 8)', () => {
    it('flags removed exports as breaking', () => {
        const result = compareFixturePair('removed-export');
        assert.equal(result.breaking, true);
        assert.ok(
            result.findings.some(
                finding => finding.exportName === 'removed' && finding.reason === 'missing-export'
            )
        );
    });

    it('flags renamed exports as breaking', () => {
        const result = compareFixturePair('renamed-export');
        assert.equal(result.breaking, true);
        assert.ok(
            result.findings.some(
                finding => finding.exportName === 'oldName' && finding.reason === 'missing-export'
            )
        );
    });

    it('flags optional to required type changes as breaking', () => {
        const result = compareFixturePair('optional-to-required');
        assert.equal(result.breaking, true);
        assert.ok(
            result.findings.some(
                finding =>
                    finding.exportName === 'SessionOptions' &&
                    finding.reason === 'incompatible-export'
            )
        );
    });

    it('flags added required function parameters as breaking', () => {
        const result = compareFixturePair('add-required-parameter');
        assert.equal(result.breaking, true);
        assert.ok(
            result.findings.some(
                finding =>
                    finding.exportName === 'runTask' && finding.reason === 'incompatible-export'
            )
        );
    });

    it('treats widened function parameter types as non-breaking', () => {
        const result = compareFixturePair('widen-parameter');
        assert.equal(result.breaking, false);
    });

    it('treats additive exports as non-breaking', () => {
        const result = compareFixturePair('add-export-only');
        assert.equal(result.breaking, false);
    });
});

// SemVer 2.0.0 item 8: major bump is required for backward incompatible changes.
describe('semver policy gate (SemVer 2.0.0)', () => {
    it('fails when breaking API changes are paired with patch intent', async () => {
        const comparison = compareFixturePair('removed-export');
        const intent = await readIntentFromFixture('patch.md');
        const outcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: intent.declaredBump,
            codeChanged: true,
            changesetIssues: intent.issues,
        });

        assert.equal(outcome.pass, false);
        assert.ok(
            outcome.messages.some(message =>
                message.includes('breaking API changes require major but declared bump is patch')
            )
        );
    });

    it('fails when breaking API changes are paired with minor intent', async () => {
        const comparison = compareFixturePair('removed-export');
        const intent = await readIntentFromFixture('minor.md');
        const outcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: intent.declaredBump,
            codeChanged: true,
            changesetIssues: intent.issues,
        });

        assert.equal(outcome.pass, false);
        assert.ok(
            outcome.messages.some(message =>
                message.includes('breaking API changes require major but declared bump is minor')
            )
        );
    });

    it('passes when breaking API changes are paired with major intent', async () => {
        const comparison = compareFixturePair('removed-export');
        const intent = await readIntentFromFixture('major.md');
        const outcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: intent.declaredBump,
            codeChanged: true,
            changesetIssues: intent.issues,
        });

        assert.equal(outcome.pass, true);
    });

    it('fails when additive API changes are paired with patch intent', async () => {
        const comparison = compareFixturePair('add-export-only');
        const intent = await readIntentFromFixture('patch.md');
        const outcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: intent.declaredBump,
            codeChanged: true,
            changesetIssues: intent.issues,
        });

        assert.equal(outcome.pass, false);
        assert.equal(outcome.requiredBump, 'minor');
        assert.ok(
            outcome.messages.some(message =>
                message.includes('additive API changes require minor but declared bump is patch')
            )
        );
    });

    it('passes when additive API changes are paired with minor intent', async () => {
        const comparison = compareFixturePair('add-export-only');
        const intent = await readIntentFromFixture('minor.md');
        const outcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: intent.declaredBump,
            codeChanged: true,
            changesetIssues: intent.issues,
        });

        assert.equal(outcome.pass, true);
        assert.equal(outcome.requiredBump, 'minor');
    });

    it('keeps patch requirement for non-breaking, non-additive API changes', async () => {
        const comparison = compareFixturePair('widen-parameter');
        const intent = await readIntentFromFixture('patch.md');
        const outcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: intent.declaredBump,
            codeChanged: true,
            changesetIssues: intent.issues,
        });

        assert.equal(outcome.pass, true);
        assert.equal(outcome.requiredBump, 'patch');
    });

    it('fails for malformed or empty changeset intent', async () => {
        const comparison = compareFixturePair('removed-export');
        const intent = await readIntentFromFixture('empty.md');
        const outcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: intent.declaredBump,
            codeChanged: true,
            changesetIssues: intent.issues,
        });

        assert.equal(intent.declaredBump, null);
        assert.ok(intent.issues.length > 0);
        assert.equal(outcome.pass, false);
    });

    // SemVer 2.0.0 item 8 + project policy: allowlist must be valid JSON.
    it('fails when allowlist JSON is invalid', async () => {
        const comparison = compareFixturePair('add-export-only');

        await withAllowlistFile('{ invalid json', async (allowlistPath) => {
            const outcome = await evaluateSemverPolicy({
                packageName: PACKAGE_NAME,
                comparison,
                declaredBump: 'patch',
                codeChanged: true,
                changesetIssues: [],
                allowlistPath,
            });

            assert.equal(outcome.pass, false);
            assert.ok(outcome.allowlistIssues.some(issue => issue.includes('not valid JSON')));
            assert.ok(outcome.messages.includes('allowlist configuration contains errors'));
        });
    });

    // SemVer 2.0.0 item 8 + project policy: allowlist schema fields are required.
    it('fails when allowlist entries violate schema requirements', async () => {
        const comparison = compareFixturePair('add-export-only');
        const invalidEntries = JSON.stringify([
            { exportName: '', justification: 'x', expiresOn: '2030-01-01' },
            { exportName: 'removed', reason: 'bad-reason', justification: 'x', expiresOn: '2030-01-01' },
            { exportName: 'removed', justification: '', expiresOn: '2030-01-01' },
            { exportName: 'removed', justification: 'x', expiresOn: 'not-a-date' },
            'not-an-object',
        ]);

        await withAllowlistFile(invalidEntries, async (allowlistPath) => {
            const outcome = await evaluateSemverPolicy({
                packageName: PACKAGE_NAME,
                comparison,
                declaredBump: 'patch',
                codeChanged: true,
                changesetIssues: [],
                allowlistPath,
            });

            assert.equal(outcome.pass, false);
            assert.ok(outcome.allowlistIssues.length >= 4);
            assert.ok(outcome.messages.includes('allowlist configuration contains errors'));
        });
    });

    // SemVer 2.0.0 item 8: expired allowlist entries must not suppress active breaking findings.
    it('does not ignore breaking findings when allowlist entries are expired', async () => {
        const comparison = compareFixturePair('removed-export');
        const allowlist = JSON.stringify([
            {
                exportName: 'removed',
                reason: 'missing-export',
                justification: 'temporary migration window',
                expiresOn: '2020-01-01T00:00:00.000Z',
            },
        ]);

        await withAllowlistFile(allowlist, async (allowlistPath) => {
            const outcome = await evaluateSemverPolicy({
                packageName: PACKAGE_NAME,
                comparison,
                declaredBump: 'patch',
                codeChanged: true,
                changesetIssues: [],
                allowlistPath,
                now: new Date('2026-01-01T00:00:00.000Z'),
            });

            assert.equal(outcome.pass, false);
            assert.equal(outcome.effectiveFindings.length > 0, true);
            assert.equal(outcome.ignoredFindings.length, 0);
        });
    });

    // SemVer 2.0.0 item 8: active allowlist entries can suppress matching findings temporarily.
    it('ignores matching active allowlist findings', async () => {
        const comparison = compareFixturePair('removed-export');
        const allowlist = JSON.stringify([
            {
                exportName: 'removed',
                reason: 'missing-export',
                justification: 'temporary migration window',
                expiresOn: '2030-01-01T00:00:00.000Z',
            },
        ]);

        await withAllowlistFile(allowlist, async (allowlistPath) => {
            const outcome = await evaluateSemverPolicy({
                packageName: PACKAGE_NAME,
                comparison,
                declaredBump: 'patch',
                codeChanged: true,
                changesetIssues: [],
                allowlistPath,
                now: new Date('2026-01-01T00:00:00.000Z'),
            });

            assert.equal(outcome.pass, true);
            assert.equal(outcome.effectiveFindings.length, 0);
            assert.equal(outcome.ignoredFindings.length > 0, true);
        });
    });

    // SemVer 2.0.0 item 8: allowlist reason must match finding reason when specified.
    it('does not ignore allowlisted exports when reason does not match', async () => {
        const comparison = compareFixturePair('removed-export');
        const allowlist = JSON.stringify([
            {
                exportName: 'removed',
                reason: 'incompatible-export',
                justification: 'wrong reason intentionally',
                expiresOn: '2030-01-01T00:00:00.000Z',
            },
        ]);

        await withAllowlistFile(allowlist, async (allowlistPath) => {
            const outcome = await evaluateSemverPolicy({
                packageName: PACKAGE_NAME,
                comparison,
                declaredBump: 'patch',
                codeChanged: true,
                changesetIssues: [],
                allowlistPath,
                now: new Date('2026-01-01T00:00:00.000Z'),
            });

            assert.equal(outcome.pass, false);
            assert.equal(outcome.ignoredFindings.length, 0);
            assert.equal(outcome.effectiveFindings.length > 0, true);
        });
    });

    // SemVer 2.0.0 item 7 and item 8 + project strict policy: declared bump ordering can be enforced.
    it('enforces strict bump ordering when strict mode is enabled', async () => {
        const comparison = compareFixturePair('removed-export');
        const outcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: 'minor',
            codeChanged: true,
            changesetIssues: [],
            strictMode: true,
        });

        assert.equal(outcome.pass, false);
        assert.ok(
            outcome.messages.some(message =>
                message.includes('strict mode: declared bump minor is lower than required major')
            )
        );
    });

    // SemVer 2.0.0 item 7 and item 8 + repo policy: code changes require a declared bump, docs-only changes do not.
    it('distinguishes code-change and no-code-change bump requirements', async () => {
        const comparison = compareFixturePair('add-export-only');

        const docsOnlyOutcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: null,
            codeChanged: false,
            changesetIssues: [],
        });

        const codeChangeOutcome = await evaluateSemverPolicy({
            packageName: PACKAGE_NAME,
            comparison,
            declaredBump: null,
            codeChanged: true,
            changesetIssues: [],
        });

        assert.equal(docsOnlyOutcome.pass, true);
        assert.equal(codeChangeOutcome.pass, false);
        assert.ok(
            codeChangeOutcome.messages.some(message =>
                message.includes('code changes detected without a valid changeset bump')
            )
        );
    });
});
