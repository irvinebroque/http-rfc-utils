/**
 * JSONPath query expressions per RFC 9535.
 * RFC 9535 §§2.1-2.7.
 * @see https://www.rfc-editor.org/rfc/rfc9535.html
 */

export type {
    JsonPathQuery,
    JsonPathSegment,
    JsonPathSelector,
    JsonPathNode,
    JsonPathOptions,
} from './types/jsonpath.js';

export {
    parseJsonPath,
    queryJsonPath,
    queryJsonPathNodes,
    isValidJsonPath,
    formatNormalizedPath,
    compileJsonPath,
} from './jsonpath/index.js';
