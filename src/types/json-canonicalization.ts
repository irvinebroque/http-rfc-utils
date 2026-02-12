/**
 * JSON Canonicalization Scheme (JCS) type contracts.
 * RFC 8785.
 * @see https://www.rfc-editor.org/rfc/rfc8785.html
 */

export type CanonicalJsonPrimitive = string | number | boolean | null;

export interface CanonicalJsonObject {
    [key: string]: CanonicalJsonValue;
}

export type CanonicalJsonArray = CanonicalJsonValue[];

export type CanonicalJsonValue = CanonicalJsonPrimitive | CanonicalJsonObject | CanonicalJsonArray;
