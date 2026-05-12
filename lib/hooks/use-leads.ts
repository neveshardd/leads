"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useLeadsStore } from "@/store/leads";
import type { LeadCreateBody, LeadCreateResponse, LeadsListQuery, LeadsListResponse } from "@/lib/schemas/lead";
import type { LeadImportWebBody, LeadImportWebResponse } from "@/lib/schemas/lead-import";
import type { BulkDeleteLeadsBody } from "@/lib/schemas/lead-bulk";

export function useLeadsQuery(params: LeadsListQuery) {
  return useQuery({
    queryKey: ["leads", params],
    queryFn: async () => {
      const { data } = await api.get<LeadsListResponse>("/leads", {
        params: {
          q: params.q || undefined,
          category: params.category || undefined,
          city: params.city || undefined,
          state: params.state || undefined,
          country: params.country || undefined,
          status: params.status ?? "todos",
        },
      });
      return data;
    },
  });
}

export function useLeadsLookupQuery(ids: string[]) {
  const sorted = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["leads", "lookup", sorted],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await api.post<{ leads: LeadsListResponse["leads"] }>("/leads/lookup", { ids });
      return data.leads;
    },
  });
}

export function useCreateLeadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LeadCreateBody) => {
      const { data } = await api.post<LeadCreateResponse>("/leads", body);
      return data.lead;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useImportWebLeadsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LeadImportWebBody) => {
      const { data } = await api.post<LeadImportWebResponse>("/leads/import-web", body);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useBulkDeleteLeadsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: BulkDeleteLeadsBody) => {
      const { data } = await api.post<{ deleted: number }>("/leads/bulk-delete", body);
      return data;
    },
    onSuccess: async (_, body) => {
      useLeadsStore.getState().removeSendListIds(body.ids);
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["leads", "lookup"] });
    },
  });
}

export function useDeleteLeadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/leads/${id}`);
    },
    onSuccess: async (_, id) => {
      useLeadsStore.getState().removeSendListIds([id]);
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["leads", "lookup"] });
    },
  });
}
