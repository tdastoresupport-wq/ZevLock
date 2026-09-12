import { findLicenseById, updateLicense } from "./db";
import type { License } from "./types";

/**
 * Deterministic license precedence: REVOKED > SUSPENDED > EXPIRED > ACTIVE.
 * A revoked/suspended key NEVER becomes active just because expires_at is
 * in the future. Permanent ACTIVE (is_permanent=1, expires_at=NULL) never
 * expires. Finite keys auto-expire past expires_at (server clock, never the
 * device clock).
 */
export function resolveLicenseStatus(lic: Pick<License, "status" | "expires_at" | "is_permanent">, nowMs = Date.now()): License["status"] {
  if (lic.status === "REVOKED") return "REVOKED";
  if (lic.status === "SUSPENDED") return "SUSPENDED";
  if (lic.is_permanent === 1) return lic.status === "ACTIVE" ? "ACTIVE" : lic.status;
  if (lic.expires_at && new Date(lic.expires_at).getTime() <= nowMs) return "EXPIRED";
  return lic.status;
}

/** Resolve effective license status (auto-expire ACTIVE keys past expires_at). */
export async function effectiveLicense(license: License): Promise<License> {
  const resolved = resolveLicenseStatus(license);
  if (resolved !== license.status) {
    await updateLicense(license.id, { status: resolved });
    return { ...license, status: resolved };
  }
  return license;
}

export async function effectiveLicenseById(id: string) {
  const lic = await findLicenseById(id);
  if (!lic) return null;
  return effectiveLicense(lic);
}
