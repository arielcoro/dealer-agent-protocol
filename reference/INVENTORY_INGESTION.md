# Inventory ingestion for a Dealer Agent Gateway

This document is non-normative implementation guidance. Dealer Agent Protocol
defines the retail facts a gateway returns. It does not require a particular
inventory vendor, data pipeline, or acquisition method.

## The short answer

A production Dealer Agent Gateway should not treat uncontrolled website
scraping as its primary system of record. The recommended order is:

1. **Authorized provider feed or API** from an inventory manager, website
   provider, or dealer-approved integration.
2. **Dealer-controlled scheduled export** over SFTP, object storage, or HTTPS,
   including the open `dealer-agent-inventory-csv/0.1` format.
3. **Dealer-published structured web data**, such as a documented public API,
   JSON-LD, inventory sitemap, or vehicle-detail pages.
4. **Consented website extraction** as a bootstrap or gap-filling source, with
   crawl policy, evidence capture, rate limits, and frequent reconciliation.

The gateway records where each field came from, when it was observed, how
authoritative the source is for that field, and whether another source
disagrees. It does not silently blend conflicting values.

## Reference architecture

```text
Authorized feeds/APIs ─┐
Scheduled CSV/SFTP ────┼─> source adapters ─> raw evidence ─> normalization
Structured website ────┤                                          │
Consented crawl ────────┘                                          v
                                                      precedence + policy gate
                                                                 │
                                             ┌───────────────────┴────────────┐
                                             v                                v
                              publish protocol tools              quarantine conflicts
                                             │
                                             v
                                      AI shopping agents
```

Every adapter terminates behind the gateway. Provider credentials, raw exports,
and internal identifiers are never exposed to agents.

## Source precedence is field-specific

There is no single source that is authoritative for every retail fact.

| Retail fact | Preferred source | Fallback | Required treatment |
|---|---|---|---|
| VIN, stock number, year, make, model, trim | Dealer-authorized inventory feed | Dealer website | Preserve source and observed time. |
| New/used status and published inventory | Inventory manager or website provider export | Dealer website | Removed units must age out quickly. |
| Mileage and stocked date | Dealer-authorized inventory manager | Dealer website | State units, timestamp, and age basis. |
| Advertised price and required dealer charges | Dealer-approved pricing publication | Dealer website | Never infer fees or collapse conditional offers. |
| Factory incentives | Licensed incentive feed or dealer-approved merchandising source | Public dealer/OEM offer evidence | Preserve eligibility, expiration, geography, stacking, and source. Do not assume universal eligibility. |
| Availability | Authoritative dealer inventory source or explicit rooftop confirmation | Recent publication snapshot | A crawl is discovery evidence, not “available now.” |
| Photos and public description | Dealer-approved merchandising source | Dealer website | Keep media rights and source terms attached. |
| Vehicle history | Provider-authorized CARFAX, AutoCheck, or equivalent integration | Authorized public report link | Never convert “no events reported” into “accident-free.” |

## New vehicles and incentives

Base new-vehicle inventory can arrive through the same authorized provider
feeds and dealer exports used for other inventory. Incentives need a separate
evidence path because program rules change and can depend on model, geography,
finance source, ownership, occupation, or other eligibility facts.

The production hierarchy is:

1. licensed incentive/program data available to the dealer or its authorized
   provider;
2. dealer-approved merchandising or pricing feed with program identifiers and
   rule text;
3. a dealer-maintained campaign file or administrative entry;
4. public offer evidence captured from an authorized dealer or OEM page.

Public extraction can discover an advertised offer, but the gateway must keep
it conditional unless the source proves universal eligibility. It must record
the source URL, observation time, expiration, geography, audience restrictions,
stacking status, and any unresolved conditions. If those facts cannot be
established, the gateway says so.

## Used vehicles

For used inventory, a dealer-authorized vAuto, HomeNet, Dealer.com, or comparable
export is preferred because it can carry inventory identifiers, mileage,
stocked dates, pricing, photos, merchandising details, and removal events. A
website adapter can bootstrap a pilot or cover fields that are not present in a
feed, but it does not become authoritative merely because the page is public.

CARFAX and AutoCheck data requires the dealer's applicable provider rights. The
gateway can normalize authorized summaries or links while preserving each
provider's report identifier, access method, freshness, and conflicts.

## Website extraction policy

A production crawl adapter should be enabled only for a dealer-controlled or
dealer-authorized domain. It should:

- identify itself and respect the site's crawl policy and applicable terms;
- prefer JSON-LD, embedded structured data, sitemaps, and stable page fields;
- use conservative rate limits, conditional requests, caching, and backoff;
- store the source URL, retrieval time, content digest, and extraction version;
- detect templates, blocked pages, stale cached pages, and bot challenges;
- quarantine surprising price, mileage, VIN, or availability changes;
- recheck removals and fast-changing facts on a tighter schedule;
- never bypass authentication, access controls, or anti-bot measures; and
- stop publishing a field when the evidence is stale or ambiguous.

The crawl adapter is a reliability compromise, not a shortcut around a vendor
agreement. Its job is to make a pilot possible while the dealer authorizes a
better feed.

## Pilot rollout

For one founding rooftop:

1. inventory-source authorization and data-rights review;
2. one structured export or consented website adapter;
3. field mapping and source-precedence matrix;
4. seven-day reconciliation against the dealer's live website and inventory
   manager;
5. dealer sign-off on price, fee, incentive, mileage, and removal behavior;
6. private gateway test with real shopper questions; and
7. a public conformance claim only after the implementation evidence is ready.

The Firecrawl API can be used for the consented website-adapter path. A key is
not needed for the protocol, the reference gateway, or feed-based integrations;
it is needed when a live pilot activates that crawler.

## Public product references

- [Dealer.com third-party inventory requests](https://www.dealer.com/support/inventory/)
- [Dealer.com Inventory API overview](https://developer.inv.dealer.com/content/inventory/inventory-home.html)
- [HomeNet Inventory Online EULA](https://www.homenetauto.com/eula/)
- [HomeNet dealer inventory syndication](https://www.homenetauto.com/dealers/)
- [vAuto inventory products and syndication](https://www.vauto.com/products/)
- [Schema.org automotive vocabulary](https://schema.org/docs/automotive.html)

These links establish publicly described capabilities only. They do not imply a
partnership, certified connector, or right to access a dealer's data.
