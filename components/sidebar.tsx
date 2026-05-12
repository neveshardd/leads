"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, FileText, List, PanelLeftClose, PanelRightOpen, Search, Send, UserPlus } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Listagem de Leads", icon: List },
  { href: "/leads/busca", label: "Busca de Leads", icon: Search },
  { href: "/leads/novo", label: "Novo lead (teste)", icon: UserPlus },
  { href: "/leads/disparos", label: "Disparos", icon: Send },
  { href: "/leads/templates", label: "Templates (Resend)", icon: FileText },
];

const STORAGE_KEY = "leads-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hintOpen, setHintOpen] = useState(true);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col gap-2 border-r border-border bg-sidebar py-3 transition-[width] duration-200",
        collapsed ? "w-[4.25rem] px-1.5" : "w-60 px-3",
      )}
    >
      <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}>
        {!collapsed ? (
          <p className="truncate px-1 text-sm font-medium">Leads</p>
        ) : (
          <span className="sr-only">Leads</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <PanelRightOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex items-center rounded-lg py-2 transition-colors",
                collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                active ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {!collapsed ? (
        <Collapsible open={hintOpen} onOpenChange={setHintOpen} className="mt-auto border-t border-border pt-2">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-sidebar-accent">
            <span>Dica</span>
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform", hintOpen && "rotate-180")}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-1 text-xs text-muted-foreground">
            Importe candidatos da busca web para alimentar a listagem e a fila de envio.
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </aside>
  );
}
