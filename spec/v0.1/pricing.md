# Pricing and Retail Offer Semantics

This document is normative.

## 1. The problem with one price

An anonymous inventory record usually lacks the buyer's registration
jurisdiction, tax status, financing choice, trade facts, and eligibility for
conditional incentives. It therefore cannot truthfully present a universal
out-the-door total. Dealer Agent Protocol forbids overloading one generic `price` field.

## 2. Money encoding

All money uses:

```json
{ "amount_minor": 2499500, "currency": "USD" }
```

`amount_minor` is an integer in the currency's minor unit. Currency is ISO 4217.
No binary floats are allowed. An adapter receiving a decimal string converts
exactly using the currency exponent or fails; it never silently rounds.

## 3. Inventory disclosure

### 3.1 Advertised price

`advertised_price` is the generally available vehicle offering price before
buyer-specific government charges. It [DAP-PR-001] MUST reflect the dealer's actual
published offer. A conditional price is represented as the generally available
amount plus separate conditional adjustments; it is not labeled as the
advertised price.

### 3.2 Required dealer charges

Every dealer-imposed charge required of all buyers is itemized with amount,
payee, taxable status when known, and whether already included in the advertised
price. An implementation [DAP-PR-002] MUST NOT omit a mandatory dealer charge merely because
the website displays it in a disclaimer.

### 3.3 Conditional adjustments

Rebates, discounts, surcharges, required add-ons, financing conditions, loyalty,
conquest, military, first-responder, college-graduate, residency, and trade
conditions are separate adjustments. Each includes:

- direction (`discount` or `surcharge`);
- amount or explicit unknown amount;
- eligibility criteria and evidence requirement;
- geography and validity interval where applicable;
- whether dealer financing or a payment mode is required;
- stacking group and explicit combinability rules; and
- source/provenance.

The gateway [DAP-PR-003] MUST NOT present a conditional adjustment as generally available.
Version 0.1 describes the eligibility rule and evidence requirement but does not
collect customer PII or make a buyer-specific eligibility determination.

### 3.4 Government charges

Taxes, title, registration, inspection, and similar government charges are:

- `unknown` when context is insufficient;
- `estimated` with assumptions and source;
- `calculated` only when an authoritative calculation is performed; or
- `not_applicable` with basis.

Unknown is a valid result. Zero is not a substitute for unknown.

## 4. Legal context

As of this draft, the US Fifth Circuit vacated the FTC CARS Rule in January
2025, and the [FTC later withdrew the rule](https://www.ftc.gov/legal-library/browse/federal-register-notices/revision-negative-option-rule-withdrawal-cars-rule-removal-non-compete-rule-conform-these-rules)
to conform to the court decision. The rule is not an operative basis for
conformance language.

Separate FTC Act enforcement remains relevant. In March 2026 the FTC warned 97
dealer groups that advertised prices must include mandatory fees and must not
depend on unavailable discounts, hidden down payments, required dealer
financing, required add-ons, or unavailable vehicles. The schema supports those
distinctions without treating US enforcement guidance as worldwide law.

Deployers must apply current federal, state/provincial, and local law. This
document is not legal advice.
