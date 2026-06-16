/**
 * Module: Núcleos (Células) — Schema Definitions
 *
 * nucleusCreateSchema and nucleusUpdateSchema live in the module
 * because they are only needed by the nuclei API, not by the core.
 *
 * The base nucleusSchema and NucleusRegion stay in @openrollcall/schemas
 * because the Student entity depends on them.
 *
 * @license BSL-1.1
 */

import { nucleusSchema } from "@openrollcall/schemas";

export const nucleusCreateSchema = nucleusSchema.pick({
  region: true,
  name: true,
});

export const nucleusUpdateSchema = nucleusCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });
