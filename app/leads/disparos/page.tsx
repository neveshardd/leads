"use client";

import { useState, useMemo, useEffect } from "react";
import { useLeadsStore } from "@/store/leads";
import { Button, buttonVariants } from "@/components/ui/button";
import { Trash2, Send, CheckCircle2, AlertCircle, Inbox, ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLeadsLookupQuery } from "@/lib/hooks/use-leads";
import { useResendTemplateDetailQuery, useResendTemplatesQuery } from "@/lib/hooks/use-resend-templates";
import { useBulkSendDryRunQuery, useBulkSendMutation } from "@/lib/hooks/use-send";
import type { BulkSendCommitResponse } from "@/lib/schemas/send";
import { formatLeadEmailForTable, hasSendableLeadEmail, isSyntheticWebImportEmail } from "@/lib/lead-display";
import { EditLeadDialog } from "@/components/edit-lead-dialog";
import type { LeadPublic } from "@/lib/schemas/lead";
import { cn } from "@/lib/utils";

const RESEND_DASHBOARD = process.env.NEXT_PUBLIC_RESEND_DASHBOARD_URL ?? "https://resend.com/dashboard";

export default function DisparosPage() {
  const { sendListIds, toggleSendListId, clearSendList, removeSendListIds } = useLeadsStore();
  const selectedLeadsQuery = useLeadsLookupQuery(sendListIds);
  const selectedLeads = selectedLeadsQuery.data ?? [];

  const [leadToEdit, setLeadToEdit] = useState<LeadPublic | null>(null);

  const templatesQuery = useResendTemplatesQuery();
  const resendTemplates = templatesQuery.data ?? [];

  const bulkSend = useBulkSendMutation();

  useEffect(() => {
    if (!selectedLeadsQuery.data?.length) return;
    const invalidIds = selectedLeadsQuery.data
      .filter((l) => !hasSendableLeadEmail(l.email))
      .map((l) => l.id);
    if (invalidIds.length > 0) removeSendListIds(invalidIds);
  }, [selectedLeadsQuery.data, removeSendListIds]);

  const sendableSelectedLeads = useMemo(
    () => selectedLeads.filter((l) => hasSendableLeadEmail(l.email)),
    [selectedLeads],
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);
  const [lastCommit, setLastCommit] = useState<BulkSendCommitResponse | null>(null);
  const [allowResend, setAllowResend] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);

  const templateDetailQuery = useResendTemplateDetailQuery(selectedTemplateId || null);
  const templateDetail = templateDetailQuery.data;

  useEffect(() => {
    if (!selectedTemplateId) return;
    if (!resendTemplates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
  }, [resendTemplates, selectedTemplateId]);

  const hasSelectedTemplate = Boolean(
    selectedTemplateId && resendTemplates.some((t) => t.id === selectedTemplateId),
  );

  const dryRun = useBulkSendDryRunQuery(
    sendableSelectedLeads.map((l) => l.id),
    selectedTemplateId,
    allowResend,
    hasSelectedTemplate && sendableSelectedLeads.length > 0 && Boolean(selectedTemplateId),
  );

  const dupIds = new Set(dryRun.data?.duplicateLeadIds ?? []);
  const readyCount = dryRun.data?.readyToSendCount ?? 0;
  const invalidCount = dryRun.data?.invalidEmailLeadIds.length ?? 0;

  const sendCommit = async () => {
    if (sendableSelectedLeads.length === 0 || !selectedTemplateId) return;
    try {
      const r = await bulkSend.mutateAsync({
        leadIds: sendableSelectedLeads.map((l) => l.id),
        templateId: selectedTemplateId,
        allowResend,
      });
      setLastCommit(r);
      setSendSuccess(true);
      setResendDialogOpen(false);
      setTimeout(() => {
        setSendSuccess(false);
        setLastCommit(null);
        clearSendList();
      }, 5000);
    } catch {
      /* axios */
    }
  };

  const handleDispararClick = () => {
    if (sendableSelectedLeads.length === 0 || !selectedTemplateId) return;
    const dupN = dryRun.data?.duplicateLeadIds.length ?? 0;
    if (allowResend && dupN > 0) {
      setResendDialogOpen(true);
      return;
    }
    void sendCommit();
  };

  const canSendEmail =
    hasSelectedTemplate &&
    sendableSelectedLeads.length > 0 &&
    readyCount > 0 &&
    !dryRun.isFetching &&
    !dryRun.isError;

  const selectedListItem = useMemo(
    () => resendTemplates.find((t) => t.id === selectedTemplateId),
    [resendTemplates, selectedTemplateId],
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Disparo</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Disparos</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Escolha um template publicado no Resend, revise a fila e dispare e-mails em lote. Crie e edite
            modelos no painel do Resend.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={RESEND_DASHBOARD}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            Painel Resend
            <ExternalLink className="size-3.5 opacity-70" aria-hidden />
          </a>
          <a
            href="https://resend.com/docs/dashboard/templates/introduction"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-muted-foreground")}
          >
            Docs templates
            <ExternalLink className="size-3.5 opacity-70" aria-hidden />
          </a>
        </div>
      </header>

      <EditLeadDialog
        lead={leadToEdit}
        open={leadToEdit != null}
        onOpenChange={(open) => {
          if (!open) setLeadToEdit(null);
        }}
      />

      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Confirmar reenvio</DialogTitle>
            <DialogDescription>
              Você marcou envio para leads que já receberam e-mail pela plataforma. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter variant="bare">
            <Button type="button" variant="outline" onClick={() => setResendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void sendCommit()}>
              Sim, enviar
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <Card className="flex min-h-[420px] w-full min-w-0 flex-col overflow-hidden lg:max-w-sm">
          <CardHeader className="border-b border-border/60 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Fila de envio</CardTitle>
                <CardDescription>
                  {sendableSelectedLeads.length} com e-mail para disparo
                  {sendListIds.length > sendableSelectedLeads.length ? (
                    <span className="block text-[11px] text-muted-foreground/90">
                      {sendListIds.length - sendableSelectedLeads.length} sem e-mail válido{" "}
                      {selectedLeadsQuery.isPending ? "" : "foram retirados da fila"}
                    </span>
                  ) : null}
                </CardDescription>
              </div>
              {sendListIds.length > 0 ? (
                <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={clearSendList}>
                  Limpar
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <ScrollArea className="min-h-0 flex-1">
            <CardPanel className="space-y-2 pt-0">
              {selectedLeadsQuery.isPending && sendListIds.length > 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-sm text-muted-foreground">
                  Carregando leads…
                </div>
              ) : sendListIds.length === 0 || (!selectedLeadsQuery.isPending && sendableSelectedLeads.length === 0) ? (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <Inbox className="mb-3 size-10 text-muted-foreground/35" aria-hidden />
                  <p className="text-sm font-medium">Fila vazia</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Só entram na fila leads com e-mail válido. Na listagem, use o lápis para editar o e-mail ou o
                    botão de fila em cada linha.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pr-3">
                  {sendableSelectedLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">{lead.name}</span>
                          {hasSelectedTemplate && dupIds.has(lead.id) ? (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              Já enviado
                            </Badge>
                          ) : null}
                        </div>
                        <p
                          className="truncate text-xs text-muted-foreground"
                          title={
                            isSyntheticWebImportEmail(lead.email) ? lead.email : lead.email || undefined
                          }
                        >
                          {formatLeadEmailForTable(lead.email)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setLeadToEdit(lead)}
                        aria-label="Editar lead"
                        title="Editar lead"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => toggleSendListId(lead.id)}
                        aria-label="Remover da fila"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardPanel>
          </ScrollArea>
        </Card>

        <Card className="flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden">
          <CardHeader className="border-b border-border/60 py-4">
            <CardTitle className="text-base">Configuração do disparo</CardTitle>
            <CardDescription>Template do Resend (publicado), fila e confirmação.</CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-1 flex-col gap-6 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground">Template Resend</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(value) => {
                  setSelectedTemplateId(value ?? "");
                  setAllowResend(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um template publicado…" />
                </SelectTrigger>
                <SelectPopup>
                  {templatesQuery.isPending ? (
                    <div className="p-3 text-sm text-muted-foreground">Carregando templates…</div>
                  ) : templatesQuery.isError ? (
                    <div className="p-3 text-sm text-destructive">
                      Não foi possível listar templates. Verifique RESEND_API_KEY e a conta Resend.
                    </div>
                  ) : resendTemplates.length === 0 ? (
                    <div className="max-w-xs p-3 text-sm leading-relaxed text-muted-foreground">
                      Nenhum template publicado. Publique um template no Resend para ele aparecer aqui.
                    </div>
                  ) : (
                    resendTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.alias ? ` (${t.alias})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectPopup>
              </Select>
            </div>

            {hasSelectedTemplate && sendableSelectedLeads.length > 0 && selectedTemplateId ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                {dryRun.isError ? (
                  <p className="text-sm text-destructive">
                    Não foi possível analisar a fila (verifique RESEND_API_KEY e o template no Resend).
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-sm leading-relaxed">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>
                      {dryRun.isFetching ? (
                        "Analisando fila…"
                      ) : (
                        <>
                          Prontos para envio: <strong className="text-foreground">{readyCount}</strong> de{" "}
                          {sendableSelectedLeads.length}. E-mail inválido: {invalidCount}. Já receberam: {dupIds.size}.
                        </>
                      )}
                    </span>
                  </p>
                )}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="allow-resend"
                    checked={allowResend}
                    onCheckedChange={(v) => setAllowResend(Boolean(v))}
                    disabled={dupIds.size === 0}
                  />
                  <Label htmlFor="allow-resend" className="cursor-pointer text-sm leading-snug text-muted-foreground">
                    Permitir reenvio para quem já recebeu e-mail pela plataforma.
                  </Label>
                </div>
              </div>
            ) : null}

            {selectedTemplateId && selectedListItem ? (
              <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="uppercase tracking-wider">
                    Resend
                  </Badge>
                  <span className="text-sm font-medium">{selectedListItem.name}</span>
                </div>

                {templateDetailQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">Carregando detalhes do template…</p>
                ) : templateDetailQuery.isError ? (
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar o detalhe do template (id pode ser inválido ou a API falhou).
                  </p>
                ) : templateDetail ? (
                  <>
                    {templateDetail.subject ? (
                      <div className="border-b border-border/60 pb-3 text-sm">
                        <span className="text-muted-foreground">Assunto padrão </span>
                        <span>{templateDetail.subject}</span>
                      </div>
                    ) : null}
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      O envio usa o HTML do template no Resend. Variáveis enviadas automaticamente para cada lead:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">nome</code>,{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">empresa</code>,{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">name</code>,{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">company</code> (valores do
                      cadastro). Defina no template as mesmas chaves ou ajuste o código.
                    </p>
                    {templateDetail.variables && templateDetail.variables.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Variáveis no template:</span>{" "}
                        {templateDetail.variables.map((v) => v.key).join(", ")}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <Separator />

            <div className="mt-auto flex flex-col gap-4 border-t border-border/60 pt-6">
              {sendSuccess && lastCommit ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/25 p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    Disparo concluído
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Enviados: {lastCommit.sent}. Ignorados (e-mail inválido): {lastCommit.skippedInvalidEmail}.
                    Ignorados (duplicado): {lastCommit.skippedDuplicate}. Erros: {lastCommit.errors.length}.
                  </p>
                </div>
              ) : null}

              <Button
                size="lg"
                className="w-full gap-2"
                disabled={
                  sendableSelectedLeads.length === 0 ||
                  !selectedTemplateId ||
                  !hasSelectedTemplate ||
                  !canSendEmail ||
                  bulkSend.isPending ||
                  sendSuccess
                }
                onClick={handleDispararClick}
              >
                <Send className="size-4" />
                {bulkSend.isPending ? "Enviando…" : `Disparar (${readyCount || sendableSelectedLeads.length})`}
              </Button>
            </div>
          </CardPanel>
        </Card>
      </div>
    </div>
  );
}
