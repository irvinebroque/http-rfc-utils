/**
 * Reporting API type contracts.
 * W3C Reporting API.
 * @see https://www.w3.org/TR/reporting-1/
 */

export interface ReportingEndpoint {
    name: string;
    url: string;
    failures: number;
}

export interface ReportingEndpointDefinition {
    name: string;
    url: string;
}

export interface ProcessReportingEndpointsOptions {
    responseIsHttpsModern?: boolean;
    isOriginPotentiallyTrustworthy?: (url: URL) => boolean;
}

export interface ReportingReportBody {
    [member: string]: unknown;
}

export interface ReportingReport {
    body: ReportingReportBody | null;
    url: string;
    userAgent: string;
    destination: string;
    type: string;
    timestamp: number;
    attempts: number;
}

export interface ReportingSerializedReport {
    age: number;
    type: string;
    url: string;
    user_agent: string;
    body: ReportingReportBody | null;
}

export interface ReportingSerializationOptions {
    now?: number | Date;
}
