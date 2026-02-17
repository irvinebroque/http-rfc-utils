/**
 * Authentication-related types.
 * RFC 7617, RFC 6750, RFC 7616, RFC 7636, W3C WebAuthn Level 3.
 * @see https://www.rfc-editor.org/rfc/rfc7617.html
 */

// RFC 7235 shared auth surface
export interface AuthParam {
    name: string;
    value: string;
}

export interface AuthChallenge {
    scheme: string;
    token68?: string;
    params?: AuthParam[];
}

export interface AuthCredentials {
    scheme: string;
    token68?: string;
    params?: AuthParam[];
}

// Basic (RFC 7617)
export interface BasicCredentials {
    username: string;
    password: string;
    encoding: 'utf-8' | 'latin1';
}

export interface BasicChallenge {
    scheme: 'Basic';
    realm: string;
    charset?: 'UTF-8';
}

// Bearer (RFC 6750)
export type BearerError = 'invalid_request' | 'invalid_token' | 'insufficient_scope';

export interface BearerChallenge {
    realm?: string;
    scope?: string;
    error?: BearerError;
    errorDescription?: string;
    errorUri?: string;
    params?: Record<string, string>;
}

// Digest (RFC 7616)
export type DigestAuthAlgorithm =
    | 'MD5'
    | 'MD5-sess'
    | 'SHA-256'
    | 'SHA-256-sess'
    | 'SHA-512-256'
    | 'SHA-512-256-sess';

export type DigestAuthQop = 'auth' | 'auth-int';

export interface DigestChallenge {
    scheme: 'Digest';
    realm: string;
    domain?: string[];
    nonce: string;
    opaque?: string;
    stale?: boolean;
    algorithm?: DigestAuthAlgorithm;
    qop?: DigestAuthQop[];
    charset?: 'UTF-8';
    userhash?: boolean;
}

export interface DigestCredentials {
    scheme: 'Digest';
    username: string;
    usernameEncoded?: boolean;
    realm: string;
    uri: string;
    response: string;
    algorithm?: DigestAuthAlgorithm;
    cnonce?: string;
    opaque?: string;
    qop?: DigestAuthQop;
    nc?: string;
    userhash?: boolean;
}

export interface DigestAuthenticationInfo {
    nextnonce?: string;
    qop?: DigestAuthQop;
    rspauth?: string;
    cnonce?: string;
    nc?: string;
}

export interface DigestComputeOptions {
    username: string;
    password: string;
    realm: string;
    method: string;
    uri: string;
    nonce: string;
    cnonce?: string;
    nc?: string;
    qop?: DigestAuthQop;
    algorithm?: DigestAuthAlgorithm;
    entityBody?: Uint8Array;
}

// PKCE (RFC 7636)
export type PkceCodeChallengeMethod = 'plain' | 'S256';

export interface PkceCodeVerifierGenerationOptions {
    byteLength?: number;
}

export interface PkceAuthorizationRequestParams {
    codeChallenge: string;
    codeChallengeMethod: PkceCodeChallengeMethod;
}

export interface PkceAuthorizationRequestInput {
    codeChallenge: string;
    codeChallengeMethod?: PkceCodeChallengeMethod;
}

export interface PkceTokenRequestParams {
    codeVerifier: string;
}

// Token revocation (RFC 7009)
export type TokenTypeHint = 'access_token' | 'refresh_token' | (string & {});

export interface TokenRevocationRequestParams {
    token: string;
    tokenTypeHint?: TokenTypeHint;
}

export interface TokenRevocationRequestInput {
    token: string;
    tokenTypeHint?: TokenTypeHint;
}

// WebAuthn (W3C WebAuthn Level 3, RFC 4648, RFC 9053)
export type WebauthnAuthenticatorAttachment = 'platform' | 'cross-platform';

export type WebauthnResidentKeyRequirement = 'discouraged' | 'preferred' | 'required';

export type WebauthnUserVerificationRequirement = 'discouraged' | 'preferred' | 'required';

export type WebauthnAttestationConveyancePreference = 'none' | 'indirect' | 'direct' | 'enterprise';

export interface WebauthnPublicKeyCredentialRpEntity {
    id?: string;
    name: string;
}

export interface WebauthnPublicKeyCredentialRpEntityJson {
    id?: string;
    name: string;
}

export interface WebauthnPublicKeyCredentialUserEntity {
    id: Uint8Array;
    name: string;
    displayName: string;
}

