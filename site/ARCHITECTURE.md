# Public site architecture

The publication has two layers: human adoption content and versioned normative artifacts.

```text
/
├── how-it-works/       visual system explainer
├── adopt/              role-based adoption paths
├── docs/               human-readable documentation hub
│   ├── core-concepts/
│   ├── tools/
│   ├── pricing/
│   ├── security/
│   ├── conformance/
│   └── quickstart/
├── spec/v0.1/          canonical versioned specification
│   ├── SPEC.md
│   ├── capabilities.yaml
│   ├── pricing.md
│   ├── security.md
│   └── schemas/
├── conformance/claim.schema.json
├── privacy/            project privacy policy
├── terms/              hosted-service terms of use
└── server.json
```

## Navigation

Primary navigation contains How it works, Adopt, Documentation, and Gateway. The persistent action is Start with v0.1. Documentation pages add a left task navigation and link directly to the relevant normative artifact.

Privacy and Terms are legal L1 pages linked from the global footer and included in the XML sitemap, robots discovery, and `llms.txt` for both public domains.

## Conversion paths

- Dealer leader: Home → How it works → Adopt / Dealers → Human guide.
- Technology provider: Home → Adopt / Providers → Quickstart → Schemas.
- Agent builder: Home → How it works → Tools → Reference gateway.
- Evaluator: Human guide → Security or Conformance → Raw specification.
