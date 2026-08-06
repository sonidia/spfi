export interface TrackingNumberRequest {
  state: string;
  from: number;
  to: number;
  carrier: string;
}

export interface TrackingNumberResponse {
  trackingNr: string;
}
