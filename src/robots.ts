/**
 * Robots Exclusion Protocol per RFC 9309.
 * RFC 9309 §2: robots.txt file format and matching rules.
 * @see https://www.rfc-editor.org/rfc/rfc9309.html
 */

import type { RobotsConfig, RobotsGroup } from './types.js';

export type { RobotsConfig, RobotsGroup } from './types.js';

// RFC 9309 §2.4: Lines with more than 500 bytes SHOULD be ignored.
const MAX_LINE_BYTES = 500;
const UTF8_ENCODER = new TextEncoder();

interface CompiledRule {
    glob: string;
    length: number;
}

interface CompiledRobotsGroup {
    allow: CompiledRule[];
    disallow: CompiledRule[];
}

const COMPILED_ROBOTS_GROUPS = new WeakMap<RobotsGroup, CompiledRobotsGroup>();

/**
 * Check if a line exceeds the 500-byte limit per RFC 9309 §2.4.
 */
function exceedsMaxLineBytes(line: string): boolean {
    return UTF8_ENCODER.encode(line).byteLength > MAX_LINE_BYTES;
}

/**
 * Strip BOM and normalize line endings.
 */
function normalizeText(text: string): string {
    // Strip UTF-8 BOM.
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }
    // Normalize line endings to LF.
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Parse a robots.txt file into a structured RobotsConfig.
 * RFC 9309 §2.1-2.2: Parsing rules for groups, directives, and comments.
 */
export function parseRobotsTxt(text: string): RobotsConfig {
    const normalized = normalizeText(text);
    const lines = normalized.split('\n');

    const groups: RobotsGroup[] = [];
    const sitemaps: string[] = [];
    let host: string | undefined;

    let currentGroup: RobotsGroup | null = null;
    let expectingRules = false;

    for (const rawLine of lines) {
        // RFC 9309 §2.4: Lines over 500 bytes SHOULD be ignored.
        if (exceedsMaxLineBytes(rawLine)) {
            continue;
        }

        // RFC 9309 §2.3: Strip comments.
        const commentIdx = rawLine.indexOf('#');
        const line = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).trim();

        if (line === '') {
            // Empty line ends the current group.
            if (currentGroup) {
                groups.push(currentGroup);
                currentGroup = null;
                expectingRules = false;
            }
            continue;
        }

        // Parse field: value.
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) {
            continue;
        }

        const field = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();

        if (field === 'user-agent') {
            if (expectingRules) {
                // We already saw rules for this group, so start a new group.
                if (currentGroup) {
                    groups.push(currentGroup);
                }
                currentGroup = { userAgents: [value], allow: [], disallow: [] };
                expectingRules = false;
            } else if (currentGroup) {
                // Multiple User-agent lines before any rules.
                currentGroup.userAgents.push(value);
            } else {
                currentGroup = { userAgents: [value], allow: [], disallow: [] };
            }
        } else if (field === 'allow') {
            if (!currentGroup) {
                continue;
            }
            expectingRules = true;
            if (value !== '') {
                currentGroup.allow.push(value);
            }
        } else if (field === 'disallow') {
            if (!currentGroup) {
                continue;
            }
            expectingRules = true;
            if (value !== '') {
                currentGroup.disallow.push(value);
            }
        } else if (field === 'crawl-delay') {
            if (!currentGroup) {
                continue;
            }
            expectingRules = true;
            const delay = parseFloat(value);
            if (!isNaN(delay) && delay >= 0) {
                currentGroup.crawlDelay = delay;
            }
        } else if (field === 'sitemap') {
            // RFC 9309 §2.2.4: Sitemap is a non-group directive.
            sitemaps.push(value);
        } else if (field === 'host') {
            // Yandex extension.
            host = value;
        }
    }

    // Push the last group if still open.
    if (currentGroup) {
        groups.push(currentGroup);
    }

    const config: RobotsConfig = { groups, sitemaps };
    if (host !== undefined) {
        config.host = host;
    }
    return config;
}

/**
 * Serialize a RobotsConfig to spec-compliant robots.txt text.
 * RFC 9309 §2: Output format.
 */
export function formatRobotsTxt(config: RobotsConfig): string {
    const lines: string[] = [];

    for (const [i, group] of config.groups.entries()) {
        if (!group) {
            continue;
        }

        if (i > 0) {
            lines.push('');
        }

        for (const ua of group.userAgents) {
            lines.push(`User-agent: ${ua}`);
        }

        for (const rule of group.allow) {
            lines.push(`Allow: ${rule}`);
        }

        for (const rule of group.disallow) {
            lines.push(`Disallow: ${rule}`);
        }

        if (group.crawlDelay !== undefined) {
            lines.push(`Crawl-delay: ${group.crawlDelay}`);
        }
    }

    for (const sitemap of config.sitemaps) {
        if (lines.length > 0) {
            lines.push('');
        }
        lines.push(`Sitemap: ${sitemap}`);
    }

    if (config.host !== undefined) {
        if (lines.length > 0) {
            lines.push('');
        }
        lines.push(`Host: ${config.host}`);
    }

    // Ensure trailing newline.
    lines.push('');
    return lines.join('\n');
}

