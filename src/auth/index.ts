/**
 * Authorization and WWW-Authenticate utilities for Basic, Bearer, and Digest,
 * plus OAuth PKCE and WebAuthn helpers.
 * RFC 7617 §2, §2.1; RFC 6750 §2.1, §3; RFC 7616 §3.3-3.5; RFC 7636 §4-§7;
 * W3C WebAuthn Level 3.
 * @see https://www.rfc-editor.org/rfc/rfc7617.html
 */

export {
    parseAuthorization,
    formatAuthorization,
    parseWWWAuthenticate,
    formatWWWAuthenticate,
} from './shared.js';

export {
    parseBasicAuthorization,
    formatBasicAuthorization,
    parseBasicChallenge,
    formatBasicChallenge,
} from './basic.js';

export {
    parseBearerAuthorization,
    formatBearerAuthorization,
    parseBearerChallenge,
    formatBearerChallenge,
} from './bearer.js';

export {
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
} from './digest.js';

export {
    generatePkceCodeVerifier,
    derivePkceCodeChallenge,
    verifyPkceCodeVerifier,
    validatePkceCodeVerifier,
    validatePkceCodeChallenge,
    parsePkceAuthorizationRequestParams,
    formatPkceAuthorizationRequestParams,
    parsePkceTokenRequestParams,
    formatPkceTokenRequestParams,
} from './pkce.js';

export {
    parseWebauthnBase64url,
    formatWebauthnBase64url,
    validateWebauthnBase64url,
    parseWebauthnCreationOptionsFromJson,
    formatWebauthnCreationOptionsToJson,
    validateWebauthnCreationOptions,
    parseWebauthnRequestOptionsFromJson,
    formatWebauthnRequestOptionsToJson,
    validateWebauthnRequestOptions,
    parseWebauthnClientDataJson,
    formatWebauthnClientDataJson,
    validateWebauthnClientData,
    parseWebauthnAuthenticatorData,
    validateWebauthnAuthenticatorData,
    validateWebauthnCoseAlgorithm,
    WEBAUTHN_COSE_ALGORITHM_IDS,
} from './webauthn.js';
