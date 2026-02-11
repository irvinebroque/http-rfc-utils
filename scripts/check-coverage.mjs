#!/usr/bin/env node

/**
 * Coverage threshold validator.
 *
 * Parses the persisted coverage report, enforces global thresholds, and emits
 * optional hotspot diagnostics for targeted modules.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';

const DEFAULT_REPORT_PATH = 'temp/coverage/report.txt';
const DEFAULT_SUMMARY_FILE = 'summary.json';

const GLOBAL_THRESHOLDS = {
    line: 96,
    branch: 81,
    funcs: 95,
};

const HOTSPOT_THRESHOLDS = [
    { path: 'src/response.ts', line: 85, branch: 70, funcs: 85 },
    { path: 'src/cors.ts', line: 89, branch: 65, funcs: 80 },
    { path: 'src/cache-status.ts', line: 86, branch: 55, funcs: 100 },
    { path: 'src/cookie.ts', line: 91, branch: 50, funcs: 100 },
    { path: 'src/trace-context.ts', line: 91, branch: 60, funcs: 93 },
    { path: 'src/ni.ts', line: 93, branch: 58, funcs: 90 },
    { path: 'scripts/semver/policy.ts', line: 85, branch: 75, funcs: 85 },
];

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

function parseCoverageSummary(rawJson, summaryPath) {
    let parsed;

    try {
        parsed = JSON.parse(rawJson);
    } catch (error) {
        throw new Error(`Coverage summary at ${summaryPath} is not valid JSON.`);
    }

    const allFiles = parsed?.allFiles;
    if (
        !allFiles
        || !Number.isFinite(allFiles.line)
        || !Number.isFinite(allFiles.branch)
        || !Number.isFinite(allFiles.funcs)
    ) {
        throw new Error(`Coverage summary at ${summaryPath} is missing a valid allFiles metric block.`);
    }

    const entries = new Map();
    const serializedEntries = parsed?.entries;

    if (Array.isArray(serializedEntries)) {
        for (const entry of serializedEntries) {
            if (
                !entry
                || typeof entry.path !== 'string'
                || !Number.isFinite(entry.line)
                || !Number.isFinite(entry.branch)
                || !Number.isFinite(entry.funcs)
            ) {
                throw new Error(`Coverage summary at ${summaryPath} has an invalid entry record.`);
            }

            const normalizedPath = normalizeCoveragePath(entry.path);
            if (entries.has(normalizedPath)) {
                throw new Error(`Coverage summary at ${summaryPath} has duplicate entries for ${normalizedPath}.`);
            }

            entries.set(normalizedPath, {
                line: entry.line,
                branch: entry.branch,
                funcs: entry.funcs,
            });
        }
    } else if (serializedEntries && typeof serializedEntries === 'object') {
        for (const [entryPath, metrics] of Object.entries(serializedEntries)) {
            if (
                !metrics
                || !Number.isFinite(metrics.line)
                || !Number.isFinite(metrics.branch)
                || !Number.isFinite(metrics.funcs)
            ) {
                throw new Error(`Coverage summary at ${summaryPath} has an invalid entry record.`);
            }

            const normalizedPath = normalizeCoveragePath(entryPath);
            if (entries.has(normalizedPath)) {
                throw new Error(`Coverage summary at ${summaryPath} has duplicate entries for ${normalizedPath}.`);
            }

            entries.set(normalizedPath, {
                line: metrics.line,
                branch: metrics.branch,
                funcs: metrics.funcs,
            });
        }
    } else {
        throw new Error(`Coverage summary at ${summaryPath} is missing an entries collection.`);
    }

    return {
        allFiles: {
            line: allFiles.line,
            branch: allFiles.branch,
            funcs: allFiles.funcs,
        },
        entries,
    };
}

function evaluateThresholds(actual, expected) {
    const failures = [];
    if (actual.line < expected.line) {
        failures.push(`line ${actual.line.toFixed(2)} < ${expected.line.toFixed(2)}`);
    }
    if (actual.branch < expected.branch) {
        failures.push(`branch ${actual.branch.toFixed(2)} < ${expected.branch.toFixed(2)}`);
    }
    if (actual.funcs < expected.funcs) {
        failures.push(`funcs ${actual.funcs.toFixed(2)} < ${expected.funcs.toFixed(2)}`);
    }
    return failures;
}

function findEntry(entries, targetPath) {
    const normalizedTargetPath = normalizeCoveragePath(targetPath);

    if (entries.has(normalizedTargetPath)) {
        return entries.get(normalizedTargetPath);
    }

    const suffixMatches = [];

    for (const [entryPath, metrics] of entries.entries()) {
        if (entryPath.endsWith(`/${normalizedTargetPath}`)) {
            suffixMatches.push({ entryPath, metrics });
        }
    }

    if (suffixMatches.length === 1) {
        return suffixMatches[0].metrics;
    }

    if (suffixMatches.length > 1) {
        const matches = suffixMatches.map(match => match.entryPath).sort().join(', ');
        throw new Error(`Ambiguous coverage rows for ${targetPath}: ${matches}`);
    }

    return null;
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

async function main() {
    const argv = process.argv.slice(2);
    const reportPath = parseReportPath(argv);
    const summaryPath = parseSummaryPath(argv, reportPath);
    const enforceHotspots = process.env.COVERAGE_ENFORCE_HOTSPOTS === '1'
        || process.env.COVERAGE_ENFORCE_HOTSPOTS === 'true';

    let parsed = null;

    try {
        const summaryRaw = await readFile(summaryPath, 'utf8');
        parsed = parseCoverageSummary(summaryRaw, summaryPath);
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
            console.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }

    if (!parsed) {
        let output;

        try {
            output = await readFile(reportPath, 'utf8');
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                console.error(`Coverage check failed: report file not found at ${reportPath}.`);
                console.error('Run `pnpm test:coverage` before `pnpm test:coverage:check`.');
                process.exit(1);
            }
            throw error;
        }

        parsed = parseCoverageTable(output);
    }

    if (!parsed?.allFiles) {
        console.error('Coverage check failed: could not parse coverage summary from test output.');
        console.error(`Checked summary artifact: ${summaryPath}`);
        console.error(`Checked report artifact: ${reportPath}`);
        process.exit(1);
    }

    const globalFailures = evaluateThresholds(parsed.allFiles, GLOBAL_THRESHOLDS);
    if (globalFailures.length > 0) {
        console.error(`Global coverage thresholds failed: ${globalFailures.join('; ')}`);
        process.exit(1);
    }

    const hotspotWarnings = [];
    const hotspotFailures = [];
    const hotspotResolutionErrors = [];

    for (const hotspot of HOTSPOT_THRESHOLDS) {
        let metrics;

        try {
            metrics = findEntry(parsed.entries, hotspot.path);
        } catch (error) {
            hotspotResolutionErrors.push(error instanceof Error ? error.message : String(error));
            continue;
        }

        if (!metrics) {
            hotspotWarnings.push(`missing coverage row for ${hotspot.path}`);
            continue;
        }

        const failures = evaluateThresholds(metrics, hotspot);
        if (failures.length > 0) {
            hotspotFailures.push(`${hotspot.path}: ${failures.join('; ')}`);
        }
    }

    if (hotspotResolutionErrors.length > 0) {
        console.error('Coverage check failed: ambiguous hotspot path resolution.');
        for (const resolutionError of hotspotResolutionErrors) {
            console.error(`- ${resolutionError}`);
        }
        process.exit(1);
    }

    if (hotspotFailures.length > 0) {
        if (enforceHotspots) {
            console.error('Hotspot coverage thresholds failed:');
            for (const failure of hotspotFailures) {
                console.error(`- ${failure}`);
            }
            process.exit(1);
        }

        console.warn('Hotspot coverage warnings (non-blocking):');
        for (const failure of hotspotFailures) {
            console.warn(`- ${failure}`);
        }
    }

    if (hotspotWarnings.length > 0) {
        console.warn('Hotspot coverage metadata warnings:');
        for (const warning of hotspotWarnings) {
            console.warn(`- ${warning}`);
        }
    }

    console.log('Coverage thresholds passed.');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
