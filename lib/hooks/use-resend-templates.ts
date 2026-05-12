import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  ResendTemplateDetail,
  ResendTemplatesListResponse,
} from "@/lib/schemas/resend-template";

export function useResendTemplatesQuery() {
  return useQuery({
    queryKey: ["resend-templates"],
    queryFn: async () => {
      const { data } = await api.get<ResendTemplatesListResponse>("/resend-templates");
      return data.templates;
    },
  });
}

export function useResendTemplateDetailQuery(id: string | null) {
  return useQuery({
    queryKey: ["resend-template", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<{ template: ResendTemplateDetail }>(`/resend-templates/${id}`);
      return data.template;
    },
  });
}
