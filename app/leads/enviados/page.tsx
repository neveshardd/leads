"use client";

import Link from "next/link";
import { LeadsMailboxView } from "@/components/leads-mailbox-view";

export default function LeadsEnviadosPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 pb-12">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Histórico</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Leads enviados</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Leads que já receberam e-mail pela plataforma (registro em disparos). Eles não aparecem mais na{" "}
          <Link href="/" className="text-foreground underline underline-offset-4">
            listagem principal
          </Link>
          , exceto se você usar reenvio explícito em Disparos.
        </p>
      </header>
      <LeadsMailboxView mailbox="sent" showBulkToolbar={false} />
    </div>
  );
}
