import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_SCRIPT_PATH = path.join(ROOT, 'scripts', 'check-coverage.mjs');

interface CoverageSummaryFixture {
    allFiles: {
        line: number;
        branch: number;
        funcs: number;
    };
    entries: Array<{
        path: string;
        line: number;
        branch: number;
        funcs: number;
    }>;
}

async function withTempCoverageArtifacts(
    callback: (artifacts: {
        root: string;
        reportPath: string;
        summaryPath: string;
    }) => Promise<void>
): Promise<void> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-tooling-'));
    const reportPath = path.join(root, 'report.txt');
    const summaryPath = path.join(root, 'summary.json');

    try {
        await callback({
            root,
            reportPath,
            summaryPath,
        });
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

async function writeSummary(summaryPath: string, summary: CoverageSummaryFixture): Promise<void> {
    const payload = {
        schemaVersion: 1,
        generatedAt: new Date('2026-02-11T00:00:00.000Z').toISOString(),
        sourceReportPath: 'temp/coverage/report.txt',
        allFiles: summary.allFiles,
        entries: summary.entries,
    };

    await fs.writeFile(summaryPath, `${JSON.stringify(payload, null, 4)}\n`, 'utf8');
}

function runCheck(reportPath: string) {
    return spawnSync('node', [CHECK_SCRIPT_PATH, '--report', reportPath], {
        cwd: ROOT,
        encoding: 'utf8',
    });
}

describe('coverage tooling hardening (F13)', () => {
    it('uses structured coverage summary when available', async () => {
        await withTempCoverageArtifacts(async ({ reportPath, summaryPath }) => {
            await fs.writeFile(reportPath, 'not a coverage report\n', 'utf8');
            await writeSummary(summaryPath, {
                allFiles: {
                    line: 97.5,
                    branch: 88.0,
                    funcs: 98.0,
                },
                entries: [
                    {
                        path: 'src/response.ts',
                        line: 90,
                        branch: 80,
                        funcs: 90,
                    },
                ],
            });

            const result = runCheck(reportPath);
            assert.equal(result.status, 0, result.stderr);
            assert.match(result.stdout, /Coverage thresholds passed\./);
        });
    });

    it('fails with explicit ambiguity errors for duplicate suffix matches', async () => {
        await withTempCoverageArtifacts(async ({ reportPath, summaryPath }) => {
            await fs.writeFile(reportPath, 'fallback report content\n', 'utf8');
            await writeSummary(summaryPath, {
                allFiles: {
                    line: 97.5,
                    branch: 88.0,
                    funcs: 98.0,
                },
                entries: [
                    {
                        path: 'packages/a/src/response.ts',
                        line: 90,
                        branch: 80,
                        funcs: 90,
                    },
                    {
                        path: 'packages/b/src/response.ts',
                        line: 90,
                        branch: 80,
                        funcs: 90,
                    },
                ],
            });

            const result = runCheck(reportPath);
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /Coverage check failed: ambiguous hotspot path resolution\./);
            assert.match(result.stderr, /Ambiguous coverage rows for src\/response\.ts/);
        });
    });

    it('parses legacy reports without sentinel markers', async () => {
        await withTempCoverageArtifacts(async ({ reportPath }) => {
            const report = [
                'ℹ file                                          | line % | branch % | funcs % | uncovered lines',
                'ℹ src                                           |        |          |         |',
                'ℹ  response.ts                                  |  98.95 |    95.45 |  100.00 |',
                'ℹ all files                                     |  97.11 |    87.20 |   98.78 |',
            ].join('\n');

            await fs.writeFile(reportPath, `${report}\n`, 'utf8');

            const result = runCheck(reportPath);
            assert.equal(result.status, 0, result.stderr);
            assert.match(result.stdout, /Coverage thresholds passed\./);
        });
    });
});
