import path from 'node:path';
import * as ts from 'typescript';
import { collectApiExports } from './apiModel.js';
import type {
    ApiExportKind,
    CompatibilityFinding,
    CompatibilityMode,
    CompatibilityResult,
} from './types.js';

export interface CompareApiDeclarationsOptions {
    previousEntrypointPath: string;
    nextEntrypointPath: string;
}

function getSourceFileOrThrow(program: ts.Program, filePath: string): ts.SourceFile {
    const resolvedPath = path.resolve(filePath);

    const sourceFile =
        program.getSourceFile(resolvedPath) ??
        program.getSourceFiles().find(candidate => path.resolve(candidate.fileName) === resolvedPath);

    if (!sourceFile) {
        throw new Error(`Could not load declaration source file: ${resolvedPath}`);
    }

    return sourceFile;
}

function getComparisonMode(kind: ApiExportKind): CompatibilityMode {
    if (kind === 'type') {
        return 'previous-assignable-to-next';
    }

    return 'next-assignable-to-previous';
}

function isCompatible(
    checker: ts.TypeChecker,
    mode: CompatibilityMode,
    previousType: ts.Type,
    nextType: ts.Type
): boolean {
    if (mode === 'previous-assignable-to-next') {
        return checker.isTypeAssignableTo(previousType, nextType);
    }

    return checker.isTypeAssignableTo(nextType, previousType);
}

function formatMode(mode: CompatibilityMode): string {
    return mode === 'previous-assignable-to-next'
        ? 'previous type must be assignable to next type'
        : 'next type must be assignable to previous type';
}

export function compareApiDeclarations(
    options: CompareApiDeclarationsOptions
): CompatibilityResult {
    const previousEntrypointPath = path.resolve(options.previousEntrypointPath);
    const nextEntrypointPath = path.resolve(options.nextEntrypointPath);

    const program = ts.createProgram({
        rootNames: [previousEntrypointPath, nextEntrypointPath],
        options: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            strict: true,
            skipLibCheck: true,
            noEmit: true,
        },
    });

    const checker = program.getTypeChecker();
    const previousSourceFile = getSourceFileOrThrow(program, previousEntrypointPath);
    const nextSourceFile = getSourceFileOrThrow(program, nextEntrypointPath);
    const previousExports = collectApiExports(checker, previousSourceFile);
    const nextExports = collectApiExports(checker, nextSourceFile);

    const findings: CompatibilityFinding[] = [];

    for (const [exportName, previousExport] of previousExports) {
        const nextExport = nextExports.get(exportName);
        if (!nextExport) {
            findings.push({
                exportName,
                reason: 'missing-export',
                mode: 'next-assignable-to-previous',
                previousType: previousExport.typeText,
                nextType: null,
                details: 'export no longer exists in next API surface',
            });
            continue;
        }

        const mode = getComparisonMode(previousExport.kind);
        const compatible = isCompatible(checker, mode, previousExport.type, nextExport.type);
        if (compatible) {
            continue;
        }

        findings.push({
            exportName,
            reason: 'incompatible-export',
            mode,
            previousType: previousExport.typeText,
            nextType: nextExport.typeText,
            details: formatMode(mode),
        });
    }

    return {
        breaking: findings.length > 0,
        comparedExports: previousExports.size,
        previousExportCount: previousExports.size,
        nextExportCount: nextExports.size,
        findings,
    };
}
