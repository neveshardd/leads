import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getPrisma, prismaClientErrorCode } from "@/lib/prisma";
import { fallbackCompany } from "@/lib/serper/fetch-serp";
import { extractPhoneFromSnippet } from "@/lib/lead-display";
import {
  leadImportWebBodySchema,
  leadImportWebResponseSchema,
} from "@/lib/schemas/lead-import";

function syntheticEmailFromUrl(url: string): string {
  const h = createHash("sha256").update(url).digest("hex").slice(0, 48);
  return `web+${h}@import.invalid`;
}

export async function POST(req: NextRequest) {
  const prisma = getPrisma();
  try {
    const json: unknown = await req.json();
    const body = leadImportWebBodySchema.parse(json);
    const loc = body.inheritLocation ?? {};

    let created = 0;
    let skippedDuplicate = 0;
    const errors: { url: string; message: string }[] = [];

    for (const item of body.items) {
      try {
        const existing = await prisma.lead.findUnique({
          where: { webSourceUrl: item.url },
          select: { id: true },
        });
        if (existing) {
          skippedDuplicate += 1;
          continue;
        }

        await prisma.lead.create({
          data: {
            name: item.title.slice(0, 500),
            email: syntheticEmailFromUrl(item.url),
            phone: extractPhoneFromSnippet(item.snippet) ?? "",
            company: fallbackCompany(item.snippet, item.title).slice(0, 500),
            category: (loc.category ?? "").trim().slice(0, 200),
            city: (loc.city ?? "").trim().slice(0, 200),
            state: (loc.state ?? "").trim().slice(0, 200),
            country: (loc.country ?? "").trim().slice(0, 200),
            webSourceUrl: item.url,
            status: "novo",
          },
        });
        created += 1;
      } catch (e) {
        if (prismaClientErrorCode(e) === "P2002") {
          skippedDuplicate += 1;
          continue;
        }
        errors.push({
          url: item.url,
          message: e instanceof Error ? e.message : "Erro ao criar lead.",
        });
      }
    }

    const res = leadImportWebResponseSchema.parse({ created, skippedDuplicate, errors });
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Falha ao importar leads da web." }, { status: 500 });
  }
}
