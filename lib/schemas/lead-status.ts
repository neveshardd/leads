import { z } from "zod";

export const leadStatusSchema = z.enum(["novo", "contatado", "qualificado", "perdido"]);

export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  qualificado: "Qualificado",
  perdido: "Perdido",
};
