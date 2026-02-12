/**
 * Cookie types per RFC 6265.
 * @see https://www.rfc-editor.org/rfc/rfc6265.html
 */

export interface CookieAttributes {
    expires?: Date;
    maxAge?: number;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    extensions?: Record<string, string | undefined>;
}

export interface SetCookie {
    name: string;
    value: string;
    attributes?: CookieAttributes;
}

export interface StoredCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    creationTime: Date;
    lastAccessTime?: Date;
    expires?: Date;
    secureOnly?: boolean;
    httpOnly?: boolean;
    hostOnly?: boolean;
}

export interface CookieHeaderOptions {
    now?: Date;
    includeHttpOnly?: boolean;
    isSecure?: boolean;
}
