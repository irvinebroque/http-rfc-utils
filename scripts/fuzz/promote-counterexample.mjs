/**
 * Promote a persisted fuzz counterexample into corpus fixtures.
 *
 * Converts failure artifacts into reusable corpus entries for regression and
 * future mutation seeding.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS_ROOT = path.resolve(ROOT, 'test', 'fuzz', 'corpus');

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
            parsed[key] = current.slice(equalsIndex + 1);
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

function resolvePath(candidate) {
    if (path.isAbsolute(candidate)) {
        return candidate;
    }
    return path.join(ROOT, candidate);
}

function assertPathInsideRoot(root, candidate, label) {
    const relative = path.relative(root, candidate);
    const isInside = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    if (!isInside) {
        throw new Error(`${label} escapes corpus root: ${candidate}`);
    }
}

function validateModuleName(value) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error('Module name must be a non-empty string');
    }

    if (value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
        throw new Error(`Invalid module name: ${value}`);
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) {
        throw new Error(`Invalid module name: ${value}`);
    }

    return value;
}

function sanitize(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);
}

function printHelp() {
    console.log('Usage: pnpm exec node scripts/fuzz/promote-counterexample.mjs --artifact <path> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --artifact <path>   Required failure artifact JSON path');
    console.log('  --module <name>     Override corpus module folder name');
    console.log('  --target <name>     Override target name used in destination filename');
    console.log('  --help              Show this message');
}

const args = parseArgs(process.argv.slice(2));
if (args.help === 'true') {
    printHelp();
    process.exit(0);
}

if (!args.artifact) {
    throw new Error('Missing required --artifact argument');
}

const artifactPath = resolvePath(args.artifact);
const artifactText = await fs.readFile(artifactPath, 'utf8');
const artifact = JSON.parse(artifactText);

const moduleName = args.module ?? artifact.module ?? artifact.target;
if (!moduleName) {
    throw new Error('Could not infer module name; pass --module explicitly');
}

const targetName = args.target ?? artifact.target ?? moduleName;
const safeModuleName = validateModuleName(moduleName);
const corpusDirectory = path.resolve(CORPUS_ROOT, safeModuleName);
assertPathInsideRoot(CORPUS_ROOT, corpusDirectory, 'Corpus directory');
await fs.mkdir(corpusDirectory, { recursive: true });

const counterexample = artifact.counterexample;
const payload = Array.isArray(counterexample) && counterexample.length === 1
    ? counterexample[0]
    : counterexample;

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const basename = `${timestamp}-${sanitize(targetName)}`;

let extension = 'json';
let content;
if (typeof payload === 'string') {
    extension = 'txt';
    content = `${payload}\n`;
} else {
    content = `${JSON.stringify(payload, null, 4)}\n`;
}

const destination = path.resolve(corpusDirectory, `${basename}.${extension}`);
assertPathInsideRoot(CORPUS_ROOT, destination, 'Destination path');
await fs.writeFile(destination, content, 'utf8');

console.log(`Promoted counterexample: ${path.relative(ROOT, destination)}`);
