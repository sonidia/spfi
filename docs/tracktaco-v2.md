# Tracktaco v2 tracking integration

The order list's **Add tracking** action uses Tracktaco's v2 search-and-reveal
workflow. The Tracktaco host is fixed to `https://v2.tracktaco.com`; operators
only configure a v2 API key in Settings.

## Request flow

1. The client sends the selected order's carrier, destination, and seven-day
   shipment window to `POST /api/tracktaco/get-trackingnr`.
2. The server calls `POST /v2/tns/search` with `transit` status. When a city is
   available, the batch includes an exact city query followed by a broader
   country/state fallback when that scope is available. Search does not spend
   credits.
3. Candidate `tn_id` values are deduplicated in query priority order.
4. The server calls `POST /v2/tns/reveal` for one candidate at a time and stops
   after the first successful reveal. At most three candidates are attempted,
   which avoids revealing and charging for an entire result batch.
5. The revealed tracking number and carrier are passed to Shopify's fulfillment
   mutation with the carrier's official tracking URL.

Tracktaco authentication uses `Authorization: Bearer <api-key>`. Search and
reveal errors are mapped to the app's standard H3 error response; per-item
`already_revealed` and `not_found` outcomes move to the next candidate, while
`insufficient_credits` stops immediately with HTTP 402.

## v2 contract used

- `POST /v2/tns/search`
  - body: `{ searches: [{ filter, page_size }] }`
  - result IDs: `searches[].results[].tn_id`
- `POST /v2/tns/reveal`
  - body: `{ tn_ids: [tn_id] }`
  - successful result: `results[].outcome === "revealed"`
  - tracking number: `results[].tracking_number`
- Error envelope:
  `{ error: { code, message, doc_url, request_id } }`

Official specification: https://v2.tracktaco.com/v2/docs.md