/**
 * Find the most specific matching group for a user agent.
 * RFC 9309 §2.3: User-agent matching is case-insensitive substring.
 * Returns the matched group, or the wildcard group, or null.
 */
export function matchUserAgent(config: RobotsConfig, userAgent: string): RobotsGroup | null {
    const ua = userAgent.toLowerCase();

    // RFC 9309 §2.3: Find the most specific matching user agent (longest substring match).
    let bestGroup: RobotsGroup | null = null;
    let bestLength = 0;
    let wildcardGroup: RobotsGroup | null = null;

    for (const group of config.groups) {
        for (const groupUa of group.userAgents) {
            if (groupUa === '*') {
                wildcardGroup = group;
                continue;
            }
            const normalizedGroupUa = groupUa.toLowerCase();
            if (ua.includes(normalizedGroupUa) && normalizedGroupUa.length > bestLength) {
                bestGroup = group;
                bestLength = normalizedGroupUa.length;
            }
        }
    }

    return bestGroup ?? wildcardGroup ?? null;
}

/**
 * Compile a robots.txt path pattern to a wildcard glob.
 * RFC 9309 §2.2.2: `*` matches zero or more characters; terminal `$` anchors end of URL.
 */
function compilePathPattern(pattern: string): string {
    const anchoredEnd = pattern.endsWith('$');
    const corePattern = anchoredEnd ? pattern.slice(0, -1) : pattern;

    // RFC 9309 §2.2.2 matching is prefix-based unless terminal `$` is present.
    // Use an explicit trailing wildcard for unanchored patterns.
    return anchoredEnd ? corePattern : `${corePattern}*`;
}

/**
 * Match a path against a `*`-wildcard glob in linear time.
 */
function wildcardMatchLinear(glob: string, value: string): boolean {
    let globIndex = 0;
    let valueIndex = 0;
    let starIndex = -1;
    let matchIndex = 0;

    while (valueIndex < value.length) {
        if (globIndex < glob.length && glob.charAt(globIndex) === '*') {
            starIndex = globIndex;
            matchIndex = valueIndex;
            globIndex++;
        } else if (globIndex < glob.length && glob.charAt(globIndex) === value.charAt(valueIndex)) {
            globIndex++;
            valueIndex++;
        } else if (starIndex >= 0) {
            globIndex = starIndex + 1;
            matchIndex++;
            valueIndex = matchIndex;
        } else {
            return false;
        }
    }

    while (globIndex < glob.length && glob.charAt(globIndex) === '*') {
        globIndex++;
    }

    return globIndex === glob.length;
}

/**
 * Get the effective path length for longest-match comparison.
 * RFC 9309 §2.2: The most specific rule (longest path) wins.
 */
function effectiveLength(pattern: string): number {
    // Remove trailing `$` and `*` for length comparison purposes.
    return pattern.replace(/\$$/g, '').replace(/\*/g, '').length;
}

function getCompiledGroup(group: RobotsGroup): CompiledRobotsGroup {
    const cached = COMPILED_ROBOTS_GROUPS.get(group);
    if (cached) {
        return cached;
    }

    const compiled: CompiledRobotsGroup = {
        allow: group.allow.map((pattern) => ({
            glob: compilePathPattern(pattern),
            length: effectiveLength(pattern),
        })),
        disallow: group.disallow.map((pattern) => ({
            glob: compilePathPattern(pattern),
            length: effectiveLength(pattern),
        })),
    };

    // RFC 9309 §2.2: Only longest matching rule matters.
    // Sort once so checks can stop at first match.
    compiled.allow.sort((left, right) => right.length - left.length);
    compiled.disallow.sort((left, right) => right.length - left.length);

    COMPILED_ROBOTS_GROUPS.set(group, compiled);
    return compiled;
}

/**
 * Check if a path is allowed for a given user agent.
 * RFC 9309 §2.2: Longest-match-wins for Allow vs Disallow.
 *
 * @param config - Parsed robots.txt configuration
 * @param userAgent - The user agent string to check
 * @param path - The URL path to check (e.g. "/foo/bar")
 * @returns true if allowed, false if disallowed
 */
export function isAllowed(config: RobotsConfig, userAgent: string, path: string): boolean {
    const group = matchUserAgent(config, userAgent);
    if (!group) {
        // No matching group — allowed by default.
        return true;
    }

    // RFC 9309 §2.2: Longest match wins. If tied, Allow takes precedence.
    let bestAllow = -1;
    let bestDisallow = -1;
    const compiledGroup = getCompiledGroup(group);

    for (let index = 0; index < compiledGroup.allow.length; index++) {
        const rule = compiledGroup.allow[index]!;
        if (wildcardMatchLinear(rule.glob, path)) {
            bestAllow = rule.length;
            break;
        }
    }

    for (let index = 0; index < compiledGroup.disallow.length; index++) {
        const rule = compiledGroup.disallow[index]!;
        if (wildcardMatchLinear(rule.glob, path)) {
            bestDisallow = rule.length;
            break;
        }
    }

    // No matching rules — allowed.
    if (bestAllow < 0 && bestDisallow < 0) {
        return true;
    }

    // RFC 9309 §2.2: Most specific wins; equal length means Allow wins.
    return bestAllow >= bestDisallow;
}
