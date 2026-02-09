import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
    formatBasicAuthorization,
    parseBasicAuthorization,
    formatBasicChallenge,
    parseBasicChallenge,
    formatBearerAuthorization,
    parseBearerAuthorization,
    formatBearerChallenge,
    parseBearerChallenge,
    parseWWWAuthenticate,
    parseAuthorization,
    // Digest (RFC 7616)
    DIGEST_AUTH_ALGORITHMS,
    parseDigestChallenge,
    formatDigestChallenge,
    parseDigestAuthorization,
    formatDigestAuthorization,
    parseDigestAuthenticationInfo,
    formatDigestAuthenticationInfo,
    computeDigestResponse,
    computeA1,
    computeA2,
    hashDigestUsername,
} from '../src/auth.js';
import type { DigestChallenge, DigestCredentials } from '../src/types.js';

function nodeHexHash(algorithm: 'md5' | 'sha256' | 'sha512-256', input: string): string {
    return createHash(algorithm).update(input).digest('hex');
}

describe('Basic Authentication (RFC 7617 Section 2)', () => {
    it('round-trips Basic credentials (RFC 7617 Section 2)', () => {
        const header = formatBasicAuthorization('Aladdin', 'open sesame');
        assert.equal(header, 'Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==');

        const parsed = parseBasicAuthorization(header!);
        assert.deepEqual(parsed, {
            username: 'Aladdin',
            password: 'open sesame',
            encoding: 'utf-8',
        });
    });

    it('parses Basic challenge with charset (RFC 7617 Section 2.1)', () => {
        const header = formatBasicChallenge('Restricted', { charset: 'UTF-8' });
        assert.equal(header, 'Basic realm="Restricted", charset="UTF-8"');

        const parsed = parseBasicChallenge(header);
        assert.deepEqual(parsed, { scheme: 'Basic', realm: 'Restricted', charset: 'UTF-8' });
    });
});

describe('Bearer Authentication (RFC 6750 Section 2.1)', () => {
    it('round-trips Bearer Authorization (RFC 6750 Section 2.1)', () => {
        const header = formatBearerAuthorization('mF_9.B5f-4.1JqM');
        assert.equal(header, 'Bearer mF_9.B5f-4.1JqM');

        const parsed = parseBearerAuthorization(header!);
        assert.equal(parsed, 'mF_9.B5f-4.1JqM');
    });

    it('parses Bearer challenge params (RFC 6750 Section 3)', () => {
        const header = 'Bearer realm="example", error="invalid_token", error_description="expired"';
        const parsed = parseBearerChallenge(header);
        assert.deepEqual(parsed, {
            realm: 'example',
            error: 'invalid_token',
            errorDescription: 'expired',
        });
    });

    it('formats Bearer challenge params (RFC 6750 Section 3)', () => {
        const formatted = formatBearerChallenge({
            realm: 'example',
            error: 'invalid_token',
            errorDescription: 'expired',
        });
        assert.equal(
            formatted,
            'Bearer realm="example", error="invalid_token", error_description="expired"'
        );
    });

    // RFC 9110 §5.5: reject CR/LF and CTLs in serialized auth parameters.
    it('rejects control bytes in Bearer challenge formatting', () => {
        assert.throws(() => {
            formatBearerChallenge({ realm: 'example\r\nInjected: true' });
        }, /control characters/);
    });

    // RFC 9110 §5.6.2: auth parameter names are tokens.
    it('rejects invalid extension parameter names in Bearer challenge formatting', () => {
        assert.throws(() => {
            formatBearerChallenge({
                realm: 'example',
                params: { 'bad key': 'value' },
            });
        }, /valid header token/);
    });
});

describe('WWW-Authenticate parsing (RFC 7235 Section 2.1)', () => {
    it('parses multiple challenges with quoted commas', () => {
        const parsed = parseWWWAuthenticate('Basic realm="hello, world", Bearer realm="example"');
        assert.equal(parsed.length, 2);
        assert.equal(parsed[0]?.scheme.toLowerCase(), 'basic');
        assert.equal(parsed[1]?.scheme.toLowerCase(), 'bearer');
    });
});

