import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    parseProxyStatus,
    formatProxyStatus,
    isProxyErrorType,
    PROXY_ERROR_TYPES,
} from '../src/proxy-status.js';

// RFC 9209 §2: Proxy-Status is a List where each member is String or Token.
describe('Proxy-Status (RFC 9209 Section 2)', () => {
    // RFC 9209 §2: Simple proxy identifier as Token.
    it('parses a simple proxy identifier (RFC 9209 Section 2)', () => {
        const parsed = parseProxyStatus('ExampleCDN');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: {},
        }]);
    });

    // RFC 9209 §2: String identifier (quoted).
    it('parses a quoted string identifier (RFC 9209 Section 2)', () => {
        const parsed = parseProxyStatus('"proxy.example.com"');
        assert.deepEqual(parsed, [{
            proxy: 'proxy.example.com',
            params: {},
        }]);
    });

    // RFC 9209 §2: First member = closest to origin; preserve order.
    it('preserves list member order (RFC 9209 Section 2)', () => {
        const parsed = parseProxyStatus('revproxy1.example.net, ExampleCDN');
        assert.equal(parsed?.length, 2);
        assert.equal(parsed?.[0]?.proxy, 'revproxy1.example.net');
        assert.equal(parsed?.[1]?.proxy, 'ExampleCDN');
    });

    // RFC 9209 §2: Each member MUST be String or Token, not Inner List.
    it('rejects inner lists (RFC 9209 Section 2)', () => {
        const parsed = parseProxyStatus('(a b)');
        assert.equal(parsed, null);
    });

    // RFC 9209 §2: Empty or whitespace-only returns empty array.
    it('returns empty array for empty input', () => {
        assert.deepEqual(parseProxyStatus(''), []);
        assert.deepEqual(parseProxyStatus('   '), []);
    });
});

// RFC 9209 §2.1.1: error parameter.
describe('Proxy-Status error parameter (RFC 9209 Section 2.1.1)', () => {
    it('parses error parameter', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=http_request_error');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: { error: 'http_request_error' },
        }]);
    });

    // RFC 9209 §2.1.1 + §2.1.5: error with details.
    it('parses error with details parameter (RFC 9209 Section 2.1.5)', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=http_protocol_error; details="Malformed response header"');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: {
                error: 'http_protocol_error',
                details: 'Malformed response header',
            },
        }]);
    });

    // RFC 9209 §2.3.9: connection_timeout example.
    it('parses connection_timeout error (RFC 9209 Section 2.3.9)', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=connection_timeout');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: { error: 'connection_timeout' },
        }]);
    });
});

// RFC 9209 §2.1.2: next-hop parameter.
describe('Proxy-Status next-hop parameter (RFC 9209 Section 2.1.2)', () => {
    it('parses next-hop parameter', () => {
        const parsed = parseProxyStatus('cdn.example.org; next-hop="backend.example.org:8001"');
        assert.deepEqual(parsed, [{
            proxy: 'cdn.example.org',
            params: { nextHop: 'backend.example.org:8001' },
        }]);
    });

    it('parses next-hop as token', () => {
        const parsed = parseProxyStatus('cdn.example.org; next-hop=backend');
        assert.deepEqual(parsed, [{
            proxy: 'cdn.example.org',
            params: { nextHop: 'backend' },
        }]);
    });
});

// RFC 9209 §2.1.3: next-protocol parameter.
describe('Proxy-Status next-protocol parameter (RFC 9209 Section 2.1.3)', () => {
    it('parses next-protocol parameter', () => {
        const parsed = parseProxyStatus('"proxy.example.org"; next-protocol=h2');
        assert.deepEqual(parsed, [{
            proxy: 'proxy.example.org',
            params: { nextProtocol: 'h2' },
        }]);
    });

    it('parses next-protocol h3', () => {
        const parsed = parseProxyStatus('ExampleCDN; next-protocol=h3');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: { nextProtocol: 'h3' },
        }]);
    });
});

