import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FINDINGS_FILE = process.env.SECURITY_FINDINGS_FILE ?? 'docs/security/findings.json';

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const VALID_STATUSES = new Set(['open', 'triaged', 'in-progress', 'fixed', 'accepted', 'deferred']);
const VALID_SLA_STATES = new Set(['on-track', 'at-risk', 'overdue', 'n/a']);
const TERMINAL_STATUSES = new Set(['fixed', 'accepted', 'deferred']);

function rootPath(relPath) {
    return path.join(ROOT, relPath);
}

function assertStringField(finding, field, index) {
    const value = finding[field];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Finding[${index}] must define non-empty string field: ${field}`);
    }
}

function assertOptionalIsoTimestampField(finding, field, index) {
    const value = finding[field];
    if (value === undefined || value === null) {
        return;
    }

    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Finding[${index}] optional field must be a non-empty timestamp string when present: ${field}`);
    }

    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
        throw new Error(`Finding[${index}] has invalid ISO timestamp in field: ${field}`);
    }
}

function toTimestamp(value, context) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
        throw new Error(`Invalid timestamp value for ${context}`);
    }

    return timestamp;
}

function validateFinding(finding, index) {
    if (finding === null || typeof finding !== 'object' || Array.isArray(finding)) {
        throw new Error(`Finding[${index}] must be an object`);
    }

    assertStringField(finding, 'id', index);
    assertStringField(finding, 'severity', index);
    assertStringField(finding, 'module', index);
    assertStringField(finding, 'trigger', index);
    assertStringField(finding, 'impact', index);
    assertStringField(finding, 'fixStrategy', index);
    assertStringField(finding, 'status', index);
    assertStringField(finding, 'owner', index);
    assertStringField(finding, 'reviewer', index);
    assertStringField(finding, 'discoveredAt', index);
    assertStringField(finding, 'slaState', index);

    assertOptionalIsoTimestampField(finding, 'triagedAt', index);
    assertOptionalIsoTimestampField(finding, 'fixPlannedAt', index);
    assertOptionalIsoTimestampField(finding, 'resolvedAt', index);

    if (!VALID_SEVERITIES.has(finding.severity)) {
        throw new Error(`Finding[${index}] has invalid severity: ${finding.severity}`);
    }

    if (!VALID_STATUSES.has(finding.status)) {
        throw new Error(`Finding[${index}] has invalid status: ${finding.status}`);
    }

    if (!VALID_SLA_STATES.has(finding.slaState)) {
        throw new Error(`Finding[${index}] has invalid slaState: ${finding.slaState}`);
    }

    const discoveredAt = toTimestamp(finding.discoveredAt, `Finding[${index}].discoveredAt`);

    if (finding.triagedAt !== undefined && finding.triagedAt !== null) {
        const triagedAt = toTimestamp(finding.triagedAt, `Finding[${index}].triagedAt`);
        if (triagedAt < discoveredAt) {
            throw new Error(`Finding[${index}] triagedAt cannot be earlier than discoveredAt`);
        }
    }

    if (finding.fixPlannedAt !== undefined && finding.fixPlannedAt !== null) {
        const fixPlannedAt = toTimestamp(finding.fixPlannedAt, `Finding[${index}].fixPlannedAt`);
        if (fixPlannedAt < discoveredAt) {
            throw new Error(`Finding[${index}] fixPlannedAt cannot be earlier than discoveredAt`);
        }
    }

    if (finding.resolvedAt !== undefined && finding.resolvedAt !== null) {
        const resolvedAt = toTimestamp(finding.resolvedAt, `Finding[${index}].resolvedAt`);
        if (resolvedAt < discoveredAt) {
            throw new Error(`Finding[${index}] resolvedAt cannot be earlier than discoveredAt`);
        }
    }

    if (finding.status === 'triaged' && (finding.triagedAt === undefined || finding.triagedAt === null)) {
        throw new Error(`Finding[${index}] with status triaged must include triagedAt timestamp`);
    }

    if (finding.status === 'fixed' && (finding.resolvedAt === undefined || finding.resolvedAt === null)) {
        throw new Error(`Finding[${index}] with status fixed must include resolvedAt timestamp`);
    }

    if (TERMINAL_STATUSES.has(finding.status) && finding.slaState !== 'n/a') {
        throw new Error(`Finding[${index}] terminal status must use slaState "n/a"`);
    }

    if (!TERMINAL_STATUSES.has(finding.status) && finding.slaState === 'n/a') {
        throw new Error(`Finding[${index}] non-terminal status cannot use slaState "n/a"`);
    }
}

function summarize(findings) {
    const summary = {
        total: findings.length,
        bySeverity: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
        },
        byStatus: {
            open: 0,
            triaged: 0,
            'in-progress': 0,
            fixed: 0,
            accepted: 0,
            deferred: 0,
        },
        bySlaState: {
            'on-track': 0,
            'at-risk': 0,
            overdue: 0,
            'n/a': 0,
        },
        overdueOpenFindings: 0,
    };

    for (const finding of findings) {
        summary.bySeverity[finding.severity] += 1;
        summary.byStatus[finding.status] += 1;
        summary.bySlaState[finding.slaState] += 1;

        if (finding.slaState === 'overdue' && !TERMINAL_STATUSES.has(finding.status)) {
            summary.overdueOpenFindings += 1;
        }
    }

    return summary;
}

async function main() {
    const findingsPath = rootPath(FINDINGS_FILE);
    const findingsText = await fs.readFile(findingsPath, 'utf8');
    const findings = JSON.parse(findingsText);

    if (!Array.isArray(findings)) {
        throw new Error(`${FINDINGS_FILE} must contain a JSON array`);
    }

    findings.forEach((finding, index) => validateFinding(finding, index));

    const summary = summarize(findings);
    const outputDirectory = rootPath(path.join('temp', 'security'));
    await fs.mkdir(outputDirectory, { recursive: true });
    const outputPath = path.join(outputDirectory, 'findings-summary.json');
    await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 4)}\n`, 'utf8');

    console.log(`Security findings validated: ${summary.total} total`);
    console.log(`  Critical: ${summary.bySeverity.critical}`);
    console.log(`  High: ${summary.bySeverity.high}`);
    console.log(`  Medium: ${summary.bySeverity.medium}`);
    console.log(`  Low: ${summary.bySeverity.low}`);
    console.log(`  SLA on-track: ${summary.bySlaState['on-track']}`);
    console.log(`  SLA at-risk: ${summary.bySlaState['at-risk']}`);
    console.log(`  SLA overdue: ${summary.bySlaState.overdue}`);
    console.log(`  SLA n/a: ${summary.bySlaState['n/a']}`);
    console.log(`  Overdue open findings: ${summary.overdueOpenFindings}`);
    console.log(`Summary written: ${path.relative(ROOT, outputPath)}`);
}

await main();
