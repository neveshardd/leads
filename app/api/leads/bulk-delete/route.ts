import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getPrisma } from "@/lib/prisma";
import { bulkDeleteLeadsBodySchema } from "@/lib/schemas/lead-bulk";

export async function POST(req: NextRequest) {
  const prisma = getPrisma();
  try {
    const json: unknown = await req.json();
    const { ids } = bulkDeleteLeadsBodySchema.parse(json);
    const result = await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ deleted: result.count });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Falha ao excluir leads." }, { status: 500 });
  }
}
