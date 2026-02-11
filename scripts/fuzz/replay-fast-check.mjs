/**
 * Replay utility for fast-check failures.
 *
 * Reconstructs deterministic fuzz runs from explicit CLI arguments or
 * persisted failure artifacts.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_TEST_FILE = 'test/fuzz/security-fuzz.spec.ts';

function parseArgs(argv) {
    const parsed = {};

    for (let index = 0; index < argv.length; index++) {
        const current = argv[index];
        if (!current || !current.startsWith('--')) {
            continue;
        }

        const equalsIndex = current.indexOf('=');
        if (equalsIndex >= 0) {
            const key = current.slice(2, equalsIndex);
            const value = current.slice(equalsIndex + 1);
            parsed[key] = value;
            continue;
        }

        const key = current.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed[key] = 'true';
            continue;
        }

        parsed[key] = next;
        index++;
    }

    return parsed;
}

function parseInteger(value) {
    if (value === undefined) {
        return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return undefined;
    }

    return parsed;
}

function resolvePath(candidate) {
    if (candidate === undefined) {
        return undefined;
    }

    if (path.isAbsolute(candidate)) {
        return candidate;
    }

    return path.join(ROOT, candidate);
}

function printHelp() {
    console.log('Usage: pnpm exec node scripts/fuzz/replay-fast-check.mjs [options]');
    console.log('');
    console.log('Options:');
    console.log('  --artifact <path>      Load seed/path/target from a failure artifact JSON');
    console.log('  --seed <number>        Replay seed');
    console.log('  --path <counterpath>   Replay counterexample path');
    console.log('  --target <name>        Run only one fuzz target');
    console.log('  --num-runs <number>    Override number of runs');
    console.log('  --profile <quick|full> Override FUZZ_PROFILE');
    console.log('  --test-file <path>     Test file to execute');
    console.log('  --help                 Show this message');
}

const args = parseArgs(process.argv.slice(2));
if (args.help === 'true') {
    printHelp();
    process.exit(0);
}

let artifact = null;
if (args.artifact) {
    const artifactPath = resolvePath(args.artifact);
    const raw = readFileSync(artifactPath, 'utf8');
    artifact = JSON.parse(raw);
}

const seed = parseInteger(args.seed) ?? parseInteger(artifact?.seed?.toString());
const counterexamplePath = args.path ?? artifact?.path;
const target = args.target ?? artifact?.target;
const numRuns = parseInteger(args['num-runs']) ?? parseInteger(artifact?.numRuns?.toString());
const profile = args.profile ?? artifact?.profile;
const testFile = args['test-file'] ?? DEFAULT_TEST_FILE;

const env = {
    ...process.env,
};

if (seed !== undefined) {
    env.FUZZ_SEED = String(seed);
}

if (counterexamplePath) {
    env.FUZZ_PATH = counterexamplePath;
}

if (target) {
    env.FUZZ_TARGET = target;
}

if (numRuns !== undefined) {
    env.FUZZ_NUM_RUNS = String(numRuns);
}

if (profile) {
    env.FUZZ_PROFILE = profile;
}

console.log('Replaying fast-check target with:');
console.log(`  seed=${env.FUZZ_SEED ?? '(default)'}`);
console.log(`  path=${env.FUZZ_PATH ?? '(none)'}`);
console.log(`  target=${env.FUZZ_TARGET ?? '(all)'}`);
console.log(`  runs=${env.FUZZ_NUM_RUNS ?? '(default)'}`);
console.log(`  profile=${env.FUZZ_PROFILE ?? '(default)'}`);
console.log(`  testFile=${testFile}`);

const replay = spawnSync('pnpm', ['exec', 'tsx', '--test', testFile], {
    cwd: ROOT,
    stdio: 'inherit',
    env,
});

if (replay.error) {
    throw replay.error;
}

process.exitCode = replay.status ?? 1;
