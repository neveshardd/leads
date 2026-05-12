import { NextResponse } from "next/server";
import { Resend } from "resend";
import { resendTemplateDetailSchema } from "@/lib/schemas/resend-template";

type RouteContext = { params: Promise<{ id: string }> };

/** Detalhe de um template Resend (prévia / variáveis). */
export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY não configurada." }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.templates.get(id);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Template não encontrado no Resend." },
      { status: 404 },
    );
  }

  const payload = resendTemplateDetailSchema.parse({
    id: data.id,
    name: data.name,
    subject: data.subject,
    status: data.status,
    alias: data.alias,
    variables: data.variables?.map((v) => ({ key: v.key, type: v.type })) ?? null,
  });

  return NextResponse.json({ template: payload });
}
