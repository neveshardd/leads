import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getPrisma } from "@/lib/prisma";
import { leadsLookupBodySchema } from "@/lib/schemas/lead";
import { leadIncludeLastEmail, mapLeadToPublic } from "@/lib/server/lead-mapper";

export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    const json: unknown = await req.json();
    const { ids } = leadsLookupBodySchema.parse(json);
    const rows = await prisma.lead.findMany({
      where: { id: { in: ids } },
      include: leadIncludeLastEmail,
    });
    return NextResponse.json({ leads: rows.map(mapLeadToPublic) });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Falha na consulta de leads." }, { status: 500 });
  }
}
