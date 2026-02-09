/**
 * JSONPath lexer token definitions.
 * RFC 9535 §2.1, §2.3.
 */

// RFC 9535 §2.1: Integers MUST be within I-JSON range.
export const I_JSON_MIN = -(2 ** 53) + 1;
export const I_JSON_MAX = 2 ** 53 - 1;

export type TokenType =
    | 'ROOT'          // $
    | 'CURRENT'       // @
    | 'DOT'           // .
    | 'DOTDOT'        // ..
    | 'LBRACKET'      // [
    | 'RBRACKET'      // ]
    | 'LPAREN'        // (
    | 'RPAREN'        // )
    | 'COLON'         // :
    | 'COMMA'         // ,
    | 'WILDCARD'      // *
    | 'QUESTION'      // ?
    | 'NOT'           // !
    | 'AND'           // &&
    | 'OR'            // ||
    | 'EQ'            // ==
    | 'NE'            // !=
    | 'LT'            // <
    | 'LE'            // <=
    | 'GT'            // >
    | 'GE'            // >=
    | 'STRING'        // 'string' or "string"
    | 'NUMBER'        // 123, -456, 3.14
    | 'TRUE'          // true
    | 'FALSE'         // false
    | 'NULL'          // null
    | 'NAME'          // member-name-shorthand
    | 'EOF';

export interface Token {
    type: TokenType;
    value: string | number | boolean | null;
    pos: number;
}
