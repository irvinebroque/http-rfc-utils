#!/usr/bin/env node

/**
 * Coverage runner wrapper.
 *
 * Executes the Node test coverage pass and persists full stdout/stderr output
 * to a report file consumed by downstream threshold checks.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, posix } from 'node:path';

const COVERAGE_EXCLUDES = [
    'src/types/*.ts',
];

const COVERAGE_ARGS = [
    '--import',
    'tsx',
    '--experimental-test-coverage',
    ...COVERAGE_EXCLUDES.map((pattern) => `--test-coverage-exclude=${pattern}`),
    '--test',
    'test/*.test.ts',
];

const DEFAULT_REPORT_PATH = 'temp/coverage/report.txt';
const DEFAULT_SUMMARY_FILE = 'summary.json';

function stripAnsi(value) {
    return value.replace(/\u001b\[[0-9;]*m/gu, '');
}

function parsePercent(cell) {
    const trimmed = cell.trim();
    if (!trimmed) {
        return null;
    }

    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCoveragePath(value) {
    const withForwardSlashes = value.trim().replace(/\\/gu, '/');
    const normalized = posix.normalize(withForwardSlashes);
    return normalized.replace(/^(?:\.\/)+/u, '');
}

function normalizeCoverageLine(line) {
    return stripAnsi(line)
        .replace(/^\s*#\s?/u, '')
        .replace(/^\s*ℹ\s?/u, '');
}

function parseCoverageTable(output) {
    const lines = output.split(/\r?\n/gu);
    const headerPattern = /^\s*file\s*\|\s*line\s*%\s*\|\s*branch\s*%\s*\|\s*funcs\s*%/iu;
    const startIndex = lines.findIndex(line => headerPattern.test(normalizeCoverageLine(line)));

    if (startIndex === -1) {
        return null;
    }

    const entries = new Map();
    const stack = [];
    let allFiles = null;

    for (let index = startIndex + 1; index < lines.length; index += 1) {
        const withoutInfo = normalizeCoverageLine(lines[index] ?? '');
        if (!withoutInfo.includes('|')) {
            continue;
        }

        const columns = withoutInfo.split('|');
        if (columns.length < 4) {
            continue;
        }

        const labelColumn = columns[0] ?? '';
        const label = labelColumn.trim();
        const normalizedLabel = label.toLowerCase();
        if (!label || normalizedLabel === 'file' || /^-+$/u.test(label)) {
            continue;
        }

        const linePct = parsePercent(columns[1] ?? '');
        const branchPct = parsePercent(columns[2] ?? '');
        const funcsPct = parsePercent(columns[3] ?? '');
        const hasMetrics = linePct !== null && branchPct !== null && funcsPct !== null;

        const indent = labelColumn.length - labelColumn.trimStart().length;
        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        if (!hasMetrics) {
            if (normalizedLabel !== 'all files') {
                stack.push({ indent, name: label });
            }
            continue;
        }

        if (normalizedLabel === 'all files') {
            allFiles = {
                line: linePct,
                branch: branchPct,
                funcs: funcsPct,
            };
            continue;
        }

        const path = normalizeCoveragePath([...stack.map(entry => entry.name), label].join('/'));
        entries.set(path, {
            line: linePct,
            branch: branchPct,
            funcs: funcsPct,
        });
    }

    return {
        allFiles,
        entries,
    };
}

function parseReportPath(argv) {
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--report') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('Missing value for --report');
            }
            return value;
        }
    }

    return DEFAULT_REPORT_PATH;
}

function summaryPathFromReportPath(reportPath) {
    return join(dirname(reportPath), DEFAULT_SUMMARY_FILE);
}

function parseSummaryPath(argv, reportPath) {
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--summary') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('Missing value for --summary');
            }
            return value;
        }
    }

    return summaryPathFromReportPath(reportPath);
}

function runCoverage() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, COVERAGE_ARGS, {
            stdio: ['inherit', 'pipe', 'pipe'],
            env: process.env,
        });

        let output = '';

        child.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            output += text;
            process.stdout.write(text);
        });

        child.stderr.on('data', (chunk) => {
            const text = chunk.toString();
            output += text;
            process.stderr.write(text);
        });

        child.on('error', reject);

        child.on('close', (code) => {
            resolve({
                code: code ?? 1,
                output,
            });
        });
    });
}

async function main() {
    const argv = process.argv.slice(2);
    const reportPath = parseReportPath(argv);
    const summaryPath = parseSummaryPath(argv, reportPath);
    const result = await runCoverage();

    await mkdir(dirname(reportPath), { recursive: true });

    await writeFile(reportPath, result.output, 'utf8');

    const parsed = parseCoverageTable(result.output);
    if (parsed?.allFiles) {
        const entries = [...parsed.entries.entries()]
            .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
            .map(([path, metrics]) => ({
                path,
                line: metrics.line,
                branch: metrics.branch,
                funcs: metrics.funcs,
            }));

        const summary = {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            sourceReportPath: reportPath,
            allFiles: parsed.allFiles,
            entries,
        };

        await mkdir(dirname(summaryPath), { recursive: true });
        await writeFile(summaryPath, `${JSON.stringify(summary, null, 4)}\n`, 'utf8');
    } else {
        console.warn('Coverage run warning: unable to parse coverage table for structured summary emission.');
        console.warn(`Coverage check will fall back to report parsing at ${reportPath}.`);
    }

    if (result.code !== 0) {
        process.exit(result.code);
    }
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
