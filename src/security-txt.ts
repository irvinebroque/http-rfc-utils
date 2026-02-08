/**
 * security.txt per RFC 9116.
 * RFC 9116 §2: Format and required fields.
 * @see https://www.rfc-editor.org/rfc/rfc9116.html
 */

import type { SecurityTxt, SecurityTxtIssue } from './types.js';

export type { SecurityTxt, SecurityTxtIssue } from './types.js';

/**
 * Known field names per RFC 9116 §2.5 (case-insensitive).
 */
const KNOWN_FIELDS = new Set([
    'contact',
    'expires',
    'encryption',
    'acknowledgments',
    'preferred-languages',
    'canonical',
    'policy',
    'hiring',
]);

/**
 * Parse a security.txt file into a structured SecurityTxt object.
 * RFC 9116 §3: Comments start with `#`, field names are case-insensitive.
 */
export function parseSecurityTxt(text: string): SecurityTxt {
    // Normalize line endings (RFC 9116 §2.3 mandates CRLF, but be lenient in parsing).
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');

    const contacts: string[] = [];
    let expires: Date | undefined;
    const encryption: string[] = [];
    const acknowledgments: string[] = [];
    const preferredLanguages: string[] = [];
    const canonical: string[] = [];
    const policy: string[] = [];
    const hiring: string[] = [];
    const extensions: Record<string, string[]> = {};

    for (const rawLine of lines) {
        // RFC 9116 §3: Strip comments.
        const commentIdx = rawLine.indexOf('#');
        const line = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).trim();

        if (line === '') {
            continue;
        }

        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) {
            continue;
        }

        const field = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();

        switch (field) {
            case 'contact':
                contacts.push(value);
                break;
            case 'expires':
                expires = new Date(value);
                break;
            case 'encryption':
                encryption.push(value);
                break;
            case 'acknowledgments':
                acknowledgments.push(value);
                break;
            case 'preferred-languages':
                // RFC 9116 §2.5.8: Comma-separated list of language tags.
                for (const lang of value.split(',')) {
                    const trimmed = lang.trim();
                    if (trimmed) {
                        preferredLanguages.push(trimmed);
                    }
                }
                break;
            case 'canonical':
                canonical.push(value);
                break;
            case 'policy':
                policy.push(value);
                break;
            case 'hiring':
                hiring.push(value);
                break;
            default:
                if (!KNOWN_FIELDS.has(field)) {
                    if (!extensions[field]) {
                        extensions[field] = [];
                    }
                    extensions[field].push(value);
                }
                break;
        }
    }

    const result: SecurityTxt = {
        contact: contacts,
        expires: expires ?? new Date(0),
    };

    if (encryption.length > 0) result.encryption = encryption;
    if (acknowledgments.length > 0) result.acknowledgments = acknowledgments;
    if (preferredLanguages.length > 0) result.preferredLanguages = preferredLanguages;
    if (canonical.length > 0) result.canonical = canonical;
    if (policy.length > 0) result.policy = policy;
    if (hiring.length > 0) result.hiring = hiring;
    if (Object.keys(extensions).length > 0) result.extensions = extensions;

    return result;
}

/**
 * Serialize a SecurityTxt config to spec-compliant text.
 * RFC 9116 §2.3: File MUST use CRLF line endings.
 */
export function formatSecurityTxt(config: SecurityTxt): string {
    const lines: string[] = [];

    for (const contact of config.contact) {
        lines.push(`Contact: ${contact}`);
    }

    // RFC 9116 §2.5.3: Expires is REQUIRED.
    lines.push(`Expires: ${config.expires.toISOString()}`);

    if (config.encryption) {
        for (const enc of config.encryption) {
            lines.push(`Encryption: ${enc}`);
        }
    }

    if (config.acknowledgments) {
        for (const ack of config.acknowledgments) {
            lines.push(`Acknowledgments: ${ack}`);
        }
    }

    if (config.preferredLanguages && config.preferredLanguages.length > 0) {
        lines.push(`Preferred-Languages: ${config.preferredLanguages.join(', ')}`);
    }

    if (config.canonical) {
        for (const can of config.canonical) {
            lines.push(`Canonical: ${can}`);
        }
    }

    if (config.policy) {
        for (const pol of config.policy) {
            lines.push(`Policy: ${pol}`);
        }
    }

    if (config.hiring) {
        for (const hire of config.hiring) {
            lines.push(`Hiring: ${hire}`);
        }
    }

    if (config.extensions) {
        for (const [field, values] of Object.entries(config.extensions)) {
            // Capitalize first letter for readability.
            const capitalized = field.charAt(0).toUpperCase() + field.slice(1);
            for (const val of values) {
                lines.push(`${capitalized}: ${val}`);
            }
        }
    }

    // RFC 9116 §2.3: CRLF line endings.
    return lines.join('\r\n') + '\r\n';
}

/**
 * Check if a security.txt Expires field is in the past.
 * RFC 9116 §2.5.3: Consumers MUST NOT use an expired security.txt file.
 */
export function isSecurityTxtExpired(config: SecurityTxt, now?: Date): boolean {
    const currentTime = now ?? new Date();
    return config.expires.getTime() <= currentTime.getTime();
}

/**
 * Validate a SecurityTxt configuration and return an array of issues.
 * RFC 9116 §2.5: Required fields, expiry limits, and recommendations.
 */
export function validateSecurityTxt(config: SecurityTxt): SecurityTxtIssue[] {
    const issues: SecurityTxtIssue[] = [];

    // RFC 9116 §2.5.1: Contact is REQUIRED, at least one.
    if (!config.contact || config.contact.length === 0) {
        issues.push({
            field: 'contact',
            message: 'At least one Contact field is REQUIRED (RFC 9116 §2.5.1)',
            severity: 'error',
        });
    }

    // Validate Contact URIs.
    for (const contact of config.contact) {
        if (!contact.startsWith('mailto:') && !contact.startsWith('https:') && !contact.startsWith('tel:')) {
            issues.push({
                field: 'contact',
                message: `Contact "${contact}" should be a mailto:, https:, or tel: URI (RFC 9116 §2.5.1)`,
                severity: 'warning',
            });
        }
    }

    // RFC 9116 §2.5.3: Expires is REQUIRED.
    if (!config.expires || isNaN(config.expires.getTime())) {
        issues.push({
            field: 'expires',
            message: 'Expires field is REQUIRED and must be a valid date (RFC 9116 §2.5.3)',
            severity: 'error',
        });
    } else {
        // RFC 9116 §2.5.3: Expires MUST be less than 1 year in the future.
        const now = new Date();
        const oneYear = new Date(now.getTime() + 365.25 * 24 * 60 * 60 * 1000);
        if (config.expires.getTime() > oneYear.getTime()) {
            issues.push({
                field: 'expires',
                message: 'Expires must be less than 1 year in the future (RFC 9116 §2.5.3)',
                severity: 'warning',
            });
        }

        if (isSecurityTxtExpired(config)) {
            issues.push({
                field: 'expires',
                message: 'The security.txt file has expired',
                severity: 'error',
            });
        }
    }

    // RFC 9116 §2.5.2: Canonical is RECOMMENDED when served over HTTPS.
    if (!config.canonical || config.canonical.length === 0) {
        issues.push({
            field: 'canonical',
            message: 'Canonical field is RECOMMENDED when served over HTTPS (RFC 9116 §2.5.2)',
            severity: 'warning',
        });
    }

    return issues;
}
