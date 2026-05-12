import Particle from "@/components/p-table-8";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 pb-12">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Base</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Listagem de leads</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Todos os leads cadastrados na plataforma. Selecione linhas para montar a fila de envio.
        </p>
      </header>
      <Particle />
    </div>
  );
}
