/**
 * Human-readable and JSON reporting for SemVer checks.
 * Converts raw policy/comparison outputs into CI-friendly diagnostics.
 * @see https://semver.org/
 */

import type {
    ChangesetIssue,
    CompatibilityFinding,
    CompatibilityResult,
    PolicyOutcome,
    SemverBump,
} from './types.js';

export interface SemverCheckReport {
    packageName: string;
    baseRef: string;
    mergeBase: string;
    changedFiles: string[];
    codeChanged: boolean;
    declaredBump: SemverBump | null;
    changedChangesetFiles: string[];
    changesetIssues: ChangesetIssue[];
    comparison: CompatibilityResult;
    policy: PolicyOutcome;
}

interface JsonFinding {
    exportName: string;
    reason: string;
    mode: string;
    details: string;
    previousType: string;
    nextType: string | null;
}

export interface SemverCheckJsonReport {
    status: 'pass' | 'fail';
    packageName: string;
    baseRef: string;
    mergeBase: string;
    changedFiles: string[];
    codeChanged: boolean;
    declaredBump: SemverBump | null;
    requiredBump: SemverBump;
    breaking: boolean;
    changesetFiles: string[];
    changesetIssues: ChangesetIssue[];
    policyMessages: string[];
    allowlistIssues: string[];
    findings: JsonFinding[];
    ignoredFindings: JsonFinding[];
}

function formatBump(bump: SemverBump | null): string {
    return bump ?? 'none';
}

function formatFinding(finding: CompatibilityFinding): string {
    const nextTypeText = finding.nextType ?? '<missing>';
    return [
        `- ${finding.exportName}: ${finding.reason}`,
        `  rule: ${finding.details}`,
        `  previous: ${finding.previousType}`,
        `  next: ${nextTypeText}`,
    ].join('\n');
}

export function buildHumanReport(report: SemverCheckReport): string {
    const lines: string[] = [];

    lines.push('SemVer public API check');
    lines.push(`package: ${report.packageName}`);
    lines.push(`base ref: ${report.baseRef}`);
    lines.push(`merge base: ${report.mergeBase}`);
    lines.push(`changed files: ${report.changedFiles.length}`);
    lines.push(`declared bump: ${formatBump(report.declaredBump)}`);
    lines.push(`required bump: ${report.policy.requiredBump}`);
    lines.push(`breaking findings: ${report.policy.effectiveFindings.length}`);

    if (report.changedChangesetFiles.length > 0) {
        lines.push('changed changesets:');
        for (const filePath of report.changedChangesetFiles) {
            lines.push(`- ${filePath}`);
        }
    }

    if (report.policy.effectiveFindings.length > 0) {
        lines.push('breaking exports:');
        for (const finding of report.policy.effectiveFindings) {
            lines.push(formatFinding(finding));
        }
    }

    if (report.policy.ignoredFindings.length > 0) {
        lines.push(`allowlisted findings ignored: ${report.policy.ignoredFindings.length}`);
    }

    if (report.changesetIssues.length > 0) {
        lines.push('changeset issues:');
        for (const issue of report.changesetIssues) {
            lines.push(`- ${issue.filePath}: ${issue.message}`);
        }
    }

    if (report.policy.allowlistIssues.length > 0) {
        lines.push('allowlist issues:');
        for (const issue of report.policy.allowlistIssues) {
            lines.push(`- ${issue}`);
        }
    }

    if (report.policy.messages.length > 0) {
        lines.push('policy diagnostics:');
        for (const message of report.policy.messages) {
            lines.push(`- ${message}`);
        }
    }

    lines.push(`result: ${report.policy.pass ? 'PASS' : 'FAIL'}`);

    return lines.join('\n');
}

function toJsonFinding(finding: CompatibilityFinding): JsonFinding {
    return {
        exportName: finding.exportName,
        reason: finding.reason,
        mode: finding.mode,
        details: finding.details,
        previousType: finding.previousType,
        nextType: finding.nextType,
    };
}

export function buildJsonReport(report: SemverCheckReport): SemverCheckJsonReport {
    return {
        status: report.policy.pass ? 'pass' : 'fail',
        packageName: report.packageName,
        baseRef: report.baseRef,
        mergeBase: report.mergeBase,
        changedFiles: report.changedFiles,
        codeChanged: report.codeChanged,
        declaredBump: report.declaredBump,
        requiredBump: report.policy.requiredBump,
        breaking: report.policy.effectiveFindings.length > 0,
        changesetFiles: report.changedChangesetFiles,
        changesetIssues: report.changesetIssues,
        policyMessages: report.policy.messages,
        allowlistIssues: report.policy.allowlistIssues,
        findings: report.policy.effectiveFindings.map(toJsonFinding),
        ignoredFindings: report.policy.ignoredFindings.map(toJsonFinding),
    };
}
