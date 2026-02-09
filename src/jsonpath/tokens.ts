/**
 * JSONPath lexer token definitions.
 * RFC 9535 §2.1, §2.3.
 */

// RFC 9535 §2.1: Integers MUST be within I-JSON range.
export const I_JSON_MIN = -(2 ** 53) + 1;
export const I_JSON_MAX = 2 ** 53 - 1;

interface TokenBase<TType extends string, TValue> {
    type: TType;
    value: TValue;
    pos: number;
}

export type Token =
    | TokenBase<'ROOT', '$'>
    | TokenBase<'CURRENT', '@'>
    | TokenBase<'DOT', '.'>
    | TokenBase<'DOTDOT', '..'>
    | TokenBase<'LBRACKET', '['>
    | TokenBase<'RBRACKET', ']'>
    | TokenBase<'LPAREN', '('>
    | TokenBase<'RPAREN', ')'>
    | TokenBase<'COLON', ':'>
    | TokenBase<'COMMA', ','>
    | TokenBase<'WILDCARD', '*'>
    | TokenBase<'QUESTION', '?'>
    | TokenBase<'NOT', '!'>
    | TokenBase<'AND', '&&'>
    | TokenBase<'OR', '||'>
    | TokenBase<'EQ', '=='>
    | TokenBase<'NE', '!='>
    | TokenBase<'LT', '<'>
    | TokenBase<'LE', '<='>
    | TokenBase<'GT', '>'>
    | TokenBase<'GE', '>='>
    | TokenBase<'STRING', string>
    | TokenBase<'NUMBER', number>
    | TokenBase<'TRUE', true>
    | TokenBase<'FALSE', false>
    | TokenBase<'NULL', null>
    | TokenBase<'NAME', string>
    | TokenBase<'EOF', null>;

export type TokenType = Token['type'];
export type TokenOf<TType extends TokenType> = Extract<Token, { type: TType }>;
export type TokenValue<TType extends TokenType> = TokenOf<TType>['value'];
