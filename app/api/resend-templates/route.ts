import { NextResponse } from "next/server";
import { Resend } from "resend";
import { resendTemplatesListResponseSchema } from "@/lib/schemas/resend-template";

/** Lista templates publicados na conta Resend (criação/edição no painel Resend). */
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY não configurada." }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.templates.list({ limit: 100 });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Falha ao listar templates no Resend." },
      { status: 502 },
    );
  }

  const published = data.data.filter((t) => t.status === "published");
  const payload = resendTemplatesListResponseSchema.parse({
    templates: published.map((t) => ({
      id: t.id,
      name: t.name,
      alias: t.alias,
      status: t.status,
      published_at: t.published_at,
    })),
  });

  return NextResponse.json(payload);
}
