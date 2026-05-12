import { z } from "zod";

export const bulkSendBodySchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1),
  templateId: z.string().min(1),
  /** Se true, envia também para leads que já receberam e-mail (opção A + confirmação no UI). */
  allowResend: z.boolean().optional().default(false),
  /** Só simula: retorna duplicados / e-mail inválido / quantos receberiam envio. */
  dryRun: z.boolean().optional().default(false),
});

export type BulkSendBody = z.infer<typeof bulkSendBodySchema>;

export const bulkSendDryRunResponseSchema = z.object({
  dryRun: z.literal(true),
  duplicateLeadIds: z.array(z.string()),
  invalidEmailLeadIds: z.array(z.string()),
  readyToSendCount: z.number().int().nonnegative(),
});

export type BulkSendDryRunResponse = z.infer<typeof bulkSendDryRunResponseSchema>;

export const bulkSendCommitResponseSchema = z.object({
  dryRun: z.literal(false),
  sent: z.number().int().nonnegative(),
  skippedInvalidEmail: z.number().int().nonnegative(),
  skippedDuplicate: z.number().int().nonnegative(),
  errors: z.array(z.object({ leadId: z.string(), message: z.string() })),
});

export type BulkSendCommitResponse = z.infer<typeof bulkSendCommitResponseSchema>;
