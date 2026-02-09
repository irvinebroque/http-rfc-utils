#!/usr/bin/env node

import { spawn } from 'node:child_process';

const COVERAGE_ARGS = [
    '--import',
    'tsx',
    '--experimental-test-coverage',
    '--test',
    'test/*.test.ts',
];

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

function parseCoverageTable(output) {
    const lines = output.split(/\r?\n/gu);
    const startIndex = lines.findIndex(line => line.includes('start of coverage report'));
    const endIndex = lines.findIndex((line, index) => index > startIndex && line.includes('end of coverage report'));

    if (startIndex === -1 || endIndex === -1) {
        return null;
    }

    const entries = new Map();
    const stack = [];
    let allFiles = null;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
        const line = stripAnsi(lines[index] ?? '');
        if (!line.includes('|')) {
            continue;
        }

        const withoutInfo = line.replace(/^\s*ℹ\s?/u, '');
        const columns = withoutInfo.split('|');
        if (columns.length < 4) {
            continue;
        }

        const labelColumn = columns[0] ?? '';
        const label = labelColumn.trim();
        if (!label || label === 'file' || /^-+$/u.test(label)) {
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
            if (label !== 'all files') {
                stack.push({ indent, name: label });
            }
            continue;
        }

        if (label === 'all files') {
            allFiles = {
                line: linePct,
                branch: branchPct,
                funcs: funcsPct,
            };
            continue;
        }

        const path = [...stack.map(entry => entry.name), label].join('/');
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
    if (entries.has(targetPath)) {
        return entries.get(targetPath);
    }

    const targetBasename = targetPath.split('/').pop();
    for (const [entryPath, metrics] of entries.entries()) {
        if (entryPath.endsWith(`/${targetPath}`) || entryPath.endsWith(`/${targetBasename}`)) {
            return metrics;
        }
    }

    return null;
}

function runCoverageCommand() {
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
    const enforceHotspots = process.env.COVERAGE_ENFORCE_HOTSPOTS === '1'
        || process.env.COVERAGE_ENFORCE_HOTSPOTS === 'true';

    const result = await runCoverageCommand();
    if (result.code !== 0) {
        process.exit(result.code);
    }

    const parsed = parseCoverageTable(result.output);
    if (!parsed || !parsed.allFiles) {
        console.error('Coverage check failed: could not parse coverage summary from test output.');
        process.exit(1);
    }

    const globalFailures = evaluateThresholds(parsed.allFiles, GLOBAL_THRESHOLDS);
    if (globalFailures.length > 0) {
        console.error(`Global coverage thresholds failed: ${globalFailures.join('; ')}`);
        process.exit(1);
    }

    const hotspotWarnings = [];
    const hotspotFailures = [];

    for (const hotspot of HOTSPOT_THRESHOLDS) {
        const metrics = findEntry(parsed.entries, hotspot.path);
        if (!metrics) {
            hotspotWarnings.push(`missing coverage row for ${hotspot.path}`);
            continue;
        }

        const failures = evaluateThresholds(metrics, hotspot);
        if (failures.length > 0) {
            hotspotFailures.push(`${hotspot.path}: ${failures.join('; ')}`);
        }
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
