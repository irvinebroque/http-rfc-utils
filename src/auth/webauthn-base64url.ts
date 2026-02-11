/**
 * WebAuthn base64url helpers.
 * RFC 4648 Section 5 and WebAuthn Level 3 parse-from-JSON algorithms.
 * @see https://www.rfc-editor.org/rfc/rfc4648.html#section-5
 * @see https://www.w3.org/TR/webauthn-3/#sctn-parseCreationOptionsFromJSON
 */

const WEBAUTHN_BASE64URL_RE = /^[A-Za-z0-9_-]*$/;

/**
 * Parse a strict unpadded base64url string into bytes.
 * Returns null when syntax is invalid.
 */
export function parseWebauthnBase64url(value: string): Uint8Array | null {
    if (!isWebauthnBase64url(value)) {
        return null;
    }

    const mod = value.length % 4;
    if (mod === 1) {
        return null;
    }

    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = mod === 0 ? normalized : `${normalized}${'='.repeat(4 - mod)}`;

    let decoded: Buffer;
    try {
        decoded = Buffer.from(padded, 'base64');
    } catch {
        return null;
    }

    const bytes = new Uint8Array(decoded);
    if (formatWebauthnBase64url(bytes) !== value) {
        return null;
    }

    return bytes;
}

/**
 * Format bytes as unpadded base64url.
 */
export function formatWebauthnBase64url(value: Uint8Array): string {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

/**
 * Validate strict unpadded base64url syntax.
 * Throws Error on invalid syntax.
 */
export function validateWebauthnBase64url(value: string): void {
    if (!isWebauthnBase64url(value)) {
        throw new Error('WebAuthn base64url value must use the URL-safe alphabet without padding or whitespace.');
    }

    if (value.length % 4 === 1) {
        throw new Error('WebAuthn base64url value has invalid length for base64url decoding.');
    }

    if (parseWebauthnBase64url(value) === null) {
        throw new Error('WebAuthn base64url value is not a canonical base64url encoding.');
    }
}

function isWebauthnBase64url(value: string): boolean {
    return value.length > 0
        && !value.includes('=')
        && !/\s/.test(value)
        && WEBAUTHN_BASE64URL_RE.test(value);
}