// RFC 9209 §2.1.4: received-status parameter.
describe('Proxy-Status received-status parameter (RFC 9209 Section 2.1.4)', () => {
    it('parses received-status parameter', () => {
        const parsed = parseProxyStatus('ExampleCDN; received-status=200');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: { receivedStatus: 200 },
        }]);
    });

    it('parses received-status=503', () => {
        const parsed = parseProxyStatus('ExampleCDN; received-status=503');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: { receivedStatus: 503 },
        }]);
    });
});

// RFC 9209 §2.3.2: dns_error with rcode extra parameter.
describe('Proxy-Status dns_error extra parameters (RFC 9209 Section 2.3.2)', () => {
    it('parses dns_error with rcode', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=dns_error; rcode=NXDOMAIN');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: {
                error: 'dns_error',
                rcode: 'NXDOMAIN',
            },
        }]);
    });

    it('parses dns_error with info-code', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=dns_error; rcode=SERVFAIL; info-code=23');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: {
                error: 'dns_error',
                rcode: 'SERVFAIL',
                infoCode: 23,
            },
        }]);
    });
});

// RFC 9209 §2.3.15: tls_alert_received with alert-id extra parameter.
describe('Proxy-Status tls_alert_received extra parameters (RFC 9209 Section 2.3.15)', () => {
    it('parses tls_alert_received with alert-id', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=tls_alert_received; alert-id=112');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: {
                error: 'tls_alert_received',
                alertId: 112,
            },
        }]);
    });

    it('parses tls_alert_received with alert-message', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=tls_alert_received; alert-id=48; alert-message=unknown_ca');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: {
                error: 'tls_alert_received',
                alertId: 48,
                alertMessage: 'unknown_ca',
            },
        }]);
    });
});

// RFC 9209 §2.3: All 32 error types.
describe('Proxy-Status error types (RFC 9209 Section 2.3)', () => {
    it('defines all 32 error types', () => {
        assert.equal(PROXY_ERROR_TYPES.length, 32);
    });

    it('includes dns_timeout (RFC 9209 Section 2.3.1)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('dns_timeout'));
        assert.ok(isProxyErrorType('dns_timeout'));
    });

    it('includes dns_error (RFC 9209 Section 2.3.2)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('dns_error'));
        assert.ok(isProxyErrorType('dns_error'));
    });

    it('includes destination_not_found (RFC 9209 Section 2.3.3)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('destination_not_found'));
    });

    it('includes destination_unavailable (RFC 9209 Section 2.3.4)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('destination_unavailable'));
    });

    it('includes destination_ip_prohibited (RFC 9209 Section 2.3.5)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('destination_ip_prohibited'));
    });

    it('includes destination_ip_unroutable (RFC 9209 Section 2.3.6)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('destination_ip_unroutable'));
    });

    it('includes connection_refused (RFC 9209 Section 2.3.7)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('connection_refused'));
    });

    it('includes connection_terminated (RFC 9209 Section 2.3.8)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('connection_terminated'));
    });

    it('includes connection_timeout (RFC 9209 Section 2.3.9)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('connection_timeout'));
    });

    it('includes connection_read_timeout (RFC 9209 Section 2.3.10)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('connection_read_timeout'));
    });

    it('includes connection_write_timeout (RFC 9209 Section 2.3.11)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('connection_write_timeout'));
    });

    it('includes connection_limit_reached (RFC 9209 Section 2.3.12)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('connection_limit_reached'));
    });

    it('includes tls_protocol_error (RFC 9209 Section 2.3.13)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('tls_protocol_error'));
    });

    it('includes tls_certificate_error (RFC 9209 Section 2.3.14)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('tls_certificate_error'));
    });

    it('includes tls_alert_received (RFC 9209 Section 2.3.15)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('tls_alert_received'));
    });

    it('includes http_request_error (RFC 9209 Section 2.3.16)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_request_error'));
    });

    it('includes http_request_denied (RFC 9209 Section 2.3.17)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_request_denied'));
    });

    it('includes http_response_incomplete (RFC 9209 Section 2.3.18)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_incomplete'));
    });

    it('includes http_response_header_section_size (RFC 9209 Section 2.3.19)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_header_section_size'));
    });

    it('includes http_response_header_size (RFC 9209 Section 2.3.20)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_header_size'));
    });

    it('includes http_response_body_size (RFC 9209 Section 2.3.21)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_body_size'));
    });

    it('includes http_response_trailer_section_size (RFC 9209 Section 2.3.22)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_trailer_section_size'));
    });

    it('includes http_response_trailer_size (RFC 9209 Section 2.3.23)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_trailer_size'));
    });

    it('includes http_response_transfer_coding (RFC 9209 Section 2.3.24)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_transfer_coding'));
    });

    it('includes http_response_content_coding (RFC 9209 Section 2.3.25)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_content_coding'));
    });

    it('includes http_response_timeout (RFC 9209 Section 2.3.26)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_response_timeout'));
    });

    it('includes http_upgrade_failed (RFC 9209 Section 2.3.27)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_upgrade_failed'));
    });

    it('includes http_protocol_error (RFC 9209 Section 2.3.28)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('http_protocol_error'));
    });

    it('includes proxy_internal_response (RFC 9209 Section 2.3.29)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('proxy_internal_response'));
    });

    it('includes proxy_internal_error (RFC 9209 Section 2.3.30)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('proxy_internal_error'));
    });

    it('includes proxy_configuration_error (RFC 9209 Section 2.3.31)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('proxy_configuration_error'));
    });

    it('includes proxy_loop_detected (RFC 9209 Section 2.3.32)', () => {
        assert.ok(PROXY_ERROR_TYPES.includes('proxy_loop_detected'));
    });

    // RFC 9209 §2.4: Unknown error types are preserved (extensibility).
    it('returns false for unknown error types', () => {
        assert.ok(!isProxyErrorType('unknown_error'));
        assert.ok(!isProxyErrorType('custom_vendor_error'));
    });

    // RFC 9209 §2.1: Unrecognized parameters MUST be ignored but preserved for round-trip.
    it('preserves unknown error types in parsing', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=custom_vendor_error');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: { error: 'custom_vendor_error' },
        }]);
    });
});

