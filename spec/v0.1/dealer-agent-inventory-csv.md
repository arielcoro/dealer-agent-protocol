# Dealer Agent Inventory CSV 0.1

This document is normative. It defines the minimum zero-server inventory feed used by `/.well-known/dealer-agent.json`. The first adapter target is a Dealer.com-style scheduled inventory export; the format is vendor-neutral and does not imply an endorsement or partnership.

## Encoding and transport

- UTF-8 CSV with a header row and RFC 4180 quoting.
- `Content-Type: text/csv; charset=utf-8`.
- HTTPS only in production.
- One row per vehicle and rooftop.
- Empty means unknown. It never means zero, false, included, or not applicable.
- A file publication is dealer-asserted. It [DAP-CSV-001] MUST NOT claim `verified_current` availability.

## Required columns

| Column | Type | Rule |
|---|---|---|
| `organization_id` | identifier | Stable group or dealer ID. |
| `rooftop_id` | identifier | Stable selling rooftop ID. |
| `vin` | string | 17-character VIN. |
| `stock_number` | string | Dealer stock number. |
| `year` | integer | Model year. |
| `make` | string | Manufacturer. |
| `model` | string | Model. |
| `condition` | enum | `new`, `used`, or `certified`. |
| `listing_url` | HTTPS URL | Public canonical vehicle detail page. |
| `observed_at` | RFC 3339 timestamp | When the source row was observed. |

## Retail disclosure columns

| Column | Type | Meaning |
|---|---|---|
| `advertised_price_minor` | integer | Generally available advertised price in minor units. |
| `currency` | ISO 4217 | Currency for every monetary column; `USD` by default only when explicitly configured. |
| `required_dealer_charges_json` | JSON array | Itemized labels, amounts, payees, required status, and inclusion in advertised price. |
| `conditional_adjustments_json` | JSON array | Discounts or surcharges with eligibility and stacking rules. |
| `government_charges_status` | enum | `unknown`, `estimated`, `calculated`, or `not_applicable`. |
| `availability_status` | enum | `available`, `unavailable`, `in_transit`, `reserved`, or `unknown`; asserted only in CSV. |

## Optional vehicle columns

`trim`, `vehicle_type`, `body_style`, `exterior_color`, `interior_color`,
`odometer_value`, `odometer_unit`, `stocked_at`, `first_public_listing_at`,
`history_reports_json`, `certification_type`, `image_urls_json`, and
`features_json` MAY be supplied. Unknown values remain empty.

`stocked_at` and `first_public_listing_at` are RFC 3339 timestamps with explicit
offsets and retain their distinct meanings from `used-vehicles.md`.
`history_reports_json` is a JSON array of provider-neutral report references.
Provider-specific URL columns MAY be accepted by an adapter, but the normative
output uses stable provider identifiers. A URL alone does not authorize summary
redistribution; adapters [DAP-CSV-003] MUST set `summary_sharing_authorized` false unless
the dealer's provider agreement affirmatively permits mapped summary fields.

When `odometer_value` is present, `odometer_unit` [DAP-CSV-004] MUST be `mi` or `km`.
Adapters [DAP-CSV-005] MUST NOT assume a unit unless the rooftop configuration supplies
that default explicitly.

## Example

See [`examples/csv/example-inventory.csv`](examples/csv/example-inventory.csv). Adapters [DAP-CSV-002] MUST reject invalid JSON cells, duplicate `(rooftop_id, vin)` rows, invalid VINs, negative monetary amounts, negative odometers, and timestamps in the future beyond configured clock skew.
