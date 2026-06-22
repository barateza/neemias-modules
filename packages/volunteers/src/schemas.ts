import { z } from "zod";

export const volunteerSchema = z.object({
  volunteerId: z.string().uuid(),
  displayName: z.string().min(1).max(140),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  photoRef: z.string().default(""),
  status: z.enum(["ACTIVE", "INACTIVE", "REMOVED"]),
  areas: z.array(z.string()).default([]),
  nucleusId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid(),
});

export const volunteerCreateSchema = z.object({
  displayName: z.string().min(1).max(140),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  photoRef: z.string().optional().default(""),
  areas: z.array(z.string()).default([]),
  nucleusId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  consentPhoto: z.boolean(),
  consentData: z.boolean(),
  classes: z
    .array(
      z.object({
        classId: z.string().uuid(),
        role: z.enum(["TEACHER", "ASSISTANT"]),
      }),
    )
    .default([]),
});

export const volunteerUpdateSchema = volunteerCreateSchema.partial();

export const volunteerClassSchema = z.object({
  classId: z.string().uuid(),
  role: z.enum(["TEACHER", "ASSISTANT"]),
});

export const guardianSchema = z.object({
  studentId: z.string().uuid(),
  relationship: z.enum(["PAI", "MAE", "TUTOR", "AVO", "OUTRO"]),
});

export type Volunteer = z.infer<typeof volunteerSchema>;
export type VolunteerCreate = z.infer<typeof volunteerCreateSchema>;
