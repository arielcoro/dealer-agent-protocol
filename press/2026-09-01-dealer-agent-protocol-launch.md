# FOR IMMEDIATE RELEASE

## Ariel Coro Introduces Dealer Agent Protocol, an Open Contract for AI-Ready Automotive Retail Facts

**The editor’s draft gives dealers, technology providers, and AI builders a shared way to publish and interpret vehicle inventory, availability, pricing, fees, and conditional incentives.**

**September 1, 2026** — Automotive technology entrepreneur Ariel Coro today introduced Dealer Agent Protocol, an open specification designed to help AI shopping agents use dealer-published inventory and offer information without guessing at its meaning or gaining broad access to internal dealership systems.

Vehicle listings, pricing feeds, incentive programs, and availability signals often describe different parts of a retail offer. Dealer Agent Protocol defines a narrow, source-aware contract for the facts an AI agent needs to answer common shopping questions: who is selling the vehicle, which units are published, whether a specific unit is currently available, what price is advertised, which dealer charges are required, and which discounts depend on customer eligibility.

> “AI shopping will not earn trust if an agent cannot tell whether a vehicle is still available or explain why a price applies,” said Ariel Coro, creator of Dealer Agent Protocol and Dealer Agent Gateway. “Dealers need a precise, controlled way to publish retail facts to agents. That is the contract this project is opening for the industry to evaluate and improve.”

### A protocol and a gateway with different jobs

Dealer Agent Protocol is the open rulebook: it defines tool names, data schemas, retail semantics, pricing disclosures, freshness, provenance, uncertainty, and conformance requirements. Dealer Agent Gateway is the open reference software that connects dealer-approved sources, applies policy, and serves protocol-conforming tools to AI agents over the Model Context Protocol.

The initial 0.1 editor’s draft includes six read-only tools, four required profiles, seven JSON schemas, and 24 repository conformance checks. The project focuses on the retail facts needed to understand vehicles and offers. It is not positioned as a general DMS or CRM access layer.

### Dealer control is part of the architecture

A participating dealer or technology provider chooses the source mapping, rooftop scope, access policy, and freshness limits. Agents receive normalized retail facts and disclosure fields while source credentials, integrations, and internal capabilities remain behind the gateway boundary.

Pricing is intentionally explicit. The protocol separates advertised price, required dealer charges, conditional programs, and unresolved government charges so an agent does not silently collapse them into a misleading single number.

### Founding dealer pilot opens

The project is accepting applications for a limited founding dealer cohort. Selected dealers will begin with one rooftop, map approved retail sources in a private gateway environment, test real shopping questions with human reviewers, and receive a readiness report covering answer quality, source gaps, and conformance evidence.

The pilot does not require customer records, credentials, credit data, or production lead data. Dealers can apply at [dealeragentprotocol.com/pilot](https://dealeragentprotocol.com/pilot/).

### Open for implementation and contribution

The specification, schemas, examples, tests, websites, and reference gateway are available under the Apache License 2.0. The public reference endpoint uses synthetic data so agent builders can evaluate the contract without using dealer or customer information.

Human documentation, normative artifacts, contribution guidance, and the synthetic reference gateway are available at [dealeragentprotocol.com](https://dealeragentprotocol.com/) and [dealeragentgateway.com](https://dealeragentgateway.com/).

### About Dealer Agent Protocol

Dealer Agent Protocol is an open, dealer-controlled contract for sharing retail vehicle inventory and offer facts with AI agents. It was created by Ariel Coro to give dealers, automotive retail technology providers, and agent builders a shared way to express retail meaning, source authority, freshness, and uncertainty. Version 0.1 is an editor’s draft open for evaluation and contribution.

### Press and industry contact

**Ariel Coro**  
Creator, Dealer Agent Protocol and Dealer Agent Gateway  
[github.com/arielcoro](https://github.com/arielcoro)

###
