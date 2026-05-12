"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { BulkSendBody, BulkSendCommitResponse, BulkSendDryRunResponse } from "@/lib/schemas/send";

export function useBulkSendDryRunQuery(
  leadIds: string[],
  templateId: string,
  allowResend: boolean,
  enabled: boolean,
) {
  const sorted = [...leadIds].sort().join(",");
  return useQuery({
    queryKey: ["send-dry-run", sorted, templateId, allowResend],
    enabled: enabled && leadIds.length > 0 && Boolean(templateId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.post<BulkSendDryRunResponse>("/send/bulk", {
        leadIds,
        templateId,
        allowResend,
        dryRun: true,
      });
      return data;
    },
  });
}

export function useBulkSendMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Omit<BulkSendBody, "dryRun">) => {
      const { data } = await api.post<BulkSendCommitResponse>("/send/bulk", {
        ...body,
        dryRun: false,
      });
      return data;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
      void qc.invalidateQueries({ queryKey: ["send-dry-run"] });
    },
  });
}
