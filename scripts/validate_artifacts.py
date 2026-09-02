#!/usr/bin/env python3
"""Validate the Dealer Agent Protocol schemas, catalog, examples, and sample claim."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "spec" / "v0.1" / "schemas"


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def resolve_pointer(document, fragment: str):
    value = document
    for token in fragment.removeprefix("/").split("/") if fragment else []:
        token = token.replace("~1", "/").replace("~0", "~")
        value = value[token]
    return value


def references(value):
    if isinstance(value, dict):
        if "$ref" in value:
            yield value["$ref"]
        for child in value.values():
            yield from references(child)
    elif isinstance(value, list):
        for child in value:
            yield from references(child)


def main() -> int:
    failures: list[str] = []

    must_pattern = re.compile(r"\bMUST(?: NOT)?\b")
    requirement_tag = re.compile(r"\[DAP-[A-Z0-9-]+-\d{3}\]\s+MUST(?: NOT)?")
    for normative_path in sorted((ROOT / "spec" / "v0.1").glob("*.md")):
        for line_number, line in enumerate(normative_path.read_text(encoding="utf-8").splitlines(), 1):
            if "key words" in line:
                continue
            must_count = len(must_pattern.findall(line))
            tag_count = len(requirement_tag.findall(line))
            if must_count != tag_count:
                failures.append(f"{normative_path.relative_to(ROOT)}:{line_number}: untagged MUST requirement")
    schema_paths = sorted(SCHEMA_DIR.glob("*.schema.json")) + [ROOT / "conformance" / "claim.schema.json"]
    schemas = {path: load_json(path) for path in schema_paths}

    registry = Registry()
    for schema in schemas.values():
        registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))

    for path, schema in schemas.items():
        try:
            Draft202012Validator.check_schema(schema)
        except Exception as exc:  # jsonschema uses several specific schema exceptions
            failures.append(f"{path.relative_to(ROOT)}: invalid schema: {exc}")

        for reference in references(schema):
            resource, _, fragment = reference.partition("#")
            if not resource:
                target_schema = schema
            elif urlparse(resource).scheme:
                target_schema = next((candidate for candidate in schemas.values() if candidate["$id"] == resource), None)
                if target_schema is None:
                    failures.append(f"{path.relative_to(ROOT)}: unresolved resource {resource}")
                    continue
            else:
                target_path = path.parent / resource
                if not target_path.exists():
                    failures.append(f"{path.relative_to(ROOT)}: unresolved resource {resource}")
                    continue
                target_schema = load_json(target_path)
            try:
                resolve_pointer(target_schema, unquote(fragment))
            except (KeyError, TypeError) as exc:
                failures.append(f"{path.relative_to(ROOT)}: bad reference {reference}: {exc}")

    catalog_path = ROOT / "spec" / "v0.1" / "capabilities.yaml"
    catalog = yaml.safe_load(catalog_path.read_text(encoding="utf-8"))
    profiles = catalog.get("profiles", {})
    tools = catalog.get("tools", {})
    required_tool_fields = {
        "effect", "mcp_annotations", "input_schema", "output_schema", "public_access",
        "confirmation", "idempotency", "pii_input", "pii_output", "retention",
        "reversible", "legal_or_financial_commitment", "freshness_authority", "audit",
    }
    required_annotations = {"readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"}
    for profile_name, profile in profiles.items():
        for field in ("status", "required_tools", "scopes"):
            if field not in profile:
                failures.append(f"{profile_name}: missing catalog field {field}")
        for dependency in profile.get("dependencies", []):
            if dependency not in profiles:
                failures.append(f"{profile_name}: missing dependency {dependency}")
        for tool_name in profile.get("required_tools", []):
            if tool_name not in tools:
                failures.append(f"{profile_name}: missing tool {tool_name}")

    for bundle_name, bundle in catalog.get("bundles", {}).items():
        for profile_name in bundle.get("required_profiles", []):
            if profile_name not in profiles:
                failures.append(f"{bundle_name}: missing profile {profile_name}")

    for tool_name, tool in tools.items():
        missing_fields = required_tool_fields - set(tool)
        if missing_fields:
            failures.append(f"{tool_name}: missing metadata {sorted(missing_fields)}")
        annotations = tool.get("mcp_annotations", {})
        if set(annotations) != required_annotations or not all(isinstance(value, bool) for value in annotations.values()):
            failures.append(f"{tool_name}: MCP annotations must be the four boolean hints")
        for field in ("input_schema", "output_schema"):
            reference = tool[field]
            file_part, _, fragment = reference.partition("#")
            target_path = SCHEMA_DIR / file_part.removeprefix("schemas/")
            if not target_path.exists():
                failures.append(f"{tool_name}.{field}: missing {file_part}")
                continue
            try:
                resolve_pointer(load_json(target_path), unquote(fragment))
            except (KeyError, TypeError) as exc:
                failures.append(f"{tool_name}.{field}: bad fragment #{fragment}: {exc}")

    examples = {
        ROOT / "spec" / "v0.1" / "examples" / "server-discovery.json": (SCHEMA_DIR / "manifest.schema.json", "manifest"),
        ROOT / "spec" / "v0.1" / "examples" / "inventory-search.json": (SCHEMA_DIR / "vehicle.schema.json", "searchResponse"),
        ROOT / "spec" / "v0.1" / "examples" / "vehicle-detail.json": (SCHEMA_DIR / "vehicle.schema.json", "vehicle"),
        ROOT / "spec" / "v0.1" / "examples" / "used-vehicle-detail.json": (SCHEMA_DIR / "used-vehicle.schema.json", "usedVehicleDetails"),
        ROOT / "conformance" / "claims" / "example-claim.json": (ROOT / "conformance" / "claim.schema.json", None),
    }

    well_known_path = ROOT / "spec" / "v0.1" / "examples" / "well-known" / "dealer-agent.json"
    well_known_schema = schemas[SCHEMA_DIR / "well-known.schema.json"]
    well_known_validator = Draft202012Validator(well_known_schema, registry=registry, format_checker=FormatChecker())
    for error in sorted(well_known_validator.iter_errors(load_json(well_known_path)), key=lambda item: list(item.path)):
        location = "/".join(str(part) for part in error.absolute_path) or "<root>"
        failures.append(f"{well_known_path.relative_to(ROOT)}:{location}: {error.message}")

    for vector_path in sorted((ROOT / "spec" / "v0.1" / "examples" / "one-price-problem").glob("*.json")):
        vector = load_json(vector_path)
        facts = vector.get("facts", {})
        if not vector.get("required_answer_facts") or not vector.get("forbidden_claims"):
            failures.append(f"{vector_path.relative_to(ROOT)}: answer requirements are missing")
        if facts.get("government_charges_status") == "unknown" and any(
            "$0" in claim for claim in vector.get("required_answer_facts", [])
        ):
            failures.append(f"{vector_path.relative_to(ROOT)}: unknown government charges were upgraded to zero")
        for adjustment in facts.get("conditional_adjustments", []):
            if not adjustment.get("eligibility") or not adjustment.get("stacking"):
                failures.append(f"{vector_path.relative_to(ROOT)}: conditional adjustment lacks eligibility or stacking")

    checker = FormatChecker()
    for example_path, (schema_path, definition) in examples.items():
        schema = schemas[schema_path]
        selected = (
            {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": schema["$id"],
                "$ref": f"#/$defs/{definition}",
                "$defs": schema.get("$defs", {}),
            }
            if definition
            else schema
        )
        validator = Draft202012Validator(selected, registry=registry, format_checker=checker)
        for error in sorted(validator.iter_errors(load_json(example_path)), key=lambda item: list(item.path)):
            location = "/".join(str(part) for part in error.absolute_path) or "<root>"
            failures.append(f"{example_path.relative_to(ROOT)}:{location}: {error.message}")

    manifest = load_json(ROOT / "spec" / "v0.1" / "examples" / "server-discovery.json")
    for advertised in manifest["capabilities"]:
        profile_name = advertised["profile"]
        if profile_name not in profiles:
            failures.append(f"server-discovery.json: unknown profile {profile_name}")
            continue
        expected_tools = set(profiles[profile_name]["required_tools"])
        if set(advertised["tools"]) != expected_tools:
            failures.append(f"server-discovery.json: {profile_name} tool set differs from catalog")
        if set(advertised.get("scopes", [])) != set(profiles[profile_name]["scopes"]):
            failures.append(f"server-discovery.json: {profile_name} scope set differs from catalog")

    claim = load_json(ROOT / "conformance" / "claims" / "example-claim.json")
    claimed_tools = set(claim["implementation"]["tools"])
    for profile_name in claim["profiles"]:
        if profile_name not in profiles:
            failures.append(f"example-claim.json: unknown profile {profile_name}")
            continue
        missing_tools = set(profiles[profile_name]["required_tools"]) - claimed_tools
        if missing_tools:
            failures.append(f"example-claim.json: {profile_name} lacks tools {sorted(missing_tools)}")

    if failures:
        print("Artifact validation failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(f"Validated {len(schemas)} schemas, {len(tools)} tools, {len(profiles)} profiles, and {len(examples)} examples.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
