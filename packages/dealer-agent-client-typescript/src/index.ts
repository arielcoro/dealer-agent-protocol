export type AvailabilityBand = "verified_current" | "recent_authoritative" | "asserted" | "stale" | "unknown";

export interface AvailabilityRecord {
  availability?: { status?: string; authority_status?: string; observed_at?: string };
  freshness?: { state?: string; observed_at?: string };
  provenance?: { authority_status?: string };
}

export interface AvailabilityPresentation {
  band: AvailabilityBand;
  maySayAvailableNow: boolean;
  label: string;
}

export function availabilityPresentation(record: AvailabilityRecord, now = new Date()): AvailabilityPresentation {
  const authority = record.availability?.authority_status ?? record.provenance?.authority_status;
  const observedRaw = record.freshness?.observed_at ?? record.availability?.observed_at;
  if (!observedRaw) return { band: "unknown", maySayAvailableNow: false, label: "Availability unknown" };
  const ageSeconds = Math.max(0, (now.getTime() - new Date(observedRaw).getTime()) / 1000);
  if (record.freshness?.state === "unknown") return { band: "unknown", maySayAvailableNow: false, label: "Availability unknown" };
  if (record.freshness?.state === "stale") return { band: "stale", maySayAvailableNow: false, label: "Availability needs verification" };
  if (authority === "authoritative" && ageSeconds <= 120 && record.availability?.status === "available") {
    return { band: "verified_current", maySayAvailableNow: true, label: "Available — verified now" };
  }
  if (authority === "authoritative" && ageSeconds <= 900) return { band: "recent_authoritative", maySayAvailableNow: false, label: "Recently observed — confirm before acting" };
  if ((authority === "asserted" || authority === "dealer_asserted") && ageSeconds <= 86400) return { band: "asserted", maySayAvailableNow: false, label: "Dealer-published listing — availability not verified" };
  return { band: "stale", maySayAvailableNow: false, label: "Availability needs verification" };
}

export interface InventoryTenure {
  age_days: number;
  age_as_of: string;
  age_basis: "stocked_at" | "first_public_listing_at" | "source_reported";
}

export function inventoryAgeLabel(tenure: InventoryTenure): string {
  const basis = tenure.age_basis === "stocked_at" ? "dealer stocked date" : tenure.age_basis === "first_public_listing_at" ? "first public listing" : "source-reported age";
  return `${tenure.age_days} complete days in inventory as of ${tenure.age_as_of}, based on ${basis}`;
}

export interface UsedVehicleHistory {
  history_reports?: Array<{ provider_name?: string; summary?: { accident_status?: string } }>;
  discrepancies?: Array<{ field?: string; status?: string }>;
}

export interface HistoryPresentation {
  maySayAccidentFree: false;
  label: string;
}

export function historyPresentation(details: UsedVehicleHistory): HistoryPresentation {
  const conflict = details.discrepancies?.some(item => item.status === "unresolved" && item.field?.includes("accident"));
  if (conflict) return { maySayAccidentFree: false, label: "Vehicle-history reports conflict — review the original reports" };
  const statuses = details.history_reports?.map(report => report.summary?.accident_status).filter(Boolean) ?? [];
  if (statuses.includes("events_reported")) return { maySayAccidentFree: false, label: "At least one vehicle-history report contains an accident event" };
  if (statuses.length && statuses.every(status => status === "no_events_reported")) return { maySayAccidentFree: false, label: "No accident events reported by the named reports as observed" };
  return { maySayAccidentFree: false, label: "Accident history unknown" };
}
