/**
 * Authentication-related types.
 * RFC 7617, RFC 6750, RFC 7616.
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
