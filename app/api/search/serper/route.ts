import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getPrisma } from "@/lib/prisma";
import { buildSerperMapsRequest } from "@/lib/serper/build-query";
import {
  buildPlacesImportCandidates,
  fetchSerperMaps,
  mapPlacesToLeadRows,
  normalizeSerperQuery,
} from "@/lib/serper/fetch-serp";
import {
  serperMapsResponseSchema,
  serperSearchApiResponseSchema,
  serperSearchParamsSchema,
} from "@/lib/schemas/serper";

const CACHE_DAYS = 7;

const emptySerper = { leads: [] as never[], importCandidates: [] as never[], cached: false };

export async function GET(req: NextRequest) {
  const prisma = getPrisma();
  try {
    const sp = req.nextUrl.searchParams;
    const raw = {
      category: sp.get("category") ?? undefined,
      city: sp.get("city") ?? undefined,
      state: sp.get("state") ?? undefined,
      country: sp.get("country") ?? undefined,
      q: sp.get("q") ?? undefined,
    };
    const parsed = serperSearchParamsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({
        error: "Consulta muito curta ou inválida.",
        ...emptySerper,
      });
    }
    const facets = parsed.data;
    const mapsReq = buildSerperMapsRequest(facets);
    const queryKey = normalizeSerperQuery(
      JSON.stringify({
        serper: "maps",
        q: mapsReq.mapsQ,
        location: mapsReq.location,
        gl: mapsReq.gl ?? "",
        hl: mapsReq.hl,
      }),
    );

    const inheritLoc = {
      category: facets.category?.trim(),
      city: facets.city?.trim(),
      state: facets.state?.trim(),
      country: facets.country?.trim(),
    };

    const now = new Date();
    const cached = await prisma.serperSearchCache.findUnique({ where: { queryKey } });
    if (cached && cached.expiresAt > now) {
      const parsedCache = serperMapsResponseSchema.safeParse(cached.responseJson);
      const serpData = parsedCache.success ? parsedCache.data : { places: [] };
      const leads = mapPlacesToLeadRows(serpData, inheritLoc);
      const importCandidates = buildPlacesImportCandidates(serpData);
      const body = serperSearchApiResponseSchema.parse({ leads, importCandidates, cached: true });
      return NextResponse.json(body);
    }

    const serp = await fetchSerperMaps(mapsReq);
    const expiresAt = new Date(now.getTime() + CACHE_DAYS * 24 * 60 * 60 * 1000);

    await prisma.serperSearchCache.upsert({
      where: { queryKey },
      create: {
        queryKey,
        responseJson: serp as object,
        expiresAt,
      },
      update: {
        responseJson: serp as object,
        expiresAt,
      },
    });

    const leads = mapPlacesToLeadRows(serp, inheritLoc);
    const importCandidates = buildPlacesImportCandidates(serp);
    const body = serperSearchApiResponseSchema.parse({ leads, importCandidates, cached: false });
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.message, ...emptySerper }, { status: 400 });
    }
    console.error(e);
    const message = e instanceof Error ? e.message : "Erro na busca web.";
    return NextResponse.json({ error: message, ...emptySerper }, { status: 502 });
  }
}
