/**
 * TypeScript API model helpers for SemVer compatibility checks.
 * Extracts exported symbol/type information from declaration entrypoints.
 * @see https://semver.org/
 */

import * as ts from 'typescript';
import type { ApiExportKind, ApiExportModel } from './types.js';

export interface ApiExport extends ApiExportModel {
    symbol: ts.Symbol;
    type: ts.Type;
}

function resolveAliasSymbol(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
    if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
        return checker.getAliasedSymbol(symbol);
    }
    return symbol;
}

function getExportKind(symbol: ts.Symbol): ApiExportKind {
    const hasValue = (symbol.flags & ts.SymbolFlags.Value) !== 0;
    const hasType = (symbol.flags & ts.SymbolFlags.Type) !== 0;

    if (hasValue && hasType) {
        return 'hybrid';
    }

    if (hasValue) {
        return 'value';
    }

    if (hasType) {
        return 'type';
    }

    return 'unknown';
}

function getSymbolType(checker: ts.TypeChecker, symbol: ts.Symbol, fallbackLocation: ts.Node): ts.Type {
    const kind = getExportKind(symbol);
    if (kind === 'type') {
        return checker.getDeclaredTypeOfSymbol(symbol);
    }

    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? fallbackLocation;
    return checker.getTypeOfSymbolAtLocation(symbol, declaration);
}

function getTypeText(checker: ts.TypeChecker, type: ts.Type): string {
    return checker.typeToString(
        type,
        undefined,
        ts.TypeFormatFlags.NoTruncation |
            ts.TypeFormatFlags.WriteArrowStyleSignature |
            ts.TypeFormatFlags.UseFullyQualifiedType
    );
}

function getModuleSymbol(checker: ts.TypeChecker, sourceFile: ts.SourceFile): ts.Symbol {
    const symbol = checker.getSymbolAtLocation(sourceFile);
    if (!symbol) {
        throw new Error(`Could not resolve module symbol for ${sourceFile.fileName}`);
    }

    return symbol;
}

export function collectApiExports(checker: ts.TypeChecker, sourceFile: ts.SourceFile): Map<string, ApiExport> {
    const moduleSymbol = getModuleSymbol(checker, sourceFile);
    const exportsMap = new Map<string, ApiExport>();

    for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
        const exportName = exportedSymbol.getName();
        const resolvedSymbol = resolveAliasSymbol(checker, exportedSymbol);
        const exportKind = getExportKind(resolvedSymbol);
        const exportType = getSymbolType(checker, resolvedSymbol, sourceFile);

        exportsMap.set(exportName, {
            name: exportName,
            kind: exportKind,
            symbolFlags: resolvedSymbol.flags,
            typeText: getTypeText(checker, exportType),
            symbol: resolvedSymbol,
            type: exportType,
        });
    }

    return exportsMap;
}
