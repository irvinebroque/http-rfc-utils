/**
 * WebAuthn utility facade.
 * W3C WebAuthn Level 3 with RFC 4648 and RFC 9053 dependencies.
 * @see https://www.w3.org/TR/webauthn-3/
 */

export {
    parseWebauthnBase64url,
    formatWebauthnBase64url,
    validateWebauthnBase64url,
} from './webauthn-base64url.js';

export {
    WEBAUTHN_COSE_ALGORITHM_IDS,
    validateWebauthnCoseAlgorithm,
} from './webauthn-cose.js';

export {
    parseWebauthnCreationOptionsFromJson,
    formatWebauthnCreationOptionsToJson,
    validateWebauthnCreationOptions,
    parseWebauthnRequestOptionsFromJson,
    formatWebauthnRequestOptionsToJson,
    validateWebauthnRequestOptions,
} from './webauthn-options.js';

export {
    parseWebauthnClientDataJson,
    formatWebauthnClientDataJson,
    validateWebauthnClientData,
} from './webauthn-client-data.js';

export {
    parseWebauthnAuthenticatorData,
    validateWebauthnAuthenticatorData,
} from './webauthn-authenticator-data.js';
