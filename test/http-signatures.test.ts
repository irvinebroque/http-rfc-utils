import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseSignatureInput,
    formatSignatureInput,
    parseSignature,
    formatSignature,
    parseComponentIdentifier,
    formatComponentIdentifier,
    canonicalizeFieldValue,
    binaryWrapFieldValues,
    deriveComponentValue,
    createSignatureBase,
    isDerivedComponent,
    DERIVED_COMPONENTS,
} from '../src/http-signatures.js';
import type {
    SignatureComponent,
    SignatureInput,
    SignatureMessageContext,
} from '../src/types.js';

// RFC 9421 HTTP Message Signatures
describe('RFC 9421 HTTP Message Signatures', () => {
    // RFC 9421 §4.1: Signature-Input field parsing
    describe('parseSignatureInput', () => {
        // RFC 9421 §4.1: Parse dictionary structured field
        it('parses single signature input', () => {
            const input = 'sig1=("@method" "@authority" "content-type");created=1618884473;keyid="test-key"';
            const result = parseSignatureInput(input);

            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].label, 'sig1');
            assert.equal(result[0].components.length, 3);
            assert.deepEqual(result[0].components[0], { name: '@method' });
            assert.deepEqual(result[0].components[1], { name: '@authority' });
            assert.deepEqual(result[0].components[2], { name: 'content-type' });
            assert.deepEqual(result[0].params, {
                created: 1618884473,
                keyid: 'test-key',
            });
        });

        // RFC 9421 §4.1: Multiple signatures
        it('parses multiple signature inputs', () => {
            const input = 'sig1=("@method");created=1, sig2=("@authority");keyid="k2"';
            const result = parseSignatureInput(input);

            assert.ok(result);
            assert.equal(result.length, 2);
            assert.equal(result[0].label, 'sig1');
            assert.equal(result[1].label, 'sig2');
        });

        // RFC 9421 §2.1: Component with parameters
        it('parses component with sf parameter', () => {
            const input = 'sig1=("content-type";sf "cache-control")';
            const result = parseSignatureInput(input);

            assert.ok(result);
            assert.equal(result[0].components[0].name, 'content-type');
            assert.equal(result[0].components[0].params?.sf, true);
            assert.equal(result[0].components[1].name, 'cache-control');
            assert.equal(result[0].components[1].params, undefined);
        });

        // RFC 9421 §2.1.2: Key parameter for dictionary members
        it('parses component with key parameter', () => {
            const input = 'sig1=("example-dict";key="member")';
            const result = parseSignatureInput(input);

            assert.ok(result);
            assert.equal(result[0].components[0].params?.key, 'member');
        });

        // RFC 9421 §2.1.4: Binary-wrapped fields
        it('parses component with bs parameter', () => {
            const input = 'sig1=("set-cookie";bs)';
            const result = parseSignatureInput(input);

            assert.ok(result);
            assert.equal(result[0].components[0].params?.bs, true);
        });

        // RFC 9421 §2.2.9: Request components in response
        it('parses component with req parameter', () => {
            const input = 'sig1=("@method";req)';
            const result = parseSignatureInput(input);

            assert.ok(result);
            assert.equal(result[0].components[0].params?.req, true);
        });

        // RFC 9421 §2.1.3: Trailer components
        it('parses component with tr parameter', () => {
            const input = 'sig1=("digest";tr)';
            const result = parseSignatureInput(input);

            assert.ok(result);
            assert.equal(result[0].components[0].params?.tr, true);
        });

        // RFC 9421 §2.3: All signature parameters
        it('parses all signature parameters', () => {
            const input = 'sig1=();created=1;expires=2;nonce="abc";alg="rsa-v1_5-sha256";keyid="key1";tag="app"';
            const result = parseSignatureInput(input);

            assert.ok(result);
            assert.deepEqual(result[0].params, {
                created: 1,
                expires: 2,
                nonce: 'abc',
                alg: 'rsa-v1_5-sha256',
                keyid: 'key1',
                tag: 'app',
            });
        });

        it('returns null for invalid input', () => {
            assert.equal(parseSignatureInput('invalid'), null);
        });

        it('returns null for non-inner-list value', () => {
            assert.equal(parseSignatureInput('sig1="not-a-list"'), null);
        });
    });

    // RFC 9421 §4.1: Signature-Input field formatting
    describe('formatSignatureInput', () => {
        it('formats single signature input', () => {
            const inputs: SignatureInput[] = [{
                label: 'sig1',
                components: [{ name: '@method' }, { name: 'content-type' }],
                params: { created: 1618884473, keyid: 'test-key' },
            }];
            const result = formatSignatureInput(inputs);

            // RFC 8941 §4.1.7: Strings matching token syntax are serialized as tokens
            // So "content-type" becomes content-type (no quotes), but "@method" is quoted
            // because @ is not valid in a token
            assert.ok(result.includes('sig1='));
            assert.ok(result.includes('"@method"'));
            assert.ok(result.includes('content-type'));
            assert.ok(result.includes('created=1618884473'));
            assert.ok(result.includes('keyid=test-key'));
        });

        it('formats component with parameters', () => {
            const inputs: SignatureInput[] = [{
                label: 'sig1',
                components: [
                    { name: 'content-type', params: { sf: true } },
                    { name: 'example-dict', params: { key: 'member' } },
                ],
            }];
            const result = formatSignatureInput(inputs);

            assert.ok(result.includes(';sf'));
            // RFC 8941: "member" can be serialized as token since it matches token syntax
            assert.ok(result.includes(';key=member'));
        });

        // RFC 9421 §4.1: Round-trip consistency
        it('round-trips through parse and format', () => {
            const original = 'sig1=("@method" "@authority");created=1618884473;keyid="test"';
            const parsed = parseSignatureInput(original);
            assert.ok(parsed);
            const formatted = formatSignatureInput(parsed);
            const reparsed = parseSignatureInput(formatted);

            assert.ok(reparsed);
            assert.deepEqual(parsed[0].components, reparsed[0].components);
            assert.deepEqual(parsed[0].params, reparsed[0].params);
        });
    });

    // RFC 9421 §4.2: Signature field parsing
    describe('parseSignature', () => {
        // RFC 9421 §4.2: Byte sequence value
        it('parses signature with byte sequence', () => {
            const input = 'sig1=:YmFzZTY0ZW5jb2RlZA==:';
            const result = parseSignature(input);

            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].label, 'sig1');
            assert.ok(result[0].value instanceof Uint8Array);
            const decoded = new TextDecoder().decode(result[0].value);
            assert.equal(decoded, 'base64encoded');
        });

        // RFC 9421 §4.2: Multiple signatures
        it('parses multiple signatures', () => {
            const input = 'sig1=:YWJj:, sig2=:ZGVm:';
            const result = parseSignature(input);

            assert.ok(result);
            assert.equal(result.length, 2);
            assert.equal(result[0].label, 'sig1');
            assert.equal(result[1].label, 'sig2');
        });

        it('returns null for non-byte-sequence value', () => {
            assert.equal(parseSignature('sig1="not-bytes"'), null);
        });

        it('returns null for inner-list value', () => {
            assert.equal(parseSignature('sig1=("a" "b")'), null);
        });
    });

    // RFC 9421 §4.2: Signature field formatting
    describe('formatSignature', () => {
        it('formats signature with byte sequence', () => {
            const signatures = [{
                label: 'sig1',
                value: new TextEncoder().encode('test'),
            }];
            const result = formatSignature(signatures);

            assert.ok(result.includes('sig1='));
            assert.ok(result.includes(':'));
        });

        it('round-trips through parse and format', () => {
            const original = [{
                label: 'sig1',
                value: new TextEncoder().encode('hello'),
            }];
            const formatted = formatSignature(original);
            const parsed = parseSignature(formatted);

            assert.ok(parsed);
            assert.deepEqual(parsed[0].value, original[0].value);
        });
    });

    // RFC 9421 §2: Component identifier parsing
    describe('parseComponentIdentifier', () => {
        // RFC 9421 §2.1: Field name component
        it('parses field name component', () => {
            const result = parseComponentIdentifier('"content-type"');

            assert.ok(result);
            assert.equal(result.name, 'content-type');
            assert.equal(result.params, undefined);
        });

        // RFC 9421 §2.2: Derived component
        it('parses derived component', () => {
            const result = parseComponentIdentifier('"@method"');

            assert.ok(result);
            assert.equal(result.name, '@method');
        });

        // RFC 9421 §2.1.1: sf parameter
        it('parses component with sf parameter', () => {
            const result = parseComponentIdentifier('"cache-control";sf');

            assert.ok(result);
            assert.equal(result.params?.sf, true);
        });

        // RFC 9421 §2.1.2: key parameter
        it('parses component with key parameter', () => {
            const result = parseComponentIdentifier('"example-dict";key="member"');

            assert.ok(result);
            assert.equal(result.params?.key, 'member');
        });

        // RFC 9421 §2.1.4: bs parameter
        it('parses component with bs parameter', () => {
            const result = parseComponentIdentifier('"set-cookie";bs');

            assert.ok(result);
            assert.equal(result.params?.bs, true);
        });

        // RFC 9421 §2.2.9: req parameter
        it('parses component with req parameter', () => {
            const result = parseComponentIdentifier('"@method";req');

            assert.ok(result);
            assert.equal(result.params?.req, true);
        });

        // RFC 9421 §2.1.3: tr parameter
        it('parses component with tr parameter', () => {
            const result = parseComponentIdentifier('"digest";tr');

            assert.ok(result);
            assert.equal(result.params?.tr, true);
        });

        it('parses component with multiple parameters', () => {
            const result = parseComponentIdentifier('"example-dict";sf;key="member"');

            assert.ok(result);
            assert.equal(result.params?.sf, true);
            assert.equal(result.params?.key, 'member');
        });

        it('returns null for unquoted name', () => {
            assert.equal(parseComponentIdentifier('content-type'), null);
        });

        it('returns null for unterminated string', () => {
            assert.equal(parseComponentIdentifier('"content-type'), null);
        });
    });

    // RFC 9421 §2: Component identifier formatting
    describe('formatComponentIdentifier', () => {
        it('formats simple component', () => {
            const result = formatComponentIdentifier({ name: 'content-type' });
            assert.equal(result, '"content-type"');
        });

        it('formats derived component', () => {
            const result = formatComponentIdentifier({ name: '@method' });
            assert.equal(result, '"@method"');
        });

        it('formats component with sf parameter', () => {
            const result = formatComponentIdentifier({
                name: 'cache-control',
                params: { sf: true },
            });
            assert.equal(result, '"cache-control";sf');
        });

        it('formats component with key parameter', () => {
            const result = formatComponentIdentifier({
                name: 'example-dict',
                params: { key: 'member' },
            });
            assert.equal(result, '"example-dict";key="member"');
        });

        it('formats component with multiple parameters', () => {
            const result = formatComponentIdentifier({
                name: 'example',
                params: { sf: true, bs: true, req: true, tr: true },
            });
            assert.ok(result.includes(';sf'));
            assert.ok(result.includes(';bs'));
            assert.ok(result.includes(';req'));
            assert.ok(result.includes(';tr'));
        });

        it('round-trips through parse and format', () => {
            const original = { name: 'example', params: { key: 'test', sf: true } };
            const formatted = formatComponentIdentifier(original);
            const parsed = parseComponentIdentifier(formatted);

            assert.ok(parsed);
            assert.equal(parsed.name, original.name);
            assert.equal(parsed.params?.key, original.params.key);
            assert.equal(parsed.params?.sf, original.params.sf);
        });
    });

    // RFC 9421 §2.1: Field value canonicalization
    describe('canonicalizeFieldValue', () => {
        // RFC 9421 §2.1: Combine multiple values with ", "
        it('combines multiple field values', () => {
            const result = canonicalizeFieldValue(['value1', 'value2']);
            assert.equal(result, 'value1, value2');
        });

        // RFC 9421 §2.1: Trim whitespace
        it('trims whitespace from values', () => {
            const result = canonicalizeFieldValue(['  value1  ', '  value2  ']);
            assert.equal(result, 'value1, value2');
        });

        // RFC 9421 §2.1: Handle empty field value
        it('handles empty field value', () => {
            const result = canonicalizeFieldValue(['']);
            assert.equal(result, '');
        });

        it('handles single value', () => {
            const result = canonicalizeFieldValue(['single']);
            assert.equal(result, 'single');
        });

        // RFC 9421 §2.1: Replace obsolete line folding
        it('replaces obsolete line folding', () => {
            const result = canonicalizeFieldValue(['value1\r\n continues']);
            assert.equal(result, 'value1 continues');
        });

        it('replaces LF-only line folding', () => {
            const result = canonicalizeFieldValue(['value1\n\tcontinues']);
            assert.equal(result, 'value1 continues');
        });
    });

    // RFC 9421 §2.1.4: Binary-wrapped field values
    describe('binaryWrapFieldValues', () => {
        it('wraps single value as base64', () => {
            const result = binaryWrapFieldValues(['value']);
            const decoded = new TextDecoder().decode(result);
            // Should be base64 wrapped in colons
            assert.ok(decoded.includes(':'));
        });

        it('wraps multiple values', () => {
            const result = binaryWrapFieldValues(['value1', 'value2']);
            const decoded = new TextDecoder().decode(result);
            // Should contain separator between wrapped values
            assert.ok(decoded.includes(', '));
        });
    });

    // RFC 9421 §2.2: Derived component values
    describe('deriveComponentValue', () => {
        // RFC 9421 §2.2.1: @method (uppercase)
        it('derives @method as uppercase', () => {
            const message: SignatureMessageContext = {
                method: 'post',
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@method' });
            assert.equal(result, 'POST');
        });

        // RFC 9421 §2.2.3: @authority
        it('derives @authority', () => {
            const message: SignatureMessageContext = {
                authority: 'example.com:8080',
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@authority' });
            assert.equal(result, 'example.com:8080');
        });

        // RFC 9421 §2.2.4: @scheme (lowercase)
        it('derives @scheme as lowercase', () => {
            const message: SignatureMessageContext = {
                scheme: 'HTTPS',
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@scheme' });
            assert.equal(result, 'https');
        });

        // RFC 9421 §2.2.6: @path
        it('derives @path', () => {
            const message: SignatureMessageContext = {
                path: '/api/resource',
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@path' });
            assert.equal(result, '/api/resource');
        });

        // RFC 9421 §2.2.7: @query (with leading ?)
        it('derives @query with leading ?', () => {
            const message: SignatureMessageContext = {
                query: '?foo=bar',
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@query' });
            assert.equal(result, '?foo=bar');
        });

        it('adds leading ? to query if missing', () => {
            const message: SignatureMessageContext = {
                query: 'foo=bar',
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@query' });
            assert.equal(result, '?foo=bar');
        });

        // RFC 9421 §2.2.8: @query-param with name parameter
        it('derives @query-param with name parameter', () => {
            const message: SignatureMessageContext = {
                query: '?foo=bar&baz=qux',
                headers: new Map(),
            };
            const component: SignatureComponent = {
                name: '@query-param',
                params: { key: 'foo' },
            };
            const result = deriveComponentValue(message, component);
            assert.equal(result, 'bar');
        });

        it('returns null for missing query param', () => {
            const message: SignatureMessageContext = {
                query: '?foo=bar',
                headers: new Map(),
            };
            const component: SignatureComponent = {
                name: '@query-param',
                params: { key: 'missing' },
            };
            const result = deriveComponentValue(message, component);
            assert.equal(result, null);
        });

        // RFC 9421 §2.2.10: @status (3 digits)
        it('derives @status as 3 digits', () => {
            const message: SignatureMessageContext = {
                status: 200,
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@status' });
            assert.equal(result, '200');
        });

        it('pads @status to 3 digits', () => {
            const message: SignatureMessageContext = {
                status: 50,
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@status' });
            assert.equal(result, '050');
        });

        // RFC 9421 §2.2.2: @target-uri
        it('derives @target-uri', () => {
            const message: SignatureMessageContext = {
                targetUri: 'https://example.com/api?foo=bar',
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@target-uri' });
            assert.equal(result, 'https://example.com/api?foo=bar');
        });

        // RFC 9421 §2.2.5: @request-target
        it('derives @request-target', () => {
            const message: SignatureMessageContext = {
                path: '/api/resource',
                query: '?foo=bar',
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: '@request-target' });
            assert.equal(result, '/api/resource?foo=bar');
        });

        // RFC 9421 §2.1: Header field values
        it('derives header field value', () => {
            const message: SignatureMessageContext = {
                headers: new Map([['content-type', ['application/json']]]),
            };
            const result = deriveComponentValue(message, { name: 'content-type' });
            assert.equal(result, 'application/json');
        });

        it('combines multiple header values', () => {
            const message: SignatureMessageContext = {
                headers: new Map([['cache-control', ['no-cache', 'no-store']]]),
            };
            const result = deriveComponentValue(message, { name: 'cache-control' });
            assert.equal(result, 'no-cache, no-store');
        });

        it('returns null for missing header', () => {
            const message: SignatureMessageContext = {
                headers: new Map(),
            };
            const result = deriveComponentValue(message, { name: 'missing-header' });
            assert.equal(result, null);
        });

        // RFC 9421 §2.2.9: req parameter accesses request context
        it('accesses request context with req parameter', () => {
            const message: SignatureMessageContext = {
                status: 200,
                headers: new Map(),
                request: {
                    method: 'POST',
                    headers: new Map(),
                },
            };
            const component: SignatureComponent = {
                name: '@method',
                params: { req: true },
            };
            const result = deriveComponentValue(message, component);
            assert.equal(result, 'POST');
        });

        it('returns null if req parameter but no request context', () => {
            const message: SignatureMessageContext = {
                status: 200,
                headers: new Map(),
            };
            const component: SignatureComponent = {
                name: '@method',
                params: { req: true },
            };
            const result = deriveComponentValue(message, component);
            assert.equal(result, null);
        });

        // RFC 9421 §2.1.3: tr parameter accesses trailers
        it('accesses trailers with tr parameter', () => {
            const message: SignatureMessageContext = {
                headers: new Map(),
                trailers: new Map([['digest', ['sha-256=...']]]),
            };
            const component: SignatureComponent = {
                name: 'digest',
                params: { tr: true },
            };
            const result = deriveComponentValue(message, component);
            assert.equal(result, 'sha-256=...');
        });

        it('returns null if tr parameter but no trailers', () => {
            const message: SignatureMessageContext = {
                headers: new Map([['digest', ['sha-256=...']]]),
            };
            const component: SignatureComponent = {
                name: 'digest',
                params: { tr: true },
            };
            const result = deriveComponentValue(message, component);
            assert.equal(result, null);
        });
    });

    // RFC 9421 §2.5: Signature base creation
    describe('createSignatureBase', () => {
        // RFC 9421 §2.5: Signature base format
        it('creates signature base with multiple components', () => {
            const message: SignatureMessageContext = {
                method: 'POST',
                authority: 'example.com',
                headers: new Map([['content-type', ['application/json']]]),
            };
            const components: SignatureComponent[] = [
                { name: '@method' },
                { name: '@authority' },
                { name: 'content-type' },
            ];
            const params = { created: 1618884473 };

            const result = createSignatureBase(message, components, params);

            assert.ok(result);
            assert.ok(result.base.includes('"@method": POST'));
            assert.ok(result.base.includes('"@authority": example.com'));
            assert.ok(result.base.includes('"content-type": application/json'));
            assert.ok(result.base.includes('"@signature-params":'));
        });

        // RFC 9421 §3.1: @signature-params MUST be last
        it('places @signature-params last', () => {
            const message: SignatureMessageContext = {
                method: 'GET',
                headers: new Map(),
            };
            const result = createSignatureBase(message, [{ name: '@method' }], {});

            assert.ok(result);
            const lines = result.base.split('\n');
            assert.ok(lines[lines.length - 1].startsWith('"@signature-params":'));
        });

        // RFC 9421 §2.5: Use LF line endings (not CRLF)
        it('uses LF line endings', () => {
            const message: SignatureMessageContext = {
                method: 'GET',
                authority: 'example.com',
                headers: new Map(),
            };
            const result = createSignatureBase(
                message,
                [{ name: '@method' }, { name: '@authority' }],
                {}
            );

            assert.ok(result);
            assert.ok(!result.base.includes('\r\n'));
            assert.ok(result.base.includes('\n'));
        });

        // RFC 9421 §2.5: Component values MUST NOT contain newlines
        it('fails if component value contains newline', () => {
            const message: SignatureMessageContext = {
                headers: new Map([['bad-header', ['line1\nline2']]]),
            };
            const result = createSignatureBase(message, [{ name: 'bad-header' }], {});

            assert.equal(result, null);
        });

        // RFC 9421 §2.5: Each component identifier MUST occur only once
        it('fails for duplicate component', () => {
            const message: SignatureMessageContext = {
                method: 'GET',
                headers: new Map(),
            };
            const result = createSignatureBase(
                message,
                [{ name: '@method' }, { name: '@method' }],
                {}
            );

            assert.equal(result, null);
        });

        // RFC 9421 §2.5: Fail for missing required component
        it('fails for missing required component', () => {
            const message: SignatureMessageContext = {
                headers: new Map(),
            };
            const result = createSignatureBase(message, [{ name: 'missing-header' }], {});

            assert.equal(result, null);
        });

        // RFC 9421 §2.3: Signature parameters in @signature-params
        it('includes all signature parameters', () => {
            const message: SignatureMessageContext = {
                headers: new Map(),
            };
            const params = {
                created: 1618884473,
                expires: 1618884773,
                nonce: 'abc123',
                alg: 'rsa-v1_5-sha256',
                keyid: 'test-key',
                tag: 'my-app',
            };
            const result = createSignatureBase(message, [], params);

            assert.ok(result);
            assert.ok(result.signatureParams.includes('created=1618884473'));
            assert.ok(result.signatureParams.includes('expires=1618884773'));
            assert.ok(result.signatureParams.includes('nonce="abc123"'));
            assert.ok(result.signatureParams.includes('alg="rsa-v1_5-sha256"'));
            assert.ok(result.signatureParams.includes('keyid="test-key"'));
            assert.ok(result.signatureParams.includes('tag="my-app"'));
        });

        // RFC 9421 §2.5: Component identifiers with parameters
        it('handles components with parameters in signature base', () => {
            const message: SignatureMessageContext = {
                headers: new Map([
                    ['example-dict', ['a=1, b=2']],
                ]),
            };
            const components: SignatureComponent[] = [
                { name: 'example-dict', params: { sf: true } },
            ];
            const result = createSignatureBase(message, components, {});

            assert.ok(result);
            assert.ok(result.base.includes('"example-dict";sf:'));
            assert.ok(result.signatureParams.includes('"example-dict";sf'));
        });

        it('returns signatureParams value', () => {
            const message: SignatureMessageContext = {
                method: 'GET',
                headers: new Map(),
            };
            const result = createSignatureBase(
                message,
                [{ name: '@method' }],
                { created: 1618884473, keyid: 'test' }
            );

            assert.ok(result);
            assert.equal(
                result.signatureParams,
                '("@method");created=1618884473;keyid="test"'
            );
        });
    });

    // RFC 9421 §2.2: isDerivedComponent helper
    describe('isDerivedComponent', () => {
        it('returns true for derived components', () => {
            assert.equal(isDerivedComponent('@method'), true);
            assert.equal(isDerivedComponent('@authority'), true);
            assert.equal(isDerivedComponent('@path'), true);
            assert.equal(isDerivedComponent('@query'), true);
            assert.equal(isDerivedComponent('@query-param'), true);
            assert.equal(isDerivedComponent('@status'), true);
            assert.equal(isDerivedComponent('@target-uri'), true);
            assert.equal(isDerivedComponent('@scheme'), true);
            assert.equal(isDerivedComponent('@request-target'), true);
        });

        it('returns false for regular field names', () => {
            assert.equal(isDerivedComponent('content-type'), false);
            assert.equal(isDerivedComponent('cache-control'), false);
            assert.equal(isDerivedComponent('@custom'), false);
        });
    });

    // RFC 9421 §2.2: DERIVED_COMPONENTS constant
    describe('DERIVED_COMPONENTS', () => {
        it('contains all derived component names', () => {
            assert.ok(DERIVED_COMPONENTS.includes('@method'));
            assert.ok(DERIVED_COMPONENTS.includes('@target-uri'));
            assert.ok(DERIVED_COMPONENTS.includes('@authority'));
            assert.ok(DERIVED_COMPONENTS.includes('@scheme'));
            assert.ok(DERIVED_COMPONENTS.includes('@request-target'));
            assert.ok(DERIVED_COMPONENTS.includes('@path'));
            assert.ok(DERIVED_COMPONENTS.includes('@query'));
            assert.ok(DERIVED_COMPONENTS.includes('@query-param'));
            assert.ok(DERIVED_COMPONENTS.includes('@status'));
        });

        it('has correct length', () => {
            assert.equal(DERIVED_COMPONENTS.length, 9);
        });
    });

    // RFC 9421 §4.1, §4.2: Label matching between Signature-Input and Signature
    describe('Label matching', () => {
        it('signature-input and signature use same labels', () => {
            const inputStr = 'sig1=("@method");created=1';
            const sigStr = 'sig1=:YWJj:';

            const inputs = parseSignatureInput(inputStr);
            const sigs = parseSignature(sigStr);

            assert.ok(inputs);
            assert.ok(sigs);
            assert.equal(inputs[0].label, sigs[0].label);
        });

        it('multiple signatures match by label', () => {
            const inputStr = 'sig1=("@method");created=1, sig2=("@authority");created=2';
            const sigStr = 'sig1=:YWJj:, sig2=:ZGVm:';

            const inputs = parseSignatureInput(inputStr);
            const sigs = parseSignature(sigStr);

            assert.ok(inputs);
            assert.ok(sigs);

            // Create a map for easy lookup
            const sigMap = new Map(sigs.map(s => [s.label, s]));

            for (const input of inputs) {
                assert.ok(sigMap.has(input.label));
            }
        });
    });
});
