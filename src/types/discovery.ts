/**
 * Discovery and metadata document types.
 * RFC 9309, RFC 9116, RFC 7033, RFC 6415, RFC 8414, W3C Webmention.
 * @see https://www.rfc-editor.org/rfc/rfc9309.html
 */

// Robots Exclusion Protocol (RFC 9309)
export interface RobotsGroup {
    userAgents: string[];
    allow: string[];
    disallow: string[];
    crawlDelay?: number;
}

export interface RobotsConfig {
    groups: RobotsGroup[];
    sitemaps: string[];
    host?: string;
}

// security.txt (RFC 9116)
export interface SecurityTxt {
    contact: string[];
    expires: Date;
    encryption?: string[];
    acknowledgments?: string[];
    preferredLanguages?: string[];
    canonical?: string[];
    policy?: string[];
    hiring?: string[];
    extensions?: Record<string, string[]>;
}

export interface SecurityTxtIssue {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

// WebFinger (RFC 7033)
export interface WebFingerLink {
    rel: string;
    type?: string;
    href?: string;
    titles?: Record<string, string>;
    properties?: Record<string, string | null>;
}

export interface WebFingerResponse {
    subject: string;
    aliases?: string[];
    properties?: Record<string, string | null>;
    links?: WebFingerLink[];
}

// Webmention (W3C Recommendation)
export type WebmentionDiscoverySource = 'http-link' | 'html-link' | 'html-a';

export interface WebmentionRequest {
    source: string;
    target: string;
}

export interface WebmentionValidationOptions {
    supportedSchemes?: readonly string[];
}

export interface WebmentionEndpointDiscoveryInput {
    target: string | URL;
    linkHeader?: string | string[] | null;
    html?: string | null;
    contentType?: string | null;
    allowLegacyRelationUri?: boolean;
}

export interface WebmentionEndpointDiscoveryResult {
    endpoint: string;
    source: WebmentionDiscoverySource;
}

// Host Metadata (RFC 6415)
export interface HostMetaLink {
    rel: string;
    type?: string;
    href?: string;
    template?: string;
}

export interface HostMeta {
    links: HostMetaLink[];
    properties?: Record<string, string | null>;
}

// OAuth 2.0 Authorization Server Metadata (RFC 8414)
export interface AuthorizationServerMetadata {
    [member: string]: unknown;
    issuer: string;
    authorization_endpoint?: string;
    token_endpoint?: string;
    jwks_uri?: string;
    registration_endpoint?: string;
    scopes_supported?: string[];
    response_types_supported: string[];
    response_modes_supported?: string[];
    grant_types_supported?: string[];
    token_endpoint_auth_methods_supported?: string[];
    token_endpoint_auth_signing_alg_values_supported?: string[];
    service_documentation?: string;
    ui_locales_supported?: string[];
    op_policy_uri?: string;
    op_tos_uri?: string;
    revocation_endpoint?: string;
    revocation_endpoint_auth_methods_supported?: string[];
    revocation_endpoint_auth_signing_alg_values_supported?: string[];
    introspection_endpoint?: string;
    introspection_endpoint_auth_methods_supported?: string[];
    introspection_endpoint_auth_signing_alg_values_supported?: string[];
    code_challenge_methods_supported?: string[];
    signed_metadata?: string;
}

export interface AuthorizationServerMetadataValidationOptions {
    expectedIssuer?: string;
}

export interface AuthorizationServerMetadataParseOptions extends AuthorizationServerMetadataValidationOptions {
}

export interface AuthorizationServerMetadataFormatOptions extends AuthorizationServerMetadataValidationOptions {
}
