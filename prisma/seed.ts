import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.lead.count();
  if (count > 0) {
    console.log("Seed ignorado: já existem leads no banco.");
    return;
  }

  await prisma.lead.createMany({
    data: [
      {
        name: "Ana Souza",
        email: "ana@empresa.com",
        phone: "(11) 91234-5678",
        company: "Tech Brasil",
        category: "Software B2B",
        city: "São Paulo",
        state: "SP",
        country: "Brasil",
        status: "novo",
      },
      {
        name: "Bruno Lima",
        email: "bruno@startup.io",
        phone: "(21) 98765-4321",
        company: "StartupIO",
        category: "SaaS",
        city: "Rio de Janeiro",
        state: "RJ",
        country: "Brasil",
        status: "contatado",
      },
    ],
  });

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
