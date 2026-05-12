import { z } from "zod";
import { serperImportCandidateSchema } from "@/lib/schemas/serper";

export const leadImportLocationSchema = z.object({
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export const leadImportWebBodySchema = z.object({
  items: z.array(serperImportCandidateSchema).min(1).max(25),
  inheritLocation: leadImportLocationSchema.optional(),
});

export type LeadImportWebBody = z.infer<typeof leadImportWebBodySchema>;

export const leadImportWebResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  skippedDuplicate: z.number().int().nonnegative(),
  errors: z.array(z.object({ url: z.string(), message: z.string() })),
});

export type LeadImportWebResponse = z.infer<typeof leadImportWebResponseSchema>;
