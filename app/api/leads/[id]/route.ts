import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getPrisma, prismaClientErrorCode } from "@/lib/prisma";
import {
  leadCreateBodySchema,
  leadCreateResponseSchema,
} from "@/lib/schemas/lead";
import { leadIncludeLastEmail, mapLeadToPublic } from "@/lib/server/lead-mapper";

type RouteContext = { params: Promise<{ id: string }> };

function trimField(s: string, max: number) {
  return s.trim().slice(0, max);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const prisma = getPrisma();
  try {
    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const body = leadCreateBodySchema.parse(await req.json());
    const row = await prisma.lead.update({
      where: { id },
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
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    if (prismaClientErrorCode(e) === "P2025") {
      return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: "Não foi possível atualizar o lead." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const prisma = getPrisma();
  try {
    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (prismaClientErrorCode(e) === "P2025") {
      return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: "Não foi possível excluir o lead." }, { status: 500 });
  }
}
