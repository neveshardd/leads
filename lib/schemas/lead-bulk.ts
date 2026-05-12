import { z } from "zod";

export const bulkDeleteLeadsBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export type BulkDeleteLeadsBody = z.infer<typeof bulkDeleteLeadsBodySchema>;
