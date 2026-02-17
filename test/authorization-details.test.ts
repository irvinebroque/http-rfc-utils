/**
 * Tests for OAuth 2.0 Rich Authorization Requests helpers.
 * Spec references are cited inline for each assertion group when applicable.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    formatAuthorizationDetails,
    parseAuthorizationDetails,
    parseAuthorizationDetailsObject,
    validateAuthorizationDetails,
} from '../src/auth.js';
import type { AuthorizationDetails } from '../src/types.js';

const SAMPLE_DETAILS: AuthorizationDetails = [
    {
        type: 'account_information',
        actions: ['list_accounts', 'read_balances', 'read_transactions'],
        locations: ['https://example.com/accounts'],
    },
    {
        type: 'payment_initiation',
        actions: ['initiate', 'status', 'cancel'],
        locations: ['https://example.com/payments'],
        instructedAmount: {
            currency: 'EUR',
            amount: '123.50',
        },
        creditorName: 'Merchant A',
        creditorAccount: {
            iban: 'DE02100100109307118603',
        },
        remittanceInformationUnstructured: 'Ref Number Merchant',
    },
];

const EXPECTED_FORMAT =
    '[{"type":"account_information","locations":["https://example.com/accounts"],"actions":["list_accounts","read_balances","read_transactions"]},'
    + '{"type":"payment_initiation","locations":["https://example.com/payments"],"actions":["initiate","status","cancel"],'
    + '"creditorAccount":{"iban":"DE02100100109307118603"},"creditorName":"Merchant A",'
    + '"instructedAmount":{"currency":"EUR","amount":"123.50"},"remittanceInformationUnstructured":"Ref Number Merchant"}]';

describe('authorization_details parsing and formatting (RFC 9396 Sections 2, 2.1, 2.2)', () => {
    it('parses the combined request example payload (RFC 9396 Section 2)', () => {
        const parsed = parseAuthorizationDetails(EXPECTED_FORMAT);
        assert.ok(parsed);
        assert.equal(parsed.length, 2);
        assert.equal(parsed[0]?.type, 'account_information');
        assert.equal(parsed[1]?.type, 'payment_initiation');
        assert.equal(formatAuthorizationDetails(parsed), EXPECTED_FORMAT);
    });

    it('parses already-decoded authorization_details arrays', () => {
        const decoded = JSON.parse(EXPECTED_FORMAT) as AuthorizationDetails;
        const parsed = parseAuthorizationDetailsObject(decoded);
        assert.ok(parsed);
        assert.equal(formatAuthorizationDetails(parsed), EXPECTED_FORMAT);
    });

    it('rejects malformed authorization_details shapes', () => {
        assert.equal(parseAuthorizationDetails('{"type":"example"}'), null);
        assert.equal(parseAuthorizationDetails('[{"actions":["read"]}]'), null);
        assert.equal(parseAuthorizationDetails('[{"type":42}]'), null);
        assert.equal(parseAuthorizationDetails('[{"type":"example","actions":[42]}]'), null);
    });

    it('formats deterministically with ordered keys (RFC 9396 Section 2)', () => {
        assert.equal(formatAuthorizationDetails(SAMPLE_DETAILS), EXPECTED_FORMAT);
    });

    it('sorts extension fields deterministically', () => {
        const details: AuthorizationDetails = [
            {
                type: 'example',
                zeta: 'end',
                alpha: 'start',
            },
        ];

        assert.equal(formatAuthorizationDetails(details), '[{"type":"example","alpha":"start","zeta":"end"}]');
    });
});

describe('authorization_details validation options (RFC 9396 Section 5)', () => {
    it('rejects unknown types when an allowed type list is provided', () => {
        assert.throws(() => {
            validateAuthorizationDetails([{ type: 'example' }], {
                allowedTypes: ['payment_initiation'],
            });
        }, /not allowed/);
    });

    it('rejects unknown fields when type definitions forbid them', () => {
        assert.throws(() => {
            validateAuthorizationDetails([{ type: 'example', locations: ['https://example.com'] }], {
                typeDefinitions: {
                    example: {
                        allowedFields: ['actions'],
                        allowUnknownFields: false,
                    },
                },
            });
        }, /unknown field/);
    });

    it('rejects missing required fields for known types', () => {
        assert.throws(() => {
            validateAuthorizationDetails([{ type: 'example' }], {
                typeDefinitions: {
                    example: {
                        requiredFields: ['locations'],
                    },
                },
            });
        }, /missing required field/);
    });

    it('rejects non-JSON values in authorization_details entries', () => {
        const details = [{ type: 'example', amount: Number.POSITIVE_INFINITY }] as AuthorizationDetails;
        assert.throws(() => validateAuthorizationDetails(details), /JSON values/);
    });
});
