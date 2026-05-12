import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

function getDatasourceUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;

  const argv = process.argv.join(" ");
  const needsDb =
    argv.includes("migrate") ||
    argv.includes("db push") ||
    argv.includes("db pull") ||
    argv.includes("db execute");

  if (needsDb) {
    throw new Error(
      "DATABASE_URL não encontrada. Adicione um arquivo .env na raiz com DATABASE_URL (veja .env.example). O Prisma CLI carrega o .env automaticamente via dotenv neste projeto.",
    );
  }

  // `prisma generate` etc. — URL fictícia só para satisfazer o parser do config
  return "postgresql://127.0.0.1:5432/__prisma_generate_only__";
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: getDatasourceUrl(),
  },
});
