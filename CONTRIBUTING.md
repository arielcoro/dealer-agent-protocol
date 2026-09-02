# Contributing to Dealer Agent Protocol

Dealer Agent Protocol and its Dealer Agent Gateway reference implementation are
developed in public. Contributions should improve
interoperability, dealer and consumer safety, or the accuracy of retail facts
presented to agents.

## Choose the right project layer

- **Protocol contribution:** normative text, schemas, capability profiles,
  examples, compatibility mappings, or conformance tests.
- **Gateway contribution:** reference server behavior, adapters, security,
  deployment, documentation, or developer experience.

The protocol is the shared contract. The gateway is software that implements
that contract. A gateway change must not silently redefine protocol semantics.

## Before proposing a change

1. Search existing issues and compatibility mappings.
2. Describe the concrete interoperability or safety problem.
3. Include at least one example, test vector, or failing scenario.
4. State the impact on schemas, security, privacy, pricing, and existing clients.

Normative changes follow the public review periods in
`governance/GOVERNANCE.md`. Released versioned schemas are immutable.

## Development

Use Python 3.11 or newer from the repository root:

```sh
python3 -m pip install -r requirements-dev.txt
python3 scripts/validate_artifacts.py
PYTHONPATH=reference/python python3 scripts/run_conformance.py
python3 scripts/build_public_site.py
python3 scripts/validate_deployment.py
```

Changes to normative prose should be accompanied by synchronized schema,
example, and behavioral-test changes when applicable. Keep fixtures synthetic;
never commit dealer credentials, customer records, private vehicle records, or
production access tokens.

## Pull requests

- Keep one proposal or fix per pull request.
- Explain backward-compatibility and security implications.
- Update `CHANGELOG.md` for externally visible changes.
- Link the issue or decision record motivating a normative change.
- Confirm that all validation and conformance tests pass.

By contributing, you agree that your contribution is licensed under the
repository's Apache License 2.0, including its patent terms. You must have the
right to submit the contribution.
