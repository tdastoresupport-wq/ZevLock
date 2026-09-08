import { z } from "zod";

export const licenseKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^ZEV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "License key must look like ZEV-XXXX-XXXX-XXXX");

export const checkLicenseSchema = z.object({ key: licenseKeySchema });

export const activateLicenseSchema = z.object({
  key: licenseKeySchema,
  device_identifier: z.string().trim().min(8).max(128),
  platform: z.string().trim().min(1).max(64).default("iPhone"),
});

const optionalBooleans = {
  aimlock_head: z.boolean().optional(),
  stability_assist: z.boolean().optional(),
  aim_hold: z.boolean().optional(),
  aim_lockdown: z.boolean().optional(),
  sensitivity_boost: z.boolean().optional(),
  screen_boost: z.boolean().optional(),
  headshot_fix: z.boolean().optional(),
  fix_recoil: z.boolean().optional(),
};

export const updateFunctionsSchema = z.object({
  states: z.object(optionalBooleans),
});

export const durationPresetSchema = z.enum(["hour", "day", "week", "month", "custom", "permanent"]);

export const createLicenseSchema = z.object({
  plan: z.string().trim().min(1).max(64).default("Premium"),
  duration_preset: durationPresetSchema.default("month"),
  /** Required when duration_preset is "custom". Ignored for "permanent". */
  custom_days: z.number().int().min(1).max(3650).optional(),
  /** Back-compat for older clients that still send duration_days. */
  duration_days: z.number().int().min(1).max(3650).optional(),
  device_limit: z.number().int().min(1).max(10).default(1),
  display_name: z.string().trim().min(1).max(64).optional(),
  avatar: z.string().max(200_000).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const editLicenseSchema = z.object({
  display_name: z.string().trim().min(1).max(64).nullable().optional(),
  avatar: z.string().max(200_000).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  plan: z.string().trim().min(1).max(64).optional(),
  device_limit: z.number().int().min(1).max(10).optional(),
  expires_at: z.string().max(64).nullable().optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(128),
  password: z.string().min(1).max(128),
});

export const profilePresetSchema = z
  .object({
    preset: z.enum(["legacy", "standard", "high-hz"]),
  })
  .strict();

export const profileUuidSchema = z
  .object({
    uuid: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  })
  .strict();

export const extendLicenseSchema = z.object({
  extra_days: z.number().int().min(1).max(3650).default(30),
});

export const changePlanSchema = z.object({
  plan: z.string().trim().min(1).max(64),
});

export const changeDeviceLimitSchema = z.object({
  device_limit: z.number().int().min(1).max(10),
});
