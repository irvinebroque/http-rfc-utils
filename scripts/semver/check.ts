#!/usr/bin/env node

/**
 * CLI entrypoint for SemVer API checks.
 * Compares emitted declaration surfaces against a base ref and validates
 * changeset bump intent for release safety.
 * @see https://semver.org/
 */

import { rm } from 'node:fs/promises';
import path from 'node:path';
import { createSemverWorkspaceRoot, emitDeclarationsForRef, emitHeadDeclarations } from './buildDts.js';
import { readChangesetIntent } from './changesetIntent.js';
import { compareApiDeclarations } from './compat.js';
import { getChangedFilesSinceMergeBase, resolveMergeBase } from './git.js';
import { evaluateSemverPolicy } from './policy.js';
import { buildHumanReport, buildJsonReport } from './report.js';

interface CliOptions {
    baseRef: string;
    packageName: string;
    allowlistPath?: string;
    strictMode: boolean;
    reportOnly: boolean;
    json: boolean;
    help: boolean;
}

function printUsage(): void {
    console.log(
        [
            'Usage: tsx scripts/semver/check.ts [options]',
            '',
            'Options:',
            '  --base-ref <ref>      Base git ref to compare against (default: origin/main)',
            '  --package <name>      Package name in changesets (default: @irvinebroque/http-rfc-utils)',
            '  --allowlist <path>    Optional path to a JSON allowlist file',
            '  --strict              Enforce full required bump ordering (future strict mode)',
            '  --report-only         Print diagnostics but always exit 0',
            '  --json                Output JSON report',
            '  --help                Show this help text',
        ].join('\n')
    );
}

function parseCliOptions(argv: string[]): CliOptions {
    const options: CliOptions = {
        baseRef: 'origin/main',
        packageName: '@irvinebroque/http-rfc-utils',
        strictMode: false,
        reportOnly: false,
        json: false,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];

        if (argument === '--') {
            continue;
        }

        if (argument === '--base-ref') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('Missing value for --base-ref');
            }
            options.baseRef = value;
            index += 1;
            continue;
        }

        if (argument === '--package') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('Missing value for --package');
            }
            options.packageName = value;
            index += 1;
            continue;
        }

        if (argument === '--allowlist') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('Missing value for --allowlist');
            }
            options.allowlistPath = value;
            index += 1;
            continue;
        }

        if (argument === '--strict') {
            options.strictMode = true;
            continue;
        }

        if (argument === '--report-only') {
            options.reportOnly = true;
            continue;
        }

        if (argument === '--json') {
            options.json = true;
            continue;
        }

        if (argument === '--help' || argument === '-h') {
            options.help = true;
            continue;
        }

        throw new Error(`Unknown argument: ${argument}`);
    }

    return options;
}

function isCodeChange(filePath: string): boolean {
    const normalized = filePath.replace(/\\/gu, '/');

    return (
        normalized.startsWith('src/') ||
        normalized.startsWith('scripts/') ||
        normalized === 'package.json' ||
        normalized === 'tsconfig.json'
    );
}

async function main(): Promise<void> {
    const options = parseCliOptions(process.argv.slice(2));
    if (options.help) {
        printUsage();
        return;
    }

    const repoRoot = process.cwd();
    const mergeBase = await resolveMergeBase(repoRoot, options.baseRef);
    const changedFiles = await getChangedFilesSinceMergeBase(repoRoot, mergeBase);
    const codeChanged = changedFiles.some(isCodeChange);
    const workspaceRoot = await createSemverWorkspaceRoot();

    try {
        const baseDeclarations = await emitDeclarationsForRef(repoRoot, mergeBase, workspaceRoot);
        const headDeclarations = await emitHeadDeclarations(repoRoot, workspaceRoot);
        const comparison = compareApiDeclarations({
            previousEntrypointPath: baseDeclarations.entrypointPath,
            nextEntrypointPath: headDeclarations.entrypointPath,
        });

        const changesetIntent = await readChangesetIntent({
            repoRoot,
            changedFiles,
            packageName: options.packageName,
        });

        const policy = await evaluateSemverPolicy({
            packageName: options.packageName,
            comparison,
            declaredBump: changesetIntent.declaredBump,
            codeChanged,
            changesetIssues: changesetIntent.issues,
            strictMode: options.strictMode,
            allowlistPath: options.allowlistPath
                ? path.resolve(repoRoot, options.allowlistPath)
                : undefined,
        });

        const report = {
            packageName: options.packageName,
            baseRef: options.baseRef,
            mergeBase,
            changedFiles,
            codeChanged,
            declaredBump: changesetIntent.declaredBump,
            changedChangesetFiles: changesetIntent.changedChangesetFiles,
            changesetIssues: changesetIntent.issues,
            comparison,
            policy,
        };

        if (options.json) {
            console.log(JSON.stringify(buildJsonReport(report), null, 2));
        } else {
            console.log(buildHumanReport(report));
        }

        if (!options.reportOnly && !policy.pass) {
            process.exitCode = 1;
        }
    } finally {
        await rm(workspaceRoot, { recursive: true, force: true });
    }
}

try {
    await main();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`semver check failed: ${message}`);
    process.exitCode = 1;
}
