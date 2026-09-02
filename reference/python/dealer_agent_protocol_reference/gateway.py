"""Reference implementation of the Dealer Agent Protocol Core Retail Read bundle."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from xml.sax.saxutils import escape
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence
from uuid import uuid4

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature

from .auth import AuthContext
from .errors import GatewayError, not_found
from .fixtures import DOWNTOWN, NORTH, ORGANIZATION_ID, build_fixture
from .schema_store import SchemaStore


PROTOCOL_VERSION = "2026-07-28"
STANDARD_VERSION = "0.1"


TOOL_SPECS: Dict[str, Dict[str, Any]] = {
    "dealeragent.discovery.get_manifest": {
        "title": "Get Dealer Agent Protocol manifest",
        "description": "Return the caller-visible Dealer Agent Protocol profiles, tools, resources, tenancy policy, and conformance evidence.",
        "input": "manifest.schema.json#/$defs/manifestRequest",
        "output": "manifest.schema.json#/$defs/manifest",
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    },
    "dealeragent.dealer.get": {
        "title": "Get dealer organization",
        "description": "Return public organization and rooftop identity, contacts, hours, provenance, and freshness.",
        "input": "dealer.schema.json#/$defs/dealerRequest",
        "output": "dealer.schema.json#/$defs/dealerOrganization",
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    },
    "dealeragent.inventory.search": {
        "title": "Search published inventory",
        "description": "Search published inventory with typed filters, facets, opaque cursor pagination, provenance, and freshness.",
        "input": "vehicle.schema.json#/$defs/searchRequest",
        "output": "vehicle.schema.json#/$defs/searchResponse",
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    },
    "dealeragent.inventory.get_vehicle": {
        "title": "Get vehicle detail",
        "description": "Get one published vehicle by gateway ID, VIN, or stock number without treating the listing as an availability promise.",
        "input": "vehicle.schema.json#/$defs/vehicleRequest",
        "output": "vehicle.schema.json#/$defs/vehicle",
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    },
    "dealeragent.inventory.verify_availability": {
        "title": "Verify authoritative availability",
        "description": "Perform an authenticated availability check against the synthetic authoritative inventory source.",
        "input": "vehicle.schema.json#/$defs/availabilityRequest",
        "output": "vehicle.schema.json#/$defs/availabilityResult",
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    },
    "dealeragent.pricing.get_disclosure": {
        "title": "Get classified pricing disclosure",
        "description": "Return advertised price, mandatory dealer charges, conditional adjustments, government-charge status, and uncertainty.",
        "input": "pricing.schema.json#/$defs/disclosureRequest",
        "output": "pricing.schema.json#/$defs/pricingDisclosure",
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    },
    "dealeragent.handoff.get_policy": {
        "title": "Get consented handoff policy",
        "description": "Return accepted handoff purposes, channels, disclosure, retention, response commitment, and delivery availability.",
        "input": "handoff.schema.json#/$defs/policyRequest",
        "output": "handoff.schema.json#/$defs/handoffPolicy",
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    },
    "dealeragent.handoff.prepare": {
        "title": "Prepare a consented handoff",
        "description": "Create an ES256-signed, expiring, single-use consent binding without accepting customer PII.",
        "input": "handoff.schema.json#/$defs/prepareRequest",
        "output": "consent.schema.json#/$defs/consentBinding",
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
    },
    "dealeragent.handoff.submit": {
        "title": "Submit a consented handoff",
        "description": "Verify and consume a consent binding, then create a synthetic ADF/XML handoff.",
        "input": "handoff.schema.json#/$defs/handoffRequest",
        "output": "handoff.schema.json#/$defs/handoffResult",
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": True},
    },
}


class Gateway:
    """A deterministic, synthetic reference gateway.

    The domain layer accepts an ``AuthContext`` created by a trusted transport.
    It never derives authorization from tool arguments or caller-provided MCP
    metadata.
    """

    def __init__(
        self,
        now: Optional[datetime] = None,
        cursor_secret: bytes = b"reference-only-change-me",
        trace_factory: Optional[Callable[[], str]] = None,
    ) -> None:
        self.now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
        configured_root = os.environ.get("DEALER_AGENT_PROJECT_ROOT")
        self.project_root = Path(configured_root).resolve() if configured_root else Path(__file__).resolve().parents[3]
        self.schemas = SchemaStore(self.project_root)
        self.data = build_fixture(self.now)
        self.cursor_secret = cursor_secret
        self.trace_factory = trace_factory or (lambda: f"trace.{uuid4().hex}")
        self.published_vehicle_ids = {vehicle["vehicle_id"] for vehicle in self.data["vehicles"]}
        self._signing_key = ec.generate_private_key(ec.SECP256R1())
        self._bindings: Dict[str, Dict[str, Any]] = {}
        self._handoff_results: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def demo_grant() -> AuthContext:
        return AuthContext.grant(
            "operator:reference-demo",
            [ORGANIZATION_ID],
            [DOWNTOWN],
            ["dealeragent:inventory:read", "dealeragent:pricing:read", "dealeragent:handoff:submit"],
        )

    def tool_definitions(self) -> List[Dict[str, Any]]:
        definitions = []
        for name in sorted(TOOL_SPECS):
            spec = TOOL_SPECS[name]
            definitions.append(
                {
                    "name": name,
                    "title": spec["title"],
                    "description": spec["description"],
                    "inputSchema": self.schemas.definition(spec["input"]),
                    "outputSchema": self.schemas.definition(spec["output"]),
                    "annotations": spec["annotations"],
                }
            )
        return definitions

    def manifest(self) -> Dict[str, Any]:
        example_claim = self.project_root / "conformance" / "claims" / "example-claim.json"
        claim_digest = hashlib.sha256(example_claim.read_bytes()).hexdigest()
        issued = self._timestamp(self.now)
        expires = self._timestamp(self.now + timedelta(hours=1))
        manifest = {
            "standard": "dealer-agent-protocol",
            "standard_version": STANDARD_VERSION,
            "mcp_revision": PROTOCOL_VERSION,
            "gateway_id": "gateway.example-motors.reference",
            "operator": {"name": "Example Motors Reference Operator", "uri": "https://dealer.example"},
            "organization_ids": [ORGANIZATION_ID],
            "rooftop_ids": [DOWNTOWN, NORTH],
            "capabilities": [
                {
                    "profile": "dealeragent.discovery/0.1",
                    "status": "supported",
                    "tools": ["dealeragent.discovery.get_manifest", "dealeragent.dealer.get"],
                    "scopes": [],
                },
                {
                    "profile": "dealeragent.inventory.read/0.1",
                    "status": "supported",
                    "tools": ["dealeragent.inventory.search", "dealeragent.inventory.get_vehicle"],
                    "scopes": ["dealeragent:inventory:read"],
                },
                {
                    "profile": "dealeragent.inventory.availability/0.1",
                    "status": "supported",
                    "tools": ["dealeragent.inventory.verify_availability"],
                    "scopes": ["dealeragent:inventory:read"],
                },
                {
                    "profile": "dealeragent.pricing.disclosure/0.1",
                    "status": "supported",
                    "tools": ["dealeragent.pricing.get_disclosure"],
                    "scopes": ["dealeragent:pricing:read"],
                },
                {
                    "profile": "dealeragent.handoff/0.1",
                    "status": "supported",
                    "tools": [
                        "dealeragent.handoff.get_policy",
                        "dealeragent.handoff.prepare",
                        "dealeragent.handoff.submit",
                    ],
                    "scopes": ["dealeragent:handoff:submit"],
                },
            ],
            "resources": ["dealeragent://manifest", f"dealeragent://organization/{ORGANIZATION_ID}"],
            "auth_modes": ["public", "workload_identity"],
            "tenant_routing": {
                "organization_id_required": True,
                "rooftop_id_required_for_unit_reads": True,
                "group_delegation_explicit": True,
            },
            "schema_base_uri": "https://dealeragentprotocol.com/spec/v0.1/schemas/",
            "policy_uri": "https://dealer.example/reference-agent-policy",
            "authority_policy": {
                "uri": "https://dealer.example/reference-agent-policy#data-authority",
                "inventory_max_age_seconds": 900,
                "authoritative_availability_required_for_actions": True,
            },
            "freshness_sla_seconds": {
                DOWNTOWN: {"inventory": 900, "availability": 120, "pricing": 3600},
                NORTH: {"inventory": 900, "availability": 120, "pricing": 3600},
            },
            "conformance": {
                "claim_uri": "https://dealer.example/conformance/reference-example-claim.json",
                "claim_digest": f"sha256:{claim_digest}",
            },
            "issued_at": issued,
            "expires_at": expires,
        }
        self.schemas.validate("manifest.schema.json#/$defs/manifest", manifest)
        return manifest

    def call_tool(
        self,
        name: str,
        arguments: Optional[Dict[str, Any]],
        auth: Optional[AuthContext] = None,
    ) -> Dict[str, Any]:
        if name not in TOOL_SPECS:
            raise GatewayError("dealeragent.capability.unsupported", "The requested tool is not supported.")
        arguments = deepcopy(arguments or {})
        spec = TOOL_SPECS[name]
        self.schemas.validate(spec["input"], arguments)
        handlers = {
            "dealeragent.discovery.get_manifest": self._get_manifest,
            "dealeragent.dealer.get": self._get_dealer,
            "dealeragent.inventory.search": self._search_inventory,
            "dealeragent.inventory.get_vehicle": self._get_vehicle,
            "dealeragent.inventory.verify_availability": self._verify_availability,
            "dealeragent.pricing.get_disclosure": self._get_pricing,
            "dealeragent.handoff.get_policy": self._get_handoff_policy,
            "dealeragent.handoff.prepare": self._prepare_handoff,
            "dealeragent.handoff.submit": self._submit_handoff,
        }
        result = handlers[name](arguments, auth)
        try:
            self.schemas.validate(spec["output"], result)
        except GatewayError as error:
            raise GatewayError("dealeragent.internal", "The gateway produced an invalid structured result.") from error
        return result

    def _get_manifest(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        organization_id = arguments.get("organization_id")
        if organization_id and organization_id != ORGANIZATION_ID:
            raise not_found()
        return self.manifest()

    def _get_dealer(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        organization_id = arguments.get("organization_id")
        if organization_id and organization_id != ORGANIZATION_ID:
            raise not_found()
        dealer = deepcopy(self.data["dealer"])
        rooftop_ids = arguments.get("rooftop_ids")
        if rooftop_ids:
            actual = {rooftop["rooftop_id"] for rooftop in dealer["rooftops"]}
            if not set(rooftop_ids).issubset(actual):
                raise not_found()
            dealer["rooftops"] = [rooftop for rooftop in dealer["rooftops"] if rooftop["rooftop_id"] in rooftop_ids]
        return dealer

    def _search_inventory(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        if arguments["organization_id"] != ORGANIZATION_ID:
            raise not_found()
        requested_rooftops = set(arguments.get("rooftop_ids", [DOWNTOWN, NORTH]))
        if not requested_rooftops.issubset({DOWNTOWN, NORTH}):
            raise not_found()
        vehicles = [
            deepcopy(vehicle)
            for vehicle in self.data["vehicles"]
            if vehicle["vehicle_id"] in self.published_vehicle_ids and vehicle["rooftop_id"] in requested_rooftops
        ]
        query = arguments.get("query", "").casefold().split()
        if query:
            vehicles = [vehicle for vehicle in vehicles if all(token in self._vehicle_search_text(vehicle) for token in query)]
        vehicles = self._filter_vehicles(vehicles, arguments.get("filters", {}))
        vehicles = self._sort_vehicles(vehicles, arguments.get("sort"))
        facets = self._facets(vehicles)

        page = arguments.get("page", {})
        limit = page.get("limit", 50)
        query_hash = self._query_hash(arguments)
        offset = self._decode_cursor(page.get("cursor"), query_hash) if page.get("cursor") else 0
        selected = vehicles[offset : offset + limit]
        next_offset = offset + len(selected)
        has_more = next_offset < len(vehicles)
        page_info: Dict[str, Any] = {"has_more": has_more}
        if has_more:
            page_info["next_cursor"] = self._encode_cursor(next_offset, query_hash)

        freshness = self._aggregate_freshness(vehicles)
        observed = self.now - timedelta(minutes=2)
        response = {
            "vehicles": selected,
            "facets": facets,
            "page": page_info,
            "provenance": {
                "sources": [
                    {
                        "source_name": "reference-inventory-index",
                        "authority": "derived",
                        "observed_at": self._timestamp(observed),
                    }
                ],
                "authority_status": "derived",
                "transformed_at": self._timestamp(self.now),
                "transformations": ["filtered published synthetic inventory"],
            },
            "freshness": freshness,
            "trace_id": self.trace_factory(),
        }
        return response

    def _get_vehicle(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        return deepcopy(self._find_vehicle(arguments, published_only=True))

    def _verify_availability(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        self._require_grant(auth, arguments["organization_id"], arguments["rooftop_id"], "dealeragent:inventory:read")
        vehicle = self._find_vehicle(arguments, published_only=False)
        if vehicle["freshness"]["state"] != "current" or vehicle["availability"]["authority_status"] != "authoritative":
            raise GatewayError(
                "dealeragent.vehicle.stale",
                "Authoritative availability is stale; refresh the retail source before presenting it as current.",
                {"current_freshness": deepcopy(vehicle["freshness"])},
                retry_after_ms=1000,
            )
        return {
            "vehicle_id": vehicle["vehicle_id"],
            "organization_id": vehicle["organization_id"],
            "rooftop_id": vehicle["rooftop_id"],
            "availability": deepcopy(vehicle["availability"]),
            "provenance": deepcopy(vehicle["provenance"]),
            "freshness": deepcopy(vehicle["freshness"]),
            "trace_id": self.trace_factory(),
        }

    def _get_pricing(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        if arguments["organization_id"] != ORGANIZATION_ID or arguments["rooftop_id"] not in {DOWNTOWN, NORTH}:
            raise not_found()
        vehicle = self._find_vehicle(arguments, published_only=True)
        return deepcopy(self.data["pricing"][vehicle["vehicle_id"]])

    def _get_handoff_policy(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        if arguments["organization_id"] != ORGANIZATION_ID or arguments["rooftop_id"] not in {DOWNTOWN, NORTH}:
            raise not_found()
        observed = self.now - timedelta(minutes=1)
        return {
            "organization_id": ORGANIZATION_ID,
            "rooftop_id": arguments["rooftop_id"],
            "accepted_purposes": ["vehicle_inquiry", "quote_follow_up"],
            "accepted_channels": ["email", "sms", "voice"],
            "required_data_categories": ["contact"],
            "optional_data_categories": ["vehicle_interest", "message"],
            "disclosure_text": "By continuing, you ask Example Motors to contact you about this vehicle using the channels you select. Your contact details will be sent to the dealership and retained under its published privacy policy.",
            "disclosure_version": "example-handoff-2026-09-02",
            "retention_ceiling_days": 30,
            "response_commitment_seconds": 900,
            "adf_destination_present": True,
            "provenance": {
                "sources": [{"source_name": "reference-handoff-policy", "authority": "dealer_asserted", "observed_at": self._timestamp(observed)}],
                "authority_status": "asserted",
                "transformed_at": self._timestamp(self.now),
            },
            "freshness": {
                "observed_at": self._timestamp(observed),
                "valid_until": self._timestamp(self.now + timedelta(hours=1)),
                "state": "current",
                "max_age_seconds": 3600,
            },
        }

    def _prepare_handoff(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        self._require_grant(auth, arguments["organization_id"], arguments["rooftop_id"], "dealeragent:handoff:submit")
        policy = self._get_handoff_policy(
            {"organization_id": arguments["organization_id"], "rooftop_id": arguments["rooftop_id"]}, auth
        )
        if arguments["purpose"] not in policy["accepted_purposes"]:
            raise GatewayError("dealeragent.validation.invalid", "The requested handoff purpose is not accepted.")
        if not set(arguments["requested_channels"]).issubset(policy["accepted_channels"]):
            raise GatewayError("dealeragent.validation.invalid", "One or more requested handoff channels are not accepted.")
        accepted_categories = set(policy["required_data_categories"] + policy["optional_data_categories"])
        if not set(arguments["requested_data_categories"]).issubset(accepted_categories):
            raise GatewayError("dealeragent.validation.invalid", "One or more requested data categories are not accepted.")

        existing = next(
            (item for item in self._bindings.values() if item["idempotency_key"] == arguments["idempotency_key"]), None
        )
        if existing:
            return deepcopy(existing["public"])

        binding_id = f"binding.{uuid4().hex}"
        expires = self.now + timedelta(minutes=10)
        disclosure_digest = f"sha256:{hashlib.sha256(policy['disclosure_text'].encode('utf-8')).hexdigest()}"
        grant = {
            "purpose": arguments["purpose"],
            "channels": arguments["requested_channels"],
            "data_categories": arguments["requested_data_categories"],
            "disclosure_version": policy["disclosure_version"],
            "disclosure_digest": disclosure_digest,
            "granted_at": self._timestamp(self.now),
            "expires_at": self._timestamp(expires),
        }
        signed_claims = {
            "binding_id": binding_id,
            "organization_id": arguments["organization_id"],
            "rooftop_id": arguments["rooftop_id"],
            "vehicle_id": arguments.get("vehicle_id"),
            "subject_binding": arguments["subject_binding"],
            "grant": grant,
            "single_use": True,
            "exp": int(expires.timestamp()),
            "nonce": secrets.token_urlsafe(16),
        }
        token = self._sign_jws(signed_claims)
        observed = self.now
        public = {
            "binding_id": binding_id,
            "organization_id": arguments["organization_id"],
            "rooftop_id": arguments["rooftop_id"],
            **({"vehicle_id": arguments["vehicle_id"]} if arguments.get("vehicle_id") else {}),
            "grant": grant,
            "status": "prepared",
            "disclosure_text": policy["disclosure_text"],
            "subject_binding": arguments["subject_binding"],
            "single_use": True,
            "expires_at": self._timestamp(expires),
            "binding_token": token,
            "issuer": "https://dealer.example/reference-gateway",
            "signature": token,
            "signature_algorithm": "ES256",
            "provenance": {
                "sources": [{"source_name": "reference-consent-service", "authority": "authoritative_dealer_system", "observed_at": self._timestamp(observed)}],
                "authority_status": "authoritative",
                "transformed_at": self._timestamp(observed),
            },
            "freshness": {"observed_at": self._timestamp(observed), "valid_until": self._timestamp(expires), "state": "current", "max_age_seconds": 600},
        }
        self._bindings[binding_id] = {"public": public, "claims": signed_claims, "consumed": False, "idempotency_key": arguments["idempotency_key"]}
        return deepcopy(public)

    def _submit_handoff(self, arguments: Dict[str, Any], auth: Optional[AuthContext]) -> Dict[str, Any]:
        self._require_grant(auth, arguments["organization_id"], arguments["rooftop_id"], "dealeragent:handoff:submit")
        if arguments["idempotency_key"] in self._handoff_results:
            duplicate = deepcopy(self._handoff_results[arguments["idempotency_key"]])
            duplicate["status"] = "duplicate"
            return duplicate

        record = self._bindings.get(arguments["binding_id"])
        if record is None or arguments["binding_token"] != record["public"]["binding_token"]:
            raise GatewayError("dealeragent.binding.invalid", "The consent binding is invalid.")
        if not self._verify_jws(arguments["binding_token"], record["claims"]):
            raise GatewayError("dealeragent.binding.invalid", "The consent binding is invalid.")
        claims = record["claims"]
        if record["consumed"]:
            raise GatewayError("dealeragent.binding.invalid", "The consent binding is invalid.")
        if int(claims["exp"]) <= int(self.now.timestamp()):
            raise GatewayError("dealeragent.binding.invalid", "The consent binding is invalid.")
        if claims["organization_id"] != arguments["organization_id"] or claims["rooftop_id"] != arguments["rooftop_id"]:
            raise GatewayError("dealeragent.binding.invalid", "The consent binding is invalid.")
        if claims["subject_binding"] != arguments["subject_binding"]:
            raise GatewayError("dealeragent.binding.invalid", "The consent binding is invalid.")
        if claims.get("vehicle_id") and arguments.get("vehicle_id") != claims["vehicle_id"]:
            raise GatewayError("dealeragent.binding.invalid", "The consent binding is invalid.")
        if not set(arguments["contact"]["preferred_channels"]).issubset(claims["grant"]["channels"]):
            raise GatewayError("dealeragent.binding.invalid", "The consent binding is invalid.")

        record["consumed"] = True
        handoff_id = f"handoff.{uuid4().hex}"
        adf_xml = self._build_adf(handoff_id, arguments)
        result = {
            "handoff_id": handoff_id,
            "organization_id": arguments["organization_id"],
            "rooftop_id": arguments["rooftop_id"],
            "status": "accepted",
            "binding_status": "consumed",
            "department": "internet_sales",
            "external_reference": f"reference:{handoff_id}",
            "adf_xml": adf_xml,
            "provenance": {
                "sources": [{"source_name": "reference-adf-emitter", "authority": "authoritative_dealer_system", "observed_at": self._timestamp(self.now)}],
                "authority_status": "authoritative",
                "transformed_at": self._timestamp(self.now),
            },
            "freshness": {"observed_at": self._timestamp(self.now), "valid_until": self._timestamp(self.now + timedelta(minutes=15)), "state": "current", "max_age_seconds": 900},
            "trace_id": self.trace_factory(),
        }
        self._handoff_results[arguments["idempotency_key"]] = deepcopy(result)
        return result

    def _sign_jws(self, claims: Dict[str, Any]) -> str:
        header = self._b64(json.dumps({"alg": "ES256", "typ": "JWT"}, sort_keys=True, separators=(",", ":")).encode("utf-8"))
        payload = self._b64(json.dumps(claims, sort_keys=True, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{header}.{payload}".encode("ascii")
        der_signature = self._signing_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
        r, s = decode_dss_signature(der_signature)
        signature = self._b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
        return f"{header}.{payload}.{signature}"

    def _verify_jws(self, token: str, expected_claims: Dict[str, Any]) -> bool:
        try:
            header, payload, signature = token.split(".")
            decoded_header = json.loads(self._unb64(header))
            decoded_claims = json.loads(self._unb64(payload))
            raw_signature = self._unb64(signature)
            if decoded_header != {"alg": "ES256", "typ": "JWT"} or decoded_claims != expected_claims or len(raw_signature) != 64:
                return False
            r = int.from_bytes(raw_signature[:32], "big")
            s = int.from_bytes(raw_signature[32:], "big")
            self._signing_key.public_key().verify(
                encode_dss_signature(r, s), f"{header}.{payload}".encode("ascii"), ec.ECDSA(hashes.SHA256())
            )
            return True
        except (ValueError, TypeError, json.JSONDecodeError, InvalidSignature):
            return False

    @staticmethod
    def _build_adf(handoff_id: str, arguments: Dict[str, Any]) -> str:
        contact = arguments["contact"]
        email = f"<email>{escape(contact['email'])}</email>" if contact.get("email") else ""
        phone = f"<phone>{escape(contact['phone'])}</phone>" if contact.get("phone") else ""
        vehicle = f"<vehicle><id source=\"dealeragent\">{escape(arguments['vehicle_id'])}</id></vehicle>" if arguments.get("vehicle_id") else ""
        comments = f"<comments>{escape(arguments['message'])}</comments>" if arguments.get("message") else ""
        return (
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            f"<adf><prospect><id source=\"dealeragent\">{escape(handoff_id)}</id><requestdate>{Gateway._timestamp(datetime.now(timezone.utc))}</requestdate>"
            f"{vehicle}<customer><contact><name part=\"full\">{escape(contact['name'])}</name>{email}{phone}</contact>{comments}</customer>"
            f"<vendor><id source=\"dealeragent\">{escape(arguments['rooftop_id'])}</id><vendorname>Example Motors</vendorname></vendor>"
            f"<provider><name part=\"full\">Dealer Agent Protocol reference gateway</name><service>consented agent handoff</service></provider>"
            "</prospect></adf>"
        )

    def _find_vehicle(self, arguments: Dict[str, Any], published_only: bool) -> Dict[str, Any]:
        if arguments["organization_id"] != ORGANIZATION_ID or arguments["rooftop_id"] not in {DOWNTOWN, NORTH}:
            raise not_found()
        selector = next(key for key in ("vehicle_id", "vin", "stock_number") if key in arguments)
        value = arguments[selector]
        for vehicle in self.data["vehicles"]:
            if (
                vehicle["organization_id"] == arguments["organization_id"]
                and vehicle["rooftop_id"] == arguments["rooftop_id"]
                and vehicle[selector] == value
                and (not published_only or vehicle["vehicle_id"] in self.published_vehicle_ids)
            ):
                return vehicle
        raise not_found()

    @staticmethod
    def _require_grant(
        auth: Optional[AuthContext], organization_id: str, rooftop_id: str, scope: str
    ) -> None:
        if auth is None:
            raise GatewayError("dealeragent.auth.required", "Authentication is required for authoritative availability.")
        if organization_id not in auth.organization_ids or rooftop_id not in auth.rooftop_ids:
            raise GatewayError("dealeragent.tenant.forbidden", "The requested tenant is outside the authorization grant.")
        if scope not in auth.scopes:
            raise GatewayError("dealeragent.scope.insufficient", "The authorization grant lacks the required scope.")

    @staticmethod
    def _vehicle_search_text(vehicle: Dict[str, Any]) -> str:
        return " ".join(
            str(vehicle.get(field, ""))
            for field in ("year", "make", "model", "trim", "condition", "stock_number", "vin")
        ).casefold()

    @staticmethod
    def _filter_vehicles(vehicles: Sequence[Dict[str, Any]], filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        result = list(vehicles)
        for field in ("vehicle_type", "make", "model", "condition", "availability"):
            if field not in filters:
                continue
            allowed = set(filters[field])
            source_field = "status" if field == "availability" else field
            if field == "availability":
                result = [vehicle for vehicle in result if vehicle["availability"][source_field] in allowed]
            else:
                result = [vehicle for vehicle in result if vehicle.get(source_field) in allowed]
        if "year_min" in filters:
            result = [vehicle for vehicle in result if vehicle["year"] >= filters["year_min"]]
        if "year_max" in filters:
            result = [vehicle for vehicle in result if vehicle["year"] <= filters["year_max"]]
        for field, comparison in (("price_min", lambda a, b: a >= b), ("price_max", lambda a, b: a <= b)):
            if field in filters:
                requested = filters[field]
                if requested["currency"] != "USD":
                    raise GatewayError("dealeragent.validation.invalid", "Price filter currency does not match inventory currency.")
                result = [
                    vehicle
                    for vehicle in result
                    if comparison(vehicle["advertised_price"]["amount"]["amount_minor"], requested["amount_minor"])
                ]
        for field in ("vin", "stock_number"):
            if field in filters:
                result = [vehicle for vehicle in result if vehicle.get(field) == filters[field]]
        return result

    @staticmethod
    def _sort_vehicles(vehicles: Sequence[Dict[str, Any]], sort: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not sort:
            return sorted(vehicles, key=lambda vehicle: vehicle["vehicle_id"])
        field = sort["field"]
        reverse = sort["order"] == "desc"
        if field == "advertised_price":
            key = lambda vehicle: vehicle["advertised_price"]["amount"]["amount_minor"]
        elif field == "odometer":
            key = lambda vehicle: vehicle.get("odometer", {}).get("value", 0)
        elif field == "observed_at":
            key = lambda vehicle: vehicle["freshness"]["observed_at"]
        else:
            key = lambda vehicle: vehicle[field]
        return sorted(vehicles, key=key, reverse=reverse)

    @staticmethod
    def _facets(vehicles: Iterable[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        counts: Dict[str, Dict[Any, int]] = {"make": {}, "model": {}, "condition": {}, "year": {}}
        for vehicle in vehicles:
            for field in counts:
                value = vehicle[field]
                counts[field][value] = counts[field].get(value, 0) + 1
        return {
            field: [{"value": value, "count": count} for value, count in sorted(values.items(), key=lambda item: str(item[0]))]
            for field, values in counts.items()
        }

    def _aggregate_freshness(self, vehicles: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
        if not vehicles:
            return {
                "observed_at": self._timestamp(self.now),
                "valid_until": self._timestamp(self.now + timedelta(minutes=15)),
                "state": "current",
                "max_age_seconds": 900,
            }
        states = {vehicle["freshness"]["state"] for vehicle in vehicles}
        state = "stale" if "stale" in states else "current"
        observed = min(vehicle["freshness"]["observed_at"] for vehicle in vehicles)
        valid_until = min(vehicle["freshness"]["valid_until"] for vehicle in vehicles)
        return {"observed_at": observed, "valid_until": valid_until, "state": state, "max_age_seconds": 900}

    def _query_hash(self, arguments: Dict[str, Any]) -> str:
        normalized = deepcopy(arguments)
        if "page" in normalized:
            normalized["page"].pop("cursor", None)
        encoded = json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def _encode_cursor(self, offset: int, query_hash: str) -> str:
        payload = json.dumps({"offset": offset, "query": query_hash}, sort_keys=True, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(self.cursor_secret, payload, hashlib.sha256).digest()
        return f"{self._b64(payload)}.{self._b64(signature)}"

    def _decode_cursor(self, cursor: str, query_hash: str) -> int:
        try:
            payload_part, signature_part = cursor.split(".", 1)
            payload = self._unb64(payload_part)
            signature = self._unb64(signature_part)
            expected = hmac.new(self.cursor_secret, payload, hashlib.sha256).digest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError("signature")
            decoded = json.loads(payload.decode("utf-8"))
            if decoded["query"] != query_hash or not isinstance(decoded["offset"], int) or decoded["offset"] < 0:
                raise ValueError("scope")
            return decoded["offset"]
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            raise GatewayError("dealeragent.validation.invalid", "The pagination cursor is invalid for this query.") from error

    @staticmethod
    def _b64(value: bytes) -> str:
        return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")

    @staticmethod
    def _unb64(value: str) -> bytes:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

    @staticmethod
    def _timestamp(value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
