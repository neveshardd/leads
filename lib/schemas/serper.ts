import { z } from "zod";
import { buildSerperSearchString } from "@/lib/serper/build-query";

/** Trecho relevante da resposta da API Serper (Google organic). */
export const serperOrganicItemSchema = z.object({
  title: z.string().optional(),
  link: z.string().optional(),
  snippet: z.string().optional(),
});

export const serperSearchResponseSchema = z.object({
  organic: z.array(serperOrganicItemSchema).optional(),
});

export type SerperSearchResponse = z.infer<typeof serperSearchResponseSchema>;

/** Resposta do endpoint Google Maps do Serper (empresas locais). */
export const serperMapsPlaceSchema = z
  .object({
    title: z.string(),
    address: z.string().optional(),
    website: z.string().optional(),
    phoneNumber: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(),
    rating: z.number().optional(),
    ratingCount: z.number().optional(),
    placeId: z.string().optional(),
    cid: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export const serperMapsResponseSchema = z.object({
  places: z.array(serperMapsPlaceSchema).optional(),
});

export type SerperMapsPlace = z.infer<typeof serperMapsPlaceSchema>;
export type SerperMapsResponse = z.infer<typeof serperMapsResponseSchema>;

export const serperSearchParamsSchema = z
  .object({
    category: z.string().max(120).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    country: z.string().max(120).optional(),
    q: z.string().max(200).optional(),
  })
  .refine(
    (data) => {
      const s = buildSerperSearchString(data);
      return s.length >= 4 && s.length <= 500;
    },
    { message: "Informe ramo, localização ou texto (mínimo 4 caracteres no total)." },
  );

export type SerperSearchParams = z.infer<typeof serperSearchParamsSchema>;

export const serperWebLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  company: z.string(),
  category: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  status: z.literal("novo"),
  createdAt: z.string(),
  source: z.literal("web"),
  url: z.string().url().optional(),
});

export const serperImportCandidateSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
  /** E-mail inferido (snippet Maps + busca orgânica em paralelo), quando existir. */
  email: z.string().email().max(320).optional(),
});

export type SerperImportCandidate = z.infer<typeof serperImportCandidateSchema>;

/** Métricas opcionais (dev ou `?debug=1`) para diagnosticar cobertura de e-mails. */
export const serperSearchDebugSchema = z.object({
  msTotal: z.number(),
  organicItemsWithEmail: z.number(),
  scrapeHostsAttempted: z.number().optional(),
  scrapeHostsWithEmail: z.number().optional(),
  scrapeHttpRequests: z.number().optional(),
});

export const serperSearchApiResponseSchema = z.object({
  leads: z.array(serperWebLeadSchema),
  importCandidates: z.array(serperImportCandidateSchema),
  cached: z.boolean(),
  debug: serperSearchDebugSchema.optional(),
});

export type SerperSearchApiResponse = z.infer<typeof serperSearchApiResponseSchema>;

/** Cache da rota `/api/search/serper`: Maps + SERP orgânica + e-mails raspados por host do site. */
export const serperCacheBundleSchema = z.object({
  maps: serperMapsResponseSchema,
  organic: serperSearchResponseSchema.optional(),
  /** host (sem www) → melhor e-mail encontrado na homepage */
  siteHostEmails: z.record(z.string(), z.string()).optional(),
});
