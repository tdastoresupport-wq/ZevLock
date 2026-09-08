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

export const createLicenseSchema = z.object({
  plan: z.string().trim().min(1).max(64).default("Premium"),
  duration_days: z.number().int().min(1).max(3650).default(30),
  device_limit: z.number().int().min(1).max(10).default(1),
});

export const extendLicenseSchema = z.object({
  extra_days: z.number().int().min(1).max(3650).default(30),
});

export const changePlanSchema = z.object({
  plan: z.string().trim().min(1).max(64),
});

export const changeDeviceLimitSchema = z.object({
  device_limit: z.number().int().min(1).max(10),
});
