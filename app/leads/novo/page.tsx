"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLeadMutation } from "@/lib/hooks/use-leads";
import { STATUS_LABELS, type LeadStatus } from "@/lib/schemas/lead-status";
import type { LeadCreateBody } from "@/lib/schemas/lead";
import { useLeadsStore } from "@/store/leads";
import { cn } from "@/lib/utils";

const emptyForm: LeadCreateBody = {
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

export default function NovoLeadPage() {
  const router = useRouter();
  const toggleSendListId = useLeadsStore((s) => s.toggleSendListId);
  const createLead = useCreateLeadMutation();

  const [form, setForm] = useState<LeadCreateBody>(emptyForm);
  const [addToQueue, setAddToQueue] = useState(true);
  const [lastCreatedName, setLastCreatedName] = useState<string | null>(null);

  const set =
    (key: keyof LeadCreateBody) => (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const fillSandbox = () => {
    setForm({
      ...emptyForm,
      name: "Lead teste Resend",
      email: "delivered@resend.dev",
      company: "Empresa Teste Ltda",
      phone: "(11) 99999-0000",
      category: "Testes",
      city: "São Paulo",
      state: "SP",
      country: "Brasil",
      status: "novo",
    });
  };

  const submit = async (thenGoDisparos: boolean) => {
    setLastCreatedName(null);
    try {
      const lead = await createLead.mutateAsync(form);
      setLastCreatedName(lead.name);
      if (addToQueue || thenGoDisparos) {
        toggleSendListId(lead.id);
      }
      if (thenGoDisparos) {
        router.push("/leads/disparos");
        return;
      }
      setForm(emptyForm);
    } catch {
      /* axios → interceptor */
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Cadastro</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Novo lead (teste)</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Crie leads manuais com e-mail real ou de sandbox (ex.:{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">delivered@resend.dev</code>) para
          testar templates e disparos. <strong className="font-medium text-foreground">Empresa</strong> e{" "}
          <strong className="font-medium text-foreground">nome</strong> alimentam as variáveis do Resend.
        </p>
      </header>

      {lastCreatedName && !createLead.isPending ? (
        <div className="rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
          Lead <span className="font-medium text-foreground">{lastCreatedName}</span> criado com sucesso.
          {addToQueue ? " Adicionado à fila de disparo." : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do lead</CardTitle>
          <CardDescription>Nome e e-mail são obrigatórios; demais campos ajudam nos testes de template.</CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={fillSandbox}>
              <FlaskConical className="size-4" aria-hidden />
              Preencher exemplo (sandbox)
            </Button>
            <Link href="/leads/disparos" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}>
              Ir para disparos
              <Send className="size-3.5 opacity-70" aria-hidden />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nl-name">Nome</Label>
              <Input id="nl-name" value={form.name} onChange={set("name")} placeholder="Maria Silva" autoComplete="name" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nl-email">E-mail</Label>
              <Input
                id="nl-email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="voce@exemplo.com ou delivered@resend.dev"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-company">Empresa</Label>
              <Input id="nl-company" value={form.company} onChange={set("company")} placeholder="ACME Inc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-phone">Telefone</Label>
              <Input id="nl-phone" value={form.phone} onChange={set("phone")} placeholder="(11) 91234-5678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-category">Categoria / ramo</Label>
              <Input id="nl-category" value={form.category} onChange={set("category")} placeholder="SaaS B2B" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-city">Cidade</Label>
              <Input id="nl-city" value={form.city} onChange={set("city")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-state">Estado</Label>
              <Input id="nl-state" value={form.state} onChange={set("state")} placeholder="SP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-country">País</Label>
              <Input id="nl-country" value={form.country} onChange={set("country")} placeholder="Brasil" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: (v ?? "novo") as LeadStatus }))}
              >
                <SelectTrigger>
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

          <div className="flex items-center gap-2">
            <Checkbox id="nl-queue" checked={addToQueue} onCheckedChange={(v) => setAddToQueue(Boolean(v))} />
            <Label htmlFor="nl-queue" className="cursor-pointer text-sm font-normal leading-snug text-muted-foreground">
              Após criar, adicionar à fila de disparo
            </Label>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={createLead.isPending || !form.name.trim() || !form.email.trim()}
              loading={createLead.isPending}
              onClick={() => void submit(false)}
            >
              Criar lead
            </Button>
            <Button
              type="button"
              disabled={createLead.isPending || !form.name.trim() || !form.email.trim()}
              loading={createLead.isPending}
              onClick={() => void submit(true)}
            >
              Criar e ir para disparos
            </Button>
          </div>
        </CardPanel>
      </Card>
    </div>
  );
}
