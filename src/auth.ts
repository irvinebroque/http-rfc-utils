/**
 * Authorization and WWW-Authenticate utilities for Basic, Bearer, and Digest,
 * plus OAuth PKCE, JWT access token profile, and WebAuthn helpers.
 * RFC 7617 §2, §2.1; RFC 6750 §2.1, §3; RFC 7616 §3.3-3.5; RFC 7636 §4-§7;
 * RFC 9068 §2, §4; W3C WebAuthn Level 3.
 * @see https://www.rfc-editor.org/rfc/rfc7617.html#section-2
 * @see https://www.rfc-editor.org/rfc/rfc7616.html
 * @see https://www.rfc-editor.org/rfc/rfc7636.html
 * @see https://www.w3.org/TR/webauthn-3/
 */

export * from './auth/index.js';
