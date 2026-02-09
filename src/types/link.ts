/**
 * Linking and pagination-related types.
 * RFC 8288, RFC 9264, RFC 9727.
 */
import type { SfBareItem } from './structured-fields.js';

export interface PaginationLinks {
    self: string;
    first: string;
    next?: string;
    prev?: string;
    last: string;
}

export interface LinkDefinition {
    href: string;
    rel: string;
    type?: string;
    title?: string;
    titleLang?: string;
    hreflang?: string | string[];
    media?: string;
    anchor?: string;
    rev?: string;
    [key: string]: string | string[] | undefined;
}

export interface LinkTemplate {
    template: string;
    rel?: string;
    anchor?: string;
    varBase?: string;
    params?: Record<string, SfBareItem>;
}

export interface ExpandedLinkTemplate {
    href: string;
    rel?: string;
    anchor?: string;
    params: Record<string, SfBareItem>;
    variableUris: Record<string, string>;
}

export interface InternationalizedValue {
    value: string;
    language?: string;
}

export interface LinksetTarget {
    href: string;
    type?: string;
    hreflang?: string[];
    title?: string;
    'title*'?: InternationalizedValue[];
    media?: string;
    [key: string]: string | string[] | InternationalizedValue[] | undefined;
}

export interface LinksetContext {
    anchor?: string;
    [relationType: string]: LinksetTarget[] | string | undefined;
}

export interface Linkset {
    linkset: LinksetContext[];
}

export interface LinksetJsonOptions {
    groupByAnchor?: boolean;
}

export interface ApiCatalogLink {
    href: string;
    type?: string;
    title?: string;
    hreflang?: string;
}

export interface ApiCatalogApi {
    anchor: string;
    'service-desc'?: LinksetTarget[];
    'service-doc'?: LinksetTarget[];
    'service-meta'?: LinksetTarget[];
    status?: LinksetTarget[];
}

export interface ApiCatalogOptions {
    anchor: string;
    apis?: ApiCatalogApi[];
    items?: ApiCatalogLink[];
    nested?: string[];
    profile?: boolean;
}

export interface ApiCatalog extends Linkset {
    profile?: string;
}