// RFC 9209 §2.2: Extension parameters.
describe('Proxy-Status extension parameters (RFC 9209 Section 2.2)', () => {
    it('preserves unknown extension parameters', () => {
        const parsed = parseProxyStatus('ExampleCDN; error=http_request_error; custom-param=42');
        assert.deepEqual(parsed, [{
            proxy: 'ExampleCDN',
            params: {
                error: 'http_request_error',
                extensions: { 'custom-param': 42 },
            },
        }]);
    });

    it('lets extension keys use known names when typed field is unset', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: {
                extensions: {
                    error: 7,
                    'custom-param': 42,
                },
            },
        }]);
        assert.equal(formatted, 'ExampleCDN;error=7;custom-param=42');
    });

    it('does not let extensions override explicitly mapped fields', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: {
                error: 'connection_timeout',
                extensions: {
                    error: 'ignored',
                },
            },
        }]);
        assert.equal(formatted, 'ExampleCDN;error=connection_timeout');
    });
});

// RFC 9209 §2: Formatting tests.
describe('Proxy-Status formatting (RFC 9209 Section 2)', () => {
    it('formats simple proxy identifier', () => {
        const formatted = formatProxyStatus([{ proxy: 'ExampleCDN', params: {} }]);
        assert.equal(formatted, 'ExampleCDN');
    });

    it('formats proxy with error parameter', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: { error: 'connection_timeout' },
        }]);
        assert.equal(formatted, 'ExampleCDN;error=connection_timeout');
    });

    it('formats proxy with multiple parameters', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: {
                error: 'http_protocol_error',
                details: 'Malformed response',
            },
        }]);
        assert.equal(formatted, 'ExampleCDN;error=http_protocol_error;details="Malformed response"');
    });

    it('formats multiple proxies', () => {
        const formatted = formatProxyStatus([
            { proxy: 'OriginProxy', params: {} },
            { proxy: 'ExampleCDN', params: { error: 'connection_timeout' } },
        ]);
        assert.equal(formatted, 'OriginProxy, ExampleCDN;error=connection_timeout');
    });

    // RFC 9209 §2.1.2: next-hop formatting.
    // RFC 8941 §3.3.4: Tokens can contain : and /, so hostname:port is a valid token.
    it('formats next-hop parameter', () => {
        const formatted = formatProxyStatus([{
            proxy: 'cdn.example.org',
            params: { nextHop: 'backend.example.org:8001' },
        }]);
        assert.equal(formatted, 'cdn.example.org;next-hop=backend.example.org:8001');
    });

    // RFC 9209 §2.1.2: next-hop as quoted string when value contains characters not valid in token.
    it('formats next-hop parameter with spaces as quoted string', () => {
        const formatted = formatProxyStatus([{
            proxy: 'cdn.example.org',
            params: { nextHop: 'backend server' },
        }]);
        assert.equal(formatted, 'cdn.example.org;next-hop="backend server"');
    });

    // RFC 9209 §2.1.3: next-protocol formatting.
    it('formats next-protocol parameter', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: { nextProtocol: 'h2' },
        }]);
        assert.equal(formatted, 'ExampleCDN;next-protocol=h2');
    });

    // RFC 9209 §2.1.4: received-status formatting.
    it('formats received-status parameter', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: { receivedStatus: 503 },
        }]);
        assert.equal(formatted, 'ExampleCDN;received-status=503');
    });

    // RFC 9209 §2.3.2: dns_error extra parameters.
    it('formats dns_error with rcode', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: {
                error: 'dns_error',
                rcode: 'NXDOMAIN',
            },
        }]);
        assert.equal(formatted, 'ExampleCDN;error=dns_error;rcode=NXDOMAIN');
    });

    // RFC 9209 §2.3.15: tls_alert_received extra parameters.
    it('formats tls_alert_received with alert-id', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: {
                error: 'tls_alert_received',
                alertId: 112,
            },
        }]);
        assert.equal(formatted, 'ExampleCDN;error=tls_alert_received;alert-id=112');
    });

    it('formats extension parameters', () => {
        const formatted = formatProxyStatus([{
            proxy: 'ExampleCDN',
            params: {
                error: 'http_request_error',
                extensions: { 'custom-param': 42 },
            },
        }]);
        assert.equal(formatted, 'ExampleCDN;error=http_request_error;custom-param=42');
    });
});

