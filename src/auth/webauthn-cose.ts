/**
 * WebAuthn COSE algorithm helpers.
 * WebAuthn Level 3 algorithm identifier handling and RFC 9053 COSE algorithms.
 * @see https://www.w3.org/TR/webauthn-3/#sctn-alg-identifier
 * @see https://www.rfc-editor.org/rfc/rfc9053.html#section-2
 */

const DEFAULT_WEBAUTHN_COSE_ALGORITHM_IDS = [-7, -257, -8] as const;

export const WEBAUTHN_COSE_ALGORITHM_IDS: readonly number[] = Object.freeze([...DEFAULT_WEBAUTHN_COSE_ALGORITHM_IDS]);

/**
 * Validate a COSE algorithm identifier against an allowlist.
 * Throws Error for invalid semantic values.
 */
export function validateWebauthnCoseAlgorithm(algorithm: number, allowedAlgorithms?: readonly number[]): void {
    if (!Number.isInteger(algorithm)) {
        throw new Error(`WebAuthn COSE algorithm id must be an integer. Received: ${String(algorithm)}`);
    }

    const allowlist = allowedAlgorithms ?? WEBAUTHN_COSE_ALGORITHM_IDS;
    if (allowlist.length === 0) {
        throw new Error('WebAuthn COSE algorithm allowlist must not be empty.');
    }

    for (const value of allowlist) {
        if (!Number.isInteger(value)) {
            throw new Error(`WebAuthn COSE algorithm allowlist contains non-integer value: ${String(value)}`);
        }
    }

    if (!allowlist.includes(algorithm)) {
        throw new Error(`WebAuthn COSE algorithm id ${algorithm} is not allowed.`);
    }
}
