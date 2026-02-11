/**
 * JSON Patch document and operation type contracts.
 * RFC 6902.
 * @see https://www.rfc-editor.org/rfc/rfc6902.html
 */

export type JsonPatchPrimitive = string | number | boolean | null;

export interface JsonPatchObject {
    [key: string]: JsonPatchValue;
}

export type JsonPatchArray = JsonPatchValue[];

export type JsonPatchValue = JsonPatchPrimitive | JsonPatchObject | JsonPatchArray;

export interface JsonPatchBaseOperation {
    op: JsonPatchOperationType;
    path: string;
}

export interface JsonPatchAddOperation extends JsonPatchBaseOperation {
    op: 'add';
    value: JsonPatchValue;
}

export interface JsonPatchRemoveOperation extends JsonPatchBaseOperation {
    op: 'remove';
}

export interface JsonPatchReplaceOperation extends JsonPatchBaseOperation {
    op: 'replace';
    value: JsonPatchValue;
}

export interface JsonPatchMoveOperation extends JsonPatchBaseOperation {
    op: 'move';
    from: string;
}

export interface JsonPatchCopyOperation extends JsonPatchBaseOperation {
    op: 'copy';
    from: string;
}

export interface JsonPatchTestOperation extends JsonPatchBaseOperation {
    op: 'test';
    value: JsonPatchValue;
}

export type JsonPatchOperationType = 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';

export type JsonPatchOperation =
    | JsonPatchAddOperation
    | JsonPatchRemoveOperation
    | JsonPatchReplaceOperation
    | JsonPatchMoveOperation
    | JsonPatchCopyOperation
    | JsonPatchTestOperation;

export type JsonPatchDocument = JsonPatchOperation[];
