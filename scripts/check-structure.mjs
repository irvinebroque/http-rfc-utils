/**
 * Repository structure guard.
 *
 * Enforces public facade presence, barrel wiring, and module layout invariants
 * expected by CI and contributor workflows.
 */

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

async function assertIndexExportsAllRootModules() {
    const srcRootEntries = await fs.readdir(path.join(ROOT, 'src'), { withFileTypes: true });
    const excludedRootModules = new Set([
        'index',
        'object-map',
        'header-utils',
        'structured-field-params',
        'structured-field-helpers',
        'structured-field-schema',
    ]);

    const rootModules = srcRootEntries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
        .map((entry) => entry.name.slice(0, -3))
        .filter((moduleName) => !excludedRootModules.has(moduleName))
        .filter((moduleName) => !moduleName.startsWith('internal-'));

    const indexContent = await readFile('src/index.ts');
    const missingModules = rootModules
        .filter((moduleName) => !indexContent.includes(`from './${moduleName}.js'`))
        .sort();

    if (missingModules.length > 0) {
        throw new Error(
            `src/index.ts is missing exports for root src modules: ${missingModules.join(', ')}`,
        );
    }
}

async function main() {
    await assertExists('src/index.ts');
    await assertExists('src/types.ts');
    await assertExists('src/auth.ts');
    await assertExists('src/jsonpath.ts');
    await assertExists('src/openapi.ts');
    await assertExists('src/openapi/index.ts');

    await assertDirectoryLayout('src/types', [
        'shared.ts',
        'auth.ts',
        'cache.ts',
        'cookie.ts',
        'pagination.ts',
        'problem.ts',
        'header.ts',
        'negotiation.ts',
        'link.ts',
        'uri.ts',
        'digest.ts',
        'discovery.ts',
        'status.ts',
        'json-patch.ts',
        'json-merge-patch.ts',
        'json-canonicalization.ts',
        'security.ts',
        'structured-fields.ts',
        'reporting.ts',
        'jsonpath.ts',
        'signature.ts',
        'openapi.ts',
    ]);

    await assertDirectoryLayout('src/auth', [
        'index.ts',
        'shared.ts',
        'basic.ts',
        'bearer.ts',
        'digest.ts',
        'pkce.ts',
    ]);

    await assertDirectoryLayout('src/jsonpath', [
        'index.ts',
        'tokens.ts',
        'lexer.ts',
        'parser.ts',
        'evaluator.ts',
        'builtins.ts',
    ]);

    await assertDirectoryLayout('src/openapi', ['index.ts']);

    await assertDirectoryLayout('src/headers', ['index.ts']);
    await assertDirectoryLayout('src/linking', ['index.ts']);
    await assertDirectoryLayout('src/security', ['index.ts']);
    await assertDirectoryLayout('src/negotiation', ['index.ts']);

    await assertFileContains('src/types.ts', "export * from './types/shared.js';");
    await assertFileContains('src/auth.ts', "export * from './auth/index.js';");
    await assertFileContains('src/jsonpath.ts', "from './jsonpath/index.js';");
    await assertFileContains('src/openapi.ts', "from './openapi/index.js';");

    await assertFileContains('src/auth/index.ts', "from './shared.js';");
    await assertFileContains('src/auth/index.ts', "from './basic.js';");
    await assertFileContains('src/auth/index.ts', "from './bearer.js';");
    await assertFileContains('src/auth/index.ts', "from './digest.js';");
    await assertFileContains('src/auth/index.ts', "from './pkce.js';");

    await assertFileContains('src/jsonpath/index.ts', "from './parser.js';");
    await assertFileContains('src/jsonpath/index.ts', "from './evaluator.js';");

    await assertFileContains('src/auth/shared.ts', "from '../types/auth.js';");
    await assertFileContains('src/auth/basic.ts', "from '../types/auth.js';");
    await assertFileContains('src/auth/digest.ts', "from '../types/auth.js';");
    await assertFileContains('src/auth/pkce.ts', "from '../types/auth.js';");

    await assertFileContains('src/jsonpath/parser.ts', "from '../types/jsonpath.js';");
    await assertFileContains('src/jsonpath/evaluator.ts', "from '../types/jsonpath.js';");

    await assertFileContains('typedoc.json', '"out": "docs/api"');

    await assertFileContains('src/index.ts', "from './types.js';");
    await assertFileContains('src/index.ts', "from './auth.js';");
    await assertFileContains('src/index.ts', "from './jsonpath.js';");
    await assertFileContains('src/index.ts', "from './openapi.js';");
    await assertIndexExportsAllRootModules();

    console.log('Structure check passed.');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
