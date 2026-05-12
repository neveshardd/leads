"use client";

import { useMemo, useState } from "react";
import { useLeadsQuery } from "@/lib/hooks/use-leads";
import { LeadsDataTable } from "@/components/leads-data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type LeadsMailboxViewProps = {
  mailbox: "inbox" | "sent";
  showBulkToolbar?: boolean;
  showLastEmailColumn?: boolean;
};

export function LeadsMailboxView({
  mailbox,
  showBulkToolbar = true,
  showLastEmailColumn = true,
}: LeadsMailboxViewProps) {
  const [onlyRealEmail, setOnlyRealEmail] = useState(() => mailbox === "inbox");
  const [hasPhone, setHasPhone] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);

  const listParams = useMemo(
    () => ({
      mailbox,
      status: "todos" as const,
      onlyRealEmail,
      hasPhone,
      hasCompany,
    }),
    [mailbox, onlyRealEmail, hasPhone, hasCompany],
  );

  const { data, isPending, isError } = useLeadsQuery(listParams);

  const filterTitle =
    mailbox === "sent" ? "Filtros (enviados)" : "Filtros da base";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/15 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:mr-2">
          {filterTitle}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={onlyRealEmail}
              onCheckedChange={(v) => setOnlyRealEmail(!!v)}
              aria-label="Só leads com e-mail válido para disparo"
            />
            Com e-mail para disparo
          </Label>
          <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
            <Checkbox checked={hasPhone} onCheckedChange={(v) => setHasPhone(!!v)} aria-label="Só com telefone" />
            Com telefone
          </Label>
          <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={hasCompany}
              onCheckedChange={(v) => setHasCompany(!!v)}
              aria-label="Só com empresa preenchida"
            />
            Com empresa
          </Label>
        </div>
      </div>
      <LeadsDataTable
        leads={data?.leads ?? []}
        isPending={isPending}
        isError={isError}
        showLastEmailColumn={showLastEmailColumn}
        showBulkToolbar={showBulkToolbar}
        emptyMessage={
          mailbox === "sent"
            ? "Nenhum lead enviado ainda. Após um disparo bem-sucedido, o lead aparece aqui e sai da listagem principal."
            : "Nenhum resultado."
        }
      />
    </div>
  );
}
