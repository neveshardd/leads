import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Resend } from "resend";
import { getPrisma } from "@/lib/prisma";
import {
  bulkSendBodySchema,
  bulkSendCommitResponseSchema,
  bulkSendDryRunResponseSchema,
} from "@/lib/schemas/send";

function isSendableEmail(email: string) {
  const t = email.trim();
  if (!t || t === "—" || t === "-") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** Variáveis comuns para templates no Resend (ajuste as chaves no painel para coincidir). */
function resendVariablesForLead(lead: { name: string; company: string }): Record<string, string | number> {
  const company = lead.company ?? "";
  return {
    nome: lead.name,
    empresa: company,
    name: lead.name,
    company: company,
  };
}

/** Opção A: qualquer registro em EmailSent = já recebeu e-mail pela plataforma. */
async function leadIdsAlreadySent(
  prisma: ReturnType<typeof getPrisma>,
  leadIds: string[],
): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set();
  const rows = await prisma.emailSent.findMany({
    where: { leadId: { in: leadIds } },
    distinct: ["leadId"],
    select: { leadId: true },
  });
  return new Set(rows.map((r) => r.leadId));
}

export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    const body = bulkSendBodySchema.parse(await req.json());

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY não configurada." }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const tplRes = await resend.templates.get(body.templateId);
    if (tplRes.error || !tplRes.data) {
      return NextResponse.json({ error: "Template não encontrado no Resend." }, { status: 404 });
    }
    const tpl = tplRes.data;
    if (tpl.status !== "published") {
      return NextResponse.json(
        { error: "O template precisa estar publicado no Resend para disparo." },
        { status: 422 },
      );
    }

    const leads = await prisma.lead.findMany({ where: { id: { in: body.leadIds } } });
    const alreadySentSet = await leadIdsAlreadySent(
      prisma,
      leads.map((l) => l.id),
    );

    const duplicateLeadIds = leads.filter((l) => alreadySentSet.has(l.id)).map((l) => l.id);
    const invalidEmailLeadIds = leads.filter((l) => !isSendableEmail(l.email)).map((l) => l.id);

    const readyToSendCount = leads.filter((l) => {
      if (!isSendableEmail(l.email)) return false;
      if (alreadySentSet.has(l.id) && !body.allowResend) return false;
      return true;
    }).length;

    if (body.dryRun) {
      const payload = bulkSendDryRunResponseSchema.parse({
        dryRun: true,
        duplicateLeadIds,
        invalidEmailLeadIds,
        readyToSendCount,
      });
      return NextResponse.json(payload);
    }

    const envFrom = process.env.RESEND_FROM ?? "José Eugênio <send@send.joseeugenio.com.br>";
    const from = tpl.from?.trim() || envFrom;

    const envReply = process.env.RESEND_REPLY_TO?.trim();
    const tplAny = tpl as { reply_to?: string[] | null; replyTo?: string[] | null };
    const replyList = tplAny.reply_to ?? tplAny.replyTo ?? [];
    const templateReply = replyList.map((a) => String(a).trim()).filter(Boolean);
    const replyTo: string | string[] | undefined =
      templateReply.length > 0
        ? templateReply.length === 1
          ? templateReply[0]
          : templateReply
        : envReply || undefined;

    let sent = 0;
    let skippedInvalidEmail = 0;
    let skippedDuplicate = 0;
    const errors: { leadId: string; message: string }[] = [];

    for (const lead of leads) {
      if (!isSendableEmail(lead.email)) {
        skippedInvalidEmail += 1;
        continue;
      }
      if (alreadySentSet.has(lead.id) && !body.allowResend) {
        skippedDuplicate += 1;
        continue;
      }

      const { data, error } = await resend.emails.send({
        from,
        to: lead.email.trim(),
        ...(replyTo !== undefined ? { replyTo } : {}),
        template: {
          id: body.templateId,
          variables: resendVariablesForLead({
            name: lead.name,
            company: lead.company ?? "",
          }),
        },
      });

      if (error) {
        errors.push({ leadId: lead.id, message: error.message });
      } else {
        sent += 1;
        await prisma.emailSent.create({
          data: {
            leadId: lead.id,
            templateId: body.templateId,
            toAddress: lead.email.trim(),
            resendMessageId: data?.id ?? null,
          },
        });
        alreadySentSet.add(lead.id);
      }
    }

    const missing = body.leadIds.filter((id) => !leads.some((l) => l.id === id));
    for (const id of missing) {
      errors.push({ leadId: id, message: "Lead não encontrado." });
    }

    const payload = bulkSendCommitResponseSchema.parse({
      dryRun: false,
      sent,
      skippedInvalidEmail,
      skippedDuplicate,
      errors,
    });
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Falha no disparo." }, { status: 500 });
  }
}
