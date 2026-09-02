# Governance

## Draft status

Dealer Agent Protocol is currently an editor's draft. The domain owner and initial
authors do not constitute an industry council, and publication of this package
does not imply endorsement, certification, or adoption.

## Principles

1. **Convergence before branding.** Existing standards are mapped and, where
   practical, changes should be offered upstream.
2. **Dealer and consumer safety.** Security, pricing integrity, provenance, and
   tenant isolation are release gates.
3. **Open evidence.** Requirements, decisions, test vectors, and conformance
   results are public and citable.
4. **No pay-to-pass.** Conformance criteria are identical for all implementers.
5. **Conflict disclosure and recusal.** Editors disclose material commercial
   interests and recuse from decisions that uniquely benefit them.

## Change process

Every normative change requires:

1. a public issue describing the interoperability or safety problem;
2. at least one concrete example or test vector;
3. impact analysis for schemas, security, privacy, and compatibility mappings;
4. a public review period of at least 14 days for draft changes and 30 days for
   stable-profile changes;
5. recorded disposition of substantive objections; and
6. synchronized changes to prose, schemas, examples, and tests.

Emergency security errata may ship sooner but must be documented afterward.

## Decision records

Normative decisions must be recorded in a future `decisions/` directory using
stable identifiers. The record must include alternatives, evidence, conflicts,
decision, and compatibility impact. A rejected proposal remains discoverable.

## Versioning and immutability

- Specifications and profiles use semantic versions.
- Capability profiles version independently.
- Released schema paths are immutable. A breaking schema change creates a new
  major-version path.
- Editorial corrections that cannot change validation may be issued as errata.
- Conformance claims pin a release tag or content digest, test-suite version,
  result hash, issuer, and timestamp.

## Working-group path

Before a `1.0` release, governance should transfer to or be co-chartered with a
neutral nonprofit or standards body. The charter should include dealerships,
dealer groups, consumer advocates, inventory/pricing data providers, agent
vendors, security and privacy experts, and international implementers. No
constituency should hold unilateral release authority.

## Intellectual property

Apache-2.0 is used for its explicit patent grant. Contributors must have the
right to submit their work. A future foundation may require a Developer
Certificate of Origin or contributor agreement, but it must not narrow the
public patent grant.

## Certification

No certification mark exists in v0.1. Self-declared conformance is acceptable
only when accompanied by the machine-readable claim and reproducible test
result. Independent certification may be introduced only after:

- at least two independent server implementations and two clients interoperate;
- the reference tests cover every normative MUST;
- assessor rules, fees, appeals, conflicts, and revocation are public; and
- false or expired claims have a documented removal process.
