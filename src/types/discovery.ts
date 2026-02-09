/**
 * Discovery and metadata document types.
 * RFC 9309, RFC 9116, RFC 7033, RFC 6415.
 */

// Robots Exclusion Protocol (RFC 9309)
export interface RobotsGroup {
    userAgents: string[];
    allow: string[];
    disallow: string[];
    crawlDelay?: number;
}

export interface RobotsConfig {
    groups: RobotsGroup[];
    sitemaps: string[];
    host?: string;
}

// security.txt (RFC 9116)
export interface SecurityTxt {
    contact: string[];
    expires: Date;
    encryption?: string[];
    acknowledgments?: string[];
    preferredLanguages?: string[];
    canonical?: string[];
    policy?: string[];
    hiring?: string[];
    extensions?: Record<string, string[]>;
}

export interface SecurityTxtIssue {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

// WebFinger (RFC 7033)
export interface WebFingerLink {
    rel: string;
    type?: string;
    href?: string;
    titles?: Record<string, string>;
    properties?: Record<string, string | null>;
}

export interface WebFingerResponse {
    subject: string;
    aliases?: string[];
    properties?: Record<string, string | null>;
    links?: WebFingerLink[];
}

// Host Metadata (RFC 6415)
export interface HostMetaLink {
    rel: string;
    type?: string;
    href?: string;
    template?: string;
}

export interface HostMeta {
    links: HostMetaLink[];
    properties?: Record<string, string | null>;
}
