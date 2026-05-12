import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  leadCreateBodySchema,
  leadCreateResponseSchema,
  leadsListQuerySchema,
} from "@/lib/schemas/lead";
import { leadIncludeLastEmail, mapLeadToPublic } from "@/lib/server/lead-mapper";

function addContains(
  and: Prisma.LeadWhereInput[],
  field: "category" | "city" | "state" | "country",
  value: string | undefined,
) {
  const t = value?.trim();
  if (!t) return;
  and.push({ [field]: { contains: t, mode: "insensitive" } });
}

export async function GET(req: NextRequest) {
  const prisma = getPrisma();
  try {
    const sp = req.nextUrl.searchParams;
    const parsed = leadsListQuerySchema.safeParse({
      q: sp.get("q") ?? undefined,
      category: sp.get("category") ?? undefined,
      city: sp.get("city") ?? undefined,
      state: sp.get("state") ?? undefined,
      country: sp.get("country") ?? undefined,
      status: sp.get("status") ?? "todos",
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { q, category, city, state, country, status } = parsed.data;

    const where: Prisma.LeadWhereInput = {};
    if (status !== "todos") {
      where.status = status;
    }

    const and: Prisma.LeadWhereInput[] = [];
    addContains(and, "category", category);
    addContains(and, "city", city);
    addContains(and, "state", state);
    addContains(and, "country", country);

    const t = q?.trim();
    if (t) {
      and.push({
        OR: [
          { name: { contains: t, mode: "insensitive" } },
          { email: { contains: t, mode: "insensitive" } },
          { company: { contains: t, mode: "insensitive" } },
        ],
      });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const rows = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: leadIncludeLastEmail,
    });

    return NextResponse.json({ leads: rows.map(mapLeadToPublic) });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Falha ao listar leads." }, { status: 500 });
  }
}

function trimField(s: string, max: number) {
  return s.trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  const prisma = getPrisma();
  try {
    const body = leadCreateBodySchema.parse(await req.json());
    const row = await prisma.lead.create({
      data: {
        name: trimField(body.name, 500),
        email: trimField(body.email, 320),
        phone: trimField(body.phone ?? "", 200),
        company: trimField(body.company ?? "", 500),
        category: trimField(body.category ?? "", 200),
        city: trimField(body.city ?? "", 200),
        state: trimField(body.state ?? "", 200),
        country: trimField(body.country ?? "", 200),
        status: body.status,
      },
      include: leadIncludeLastEmail,
    });
    const payload = leadCreateResponseSchema.parse({ lead: mapLeadToPublic(row) });
    return NextResponse.json(payload, { status: 201 });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar lead." }, { status: 500 });
  }
}
