"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

const RESEND_DASHBOARD = process.env.NEXT_PUBLIC_RESEND_DASHBOARD_URL ?? "https://resend.com/dashboard";

/** Templates de e-mail são criados e publicados no painel do Resend; esta app só lista os publicados em Disparos. */
export default function TemplatesResendInfoPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">E-mail</p>
        <h1 className="text-2xl font-semibold tracking-tight">Templates no Resend</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Os modelos de e-mail deixaram de ser editados aqui. Use o painel do Resend para criar, editar e publicar
          templates; na página <Link href="/leads/disparos" className="text-foreground underline">Disparos</Link>{" "}
          você escolhe um template publicado e envia para a fila de leads.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abrir Resend</CardTitle>
          <CardDescription>Gerencie templates e variáveis no dashboard oficial.</CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-3 sm:flex-row">
          <a
            href={RESEND_DASHBOARD}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "default" }), "gap-2")}
          >
            Painel Resend
            <ExternalLink className="size-4 opacity-80" aria-hidden />
          </a>
          <a
            href="https://resend.com/docs/dashboard/templates/introduction"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            Documentação
            <ExternalLink className="size-4 opacity-80" aria-hidden />
          </a>
        </CardPanel>
      </Card>
    </div>
  );
}
