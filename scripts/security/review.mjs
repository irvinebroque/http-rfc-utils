import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REVIEW_DOC = 'docs/security/security-review-2026Q1.md';

const REQUIRED_PATHS = [
    REVIEW_DOC,
    'docs/security/review-template.md',
    'docs/security/finding-template.md',
    'docs/security/findings.json',
    'test/fuzz/fast-check-harness.ts',
    'test/fuzz/invariants.ts',
    'test/fuzz/security-fuzz.spec.ts',
    'scripts/fuzz/replay-fast-check.mjs',
    'scripts/fuzz/promote-counterexample.mjs',
    'scripts/security/risk-register.mjs',
];

const REQUIRED_REVIEW_SNIPPETS = [
    '## Scope',
    '## Risk rubric',
    '## SLA targets',
    '## Module inventory',
    '## Baseline snapshot',
];

function rootPath(relPath) {
    return path.join(ROOT, relPath);
}

async function assertExists(relPath) {
    try {
        await fs.access(rootPath(relPath));
    } catch {
        throw new Error(`Missing required security artifact: ${relPath}`);
    }
}

function resolveGitSha() {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: ROOT,
            encoding: 'utf8',
        }).trim();
    } catch {
        return null;
    }
}

async function writeBaselineSnapshot() {
    const lockfilePath = rootPath('pnpm-lock.yaml');
    const lockfileContent = await fs.readFile(lockfilePath, 'utf8');
    const lockfileSha256 = createHash('sha256').update(lockfileContent).digest('hex');
    const commitSha = resolveGitSha();

    const snapshot = {
        generatedAt: new Date().toISOString(),
        commitSha,
        lockfileSha256,
        baselineCommands: [
            'pnpm check:structure',
            'pnpm typecheck',
            'pnpm test',
            'pnpm build',
        ],
    };

    const outputDirectory = rootPath(path.join('temp', 'security'));
    await fs.mkdir(outputDirectory, { recursive: true });

    const outputPath = path.join(outputDirectory, 'baseline-2026Q1.json');
    await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 4)}\n`, 'utf8');

    return path.relative(ROOT, outputPath);
}

async function main() {
    for (const relPath of REQUIRED_PATHS) {
        await assertExists(relPath);
    }

    const reviewContent = await fs.readFile(rootPath(REVIEW_DOC), 'utf8');
    for (const snippet of REQUIRED_REVIEW_SNIPPETS) {
        if (!reviewContent.includes(snippet)) {
            throw new Error(`Expected ${REVIEW_DOC} to include section: ${snippet}`);
        }
    }

    const baselinePath = await writeBaselineSnapshot();
    console.log('Security review scaffolding check passed.');
    console.log(`Baseline snapshot written: ${baselinePath}`);
}

await main();
