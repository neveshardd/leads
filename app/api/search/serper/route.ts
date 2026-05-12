import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getPrisma } from "@/lib/prisma";
import { buildOrganicEmailSearchQuery, buildSerperMapsRequest } from "@/lib/serper/build-query";
import {
  buildPerPlaceEmailQueries,
  buildSerperMapsLeadBundle,
  countOrganicItemsWithVisibleEmail,
  fetchSerperMaps,
  fetchSerperSearch,
  fetchSerperSearchesBatched,
  mergeOrganicSearchResponses,
  normalizeSerperQuery,
} from "@/lib/serper/fetch-serp";
import { scrapeSiteHostEmailsForPlaces } from "@/lib/serper/website-email-scrape";
import {
  serperCacheBundleSchema,
  serperMapsResponseSchema,
  serperSearchApiResponseSchema,
  serperSearchParamsSchema,
  type SerperMapsResponse,
  type SerperSearchResponse,
} from "@/lib/schemas/serper";

const CACHE_DAYS = 7;

const emptySerper = { leads: [] as never[], importCandidates: [] as never[], cached: false };

export async function GET(req: NextRequest) {
  const prisma = getPrisma();
  const t0 = Date.now();
  const wantDebug =
    process.env.NODE_ENV === "development" || req.nextUrl.searchParams.get("debug") === "1";

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
        serper: "maps+v7",
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
      const raw = cached.responseJson;
      const bundled = serperCacheBundleSchema.safeParse(raw);
      let serpData: SerperMapsResponse;
      let organic: SerperSearchResponse | undefined;
      let siteHostEmails: Record<string, string> = {};
      if (bundled.success) {
        serpData = bundled.data.maps;
        organic = bundled.data.organic;
        siteHostEmails = bundled.data.siteHostEmails ?? {};
      } else {
        const legacy = serperMapsResponseSchema.safeParse(raw);
        serpData = legacy.success ? legacy.data : { places: [] };
        organic = undefined;
      }
      const { leads, importCandidates } = buildSerperMapsLeadBundle(
        serpData,
        organic,
        inheritLoc,
        siteHostEmails,
      );
      const body = serperSearchApiResponseSchema.parse({
        leads,
        importCandidates,
        cached: true,
        ...(wantDebug
          ? {
              debug: {
                msTotal: Date.now() - t0,
                organicItemsWithEmail: countOrganicItemsWithVisibleEmail(organic),
              },
            }
          : {}),
      });
      return NextResponse.json(body);
    }

    const serp = await fetchSerperMaps(mapsReq);
    const organicQ = buildOrganicEmailSearchQuery(mapsReq);
    const [organicBroad, scrapeResult] = await Promise.all([
      fetchSerperSearch({ q: organicQ, hl: mapsReq.hl, gl: mapsReq.gl, num: 14 }).catch(() => ({
        organic: [],
      })),
      scrapeSiteHostEmailsForPlaces(serp.places, { maxHosts: 18, concurrency: 3 }),
    ]);
    const { siteHostEmails, stats: scrapeStats } = scrapeResult;

    const perPlaceQs = buildPerPlaceEmailQueries(serp.places, inheritLoc, 18);
    const organicPerPlace = await fetchSerperSearchesBatched(perPlaceQs, {
      hl: mapsReq.hl,
      gl: mapsReq.gl,
      num: 12,
      concurrency: 3,
    });
    const organic = mergeOrganicSearchResponses([organicBroad, organicPerPlace]);
    const expiresAt = new Date(now.getTime() + CACHE_DAYS * 24 * 60 * 60 * 1000);

    await prisma.serperSearchCache.upsert({
      where: { queryKey },
      create: {
        queryKey,
        responseJson: { maps: serp, organic, siteHostEmails } as object,
        expiresAt,
      },
      update: {
        responseJson: { maps: serp, organic, siteHostEmails } as object,
        expiresAt,
      },
    });

    const { leads, importCandidates } = buildSerperMapsLeadBundle(serp, organic, inheritLoc, siteHostEmails);
    const body = serperSearchApiResponseSchema.parse({
      leads,
      importCandidates,
      cached: false,
      ...(wantDebug
        ? {
            debug: {
              msTotal: Date.now() - t0,
              organicItemsWithEmail: countOrganicItemsWithVisibleEmail(organic),
              scrapeHostsAttempted: scrapeStats.hostsAttempted,
              scrapeHostsWithEmail: scrapeStats.hostsWithEmail,
              scrapeHttpRequests: scrapeStats.httpRequests,
            },
          }
        : {}),
    });
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
