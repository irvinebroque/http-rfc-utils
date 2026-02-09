import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { constants as fsConstants, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ts from 'typescript';
import { listFilesAtRef, readFileAtRef } from './git.js';

export interface DeclarationBuildResult {
    entrypointPath: string;
    outputDir: string;
    workspaceDir: string;
    diagnostics: string[];
}

function diagnosticHost(currentDirectory: string): ts.FormatDiagnosticsHost {
    return {
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: () => currentDirectory,
        getNewLine: () => '\n',
    };
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[], currentDirectory: string): string[] {
    return diagnostics.map(diagnostic =>
        ts.formatDiagnostic(diagnostic, diagnosticHost(currentDirectory)).trim()
    );
}

function getParsedConfig(projectRoot: string): ts.ParsedCommandLine {
    const configPath = path.join(projectRoot, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) {
        throw new Error(ts.formatDiagnostic(config.error, diagnosticHost(projectRoot)).trim());
    }

    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot, undefined, configPath);
    if (parsed.errors.length > 0) {
        const messages = formatDiagnostics(parsed.errors, projectRoot);
        throw new Error(`Failed to parse tsconfig at ${configPath}\n${messages.join('\n')}`);
    }

    return parsed;
}

function getCompilerOptions(
    parsedConfig: ts.ParsedCommandLine,
    outputDir: string,
    repoRoot: string
): ts.CompilerOptions {
    const options: ts.CompilerOptions = {
        ...parsedConfig.options,
        declaration: true,
        emitDeclarationOnly: true,
        declarationMap: false,
        sourceMap: false,
        noEmit: false,
        outDir: outputDir,
        incremental: false,
        composite: false,
        tsBuildInfoFile: undefined,
    };

    const typeRootsPath = path.join(repoRoot, 'node_modules', '@types');
    if (existsSync(typeRootsPath)) {
        options.typeRoots = [typeRootsPath];
    }

    return options;
}

async function compileProjectToDeclarations(
    projectRoot: string,
    outputDir: string,
    repoRoot: string
): Promise<string[]> {
    const parsedConfig = getParsedConfig(projectRoot);
    const compilerOptions = getCompilerOptions(parsedConfig, outputDir, repoRoot);
    const program = ts.createProgram({
        rootNames: parsedConfig.fileNames,
        options: compilerOptions,
    });

    const preEmitDiagnostics = ts.getPreEmitDiagnostics(program);
    const emitResult = program.emit(undefined, undefined, undefined, true);
    const allDiagnostics = [...preEmitDiagnostics, ...emitResult.diagnostics];
    const errorDiagnostics = allDiagnostics.filter(
        diagnostic => diagnostic.category === ts.DiagnosticCategory.Error
    );

    if (errorDiagnostics.length > 0) {
        const messages = formatDiagnostics(errorDiagnostics, projectRoot);
        throw new Error(
            [
                `Declaration emit failed for ${projectRoot}`,
                ...messages,
            ].join('\n')
        );
    }

    return formatDiagnostics(allDiagnostics, projectRoot);
}

function sanitizeRefForDirectoryName(gitRef: string): string {
    return gitRef.replace(/[^a-zA-Z0-9._-]/gu, '_').slice(0, 64);
}

async function writeRefSnapshot(repoRoot: string, gitRef: string, snapshotRoot: string): Promise<void> {
    const files = await listFilesAtRef(repoRoot, gitRef, ['package.json', 'tsconfig.json', 'src']);
    if (!files.includes('tsconfig.json')) {
        throw new Error(`Could not find tsconfig.json at git ref ${gitRef}`);
    }

    for (const filePath of files) {
        const fileContent = await readFileAtRef(repoRoot, gitRef, filePath);
        if (fileContent === null) {
            continue;
        }

        const destinationPath = path.join(snapshotRoot, filePath);
        await mkdir(path.dirname(destinationPath), { recursive: true });
        await writeFile(destinationPath, fileContent, 'utf8');
    }
}

async function ensureEntrypointExists(entrypointPath: string): Promise<void> {
    try {
        await access(entrypointPath, fsConstants.F_OK);
    } catch {
        throw new Error(`Declaration entrypoint was not emitted: ${entrypointPath}`);
    }
}

export async function createSemverWorkspaceRoot(): Promise<string> {
    return mkdtemp(path.join(os.tmpdir(), 'http-rfc-semver-'));
}

export async function emitHeadDeclarations(
    repoRoot: string,
    workspaceRoot: string
): Promise<DeclarationBuildResult> {
    const outputDir = path.join(workspaceRoot, 'head-dist');
    await mkdir(outputDir, { recursive: true });
    const diagnostics = await compileProjectToDeclarations(repoRoot, outputDir, repoRoot);
    const entrypointPath = path.join(outputDir, 'index.d.ts');
    await ensureEntrypointExists(entrypointPath);

    return {
        entrypointPath,
        outputDir,
        workspaceDir: repoRoot,
        diagnostics,
    };
}

export async function emitDeclarationsForRef(
    repoRoot: string,
    gitRef: string,
    workspaceRoot: string
): Promise<DeclarationBuildResult> {
    const snapshotPrefix = `snapshot-${sanitizeRefForDirectoryName(gitRef)}-`;
    const snapshotRoot = await mkdtemp(path.join(workspaceRoot, snapshotPrefix));
    await writeRefSnapshot(repoRoot, gitRef, snapshotRoot);

    const outputDir = path.join(snapshotRoot, 'dist');
    await mkdir(outputDir, { recursive: true });
    const diagnostics = await compileProjectToDeclarations(snapshotRoot, outputDir, repoRoot);
    const entrypointPath = path.join(outputDir, 'index.d.ts');
    await ensureEntrypointExists(entrypointPath);

    return {
        entrypointPath,
        outputDir,
        workspaceDir: snapshotRoot,
        diagnostics,
    };
}
