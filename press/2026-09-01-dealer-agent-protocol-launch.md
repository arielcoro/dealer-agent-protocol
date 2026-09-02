# FOR IMMEDIATE RELEASE

## Ariel Coro Launches Dealer Agent Protocol, an Open Standard for AI-Ready Dealership Inventory and Offers

**The Apache-2.0 editor’s draft gives dealers, automotive technology providers,
and AI builders a shared contract for vehicle inventory, used-car evidence,
availability, pricing, fees, and conditional incentives. A founding dealer pilot
is now accepting applications.**

**MIAMI, September 2, 2026** — Automotive technology entrepreneur **Ariel
Coro** today launched **Dealer Agent Protocol**, an open specification that
helps AI shopping agents interpret dealer-published inventory and offer data
without guessing at its meaning or receiving broad access to dealership systems.

When a shopper asks an AI assistant whether a vehicle is still available or
what price applies, the underlying facts may be scattered across an inventory
feed, vehicle-detail page, incentive program, pricing policy, and availability
source. Dealer Agent Protocol defines a source-aware contract for those retail
facts: which dealership and rooftop published the vehicle, what is known about
the unit, when availability was checked, which charges are required, which
discounts are conditional, and where uncertainty remains.

> “AI shopping will not earn trust if an agent cannot tell whether a vehicle is
> still available or explain why a price applies,” said Ariel Coro, creator of
> Dealer Agent Protocol and Dealer Agent Gateway. “Dealers need a precise,
> controlled way to publish retail truth to agents. This project gives the
> industry a contract it can evaluate, implement, and improve in public.”

### One open protocol; many possible gateways

Dealer Agent Protocol is the open rulebook. It defines portable tool names,
JSON schemas, retail meaning, pricing disclosures, freshness, provenance,
uncertainty, and conformance evidence. **Dealer Agent Gateway** is open reference
software that connects approved dealer sources, applies policy, and serves
protocol-conforming tools over the Model Context Protocol. **DealershipMCP** is
a managed commercial implementation from Dealer Growth Hackers. Other vendors
can independently implement the same Apache-2.0 standard.

The 0.1 editor’s draft currently defines 10 tools across six profiles, 11
protocol schema files plus a conformance-claim schema, and 49 behavioral tests.
The public reference endpoint uses synthetic inventory so developers can test
the contract without dealer or customer information.

### A real used vehicle is more than year, make, model, and price

The optional used-vehicle profile covers mileage with units and timestamps,
stocked date, first public listing date, inventory age and its calculation basis,
title and condition evidence, inspection, manufacturer-versus-dealer
certification, warranty, public reconditioning facts, and provider-neutral
vehicle-history references.

CARFAX, AutoCheck, or another history source can connect behind a gateway when
the dealer has the applicable provider rights. Each report keeps its own source
and freshness. If two sources disagree, the protocol preserves the discrepancy
instead of manufacturing a cleaner claim. “No events reported” never becomes
“accident-free.” Provider names in the public examples are synthetic and do not
imply a partnership.

### Feeds first; consented website extraction as a fallback

The protocol is source-neutral. A production gateway should prefer a
dealer-authorized provider feed or API, followed by a scheduled CSV/SFTP export
and structured dealer website data. Consented website extraction can bootstrap
a pilot or fill public data gaps, but it remains discovery evidence—not the
authority for “available now.”

New-vehicle incentives follow a separate evidence hierarchy. A licensed
program feed or dealer-approved merchandising source is preferred. When only a
public offer page is available, the gateway retains eligibility language,
expiration, geography, stacking status, source URL, and observation time rather
than treating the rebate as universal.

### Founding dealer pilot opens

Dealer Agent Protocol is accepting applications for a limited founding dealer
cohort. A participating dealer begins with one rooftop, authorizes the retail
sources it already controls, maps those sources in a private gateway, and tests
real shopping questions with human reviewers. The deliverable is a readiness
report covering answer quality, source gaps, stale-data risk, and conformance
evidence.

The pilot does not require customer records, production lead data, credit data,
or broad DMS/CRM access. Dealers can apply at
[dealeragentprotocol.com/pilot](https://dealeragentprotocol.com/pilot/).

### Open for implementation and contribution

The specification, schemas, examples, conformance tests, website sources, and
reference gateway are available under the Apache License 2.0, including its
explicit patent grant. The project welcomes concrete interoperability
proposals, implementation feedback, test vectors, and corrections through its
public repository.

- Human guide and specification: [dealeragentprotocol.com](https://dealeragentprotocol.com/)
- Inventory ingestion architecture: [dealeragentprotocol.com/inventory-sources](https://dealeragentprotocol.com/inventory-sources/)
- Managed gateway and AI Answer Audit: [dealershipmcp.com](https://dealershipmcp.com/)
- Open-source repository: [github.com/arielcoro/dealer-agent-protocol](https://github.com/arielcoro/dealer-agent-protocol)

### About Dealer Agent Protocol

Dealer Agent Protocol is an open, dealer-controlled contract for sharing retail
vehicle inventory and offer facts with AI agents. It was created by Ariel Coro
to give dealers, automotive retail technology providers, and agent builders a
shared way to express retail meaning, source authority, freshness, and
uncertainty. Version 0.1 is an editor’s draft open for public evaluation and
contribution.

### Press and industry contact

**Ariel Coro**  
Creator, Dealer Agent Protocol and Dealer Agent Gateway  
[github.com/arielcoro](https://github.com/arielcoro)

###
