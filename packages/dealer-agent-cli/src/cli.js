#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const [command, target] = process.argv.slice(2);
const usage = "Usage: dealer-agent audit <dealer-agent.json> | conform <claim.json>";
if (!command || !target || !["audit", "conform"].includes(command)) { console.error(usage); process.exit(2); }
const document = JSON.parse(await readFile(target, "utf8"));
const failures = [];
if (command === "audit") {
  if (document.dealer_agent_protocol !== "0.1") failures.push("dealer_agent_protocol must equal 0.1");
  if (!document.organization_id || !Array.isArray(document.rooftops) || !document.rooftops.length) failures.push("organization_id and at least one rooftop are required");
  if (document.published_feed?.authority !== "asserted") failures.push("a file-only publication must use authority: asserted");
  if (document.published_feed?.availability_band === "verified_current") failures.push("a static file may not claim verified_current availability");
} else {
  if (document.standard !== "dealer-agent-protocol" || document.standard_version !== "0.1") failures.push("claim standard/version mismatch");
  if (!Array.isArray(document.profiles) || !document.profiles.length) failures.push("claim must name at least one profile");
  if (!document.test_evidence && !document.test_suite) failures.push("claim must include test evidence");
}
if (failures.length) { for (const failure of failures) console.error(`FAIL: ${failure}`); process.exit(1); }
console.log(`PASS: ${command} checks completed for ${target}`);
