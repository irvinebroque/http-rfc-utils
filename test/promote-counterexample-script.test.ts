import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'fuzz', 'promote-counterexample.mjs');
const CORPUS_ROOT = path.join(ROOT, 'test', 'fuzz', 'corpus');

async function createArtifact(payload: unknown): Promise<string> {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'promote-counterexample-'));
    const artifactPath = path.join(tempDirectory, 'artifact.json');
    await fs.writeFile(artifactPath, `${JSON.stringify(payload, null, 4)}\n`, 'utf8');
    return artifactPath;
}

function runPromote(args: string[]) {
    return spawnSync('node', [SCRIPT_PATH, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });
}

describe('promote-counterexample script hardening (F9)', () => {
    it('promotes artifact for a valid module name under corpus root', async () => {
        const moduleName = 'f9-safe-module';
        const corpusDirectory = path.join(CORPUS_ROOT, moduleName);
        await fs.rm(corpusDirectory, { recursive: true, force: true });

        const artifactPath = await createArtifact({
            module: moduleName,
            target: 'target-1',
            counterexample: {
                a: 1,
            },
        });

        try {
            const result = runPromote(['--artifact', artifactPath]);
            assert.equal(result.status, 0, result.stderr);
            assert.match(result.stdout, /Promoted counterexample: test\/fuzz\/corpus\/f9-safe-module\//);

            const entries = await fs.readdir(corpusDirectory);
            assert.equal(entries.length, 1);
            assert.match(entries[0], /\.json$/);
        } finally {
            await fs.rm(corpusDirectory, { recursive: true, force: true });
            await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
        }
    });

    it('rejects module names that contain parent traversal segments', async () => {
        const artifactPath = await createArtifact({
            target: 'target-2',
            counterexample: {
                b: 2,
            },
        });

        try {
            const result = runPromote(['--artifact', artifactPath, '--module', '../outside']);
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /Invalid module name: \.\.\/outside/);
        } finally {
            await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
        }
    });

    it('rejects module names with Windows-style separators', async () => {
        const artifactPath = await createArtifact({
            target: 'target-3',
            counterexample: {
                c: 3,
            },
        });

        try {
            const result = runPromote(['--artifact', artifactPath, '--module', '..\\outside']);
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /Invalid module name: \.\.\\outside/);
        } finally {
            await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
        }
    });

    it('rejects traversal module names from artifact content', async () => {
        const artifactPath = await createArtifact({
            module: '../../outside',
            target: 'target-4',
            counterexample: {
                d: 4,
            },
        });

        try {
            const result = runPromote(['--artifact', artifactPath]);
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /Invalid module name: \.\.\/\.\.\/outside/);
        } finally {
            await fs.rm(path.dirname(artifactPath), { recursive: true, force: true });
        }
    });
});
