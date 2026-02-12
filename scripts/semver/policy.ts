/**
 * SemVer policy evaluation for API compatibility results.
 * Applies changeset intent checks and optional allowlist filtering.
 * @see https://semver.org/
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { SEMVER_BUMP_ORDER } from './types.js';
import type {
    AllowlistEntry,
    ChangesetIssue,
    CompatibilityFinding,
    CompatibilityResult,
    PolicyOutcome,
    SemverBump,
} from './types.js';

interface AllowlistLoadResult {
    entries: AllowlistEntry[];
    issues: string[];
}

export interface EvaluateSemverPolicyOptions {
    packageName: string;
    comparison: CompatibilityResult;
    declaredBump: SemverBump | null;
    codeChanged: boolean;
    changesetIssues: ChangesetIssue[];
    strictMode?: boolean;
    allowlistPath?: string;
    now?: Date;
}

function parseAllowlistEntry(value: unknown, index: number): { entry: AllowlistEntry | null; issue: string | null } {
    if (typeof value !== 'object' || value === null) {
        return {
            entry: null,
            issue: `allowlist entry ${index} is not an object`,
        };
    }

    const candidate = value as Partial<AllowlistEntry>;

    if (typeof candidate.exportName !== 'string' || candidate.exportName.trim().length === 0) {
        return {
            entry: null,
            issue: `allowlist entry ${index} is missing a non-empty exportName`,
        };
    }

    if (candidate.reason !== undefined && candidate.reason !== 'missing-export' && candidate.reason !== 'incompatible-export') {
        return {
            entry: null,
            issue: `allowlist entry ${index} has invalid reason: ${String(candidate.reason)}`,
        };
    }

    if (typeof candidate.justification !== 'string' || candidate.justification.trim().length === 0) {
        return {
            entry: null,
            issue: `allowlist entry ${index} is missing a non-empty justification`,
        };
    }

    if (typeof candidate.expiresOn !== 'string' || candidate.expiresOn.trim().length === 0) {
        return {
            entry: null,
            issue: `allowlist entry ${index} is missing expiresOn`,
        };
    }

    const expiresOnDate = new Date(candidate.expiresOn);
    if (Number.isNaN(expiresOnDate.getTime())) {
        return {
            entry: null,
            issue: `allowlist entry ${index} has invalid expiresOn date: ${candidate.expiresOn}`,
        };
    }

    return {
        entry: {
            exportName: candidate.exportName.trim(),
            reason: candidate.reason,
            justification: candidate.justification.trim(),
            expiresOn: candidate.expiresOn,
        },
        issue: null,
    };
}

async function loadAllowlist(allowlistPath: string | undefined): Promise<AllowlistLoadResult> {
    if (!allowlistPath || !existsSync(allowlistPath)) {
        return {
            entries: [],
            issues: [],
        };
    }

    let content: string;
    try {
        content = await readFile(allowlistPath, 'utf8');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            entries: [],
            issues: [`failed to read allowlist at ${allowlistPath}: ${message}`],
        };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content) as unknown;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            entries: [],
            issues: [`allowlist at ${allowlistPath} is not valid JSON: ${message}`],
        };
    }

    const rawEntries = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { entries?: unknown }).entries)
            ? ((parsed as { entries: unknown[] }).entries as unknown[])
            : null;

    if (rawEntries === null) {
        return {
            entries: [],
            issues: [`allowlist at ${allowlistPath} must be an array or { "entries": [] }`],
        };
    }

    const entries: AllowlistEntry[] = [];
    const issues: string[] = [];

    for (let index = 0; index < rawEntries.length; index += 1) {
        const parsedEntry = parseAllowlistEntry(rawEntries[index], index);
        if (parsedEntry.issue) {
            issues.push(parsedEntry.issue);
            continue;
        }

        if (parsedEntry.entry) {
            entries.push(parsedEntry.entry);
        }
    }

    return {
        entries,
        issues,
    };
}

function isAllowlistEntryActive(entry: AllowlistEntry, now: Date): boolean {
    const expirationDate = new Date(entry.expiresOn);
    return expirationDate.getTime() >= now.getTime();
}

function matchesAllowlistEntry(entry: AllowlistEntry, finding: CompatibilityFinding): boolean {
    if (entry.exportName !== finding.exportName) {
        return false;
    }

    if (entry.reason && entry.reason !== finding.reason) {
        return false;
    }

    return true;
}

function filterAllowlistedFindings(
    findings: CompatibilityFinding[],
    entries: AllowlistEntry[],
    now: Date
): { effectiveFindings: CompatibilityFinding[]; ignoredFindings: CompatibilityFinding[] } {
    const activeEntries = entries.filter(entry => isAllowlistEntryActive(entry, now));
    const effectiveFindings: CompatibilityFinding[] = [];
    const ignoredFindings: CompatibilityFinding[] = [];

    for (const finding of findings) {
        const matched = activeEntries.some(entry => matchesAllowlistEntry(entry, finding));
        if (matched) {
            ignoredFindings.push(finding);
            continue;
        }

        effectiveFindings.push(finding);
    }

    return {
        effectiveFindings,
        ignoredFindings,
    };
}

function getRequiredBump(comparison: CompatibilityResult, findings: CompatibilityFinding[]): SemverBump {
    if (findings.length > 0) {
        return 'major';
    }

    if (comparison.nextExportCount > comparison.previousExportCount) {
        return 'minor';
    }

    return 'patch';
}

export async function evaluateSemverPolicy(
    options: EvaluateSemverPolicyOptions
): Promise<PolicyOutcome> {
    const strictModeEnabled = options.strictMode ?? false;
    const now = options.now ?? new Date();
    const allowlist = await loadAllowlist(options.allowlistPath);
    const filteredFindings = filterAllowlistedFindings(options.comparison.findings, allowlist.entries, now);

    const requiredBump = getRequiredBump(options.comparison, filteredFindings.effectiveFindings);
    const messages: string[] = [];

    if (allowlist.issues.length > 0) {
        messages.push('allowlist configuration contains errors');
    }

    if (options.changesetIssues.length > 0) {
        messages.push('changeset metadata has validation errors');
    }

    if (options.codeChanged && options.declaredBump === null) {
        messages.push(
            `code changes detected without a valid changeset bump for ${options.packageName}`
        );
    }

    if (requiredBump === 'major' && options.declaredBump !== 'major') {
        const declared = options.declaredBump ?? 'none';
        messages.push(`breaking API changes require major but declared bump is ${declared}`);
    }

    if (requiredBump === 'minor' && options.declaredBump === 'patch') {
        messages.push('additive API changes require minor but declared bump is patch');
    }

    if (
        strictModeEnabled &&
        options.declaredBump !== null &&
        SEMVER_BUMP_ORDER[options.declaredBump] < SEMVER_BUMP_ORDER[requiredBump]
    ) {
        messages.push(
            `strict mode: declared bump ${options.declaredBump} is lower than required ${requiredBump}`
        );
    }

    return {
        pass: messages.length === 0,
        strictModeEnabled,
        requiredBump,
        effectiveFindings: filteredFindings.effectiveFindings,
        ignoredFindings: filteredFindings.ignoredFindings,
        allowlistIssues: allowlist.issues,
        messages,
    };
}
