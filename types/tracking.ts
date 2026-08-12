export interface TrackingNumberRequest {
  state: string;
  from: number;
  to: number;
  carrier: string;
}

export interface TrackingProviderSettings {
  baseUrl: string;
  apiKey: string;
}

export interface TrackingNumberProxyRequest extends TrackingNumberRequest {
  provider: TrackingProviderSettings;
}

export interface TrackingNumberResponse {
  trackingNr: string;
}
