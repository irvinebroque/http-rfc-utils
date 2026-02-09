import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { maxSemverBump } from './types.js';
import type { ChangesetIntentResult, ChangesetIssue, SemverBump } from './types.js';

const VALID_BUMPS = new Set<SemverBump>(['patch', 'minor', 'major']);

interface ParsedFrontmatter {
    packageBumps: Map<string, SemverBump>;
    issues: string[];
}

export interface ReadChangesetIntentOptions {
    repoRoot: string;
    changedFiles: string[];
    packageName: string;
}

function normalizePath(filePath: string): string {
    return filePath.split(path.sep).join('/');
}

export function isChangesetMarkdownFile(filePath: string): boolean {
    const normalizedPath = normalizePath(filePath);
    return (
        normalizedPath.startsWith('.changeset/') &&
        normalizedPath.endsWith('.md') &&
        normalizedPath !== '.changeset/README.md'
    );
}

function normalizeBump(rawValue: string): SemverBump | null {
    const normalizedValue = rawValue.trim().toLowerCase();
    if (VALID_BUMPS.has(normalizedValue as SemverBump)) {
        return normalizedValue as SemverBump;
    }
    return null;
}

function stripMatchingQuotes(value: string): string {
    if (value.length < 2) {
        return value;
    }

    const first = value[0];
    const last = value[value.length - 1];
    const hasMatchingSingleQuotes = first === "'" && last === "'";
    const hasMatchingDoubleQuotes = first === '"' && last === '"';

    if (!hasMatchingSingleQuotes && !hasMatchingDoubleQuotes) {
        return value;
    }

    return value.slice(1, -1);
}

export function parseChangesetFrontmatter(content: string): ParsedFrontmatter {
    const lines = content.split(/\r?\n/u);
    const packageBumps = new Map<string, SemverBump>();
    const issues: string[] = [];

    if (lines[0]?.trim() !== '---') {
        issues.push('missing opening frontmatter delimiter (`---`)');
        return { packageBumps, issues };
    }

    let closingDelimiterIndex = -1;
    for (let index = 1; index < lines.length; index += 1) {
        if (lines[index].trim() === '---') {
            closingDelimiterIndex = index;
            break;
        }
    }

    if (closingDelimiterIndex < 0) {
        issues.push('missing closing frontmatter delimiter (`---`)');
        return { packageBumps, issues };
    }

    const frontmatterLines = lines.slice(1, closingDelimiterIndex);
    for (const line of frontmatterLines) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmed.indexOf(':');
        if (separatorIndex < 0) {
            issues.push(`invalid frontmatter entry: ${trimmed}`);
            continue;
        }

        const rawKey = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        const packageName = stripMatchingQuotes(rawKey);
        const parsedBump = normalizeBump(stripMatchingQuotes(rawValue));

        if (parsedBump === null) {
            issues.push(`invalid bump value for ${packageName}: ${rawValue}`);
            continue;
        }

        packageBumps.set(packageName, parsedBump);
    }

    return { packageBumps, issues };
}

function toIssue(filePath: string, message: string): ChangesetIssue {
    return {
        filePath,
        message,
    };
}

export async function readChangesetIntent(
    options: ReadChangesetIntentOptions
): Promise<ChangesetIntentResult> {
    const changedChangesetFiles = options.changedFiles
        .filter(isChangesetMarkdownFile)
        .map(normalizePath)
        .sort();

    const issues: ChangesetIssue[] = [];
    let declaredBump: SemverBump | null = null;

    for (const relativePath of changedChangesetFiles) {
        const absolutePath = path.join(options.repoRoot, relativePath);
        let fileContent: string;

        try {
            fileContent = await readFile(absolutePath, 'utf8');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            issues.push(toIssue(relativePath, `failed to read changeset file: ${message}`));
            continue;
        }

        const parsed = parseChangesetFrontmatter(fileContent);
        for (const issue of parsed.issues) {
            issues.push(toIssue(relativePath, issue));
        }

        const packageBump = parsed.packageBumps.get(options.packageName) ?? null;
        if (packageBump === null) {
            issues.push(
                toIssue(
                    relativePath,
                    `frontmatter does not declare a bump for ${options.packageName}`
                )
            );
            continue;
        }

        declaredBump = maxSemverBump(declaredBump, packageBump);
    }

    return {
        changedChangesetFiles,
        declaredBump,
        issues,
    };
}
