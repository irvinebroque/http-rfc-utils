export type SemverBump = 'patch' | 'minor' | 'major';

export const SEMVER_BUMP_ORDER: Record<SemverBump, number> = {
    patch: 0,
    minor: 1,
    major: 2,
};

export function maxSemverBump(
    left: SemverBump | null,
    right: SemverBump | null
): SemverBump | null {
    if (left === null) {
        return right;
    }

    if (right === null) {
        return left;
    }

    return SEMVER_BUMP_ORDER[left] >= SEMVER_BUMP_ORDER[right] ? left : right;
}

export type ApiExportKind = 'value' | 'type' | 'hybrid' | 'unknown';

export type CompatibilityMode = 'next-assignable-to-previous' | 'previous-assignable-to-next';

export interface ApiExportModel {
    name: string;
    kind: ApiExportKind;
    symbolFlags: number;
    typeText: string;
}

export type CompatibilityFindingReason = 'missing-export' | 'incompatible-export';

export interface CompatibilityFinding {
    exportName: string;
    reason: CompatibilityFindingReason;
    mode: CompatibilityMode;
    previousType: string;
    nextType: string | null;
    details: string;
}

export interface CompatibilityResult {
    breaking: boolean;
    comparedExports: number;
    previousExportCount: number;
    nextExportCount: number;
    findings: CompatibilityFinding[];
}

export interface ChangesetIssue {
    filePath: string;
    message: string;
}

export interface ChangesetIntentResult {
    changedChangesetFiles: string[];
    declaredBump: SemverBump | null;
    issues: ChangesetIssue[];
}

export interface AllowlistEntry {
    exportName: string;
    reason?: CompatibilityFindingReason;
    justification: string;
    expiresOn: string;
}

export interface PolicyOutcome {
    pass: boolean;
    strictModeEnabled: boolean;
    requiredBump: SemverBump;
    effectiveFindings: CompatibilityFinding[];
    ignoredFindings: CompatibilityFinding[];
    allowlistIssues: string[];
    messages: string[];
}
