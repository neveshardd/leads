import { z } from "zod";

/** Item retornado por GET /api/resend-templates (só publicados). */
export const resendTemplateListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  alias: z.string().nullable(),
  status: z.enum(["draft", "published"]),
  published_at: z.string().nullable(),
});

export type ResendTemplateListItem = z.infer<typeof resendTemplateListItemSchema>;

export const resendTemplatesListResponseSchema = z.object({
  templates: z.array(resendTemplateListItemSchema),
});

export type ResendTemplatesListResponse = z.infer<typeof resendTemplatesListResponseSchema>;

export const resendTemplateVariableSchema = z.object({
  key: z.string(),
  type: z.enum(["string", "number"]),
});

export const resendTemplateDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string().nullable(),
  status: z.enum(["draft", "published"]),
  alias: z.string().nullable(),
  variables: z.array(resendTemplateVariableSchema).nullable(),
});

export type ResendTemplateDetail = z.infer<typeof resendTemplateDetailSchema>;