// Round-trip tests.
describe('Proxy-Status round-trip (RFC 9209)', () => {
    it('round-trips simple proxy', () => {
        const original = 'ExampleCDN';
        const parsed = parseProxyStatus(original);
        assert.ok(parsed);
        const formatted = formatProxyStatus(parsed);
        assert.equal(formatted, original);
    });

    it('round-trips proxy with error', () => {
        const original = 'ExampleCDN;error=connection_timeout';
        const parsed = parseProxyStatus(original);
        assert.ok(parsed);
        const formatted = formatProxyStatus(parsed);
        assert.equal(formatted, original);
    });

    it('round-trips multiple proxies', () => {
        const original = 'OriginProxy, ExampleCDN;error=http_protocol_error';
        const parsed = parseProxyStatus(original);
        assert.ok(parsed);
        const formatted = formatProxyStatus(parsed);
        assert.equal(formatted, original);
    });

    it('round-trips complex entry', () => {
        const original = 'ExampleCDN;error=dns_error;rcode=NXDOMAIN;next-hop=origin.example.com';
        const parsed = parseProxyStatus(original);
        assert.ok(parsed);
        const formatted = formatProxyStatus(parsed);
        // Parameter order may differ, so parse again and compare
        const reparsed = parseProxyStatus(formatted);
        assert.deepEqual(reparsed, parsed);
    });
});
