import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readFile(relPath) {
    return fs.readFile(path.join(ROOT, relPath), 'utf8');
}

async function assertExists(relPath) {
    try {
        await fs.access(path.join(ROOT, relPath));
    } catch {
        throw new Error(`Missing required path: ${relPath}`);
    }
}

async function assertFileContains(relPath, expectedSnippet) {
    const content = await readFile(relPath);
    if (!content.includes(expectedSnippet)) {
        throw new Error(`Expected ${relPath} to include: ${expectedSnippet}`);
    }
}

async function assertDirectoryLayout(dirPath, expectedFiles) {
    const absDirPath = path.join(ROOT, dirPath);
    const entries = await fs.readdir(absDirPath);
    for (const file of expectedFiles) {
        if (!entries.includes(file)) {
            throw new Error(`Missing ${dirPath}/${file}`);
        }
    }
}

async function main() {
    await assertExists('src/index.ts');
    await assertExists('src/types.ts');
    await assertExists('src/auth.ts');
    await assertExists('src/jsonpath.ts');

    await assertDirectoryLayout('src/types', [
        'shared.ts',
        'auth.ts',
        'cache.ts',
        'link.ts',
        'jsonpath.ts',
        'signature.ts',
    ]);

    await assertDirectoryLayout('src/auth', [
        'index.ts',
        'shared.ts',
        'basic.ts',
        'bearer.ts',
        'digest.ts',
    ]);

    await assertDirectoryLayout('src/jsonpath', [
        'index.ts',
        'tokens.ts',
        'lexer.ts',
        'parser.ts',
        'evaluator.ts',
        'builtins.ts',
    ]);

    await assertDirectoryLayout('src/headers', ['index.ts']);
    await assertDirectoryLayout('src/linking', ['index.ts']);
    await assertDirectoryLayout('src/security', ['index.ts']);
    await assertDirectoryLayout('src/negotiation', ['index.ts']);

    await assertFileContains('src/types.ts', "export * from './types/shared.js';");
    await assertFileContains('src/auth.ts', "export * from './auth/index.js';");
    await assertFileContains('src/jsonpath.ts', "from './jsonpath/index.js';");

    await assertFileContains('src/auth/index.ts', "from './shared.js';");
    await assertFileContains('src/auth/index.ts', "from './basic.js';");
    await assertFileContains('src/auth/index.ts', "from './bearer.js';");
    await assertFileContains('src/auth/index.ts', "from './digest.js';");

    await assertFileContains('src/jsonpath/index.ts', "from './parser.js';");
    await assertFileContains('src/jsonpath/index.ts', "from './evaluator.js';");

    await assertFileContains('src/auth/shared.ts', "from '../types/auth.js';");
    await assertFileContains('src/auth/basic.ts', "from '../types/auth.js';");
    await assertFileContains('src/auth/digest.ts', "from '../types/auth.js';");

    await assertFileContains('src/jsonpath/parser.ts', "from '../types/jsonpath.js';");
    await assertFileContains('src/jsonpath/evaluator.ts', "from '../types/jsonpath.js';");

    await assertFileContains('typedoc.json', '"out": "docs/api"');

    await assertFileContains('src/index.ts', "from './types.js';");
    await assertFileContains('src/index.ts', "from './auth.js';");
    await assertFileContains('src/index.ts', "from './jsonpath.js';");

    console.log('Structure check passed.');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