export interface WebauthnPublicKeyCredentialUserEntityJson {
    id: string;
    name: string;
    displayName: string;
}

export interface WebauthnPublicKeyCredentialParameters {
    type: 'public-key';
    alg: number;
}

export interface WebauthnPublicKeyCredentialDescriptor {
    type: 'public-key';
    id: Uint8Array;
    transports?: string[];
}

export interface WebauthnPublicKeyCredentialDescriptorJson {
    type: 'public-key';
    id: string;
    transports?: string[];
}

export interface WebauthnAuthenticatorSelectionCriteria {
    authenticatorAttachment?: WebauthnAuthenticatorAttachment;
    residentKey?: WebauthnResidentKeyRequirement;
    requireResidentKey?: boolean;
    userVerification?: WebauthnUserVerificationRequirement;
}

export interface WebauthnPublicKeyCredentialCreationOptions {
    challenge: Uint8Array;
    rp: WebauthnPublicKeyCredentialRpEntity;
    user: WebauthnPublicKeyCredentialUserEntity;
    pubKeyCredParams: WebauthnPublicKeyCredentialParameters[];
    timeout?: number;
    excludeCredentials?: WebauthnPublicKeyCredentialDescriptor[];
    authenticatorSelection?: WebauthnAuthenticatorSelectionCriteria;
    attestation?: WebauthnAttestationConveyancePreference;
    hints?: string[];
}

export interface WebauthnPublicKeyCredentialCreationOptionsJson {
    challenge: string;
    rp: WebauthnPublicKeyCredentialRpEntityJson;
    user: WebauthnPublicKeyCredentialUserEntityJson;
    pubKeyCredParams: WebauthnPublicKeyCredentialParameters[];
    timeout?: number;
    excludeCredentials?: WebauthnPublicKeyCredentialDescriptorJson[];
    authenticatorSelection?: WebauthnAuthenticatorSelectionCriteria;
    attestation?: WebauthnAttestationConveyancePreference;
    hints?: string[];
}

export interface WebauthnPublicKeyCredentialRequestOptions {
    challenge: Uint8Array;
    timeout?: number;
    rpId?: string;
    allowCredentials?: WebauthnPublicKeyCredentialDescriptor[];
    userVerification?: WebauthnUserVerificationRequirement;
    hints?: string[];
}

export interface WebauthnPublicKeyCredentialRequestOptionsJson {
    challenge: string;
    timeout?: number;
    rpId?: string;
    allowCredentials?: WebauthnPublicKeyCredentialDescriptorJson[];
    userVerification?: WebauthnUserVerificationRequirement;
    hints?: string[];
}

export interface WebauthnCreationOptionsValidationOptions {
    minChallengeLength?: number;
    allowedCoseAlgorithms?: readonly number[];
    allowIpRpId?: boolean;
}

export interface WebauthnRequestOptionsValidationOptions {
    minChallengeLength?: number;
    allowIpRpId?: boolean;
}

export interface WebauthnClientData {
    type: string;
    challenge: string;
    origin: string;
    crossOrigin?: boolean;
    topOrigin?: string;
}

export interface WebauthnClientDataValidationOptions {
    expectedType?: string | readonly string[];
    expectedChallenge?: string | Uint8Array;
    expectedOrigin?: string | readonly string[];
    minChallengeLength?: number;
    requireHttpsOrigin?: boolean;
    allowHttpLoopbackOrigin?: boolean;
}

export interface WebauthnClientDataFormatOptions {
    requireHttpsOrigin?: boolean;
    allowHttpLoopbackOrigin?: boolean;
}

export interface WebauthnAuthenticatorFlags {
    userPresent: boolean;
    userVerified: boolean;
    backupEligible: boolean;
    backupState: boolean;
    attestedCredentialData: boolean;
    extensionData: boolean;
}

export interface WebauthnAttestedCredentialData {
    aaguid: Uint8Array;
    credentialId: Uint8Array;
    credentialPublicKey: Uint8Array;
}

export interface WebauthnAuthenticatorData {
    rpIdHash: Uint8Array;
    flagsByte: number;
    flags: WebauthnAuthenticatorFlags;
    signCount: number;
    attestedCredentialData?: WebauthnAttestedCredentialData;
    extensions?: Uint8Array;
}

export interface WebauthnAuthenticatorDataValidationOptions {
    expectedRpId?: string;
    requireUserPresence?: boolean;
    requireUserVerification?: boolean;
    previousSignCount?: number;
    allowIpRpId?: boolean;
}
