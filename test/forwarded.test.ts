import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseForwarded, formatForwarded } from '../src/forwarded.js';

describe('Forwarded Header (RFC 7239 Section 4)', () => {
    it('parses a single Forwarded element (RFC 7239 Section 4)', () => {
        const parsed = parseForwarded('for=192.0.2.43;proto=https;host=example.com');
        assert.deepEqual(parsed, [
            { for: '192.0.2.43', proto: 'https', host: 'example.com' },
        ]);
    });

    // RFC 7239 Section 4: each parameter MUST NOT occur more than once.
    it('ignores duplicate parameters after the first', () => {
        const parsed = parseForwarded('for=192.0.2.43;for=198.51.100.17');
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0]?.for, '192.0.2.43');
    });

    it('parses multiple Forwarded elements (RFC 7239 Section 4)', () => {
        const parsed = parseForwarded('for=192.0.2.43, for=198.51.100.17');
        assert.equal(parsed.length, 2);
        assert.equal(parsed[0]?.for, '192.0.2.43');
        assert.equal(parsed[1]?.for, '198.51.100.17');
    });

    it('formats Forwarded with quoting when needed (RFC 7239 Section 4)', () => {
        const formatted = formatForwarded([
            { for: '[2001:db8:cafe::17]:4711', proto: 'https' },
        ]);
        assert.equal(formatted, 'for="[2001:db8:cafe::17]:4711";proto=https');
    });
});
