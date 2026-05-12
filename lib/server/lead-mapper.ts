import type { LeadStatus as PrismaLeadStatus } from "@prisma/client";
import { leadPublicSchema } from "@/lib/schemas/lead";
import type { LeadPublic } from "@/lib/schemas/lead";
import { leadWebUrlFromStoredSource } from "@/lib/lead-display";

export type LeadRowWithSents = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  category: string;
  city: string;
  state: string;
  country: string;
  webSourceUrl: string | null;
  status: PrismaLeadStatus;
  createdAt: Date;
  emailSents: { sentAt: Date }[];
};

export const leadIncludeLastEmail = {
  emailSents: {
    orderBy: { sentAt: "desc" as const },
    take: 1,
    select: { sentAt: true },
  },
} as const;

export function mapLeadToPublic(lead: LeadRowWithSents): LeadPublic {
  const last = lead.emailSents[0]?.sentAt;
  return leadPublicSchema.parse({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    category: lead.category,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    webSourceUrl: lead.webSourceUrl,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
    source: "database",
    lastEmailSentAt: last ? last.toISOString() : null,
    url: leadWebUrlFromStoredSource(lead.webSourceUrl),
  });
}
