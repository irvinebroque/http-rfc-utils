#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';

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
    const reportPath = parseReportPath(process.argv.slice(2));
    const result = await runCoverage();

    await mkdir(dirname(reportPath), { recursive: true });

    await writeFile(reportPath, result.output, 'utf8');

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
