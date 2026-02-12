/**
 * JSON Merge Patch type contracts.
 * RFC 7396.
 * @see https://www.rfc-editor.org/rfc/rfc7396.html
 */

export type JsonMergePatchPrimitive = string | number | boolean | null;

export interface JsonMergePatchObject {
    [key: string]: JsonMergePatchValue;
}

export type JsonMergePatchArray = JsonMergePatchValue[];

export type JsonMergePatchValue = JsonMergePatchPrimitive | JsonMergePatchObject | JsonMergePatchArray;

export type JsonMergePatchDocument = JsonMergePatchValue;
