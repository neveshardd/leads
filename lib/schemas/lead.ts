import { z } from "zod";
import { leadStatusSchema } from "@/lib/schemas/lead-status";

export const leadSourceSchema = z.enum(["database", "web"]);

export type LeadSource = z.infer<typeof leadSourceSchema>;

export const leadPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  company: z.string(),
  /** Ramo / nicho / categoria */
  category: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  status: leadStatusSchema,
  createdAt: z.string(),
  source: leadSourceSchema.optional(),
  url: z.string().url().optional(),
  /** Último e-mail disparado pela plataforma (opção A), se houver. */
  lastEmailSentAt: z.string().nullable().optional(),
  webSourceUrl: z.string().url().nullable().optional(),
});

export type LeadPublic = z.infer<typeof leadPublicSchema>;

export const leadsListQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  status: z.union([leadStatusSchema, z.literal("todos")]).optional().default("todos"),
});

export type LeadsListQuery = z.infer<typeof leadsListQuerySchema>;

export const leadsListResponseSchema = z.object({
  leads: z.array(leadPublicSchema),
});

export type LeadsListResponse = z.infer<typeof leadsListResponseSchema>;

export const leadsLookupBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export type LeadsLookupBody = z.infer<typeof leadsLookupBodySchema>;

export const leadCreateBodySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(500),
  email: z.string().trim().email("E-mail inválido.").max(320),
  phone: z.string().max(200).optional().default(""),
  company: z.string().max(500).optional().default(""),
  category: z.string().max(200).optional().default(""),
  city: z.string().max(200).optional().default(""),
  state: z.string().max(200).optional().default(""),
  country: z.string().max(200).optional().default(""),
  status: leadStatusSchema.optional().default("novo"),
});

export type LeadCreateBody = z.infer<typeof leadCreateBodySchema>;

export const leadCreateResponseSchema = z.object({
  lead: leadPublicSchema,
});

export type LeadCreateResponse = z.infer<typeof leadCreateResponseSchema>;
