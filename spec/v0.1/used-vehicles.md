# Used Vehicle Retail Profile 0.1

This document is normative. It defines `dealeragent.used-vehicle.read/0.1`, an
optional retail profile for mileage, inventory tenure, vehicle-history reports,
title, inspection, certification, warranty, and public reconditioning facts.
An implementation that publishes used, certified, or demo vehicles without this
profile remains Core-compatible, but it cannot claim structured used-vehicle
disclosure.

## 1. Tool and data boundary

The profile adds `dealeragent.inventory.get_used_vehicle_details`. The tool is a
public retail read controlled by dealer policy. It does not grant access to a
DMS, service history, acquisition cost, appraisal, auction record, or private
reconditioning work order.

A response [DAP-UV-001] MUST describe a `used`, `certified`, or `demo` vehicle already
published by the inventory-read profile. A gateway [DAP-UV-002] MUST return
`dealeragent.resource.not_found` without revealing whether an unpublished or
cross-rooftop VIN exists.

## 2. Odometer

The response separates the numeric reading, unit, disclosure status, observation
time, provenance, and freshness. A client [DAP-UV-003] MUST NOT describe an odometer as
actual when its status is `not_actual`, `exceeds_mechanical_limits`, `exempt`, or
`unknown`. Gateways [DAP-UV-004] MUST NOT convert miles and kilometers without retaining
the original unit and recording the conversion in provenance.

Inventory search accepts `odometer_min` and `odometer_max` as unit-bearing
distances. A comparison across units [DAP-UV-005] MUST use an explicit conversion rule;
it cannot compare bare numbers.

## 3. Inventory tenure

`stocked_at` is when the dealer accepted the unit into owned or consigned retail
inventory. `first_public_listing_at` is when it first appeared in a public retail
listing. These events are not interchangeable. Recon time remains part of dealer
inventory age unless the dealer's named source uses another definition.

`age_days` [DAP-UV-006] MUST include `age_as_of`, `age_basis`, provenance, and freshness.
When `age_basis` is `stocked_at` or `first_public_listing_at`, the gateway
[DAP-UV-007] MUST calculate complete elapsed 24-hour periods from that timestamp and
[DAP-UV-008] MUST reject a future basis timestamp. When a DMS supplies only a reported
days-in-stock value, the gateway [DAP-UV-009] MUST use `source_reported`, retain the
source value and observation in provenance, and avoid presenting a derived calendar
date as authoritative.

Clients [DAP-UV-010] MUST say “in dealer inventory for N days as of DATE” or an
equivalent dated statement. An undated `days_on_lot` scalar is not a conforming
inventory-age claim.

## 4. Vehicle-history providers

`history_reports` is provider-neutral. Examples of provider identifiers include
`com.carfax` and `com.experian.autocheck`; their inclusion does not assert a
partnership, API availability, or redistribution right. Any provider may be
represented with a stable reverse-domain identifier.

Each report [DAP-UV-011] MUST state provider, availability status, access method,
observation time, provenance, freshness, and whether summary sharing is authorized.
If `summary_sharing_authorized` is false, the gateway [DAP-UV-012] MUST omit `summary`.
A gateway [DAP-UV-013] MUST expose only report links and summary fields permitted by
the dealer's current provider agreement. Provider credentials, tokens, signed report
URLs intended only for backend use, and licensed raw report content [DAP-UV-014] MUST
NOT appear in protocol responses, logs, or conformance evidence.

`no_events_reported`, `no_damage_reported`, and `no_brands_reported` describe the
contents of a named report at an observation time. A client [DAP-UV-015] MUST NOT
translate any of them into “accident-free,” “damage-free,” “clean history,” or a
guarantee that no event occurred.

A missing or inaccessible report [DAP-UV-016] MUST remain `not_available`, `restricted`,
or `unknown`; it [DAP-UV-017] MUST NOT be treated as favorable evidence. Provider
summaries [DAP-UV-018] MUST retain their own source and freshness rather than inheriting
the vehicle listing's authority.

## 5. Conflicts and uncertainty

When providers, title records, the dealer, or an inspection disagree on a material
fact, the gateway [DAP-UV-019] MUST add a `discrepancies` entry naming at least two
sources and [DAP-UV-020] MUST NOT silently select the more favorable value. An unresolved
odometer, title-brand, structural-damage, or accident discrepancy [DAP-UV-021] MUST be
presented to the shopper before a consented handoff about that vehicle.

## 6. Condition, certification, warranty, and recon

Condition grades [DAP-UV-022] MUST name their grading system; a bare score or adjective
cannot be compared across inspection providers. Inspection components use explicit
`pass`, `attention`, `fail`, `not_inspected`, or `unknown` states.

Certification distinguishes `manufacturer_cpo`, `dealer_certified`,
`third_party_certified`, `not_certified`, and `unknown`. A client [DAP-UV-023] MUST NOT
describe dealer or third-party certification as manufacturer CPO. A manufacturer-CPO
claim [DAP-UV-024] MUST name the program and carry dealer-authorized provenance.

Warranty coverage separates included, remaining-factory, optional, expired, and
unknown status. An optional service contract [DAP-UV-025] MUST NOT be described as an
included warranty.

Reconditioning exposes only dealer-approved retail disclosures and completion state.
The profile [DAP-UV-026] MUST NOT expose acquisition cost, recon cost, internal labor,
technician notes, or other nonpublic operational data. `completed` [DAP-UV-027] MUST NOT
be used when any disclosed safety item remains planned, in progress, declined, or
unknown.

## 7. Search summaries

The base vehicle object may carry `used_vehicle`, a compact summary containing
inventory tenure, history-report status, and certification type. This enables search
filters without copying licensed report content into every result. The full facts,
source distinctions, and discrepancies remain in
`dealeragent.inventory.get_used_vehicle_details`.

Search results [DAP-UV-028] MUST omit used-vehicle filters that the gateway cannot
evaluate from its authorized sources rather than treating unknown values as a match or
non-match. A vehicle returned under a history or certification filter [DAP-UV-029] MUST
include the compact summary that justified the match.
