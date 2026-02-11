/**
 * Tests for trace context behavior.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseTraceparent,
    formatTraceparent,
    validateTraceparent,
    parseTracestate,
    formatTracestate,
    validateTracestate,
    updateTraceparentParent,
    restartTraceparent,
    addOrUpdateTracestate,
    removeTracestateKey,
    truncateTracestate,
} from '../src/trace-context.js';

const VALID_TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

// W3C Trace Context §3.2: traceparent field format and lowercase hex constraints.
describe('traceparent parsing/formatting (W3C Trace Context Section 3.2)', () => {
    it('parses a valid traceparent value', () => {
        assert.deepEqual(parseTraceparent(VALID_TRACEPARENT), {
            version: '00',
            traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
            parentId: '00f067aa0ba902b7',
            traceFlags: '01',
        });
    });

    it('rejects uppercase hex and all-zero identifiers', () => {
        assert.equal(parseTraceparent('00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01'), null);
        assert.equal(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01'), null);
        assert.equal(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01'), null);
    });

    it('formats a parsed traceparent canonically', () => {
        const parsed = parseTraceparent(VALID_TRACEPARENT);
        assert.ok(parsed);
        assert.equal(formatTraceparent(parsed), VALID_TRACEPARENT);
    });

    it('returns structured validation errors', () => {
        const result = validateTraceparent('00-zzzz-00f067aa0ba902b7-01');
        assert.equal(result.valid, false);
        assert.ok(result.errors.length > 0);
    });

    it('accepts higher traceparent versions and ignores opaque fields with valid prefix', () => {
        assert.deepEqual(parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'), {
            version: '01',
            traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
            parentId: '00f067aa0ba902b7',
            traceFlags: '01',
        });

        assert.deepEqual(parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-ab-extra-data'), {
            version: '01',
            traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
            parentId: '00f067aa0ba902b7',
            traceFlags: '01',
        });
    });

    // W3C Trace Context §3.2.4: future-version extra fields must keep delimiter/hex prefix compatibility.
    it('rejects higher-version malformed additional field prefixes', () => {
        assert.equal(parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-'), null);
        assert.equal(parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-extra-data'), null);
    });

    it('rejects invalid versions and malformed field counts/layout', () => {
        assert.equal(parseTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'), null);
        assert.equal(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7'), null);
        assert.equal(parseTraceparent('0-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'), null);
        assert.equal(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-extra'), null);
        assert.equal(parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01extra'), null);
    });

    it('throws when formatting an invalid traceparent object', () => {
        assert.throws(() => {
            formatTraceparent({
                version: '00',
                traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
                parentId: '0000000000000000',
                traceFlags: '01',
            });
        }, /Invalid traceparent/);
    });
});

// W3C Trace Context §3.3.1.5: tracestate limits and list-member constraints.
describe('tracestate parsing/formatting (W3C Trace Context Section 3.3)', () => {
    it('parses valid tracestate while preserving order', () => {
        const parsed = parseTracestate('rojo=00f067aa0ba902b7,congo=t61rcWkgMzE');
        assert.deepEqual(parsed, [
            { key: 'rojo', value: '00f067aa0ba902b7' },
            { key: 'congo', value: 't61rcWkgMzE' },
        ]);
    });

    it('rejects duplicate keys and invalid key/value syntax', () => {
        assert.equal(parseTracestate('rojo=1,rojo=2'), null);
        assert.equal(parseTracestate('Rojo=1'), null);
        assert.equal(parseTracestate('rojo=a=b'), null);
    });

    it('accepts tenant@system keys and rejects malformed multi-tenant keys', () => {
        assert.deepEqual(parseTracestate('tenant@sys=value'), [{ key: 'tenant@sys', value: 'value' }]);
        assert.equal(parseTracestate('tenant@@sys=value'), null);
        assert.equal(parseTracestate('tenant@toolongsystemid=value'), null);
    });

    it('formats tracestate members in supplied order', () => {
        const header = formatTracestate([
            { key: 'rojo', value: '1' },
            { key: 'congo', value: '2' },
        ]);
        assert.equal(header, 'rojo=1,congo=2');
    });

    it('validates member and length limits', () => {
        const overMemberLimit = Array.from({ length: 33 }, (_, index) => `k${index}=1`).join(',');
        const overLengthLimit = `a=${'b'.repeat(511)}`;

        assert.equal(validateTracestate(overMemberLimit).valid, false);
        assert.equal(validateTracestate(overLengthLimit).valid, false);
    });

    it('rejects empty and malformed list-members', () => {
        assert.equal(validateTracestate(' ').valid, false);
        assert.equal(validateTracestate('rojo=1,,congo=2').valid, false);
        assert.equal(validateTracestate('rojo=' + String.fromCharCode(0x1f)).valid, false);
    });

    // W3C Trace Context §3.3.1.2: OWS around list-members is ignored, so `k=v ` is valid wire syntax.
    // We still reject trailing-space values in direct entry APIs (see mutation helper tests).
    it('rejects empty values and preserves OWS semantics on wire-format values', () => {
        assert.equal(validateTracestate('rojo=').valid, false);
        assert.equal(validateTracestate('rojo=value ').valid, true);
        assert.equal(validateTracestate('rojo= value').valid, true);
    });
});

// W3C Trace Context §4.2 and §4.3: restart/update behavior and invalid-parent handling.
describe('trace context mutation helpers (W3C Trace Context Sections 3.5, 4.2, 4.3)', () => {
    it('updates parent-id and sampled bit when requested', () => {
        const updated = updateTraceparentParent(VALID_TRACEPARENT, { sampled: false });
        assert.ok(updated.traceparent);
        assert.equal(updated.traceparent.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
        assert.equal(updated.traceparent.traceFlags, '00');
        assert.equal(updated.traceparent.parentId.length, 16);
        assert.notEqual(updated.traceparent.parentId, '0000000000000000');
    });

    it('restarts context with new non-zero trace-id and parent-id', () => {
        const restarted = restartTraceparent(VALID_TRACEPARENT, { sampled: true });
        assert.ok(restarted.traceparent);
        assert.equal(restarted.traceparent.version, '00');
        assert.equal(restarted.traceparent.traceFlags, '01');
        assert.equal(restarted.traceparent.traceId.length, 32);
        assert.equal(restarted.traceparent.parentId.length, 16);
        assert.notEqual(restarted.traceparent.traceId, '00000000000000000000000000000000');
        assert.notEqual(restarted.traceparent.parentId, '0000000000000000');
    });

    it('inherits sampled flag on restart when sampled option is omitted', () => {
        const sampled = restartTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
        const unsampled = restartTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');

        assert.equal(sampled.traceparent?.traceFlags, '01');
        assert.equal(unsampled.traceparent?.traceFlags, '00');
    });

    it('returns empty tracestate for invalid tracestate arrays on update/restart', () => {
        const invalidEntries = [{ key: 'BadKey', value: '1' }];

        const updated = updateTraceparentParent(VALID_TRACEPARENT, { tracestate: invalidEntries });
        const restarted = restartTraceparent(VALID_TRACEPARENT, { tracestate: invalidEntries });

        assert.deepEqual(updated.tracestate, []);
        assert.deepEqual(restarted.tracestate, []);
    });

    it('drops tracestate when traceparent is invalid in combined helpers', () => {
        const updated = updateTraceparentParent('00-00000000000000000000000000000000-00f067aa0ba902b7-01', {
            tracestate: 'rojo=1,congo=2',
        });
        assert.equal(updated.traceparent, null);
        assert.deepEqual(updated.tracestate, []);

        const added = addOrUpdateTracestate('rojo=1', 'congo', '2', '00-00000000000000000000000000000000-00f067aa0ba902b7-01');
        assert.deepEqual(added, []);
    });

    it('adds or updates tracestate key and moves it to front', () => {
        const next = addOrUpdateTracestate('rojo=1,congo=2', 'congo', '3');
        assert.deepEqual(next, [
            { key: 'congo', value: '3' },
            { key: 'rojo', value: '1' },
        ]);
    });

    it('returns null for invalid tracestate keys and values', () => {
        assert.equal(addOrUpdateTracestate('rojo=1', 'BadKey', '2'), null);
        assert.equal(addOrUpdateTracestate('rojo=1', 'ok', String.fromCharCode(0x1f)), null);
        assert.equal(addOrUpdateTracestate('rojo=1', 'ok', 'value '), null);
        assert.equal(removeTracestateKey('rojo=1', 'BadKey'), null);
    });

    it('removes keys and truncates while preserving order', () => {
        const removed = removeTracestateKey('rojo=1,congo=2', 'rojo');
        assert.deepEqual(removed, [{ key: 'congo', value: '2' }]);

        const truncated = truncateTracestate(
            [
                { key: 'rojo', value: '1' },
                { key: 'congo', value: '2' },
                { key: 'otter', value: '3' },
            ],
            2,
            512,
        );
        assert.deepEqual(truncated, [
            { key: 'rojo', value: '1' },
            { key: 'congo', value: '2' },
        ]);
    });

    it('returns null for invalid truncation bounds or malformed entries', () => {
        assert.equal(truncateTracestate('rojo=1', -1, 512), null);
        assert.equal(truncateTracestate('rojo=1', 32, -1), null);
        assert.equal(truncateTracestate([{ key: 'BadKey', value: '1' }]), null);
    });

    it('truncates by serialized length boundary', () => {
        const truncated = truncateTracestate(
            [
                { key: 'a', value: '1' },
                { key: 'b', value: '2' },
            ],
            32,
            3,
        );

        assert.deepEqual(truncated, [{ key: 'a', value: '1' }]);
    });
});