// =============================================================================
// Digest Authentication (RFC 7616)
// =============================================================================

describe('Digest Authentication (RFC 7616)', () => {
    // RFC 7616 §3.3: Challenge parsing
    describe('Challenge parsing (RFC 7616 §3.3)', () => {
        it('parses challenge with all parameters', () => {
            const challenges = parseWWWAuthenticate(
                'Digest realm="testrealm@host.com", ' +
                'nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", ' +
                'opaque="5ccc069c403ebaf9f0171e9517f40e41", ' +
                'qop="auth, auth-int", ' +
                'algorithm=SHA-256, ' +
                'charset=UTF-8, ' +
                'userhash=true'
            );
            assert.equal(challenges.length, 1);

            const parsed = parseDigestChallenge(challenges[0]!);
            assert.ok(parsed);
            assert.equal(parsed.scheme, 'Digest');
            assert.equal(parsed.realm, 'testrealm@host.com');
            assert.equal(parsed.nonce, 'dcd98b7102dd2f0e8b11d0f600bfb0c093');
            assert.equal(parsed.opaque, '5ccc069c403ebaf9f0171e9517f40e41');
            assert.deepEqual(parsed.qop, ['auth', 'auth-int']);
            assert.equal(parsed.algorithm, 'SHA-256');
            assert.equal(parsed.charset, 'UTF-8');
            assert.equal(parsed.userhash, true);
        });

        it('parses multiple qop values (RFC 7616 §3.3)', () => {
            const challenges = parseWWWAuthenticate(
                'Digest realm="test", nonce="abc123", qop="auth, auth-int"'
            );
            const parsed = parseDigestChallenge(challenges[0]!);
            assert.ok(parsed);
            assert.deepEqual(parsed.qop, ['auth', 'auth-int']);
        });

        it('parses stale=true handling (RFC 7616 §3.3)', () => {
            const challenges = parseWWWAuthenticate(
                'Digest realm="test", nonce="abc123", stale=true'
            );
            const parsed = parseDigestChallenge(challenges[0]!);
            assert.ok(parsed);
            assert.equal(parsed.stale, true);
        });

        it('parses domain parameter with multiple URIs', () => {
            const challenges = parseWWWAuthenticate(
                'Digest realm="test", nonce="abc123", domain="/api /admin"'
            );
            const parsed = parseDigestChallenge(challenges[0]!);
            assert.ok(parsed);
            assert.deepEqual(parsed.domain, ['/api', '/admin']);
        });

        it('returns null for missing realm', () => {
            const challenges = parseWWWAuthenticate('Digest nonce="abc123"');
            const parsed = parseDigestChallenge(challenges[0]!);
            assert.equal(parsed, null);
        });

        it('returns null for missing nonce', () => {
            const challenges = parseWWWAuthenticate('Digest realm="test"');
            const parsed = parseDigestChallenge(challenges[0]!);
            assert.equal(parsed, null);
        });

        it('returns null for non-Digest scheme', () => {
            const challenges = parseWWWAuthenticate('Basic realm="test"');
            const parsed = parseDigestChallenge(challenges[0]!);
            assert.equal(parsed, null);
        });
    });

    // RFC 7616 §3.3: Challenge formatting
    describe('Challenge formatting (RFC 7616 §3.3)', () => {
        it('formats challenge with all parameters', () => {
            const challenge: DigestChallenge = {
                scheme: 'Digest',
                realm: 'testrealm@host.com',
                nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093',
                opaque: '5ccc069c403ebaf9f0171e9517f40e41',
                qop: ['auth', 'auth-int'],
                algorithm: 'SHA-256',
                charset: 'UTF-8',
                userhash: true,
            };
            const formatted = formatDigestChallenge(challenge);
            assert.ok(formatted.startsWith('Digest '));
            assert.ok(formatted.includes('realm="testrealm@host.com"'));
            assert.ok(formatted.includes('nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093"'));
            assert.ok(formatted.includes('opaque="5ccc069c403ebaf9f0171e9517f40e41"'));
            assert.ok(formatted.includes('qop="auth, auth-int"'));
            // RFC 7616 §3.3: algorithm is NOT quoted
            assert.ok(formatted.includes('algorithm=SHA-256'));
            // RFC 7616 §3.3: charset is NOT quoted
            assert.ok(formatted.includes('charset=UTF-8'));
            // RFC 7616 §3.3: userhash is NOT quoted
            assert.ok(formatted.includes('userhash=true'));
        });

        it('formats stale=true as unquoted token', () => {
            const challenge: DigestChallenge = {
                scheme: 'Digest',
                realm: 'test',
                nonce: 'abc123',
                stale: true,
            };
            const formatted = formatDigestChallenge(challenge);
            assert.ok(formatted.includes('stale=true'));
            assert.ok(!formatted.includes('stale="true"'));
        });

        it('round-trips challenge parsing and formatting', () => {
            const original: DigestChallenge = {
                scheme: 'Digest',
                realm: 'example.com',
                nonce: 'nonce123',
                opaque: 'opaque456',
                qop: ['auth'],
                algorithm: 'SHA-256',
            };
            const formatted = formatDigestChallenge(original);
            const challenges = parseWWWAuthenticate(formatted);
            const parsed = parseDigestChallenge(challenges[0]!);
            assert.ok(parsed);
            assert.equal(parsed.realm, original.realm);
            assert.equal(parsed.nonce, original.nonce);
            assert.equal(parsed.opaque, original.opaque);
            assert.deepEqual(parsed.qop, original.qop);
            assert.equal(parsed.algorithm, original.algorithm);
        });
    });

    // RFC 7616 §3.4: Authorization credentials parsing
    describe('Authorization parsing (RFC 7616 §3.4)', () => {
        it('parses credentials with all parameters', () => {
            const header =
                'Digest username="Mufasa", ' +
                'realm="testrealm@host.com", ' +
                'nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", ' +
                'uri="/dir/index.html", ' +
                'response="6629fae49393a05397450978507c4ef1", ' +
                'algorithm=MD5, ' +
                'cnonce="0a4f113b", ' +
                'opaque="5ccc069c403ebaf9f0171e9517f40e41", ' +
                'qop=auth, ' +
                'nc=00000001';
            const auth = parseAuthorization(header);
            assert.ok(auth);
            const parsed = parseDigestAuthorization(auth);
            assert.ok(parsed);
            assert.equal(parsed.scheme, 'Digest');
            assert.equal(parsed.username, 'Mufasa');
            assert.equal(parsed.realm, 'testrealm@host.com');
            assert.equal(parsed.uri, '/dir/index.html');
            assert.equal(parsed.response, '6629fae49393a05397450978507c4ef1');
            assert.equal(parsed.algorithm, 'MD5');
            assert.equal(parsed.cnonce, '0a4f113b');
            assert.equal(parsed.opaque, '5ccc069c403ebaf9f0171e9517f40e41');
            assert.equal(parsed.qop, 'auth');
            assert.equal(parsed.nc, '00000001');
        });

        it('validates nc must be exactly 8 hex digits (RFC 7616 §3.4)', () => {
            // Valid: 8 hex digits
            const validHeader =
                'Digest username="test", realm="r", uri="/", response="abc", nc=00000001';
            const validAuth = parseAuthorization(validHeader);
            const validParsed = parseDigestAuthorization(validAuth!);
            assert.ok(validParsed);
            assert.equal(validParsed.nc, '00000001');

            // Invalid: 7 hex digits
            const shortHeader =
                'Digest username="test", realm="r", uri="/", response="abc", nc=0000001';
            const shortAuth = parseAuthorization(shortHeader);
            const shortParsed = parseDigestAuthorization(shortAuth!);
            assert.equal(shortParsed, null);

            // Invalid: 9 hex digits
            const longHeader =
                'Digest username="test", realm="r", uri="/", response="abc", nc=000000001';
            const longAuth = parseAuthorization(longHeader);
            const longParsed = parseDigestAuthorization(longAuth!);
            assert.equal(longParsed, null);
        });

        it('rejects both username and username* present (RFC 7616 §3.4)', () => {
            const header =
                'Digest username="test", username*=UTF-8\'\'test, realm="r", uri="/", response="abc"';
            const auth = parseAuthorization(header);
            const parsed = parseDigestAuthorization(auth!);
            assert.equal(parsed, null);
        });

        it('parses username* with RFC 8187 encoding (RFC 7616 §3.4)', () => {
            const header =
                'Digest username*=UTF-8\'\'J%C3%A4s%C3%B8n%20Doe, realm="r", uri="/", response="abc"';
            const auth = parseAuthorization(header);
            const parsed = parseDigestAuthorization(auth!);
            assert.ok(parsed);
            assert.equal(parsed.username, 'Jäsøn Doe');
            assert.equal(parsed.usernameEncoded, true);
        });

        it('parses userhash=true (RFC 7616 §3.4.4)', () => {
            const header =
                'Digest username="488869477bf257147b804c45308cd62ac4e25eb717b12b298c79e62dcea254ec", ' +
                'realm="r", uri="/", response="abc", userhash=true';
            const auth = parseAuthorization(header);
            const parsed = parseDigestAuthorization(auth!);
            assert.ok(parsed);
            assert.equal(parsed.userhash, true);
        });

        it('returns null for missing required fields', () => {
            // Missing username
            const header1 = 'Digest realm="r", uri="/", response="abc"';
            const auth1 = parseAuthorization(header1);
            assert.equal(parseDigestAuthorization(auth1!), null);

            // Missing realm
            const header2 = 'Digest username="u", uri="/", response="abc"';
            const auth2 = parseAuthorization(header2);
            assert.equal(parseDigestAuthorization(auth2!), null);

            // Missing uri
            const header3 = 'Digest username="u", realm="r", response="abc"';
            const auth3 = parseAuthorization(header3);
            assert.equal(parseDigestAuthorization(auth3!), null);

            // Missing response
            const header4 = 'Digest username="u", realm="r", uri="/"';
            const auth4 = parseAuthorization(header4);
            assert.equal(parseDigestAuthorization(auth4!), null);
        });
    });

    // RFC 7616 §3.4: Authorization credentials formatting
    describe('Authorization formatting (RFC 7616 §3.4)', () => {
        it('formats credentials with correct quoting', () => {
            const credentials: DigestCredentials = {
                scheme: 'Digest',
                username: 'Mufasa',
                realm: 'testrealm@host.com',
                uri: '/dir/index.html',
                response: '6629fae49393a05397450978507c4ef1',
                algorithm: 'MD5',
                cnonce: '0a4f113b',
                opaque: '5ccc069c403ebaf9f0171e9517f40e41',
                qop: 'auth',
                nc: '00000001',
            };
            const formatted = formatDigestAuthorization(credentials);
            assert.ok(formatted.startsWith('Digest '));
            // RFC 7616 §3.4: username MUST be quoted
            assert.ok(formatted.includes('username="Mufasa"'));
            // RFC 7616 §3.4: realm MUST be quoted
            assert.ok(formatted.includes('realm="testrealm@host.com"'));
            // RFC 7616 §3.4: uri MUST be quoted
            assert.ok(formatted.includes('uri="/dir/index.html"'));
            // RFC 7616 §3.4: response MUST be quoted
            assert.ok(formatted.includes('response="6629fae49393a05397450978507c4ef1"'));
            // RFC 7616 §3.4: algorithm MUST NOT be quoted
            assert.ok(formatted.includes('algorithm=MD5'));
            assert.ok(!formatted.includes('algorithm="MD5"'));
            // RFC 7616 §3.4: cnonce MUST be quoted
            assert.ok(formatted.includes('cnonce="0a4f113b"'));
            // RFC 7616 §3.4: opaque MUST be quoted
            assert.ok(formatted.includes('opaque="5ccc069c403ebaf9f0171e9517f40e41"'));
            // RFC 7616 §3.4: qop MUST NOT be quoted
            assert.ok(formatted.includes('qop=auth'));
            assert.ok(!formatted.includes('qop="auth"'));
            // RFC 7616 §3.4: nc MUST NOT be quoted
            assert.ok(formatted.includes('nc=00000001'));
            assert.ok(!formatted.includes('nc="00000001"'));
        });

        it('formats username* for encoded usernames', () => {
            const credentials: DigestCredentials = {
                scheme: 'Digest',
                username: 'Jäsøn Doe',
                usernameEncoded: true,
                realm: 'r',
                uri: '/',
                response: 'abc',
            };
            const formatted = formatDigestAuthorization(credentials);
            assert.ok(formatted.includes('username*=UTF-8\'\'J%C3%A4s%C3%B8n%20Doe'));
            assert.ok(!formatted.includes('username="'));
        });

        it('round-trips credentials parsing and formatting', () => {
            const original: DigestCredentials = {
                scheme: 'Digest',
                username: 'user',
                realm: 'example.com',
                uri: '/resource',
                response: 'deadbeef',
                algorithm: 'SHA-256',
                qop: 'auth',
                nc: '00000001',
                cnonce: 'xyz789',
            };
            const formatted = formatDigestAuthorization(original);
            const auth = parseAuthorization(formatted);
            const parsed = parseDigestAuthorization(auth!);
            assert.ok(parsed);
            assert.equal(parsed.username, original.username);
            assert.equal(parsed.realm, original.realm);
            assert.equal(parsed.uri, original.uri);
            assert.equal(parsed.response, original.response);
            assert.equal(parsed.algorithm, original.algorithm);
            assert.equal(parsed.qop, original.qop);
            assert.equal(parsed.nc, original.nc);
            assert.equal(parsed.cnonce, original.cnonce);
        });
    });

    // RFC 7616 §3.5: Authentication-Info
    describe('Authentication-Info (RFC 7616 §3.5)', () => {
        it('parses Authentication-Info header', () => {
            const header = 'nextnonce="abc123", qop=auth, rspauth="1234567890", cnonce="xyz", nc=00000002';
            const parsed = parseDigestAuthenticationInfo(header);
            assert.ok(parsed);
            assert.equal(parsed.nextnonce, 'abc123');
            assert.equal(parsed.qop, 'auth');
            assert.equal(parsed.rspauth, '1234567890');
            assert.equal(parsed.cnonce, 'xyz');
            assert.equal(parsed.nc, '00000002');
        });

        it('formats Authentication-Info header', () => {
            const info = {
                nextnonce: 'abc123',
                qop: 'auth' as const,
                rspauth: '1234567890',
                cnonce: 'xyz',
                nc: '00000002',
            };
            const formatted = formatDigestAuthenticationInfo(info);
            assert.ok(formatted.includes('nextnonce="abc123"'));
            assert.ok(formatted.includes('qop=auth'));
            assert.ok(!formatted.includes('qop="auth"'));
            assert.ok(formatted.includes('rspauth="1234567890"'));
            assert.ok(formatted.includes('cnonce="xyz"'));
            assert.ok(formatted.includes('nc=00000002'));
        });

        it('round-trips Authentication-Info', () => {
            const original = {
                nextnonce: 'newnonce',
                qop: 'auth' as const,
                rspauth: 'deadbeef',
            };
            const formatted = formatDigestAuthenticationInfo(original);
            const parsed = parseDigestAuthenticationInfo(formatted);
            assert.ok(parsed);
            assert.equal(parsed.nextnonce, original.nextnonce);
            assert.equal(parsed.qop, original.qop);
            assert.equal(parsed.rspauth, original.rspauth);
        });
    });

    // RFC 7616 §3.4.1: Response computation
    describe('Response computation (RFC 7616 §3.4.1)', () => {
        it('uses SHA-256 by default when algorithm is omitted', async () => {
            const input = {
                username: 'Mufasa',
                password: 'Circle of Life',
                realm: 'http-auth@example.org',
                method: 'GET',
                uri: '/dir/index.html',
                nonce: '7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v',
                cnonce: 'f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ',
                nc: '00000001',
                qop: 'auth' as const,
            };

            const withDefault = await computeDigestResponse(input);
            const explicitSha256 = await computeDigestResponse({
                ...input,
                algorithm: 'SHA-256',
            });

            assert.equal(withDefault, explicitSha256);
            assert.equal(withDefault.length, 64);
        });

        it('computes response with qop=auth using MD5', async () => {
            // Example from RFC 7616 §3.9.1 (adapted)
            const response = await computeDigestResponse({
                username: 'Mufasa',
                password: 'Circle of Life',
                realm: 'http-auth@example.org',
                method: 'GET',
                uri: '/dir/index.html',
                nonce: '7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v',
                cnonce: 'f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ',
                nc: '00000001',
                qop: 'auth',
                algorithm: 'MD5',
            });
            // MD5 response is 32 hex chars
            assert.equal(response.length, 32);
        });

        it('computes response with qop=auth using SHA-256', async () => {
            const response = await computeDigestResponse({
                username: 'Mufasa',
                password: 'Circle of Life',
                realm: 'http-auth@example.org',
                method: 'GET',
                uri: '/dir/index.html',
                nonce: '7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v',
                cnonce: 'f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ',
                nc: '00000001',
                qop: 'auth',
                algorithm: 'SHA-256',
            });
            // SHA-256 response is 64 hex chars
            assert.equal(response.length, 64);
        });

        it('computes response with qop=auth using SHA-512-256 (RFC 7616 §3.4.1)', async () => {
            const input = {
                username: 'Mufasa',
                password: 'Circle of Life',
                realm: 'http-auth@example.org',
                method: 'GET',
                uri: '/dir/index.html',
                nonce: '7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v',
                cnonce: 'f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ',
                nc: '00000001',
                qop: 'auth' as const,
            };

            const response = await computeDigestResponse({
                ...input,
                algorithm: 'SHA-512-256',
            });

            const ha1 = nodeHexHash('sha512-256', `${input.username}:${input.realm}:${input.password}`);
            const ha2 = nodeHexHash('sha512-256', `${input.method}:${input.uri}`);
            const expected = nodeHexHash(
                'sha512-256',
                `${ha1}:${input.nonce}:${input.nc}:${input.cnonce}:${input.qop}:${ha2}`
            );

            assert.equal(response, expected);
            assert.equal(response.length, 64);
        });

        it('computes response with SHA-512-256-sess using true sha512-256 (RFC 7616 §3.4.1)', async () => {
            const input = {
                username: 'Mufasa',
                password: 'Circle of Life',
                realm: 'http-auth@example.org',
                method: 'GET',
                uri: '/dir/index.html',
                nonce: '7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v',
                cnonce: 'f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ',
                nc: '00000001',
                qop: 'auth' as const,
            };

            const response = await computeDigestResponse({
                ...input,
                algorithm: 'SHA-512-256-sess',
            });

            const hUserRealmPass = nodeHexHash('sha512-256', `${input.username}:${input.realm}:${input.password}`);
            const ha1 = nodeHexHash('sha512-256', `${hUserRealmPass}:${input.nonce}:${input.cnonce}`);
            const ha2 = nodeHexHash('sha512-256', `${input.method}:${input.uri}`);
            const expected = nodeHexHash(
                'sha512-256',
                `${ha1}:${input.nonce}:${input.nc}:${input.cnonce}:${input.qop}:${ha2}`
            );

            assert.equal(response, expected);
            assert.equal(response.length, 64);
        });

        it('computes response without qop (legacy)', async () => {
            const response = await computeDigestResponse({
                username: 'Mufasa',
                password: 'Circle of Life',
                realm: 'testrealm@host.com',
                method: 'GET',
                uri: '/dir/index.html',
                nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093',
                algorithm: 'MD5',
            });
            // MD5 response is 32 hex chars
            assert.equal(response.length, 32);
        });
    });

    // RFC 7616 §3.4.2: A1 computation
    describe('A1 computation (RFC 7616 §3.4.2)', () => {
        it('computes A1 for non-session algorithms', async () => {
            const a1 = await computeA1('user', 'realm', 'password', 'MD5');
            assert.equal(a1, 'user:realm:password');
        });

        it('computes A1 for session algorithms', async () => {
            const a1 = await computeA1(
                'user',
                'realm',
                'password',
                'MD5-sess',
                'servernonce',
                'clientnonce'
            );
            // A1 for -sess = H(user:realm:password):nonce:cnonce
            // The hash part is computed, so we just check format
            assert.ok(a1.includes(':servernonce:clientnonce'));
            assert.equal(a1.split(':').length, 3);
        });

        it('throws for session algorithm without nonce/cnonce', async () => {
            await assert.rejects(
                async () => computeA1('user', 'realm', 'password', 'MD5-sess'),
                /nonce and cnonce are required/
            );
        });
    });

    // RFC 7616 §3.4.3: A2 computation
    describe('A2 computation (RFC 7616 §3.4.3)', () => {
        it('computes A2 for qop=auth', () => {
            const a2 = computeA2('GET', '/resource', 'auth');
            assert.equal(a2, 'GET:/resource');
        });

        it('computes A2 without qop', () => {
            const a2 = computeA2('POST', '/api/data');
            assert.equal(a2, 'POST:/api/data');
        });

        it('throws for qop=auth-int (out of scope)', () => {
            assert.throws(
                () => computeA2('GET', '/', 'auth-int'),
                /auth-int is not supported/
            );
        });
    });

    // RFC 7616 §3.4.4: Username hashing
    describe('Username hashing (RFC 7616 §3.4.4)', () => {
        it('hashes username with SHA-256', async () => {
            const hashed = await hashDigestUsername('Mufasa', 'http-auth@example.org', 'SHA-256');
            // SHA-256 hash is 64 hex chars
            assert.equal(hashed.length, 64);
        });

        it('hashes username with SHA-512-256 using true algorithm (RFC 7616 §3.4.4)', async () => {
            const username = 'Mufasa';
            const realm = 'http-auth@example.org';
            const hashed = await hashDigestUsername(username, realm, 'SHA-512-256');
            const expected = nodeHexHash('sha512-256', `${username}:${realm}`);
            assert.equal(hashed, expected);
            assert.equal(hashed.length, 64);
        });

        it('produces consistent hash', async () => {
            const hash1 = await hashDigestUsername('user', 'realm', 'SHA-256');
            const hash2 = await hashDigestUsername('user', 'realm', 'SHA-256');
            assert.equal(hash1, hash2);
        });

        it('produces different hash for different inputs', async () => {
            const hash1 = await hashDigestUsername('user1', 'realm', 'SHA-256');
            const hash2 = await hashDigestUsername('user2', 'realm', 'SHA-256');
            assert.notEqual(hash1, hash2);
        });
    });

    // Constant exports
    describe('Constants', () => {
        it('exports DIGEST_AUTH_ALGORITHMS', () => {
            assert.ok(Array.isArray(DIGEST_AUTH_ALGORITHMS));
            assert.ok(DIGEST_AUTH_ALGORITHMS.includes('MD5'));
            assert.ok(DIGEST_AUTH_ALGORITHMS.includes('SHA-256'));
            assert.ok(DIGEST_AUTH_ALGORITHMS.includes('SHA-512-256'));
            assert.ok(DIGEST_AUTH_ALGORITHMS.includes('MD5-sess'));
            assert.ok(DIGEST_AUTH_ALGORITHMS.includes('SHA-256-sess'));
            assert.ok(DIGEST_AUTH_ALGORITHMS.includes('SHA-512-256-sess'));
        });
    });
});
