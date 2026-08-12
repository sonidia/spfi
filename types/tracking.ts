export type TrackingCarrier = "fedex" | "ups" | "dhl";

export interface TrackingDestination {
  country?: string;
  state?: string;
  city?: string;
}

export interface TrackingDateRange {
  from: string;
  to: string;
}

export interface TrackingNumberRequest {
  carrier: TrackingCarrier;
  destination: TrackingDestination;
  shippedBetween: TrackingDateRange;
}

export interface TrackingProviderSettings {
  apiKey: string;
}

export interface TrackingNumberProxyRequest extends TrackingNumberRequest {
  provider: TrackingProviderSettings;
}

export interface TrackingNumberResponse {
  trackingNumber: string;
  carrier: TrackingCarrier;
  service?: string;
  creditsRemaining?: number;
}
