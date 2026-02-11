/**
 * Tests for alt svc behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseAltSvc,
    formatAltSvc,
    parseAltUsed,
    formatAltUsed,
} from '../src/alt-svc.js';

// RFC 7838 §3: Alt-Svc = clear / 1#alt-value and clear is case-sensitive.
describe('parseAltSvc (RFC 7838 Section 3)', () => {
    it('parses the case-sensitive clear token', () => {
        assert.deepEqual(parseAltSvc('clear'), {
            clear: true,
            alternatives: [],
        });
    });

    it('does not treat mixed-case clear as valid clear', () => {
        assert.equal(parseAltSvc('Clear'), null);
    });

    it('rejects members with a missing protocol-id segment', () => {
        assert.equal(parseAltSvc(';h2=":443"'), null);
    });

    // RFC 7838 §3: parse alternatives as ordered 1# list members.
    it('parses h2 and host+port alternatives preserving preference order', () => {
        const parsed = parseAltSvc('h2=":8000"; ma=60, h3="alt.example.test:443"; persist=1');

        assert.deepEqual(parsed, {
            clear: false,
            alternatives: [
                {
                    protocolId: 'h2',
                    authority: ':8000',
                    ma: 60,
                },
                {
                    protocolId: 'h3',
                    authority: 'alt.example.test:443',
                    persist: true,
                },
            ],
        });
    });

    // RFC 7838 §3.1: unknown parameters are ignored.
    it('ignores unknown parameters and malformed members while keeping valid members', () => {
        const parsed = parseAltSvc('h2=":8000"; foo=bar, invalid-member, h3="alt.example.test:443"; ma=abc, h3-29="alt2.example.test:443"');

        assert.deepEqual(parsed, {
            clear: false,
            alternatives: [
                {
                    protocolId: 'h2',
                    authority: ':8000',
                },
                {
                    protocolId: 'h3',
                    authority: 'alt.example.test:443',
                },
                {
                    protocolId: 'h3-29',
                    authority: 'alt2.example.test:443',
                },
            ],
        });
    });

    // RFC 7838 §3.1: persist has meaning only when value is 1.
    it('only sets persist when the parameter value is 1', () => {
        const parsed = parseAltSvc('h2=":443"; persist=0, h3=":8443"; persist=1');

        assert.deepEqual(parsed, {
            clear: false,
            alternatives: [
                {
                    protocolId: 'h2',
                    authority: ':443',
                },
                {
                    protocolId: 'h3',
                    authority: ':8443',
                    persist: true,
                },
            ],
        });
    });
});

describe('formatAltSvc (RFC 7838 Section 3)', () => {
    it('formats clear', () => {
        assert.equal(formatAltSvc({ clear: true, alternatives: [] }), 'clear');
    });

    it('throws when clear is mixed with alternatives', () => {
        assert.throws(() => {
            formatAltSvc({
                clear: true,
                alternatives: [{ protocolId: 'h2', authority: ':443' }],
            });
        }, /clear=true/);
    });

    it('formats ordered alternatives with ma and persist', () => {
        const value = formatAltSvc({
            clear: false,
            alternatives: [
                { protocolId: 'h2', authority: ':8000', ma: 60 },
                { protocolId: 'h3', authority: 'alt.example.test:443', persist: true },
            ],
        });

        assert.equal(value, 'h2=":8000"; ma=60, h3="alt.example.test:443"; persist=1');
    });

    it('formats authority with embedded quote and backslash', () => {
        const value = formatAltSvc({
            clear: false,
            alternatives: [{ protocolId: 'h2', authority: 'alt\\"svc:443' }],
        });

        assert.equal(value, 'h2="alt\\\\\\"svc:443"');
    });

    it('round-trips parse -> format -> parse for alternatives', () => {
        const input = 'h2=":8000"; ma=60, h3="alt.example.test:443"; persist=1';
        const parsed = parseAltSvc(input);
        assert.ok(parsed);
        const reparsed = parseAltSvc(formatAltSvc(parsed));
        assert.deepEqual(reparsed, parsed);
    });
});

// RFC 7838 §5: Alt-Used = uri-host [":" port].
describe('Alt-Used (RFC 7838 Section 5)', () => {
    it('parses host and optional port', () => {
        assert.deepEqual(parseAltUsed('alt.example.test'), { host: 'alt.example.test' });
        assert.deepEqual(parseAltUsed('alt.example.test:443'), { host: 'alt.example.test', port: 443 });
    });

    it('parses bracketed IPv6 host and port', () => {
        assert.deepEqual(parseAltUsed('[2001:db8::1]:8443'), { host: '2001:db8::1', port: 8443 });
    });

    it('formats host, host:port, and IPv6 host:port', () => {
        assert.equal(formatAltUsed({ host: 'alt.example.test' }), 'alt.example.test');
        assert.equal(formatAltUsed({ host: 'alt.example.test', port: 443 }), 'alt.example.test:443');
        assert.equal(formatAltUsed({ host: '2001:db8::1', port: 8443 }), '[2001:db8::1]:8443');
    });
});
