/**
 * Shared fast-check fuzzing harness utilities.
 *
 * Provides deterministic run configuration, corpus mutation helpers, and
 * failure artifact persistence for reproducible parser/security fuzz tests.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import type { Arbitrary, Parameters, RunDetails } from 'fast-check';

const QUICK_NUM_RUNS = 32;
const FULL_NUM_RUNS = 320;
const QUICK_INTERRUPT_AFTER_MS = 5_000;
const FULL_INTERRUPT_AFTER_MS = 30_000;
const DEFAULT_SEED = 20_260_317;

const MUTATION_CHARSET = [
    ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ...'0123456789',
    ' ',
    '\t',
    '\r',
    '\n',
    '-',
    '_',
    '.',
    ',',
    ';',
    ':',
    '=',
    '/',
    '\\',
    '"',
    '\'',
    '<',
    '>',
    '(',
    ')',
    '[',
    ']',
    '{',
    '}',
    '?',
    '!',
    '@',
    '#',
    '$',
    '%',
    '^',
    '&',
    '*',
    '+',
    '|',
];

export interface FuzzTarget<TInput, TResult> {
    name: string;
    module: string;
    arbitrary: Arbitrary<TInput>;
    execute(input: TInput): TResult;
    assertInvariant(result: TResult, input: TInput): void;
}

export interface FuzzRunOverrides {
    seed?: number;
    path?: string;
    numRuns?: number;
    endOnFailure?: boolean;
    interruptAfterTimeLimit?: number;
}

export interface CorpusStringArbitraryOptions {
    maxLength?: number;
    includeRandom?: boolean;
}

interface ResolvedRunConfig {
    seed: number;
    path?: string;
    numRuns: number;
    endOnFailure: boolean;
    interruptAfterTimeLimit: number;
    profile: 'quick' | 'full';
}

interface PersistedFailure {
    artifactPath: string;
    replayCommand: string;
}

function parseIntegerEnv(name: string): number | undefined {
    const raw = process.env[name];
    if (raw === undefined) {
        return undefined;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
        return undefined;
    }

    return parsed;
}

function parseBooleanEnv(name: string): boolean | undefined {
    const raw = process.env[name]?.trim().toLowerCase();
    if (raw === undefined) {
        return undefined;
    }

    if (raw === '1' || raw === 'true') {
        return true;
    }

    if (raw === '0' || raw === 'false') {
        return false;
    }

    return undefined;
}

function profileFromEnv(): 'quick' | 'full' {
    return process.env.FUZZ_PROFILE === 'full' ? 'full' : 'quick';
}

function resolveRunConfig(overrides: FuzzRunOverrides): ResolvedRunConfig {
    const profile = profileFromEnv();
    const defaultNumRuns = profile === 'full' ? FULL_NUM_RUNS : QUICK_NUM_RUNS;
    const defaultInterruptAfterTimeLimit = profile === 'full'
        ? FULL_INTERRUPT_AFTER_MS
        : QUICK_INTERRUPT_AFTER_MS;

    const envSeed = parseIntegerEnv('FUZZ_SEED');
    const envNumRuns = parseIntegerEnv('FUZZ_NUM_RUNS');
    const envPath = process.env.FUZZ_PATH;
    const envEndOnFailure = parseBooleanEnv('FUZZ_END_ON_FAILURE');
    const envInterruptAfterTimeLimit = parseIntegerEnv('FUZZ_INTERRUPT_AFTER_MS');

    return {
        seed: overrides.seed ?? envSeed ?? DEFAULT_SEED,
        path: overrides.path ?? envPath,
        numRuns: overrides.numRuns ?? envNumRuns ?? defaultNumRuns,
        endOnFailure: overrides.endOnFailure ?? envEndOnFailure ?? true,
        interruptAfterTimeLimit:
            overrides.interruptAfterTimeLimit
            ?? envInterruptAfterTimeLimit
            ?? defaultInterruptAfterTimeLimit,
        profile,
    };
}

function toParameters<TInput>(config: ResolvedRunConfig): Parameters<[TInput]> {
    const parameters: Parameters<[TInput]> = {
        seed: config.seed,
        numRuns: config.numRuns,
        endOnFailure: config.endOnFailure,
        interruptAfterTimeLimit: config.interruptAfterTimeLimit,
    };

    if (config.path !== undefined && config.path !== '') {
        parameters.path = config.path;
    }

    return parameters;
}

function sanitizeFileSegment(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);
}

function toJsonValue(value: unknown): unknown {
    try {
        return JSON.parse(JSON.stringify(value, (_key, currentValue) => {
            if (typeof currentValue === 'bigint') {
                return currentValue.toString();
            }

            if (currentValue instanceof Uint8Array) {
                return {
                    __type: 'Uint8Array',
                    data: Array.from(currentValue),
                };
            }

            if (currentValue instanceof Map) {
                return {
                    __type: 'Map',
                    entries: Array.from(currentValue.entries()),
                };
            }

            if (currentValue instanceof Set) {
                return {
                    __type: 'Set',
                    values: Array.from(currentValue.values()),
                };
            }

            if (currentValue instanceof Error) {
                return {
                    name: currentValue.name,
                    message: currentValue.message,
                    stack: currentValue.stack,
                };
            }

            return currentValue;
        }));
    } catch {
        return String(value);
    }
}

function buildReplayCommand(
    targetName: string,
    seed: number,
    counterexamplePath: string | null,
    artifactPath: string,
): string {
    const commandParts = [
        'pnpm exec node scripts/fuzz/replay-fast-check.mjs',
        `--seed ${seed}`,
        `--target ${JSON.stringify(targetName)}`,
        `--artifact ${JSON.stringify(artifactPath)}`,
    ];

    if (counterexamplePath) {
        commandParts.push(`--path ${JSON.stringify(counterexamplePath)}`);
    }

    return commandParts.join(' ');
}

function persistFailureArtifact<TInput>(
    target: FuzzTarget<TInput, unknown>,
    details: RunDetails<[TInput]>,
    config: ResolvedRunConfig,
): PersistedFailure {
    const artifactDirectory = process.env.FUZZ_ARTIFACT_DIR
        ?? path.join(process.cwd(), 'temp', 'fuzz-artifacts');
    mkdirSync(artifactDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${sanitizeFileSegment(target.name)}-${timestamp}.json`;
    const artifactPath = path.join(artifactDirectory, fileName);
    const replayCommand = buildReplayCommand(target.name, details.seed, details.counterexamplePath, artifactPath);

    const minimalCounterexample = details.counterexample === null
        ? null
        : details.counterexample[0] ?? null;

    const payload = {
        createdAt: new Date().toISOString(),
        target: target.name,
        module: target.module,
        profile: config.profile,
        seed: details.seed,
        path: details.counterexamplePath,
        numRuns: details.numRuns,
        numSkips: details.numSkips,
        numShrinks: details.numShrinks,
        interrupted: details.interrupted,
        counterexample: toJsonValue(minimalCounterexample),
        counterexampleTuple: toJsonValue(details.counterexample),
        failures: toJsonValue(details.failures),
        error: toJsonValue(details.errorInstance),
        replayCommand,
    };

    writeFileSync(artifactPath, `${JSON.stringify(payload, null, 4)}\n`, 'utf8');

    return {
        artifactPath,
        replayCommand,
    };
}

function isTargetEnabled(name: string): boolean {
    const rawSelector = process.env.FUZZ_TARGET;
    if (!rawSelector) {
        return true;
    }

    const selectedTargets = rawSelector
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

    if (selectedTargets.length === 0) {
        return true;
    }

    return selectedTargets.includes(name);
}

export function runFuzzTarget<TInput, TResult>(
    target: FuzzTarget<TInput, TResult>,
    overrides: FuzzRunOverrides = {},
): void {
    if (!isTargetEnabled(target.name)) {
        return;
    }

    const runConfig = resolveRunConfig(overrides);
    const property = fc.property(target.arbitrary, (input) => {
        const result = target.execute(input);
        target.assertInvariant(result, input);
    });

    const details: RunDetails<[TInput]> = fc.check(property, toParameters<TInput>(runConfig));
    if (!details.failed) {
        return;
    }

    const persisted = persistFailureArtifact(target, details, runConfig);
    const counterexamplePreview = details.counterexample === null
        ? 'null'
        : JSON.stringify(toJsonValue(details.counterexample[0]));

    throw new Error([
        `Fuzz target "${target.name}" failed after ${details.numRuns} run(s).`,
        `Seed: ${details.seed}`,
        `Path: ${details.counterexamplePath ?? '(none)'}`,
        `Counterexample: ${counterexamplePreview}`,
        `Artifact: ${persisted.artifactPath}`,
        `Replay: ${persisted.replayCommand}`,
    ].join('\n'));
}

function resolveCorpusDirectory(moduleName: string): string {
    return path.join(process.cwd(), 'test', 'fuzz', 'corpus', moduleName);
}

export function loadStringCorpus(moduleName: string): string[] {
    const corpusDirectory = resolveCorpusDirectory(moduleName);
    let entries: string[];

    try {
        entries = readdirSync(corpusDirectory).sort();
    } catch {
        return [];
    }

    const values: string[] = [];
    for (const entry of entries) {
        const fullPath = path.join(corpusDirectory, entry);
        let isFile = false;
        try {
            isFile = statSync(fullPath).isFile();
        } catch {
            isFile = false;
        }

        if (!isFile) {
            continue;
        }

        const content = readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            if (line.trim() === '') {
                continue;
            }

            if (line.trimStart().startsWith('#')) {
                continue;
            }

            values.push(line);
        }
    }

    return Array.from(new Set(values));
}

function mutateSeed(
    seed: string,
    operation: number,
    position: number,
    deleteLength: number,
    fragment: string,
    maxLength: number,
): string {
    const safePosition = Math.min(Math.max(position, 0), seed.length);

    if (operation === 0) {
        return `${seed.slice(0, safePosition)}${fragment}${seed.slice(safePosition)}`.slice(0, maxLength);
    }

    if (operation === 1) {
        return `${seed.slice(0, safePosition)}${fragment}${seed.slice(safePosition + deleteLength)}`.slice(0, maxLength);
    }

    return `${seed.slice(0, safePosition)}${seed.slice(safePosition + deleteLength)}`.slice(0, maxLength);
}

export function createCorpusStringArbitrary(
    moduleName: string,
    options: CorpusStringArbitraryOptions = {},
): Arbitrary<string> {
    const maxLength = options.maxLength ?? 256;
    const includeRandom = options.includeRandom ?? true;
    const seeds = loadStringCorpus(moduleName);

    const seedArbitrary = seeds.length > 0
        ? fc.constantFrom(...seeds)
        : fc.constant('');

    const fragmentArbitrary = fc
        .array(fc.constantFrom(...MUTATION_CHARSET), { maxLength: 16 })
        .map((chars) => chars.join(''));

    const mutatedArbitrary = fc
        .tuple(
            seedArbitrary,
            fc.integer({ min: 0, max: 2 }),
            fc.integer({ min: 0, max: maxLength }),
            fc.integer({ min: 0, max: 16 }),
            fragmentArbitrary,
        )
        .map(([seed, operation, position, deleteLength, fragment]) => {
            return mutateSeed(seed, operation, position, deleteLength, fragment, maxLength);
        });

    if (!includeRandom) {
        return fc.oneof(seedArbitrary, mutatedArbitrary);
    }

    const randomArbitrary = fc
        .array(fc.constantFrom(...MUTATION_CHARSET), { maxLength })
        .map((chars) => chars.join(''));

    return fc.oneof(seedArbitrary, mutatedArbitrary, randomArbitrary);
}

export function withCorpusMutations(
    moduleName: string,
    generatorArbitrary: Arbitrary<string>,
    options: CorpusStringArbitraryOptions = {},
): Arbitrary<string> {
    const corpusArbitrary = createCorpusStringArbitrary(moduleName, options);
    return fc.oneof(generatorArbitrary, corpusArbitrary);
}
