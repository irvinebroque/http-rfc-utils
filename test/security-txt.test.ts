import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseSecurityTxt,
    formatSecurityTxt,
    isSecurityTxtExpired,
    validateSecurityTxt,
} from '../src/security-txt.js';

// RFC 9116 §2: security.txt format.
describe('RFC 9116 security.txt', () => {
    describe('parseSecurityTxt', () => {
        it('parses all standard fields', () => {
            const text = [
                'Contact: mailto:security@example.com',
                'Expires: 2027-01-31T23:59:59.000Z',
                'Encryption: https://example.com/.well-known/pgp-key.txt',
                'Acknowledgments: https://example.com/thanks',
                'Preferred-Languages: en, fr',
                'Canonical: https://example.com/.well-known/security.txt',
                'Policy: https://example.com/security-policy',
                'Hiring: https://example.com/security-jobs',
            ].join('\n');

            const config = parseSecurityTxt(text);
            assert.deepEqual(config.contact, ['mailto:security@example.com']);
            assert.equal(config.expires.toISOString(), '2027-01-31T23:59:59.000Z');
            assert.deepEqual(config.encryption, ['https://example.com/.well-known/pgp-key.txt']);
            assert.deepEqual(config.acknowledgments, ['https://example.com/thanks']);
            assert.deepEqual(config.preferredLanguages, ['en', 'fr']);
            assert.deepEqual(config.canonical, ['https://example.com/.well-known/security.txt']);
            assert.deepEqual(config.policy, ['https://example.com/security-policy']);
            assert.deepEqual(config.hiring, ['https://example.com/security-jobs']);
        });

        it('parses multiple Contact fields', () => {
            const text = 'Contact: mailto:a@example.com\nContact: mailto:b@example.com\nExpires: 2027-01-01T00:00:00.000Z\n';
            const config = parseSecurityTxt(text);
            assert.deepEqual(config.contact, ['mailto:a@example.com', 'mailto:b@example.com']);
        });

        // RFC 9116 §3: Comments start with #.
        it('strips comments', () => {
            const text = '# This is a comment\nContact: mailto:test@example.com # inline\nExpires: 2027-01-01T00:00:00.000Z\n';
            const config = parseSecurityTxt(text);
            assert.deepEqual(config.contact, ['mailto:test@example.com']);
        });

        it('handles CRLF line endings', () => {
            const text = 'Contact: mailto:test@example.com\r\nExpires: 2027-01-01T00:00:00.000Z\r\n';
            const config = parseSecurityTxt(text);
            assert.deepEqual(config.contact, ['mailto:test@example.com']);
        });

        it('is case-insensitive for field names', () => {
            const text = 'CONTACT: mailto:test@example.com\nEXPIRES: 2027-01-01T00:00:00.000Z\n';
            const config = parseSecurityTxt(text);
            assert.deepEqual(config.contact, ['mailto:test@example.com']);
        });

        it('parses extension fields', () => {
            const text = 'Contact: mailto:test@example.com\nExpires: 2027-01-01T00:00:00.000Z\nCustom-Field: some value\n';
            const config = parseSecurityTxt(text);
            assert.ok(config.extensions);
            assert.deepEqual(config.extensions['custom-field'], ['some value']);
        });

        it('handles missing Expires gracefully', () => {
            const text = 'Contact: mailto:test@example.com\n';
            const config = parseSecurityTxt(text);
            // Falls back to epoch.
            assert.equal(config.expires.getTime(), 0);
        });
    });

    // RFC 9116 §2.3: CRLF line endings.
    describe('formatSecurityTxt', () => {
        it('formats with CRLF line endings', () => {
            const config = {
                contact: ['mailto:test@example.com'],
                expires: new Date('2027-01-31T23:59:59.000Z'),
            };
            const text = formatSecurityTxt(config);
            assert.ok(text.includes('\r\n'));
            assert.ok(!text.includes('\r\n\r\n')); // No double CRLFs.
        });

        it('formats all fields', () => {
            const config = {
                contact: ['mailto:a@example.com', 'mailto:b@example.com'],
                expires: new Date('2027-01-31T23:59:59.000Z'),
                encryption: ['https://example.com/pgp-key.txt'],
                acknowledgments: ['https://example.com/thanks'],
                preferredLanguages: ['en', 'fr'],
                canonical: ['https://example.com/.well-known/security.txt'],
                policy: ['https://example.com/policy'],
                hiring: ['https://example.com/jobs'],
            };
            const text = formatSecurityTxt(config);
            assert.ok(text.includes('Contact: mailto:a@example.com'));
            assert.ok(text.includes('Contact: mailto:b@example.com'));
            assert.ok(text.includes('Expires: 2027-01-31T23:59:59.000Z'));
            assert.ok(text.includes('Encryption: https://example.com/pgp-key.txt'));
            assert.ok(text.includes('Acknowledgments: https://example.com/thanks'));
            assert.ok(text.includes('Preferred-Languages: en, fr'));
            assert.ok(text.includes('Canonical: https://example.com/.well-known/security.txt'));
            assert.ok(text.includes('Policy: https://example.com/policy'));
            assert.ok(text.includes('Hiring: https://example.com/jobs'));
        });

        it('round-trips a parsed file', () => {
            const original = 'Contact: mailto:test@example.com\nExpires: 2027-01-31T23:59:59.000Z\nPreferred-Languages: en\n';
            const config = parseSecurityTxt(original);
            const formatted = formatSecurityTxt(config);
            const reparsed = parseSecurityTxt(formatted);
            assert.deepEqual(reparsed.contact, config.contact);
            assert.equal(reparsed.expires.toISOString(), config.expires.toISOString());
            assert.deepEqual(reparsed.preferredLanguages, config.preferredLanguages);
        });
    });

    // RFC 9116 §2.5.3: Expires check.
    describe('isSecurityTxtExpired', () => {
        it('returns true for past date', () => {
            const config = {
                contact: ['mailto:test@example.com'],
                expires: new Date('2020-01-01T00:00:00.000Z'),
            };
            assert.equal(isSecurityTxtExpired(config), true);
        });

        it('returns false for future date', () => {
            const config = {
                contact: ['mailto:test@example.com'],
                expires: new Date('2099-01-01T00:00:00.000Z'),
            };
            assert.equal(isSecurityTxtExpired(config), false);
        });

        it('accepts a custom now date', () => {
            const config = {
                contact: ['mailto:test@example.com'],
                expires: new Date('2025-06-01T00:00:00.000Z'),
            };
            assert.equal(isSecurityTxtExpired(config, new Date('2025-01-01T00:00:00.000Z')), false);
            assert.equal(isSecurityTxtExpired(config, new Date('2025-12-01T00:00:00.000Z')), true);
        });
    });

    // RFC 9116 §2.5: Validation.
    describe('validateSecurityTxt', () => {
        it('returns no issues for a valid config', () => {
            const config = {
                contact: ['mailto:test@example.com'],
                expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
                canonical: ['https://example.com/.well-known/security.txt'],
            };
            const issues = validateSecurityTxt(config);
            assert.equal(issues.length, 0);
        });

        // RFC 9116 §2.5.1: Contact is REQUIRED.
        it('reports missing Contact', () => {
            const config = {
                contact: [],
                expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                canonical: ['https://example.com/.well-known/security.txt'],
            };
            const issues = validateSecurityTxt(config);
            assert.ok(issues.some(i => i.field === 'contact' && i.severity === 'error'));
        });

        it('warns on non-standard Contact URI', () => {
            const config = {
                contact: ['http://example.com/contact'],
                expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                canonical: ['https://example.com/.well-known/security.txt'],
            };
            const issues = validateSecurityTxt(config);
            assert.ok(issues.some(i => i.field === 'contact' && i.severity === 'warning'));
        });

        // RFC 9116 §2.5.3: Expires more than 1 year out.
        it('warns on Expires > 1 year', () => {
            const config = {
                contact: ['mailto:test@example.com'],
                expires: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
                canonical: ['https://example.com/.well-known/security.txt'],
            };
            const issues = validateSecurityTxt(config);
            assert.ok(issues.some(i => i.field === 'expires' && i.severity === 'warning'));
        });

        it('reports expired date', () => {
            const config = {
                contact: ['mailto:test@example.com'],
                expires: new Date('2020-01-01T00:00:00.000Z'),
                canonical: ['https://example.com/.well-known/security.txt'],
            };
            const issues = validateSecurityTxt(config);
            assert.ok(issues.some(i => i.field === 'expires' && i.severity === 'error'));
        });

        // RFC 9116 §2.5.2: Canonical is RECOMMENDED.
        it('warns on missing Canonical', () => {
            const config = {
                contact: ['mailto:test@example.com'],
                expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            };
            const issues = validateSecurityTxt(config);
            assert.ok(issues.some(i => i.field === 'canonical' && i.severity === 'warning'));
        });
    });
});
