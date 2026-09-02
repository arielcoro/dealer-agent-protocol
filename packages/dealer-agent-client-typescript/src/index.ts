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
