"use client";

import { useEffect, useState } from "react";
import type { LeadCreateBody } from "@/lib/schemas/lead";
import type { LeadPublic } from "@/lib/schemas/lead";
import { STATUS_LABELS } from "@/lib/schemas/lead-status";
import type { LeadStatus } from "@/lib/schemas/lead-status";
import { useUpdateLeadMutation } from "@/lib/hooks/use-leads";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

const emptyDraft: LeadCreateBody = {
  name: "",
  email: "",
  phone: "",
  company: "",
  category: "",
  city: "",
  state: "",
  country: "",
  status: "novo",
};

function mapLeadToForm(lead: LeadPublic): LeadCreateBody {
  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone ?? "",
    company: lead.company ?? "",
    category: lead.category ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    country: lead.country ?? "",
    status: lead.status,
  };
}

export type EditLeadDialogProps = {
  lead: LeadPublic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditLeadDialog({ lead, open, onOpenChange }: EditLeadDialogProps) {
  const [form, setForm] = useState<LeadCreateBody>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const updateMut = useUpdateLeadMutation();

  useEffect(() => {
    if (lead) {
      setForm(mapLeadToForm(lead));
      setError(null);
    }
  }, [lead]);

  const set =
    (key: keyof LeadCreateBody) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setError(null);
    try {
      await updateMut.mutateAsync({ id: lead.id, body: form });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível guardar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup showCloseButton className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col gap-0 p-0 sm:max-h-[85vh]">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-5">
          <DialogTitle>Editar lead</DialogTitle>
          <DialogDescription>
            Atualize o e-mail ou outros dados; com e-mail válido o lead pode entrar na fila de disparos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {error ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="ed-name">Nome</Label>
                <Input id="ed-name" value={form.name} onChange={set("name")} autoComplete="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-email">E-mail</Label>
                <Input
                  id="ed-email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-phone">Telefone</Label>
                <Input id="ed-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-company">Empresa</Label>
                <Input id="ed-company" value={form.company} onChange={set("company")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-category">Ramo / categoria</Label>
                <Input id="ed-category" value={form.category} onChange={set("category")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ed-city">Cidade</Label>
                  <Input id="ed-city" value={form.city} onChange={set("city")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-state">Estado</Label>
                  <Input id="ed-state" value={form.state} onChange={set("state")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-country">País</Label>
                  <Input id="ed-country" value={form.country} onChange={set("country")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: (v ?? "novo") as LeadStatus }))}
                >
                  <SelectTrigger id="ed-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter variant="bare" className="shrink-0 border-t border-border/60 px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" disabled={updateMut.isPending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={updateMut.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
