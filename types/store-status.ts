export type CheckSeverity = "ok" | "warning" | "danger" | "neutral";

export type CheckPlatform = "shopify";
export type ProxyMode = "common-proxy" | "separate-proxy" | "no-proxy";
export type BatchStatus = "queued" | "checking" | "done" | "error";
export type StatusRowState = BatchStatus;
export type StoreLifecycleStatus = "alive" | "dead";

export interface CheckItem {
  key: string;
  title: string;
  status: string;
  severity: CheckSeverity;
  details: string[];
}

export interface StoreCheckResult {
  input: string;
  platform: CheckPlatform;
  storeStatus: StoreLifecycleStatus;
  normalizedUrl: string;
  host: string;
  proxyIp?: string;
  checkedAt: string;
  verdict: {
    status: string;
    severity: CheckSeverity;
    summary: string;
  };
  checks: CheckItem[];
  limitations: string[];
}
