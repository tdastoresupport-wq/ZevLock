import { findLicenseById, updateLicense } from "./db";
import type { License } from "./types";

/** Resolve effective license status (auto-expire ACTIVE keys past expires_at). */
export async function effectiveLicense(license: License): Promise<License> {
  if (license.status === "ACTIVE" && license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
    await updateLicense(license.id, { status: "EXPIRED" });
    return { ...license, status: "EXPIRED" };
  }
  return license;
}

export async function effectiveLicenseById(id: string) {
  const lic = await findLicenseById(id);
  if (!lic) return null;
  return effectiveLicense(lic);
}
