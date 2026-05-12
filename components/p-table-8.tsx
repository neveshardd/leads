"use client";

import { useLeadsQuery } from "@/lib/hooks/use-leads";
import { LeadsDataTable } from "@/components/leads-data-table";

export default function Particle() {
  const { data, isPending, isError } = useLeadsQuery({ status: "todos" });
  return (
    <LeadsDataTable leads={data?.leads ?? []} isPending={isPending} isError={isError} showLastEmailColumn />
  );
}
