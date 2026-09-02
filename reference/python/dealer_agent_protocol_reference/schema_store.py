"""Load and validate the normative local JSON Schemas."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

from .errors import GatewayError


class SchemaStore:
    def __init__(self, project_root: Path) -> None:
        self.schema_dir = project_root / "spec" / "v0.1" / "schemas"
        self.schemas: Dict[str, Dict[str, Any]] = {}
        self.registry = Registry()
        for path in sorted(self.schema_dir.glob("*.schema.json")):
            schema = json.loads(path.read_text(encoding="utf-8"))
            self.schemas[path.name] = schema
            self.registry = self.registry.with_resource(schema["$id"], Resource.from_contents(schema))
        self.format_checker = FormatChecker()

    def definition(self, reference: str) -> Dict[str, Any]:
        file_name, separator, fragment = reference.partition("#/$defs/")
        if not separator or file_name not in self.schemas:
            raise KeyError(reference)
        schema = self.schemas[file_name]
        return {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": schema["$id"],
            "$ref": f"#/$defs/{fragment}",
            "$defs": schema.get("$defs", {}),
        }

    def validate(self, reference: str, value: Any) -> None:
        schema = self.definition(reference)
        self._validate_schema(schema, value)

    def validate_document(self, file_name: str, value: Any) -> None:
        if file_name not in self.schemas:
            raise KeyError(file_name)
        self._validate_schema(self.schemas[file_name], value)

    def _validate_schema(self, schema: Dict[str, Any], value: Any) -> None:
        validator = Draft202012Validator(
            schema,
            registry=self.registry,
            format_checker=self.format_checker,
        )
        errors = sorted(
            validator.iter_errors(value),
            key=lambda error: tuple(str(part) for part in error.absolute_path),
        )
        if not errors:
            return
        field_errors = []
        for error in errors[:100]:
            pointer = "/" + "/".join(str(part) for part in error.absolute_path)
            field_errors.append(
                {
                    "instance_location": pointer,
                    "keyword": str(error.validator),
                    "explanation": f"Value failed validation for keyword '{error.validator}'.",
                }
            )
        raise GatewayError(
            "dealeragent.validation.invalid",
            "The request or response did not satisfy its Dealer Agent Protocol schema.",
            {"field_errors": field_errors},
        )
