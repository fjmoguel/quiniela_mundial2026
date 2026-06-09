/**
 * Script de diagnóstico: muestra qué partidos de knockout están en la DB
 * y cómo están sus labels. Útil para entender por qué el reset-dates falla.
 *
 * Corre con: npx tsx prisma/diagnose-ko.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Diagnóstico de partidos de knockout en la DB:\n");

  const koStages = ["r32", "r16", "qf", "sf", "third_place", "final"];

  for (const stage of koStages) {
    const matches = await prisma.match.findMany({
      where: { stage },
      orderBy: { kickoff: "asc" },
    });
    console.log(`\n📌 Stage "${stage}": ${matches.length} partidos`);
    for (const m of matches) {
      console.log(`   - id: ${m.id.slice(-6)} · label: "${m.label}" · kickoff: ${m.kickoff.toISOString()}`);
    }
  }

  console.log("\n");
  // Also check if there are any matches with no stage or weird stage
  const total = await prisma.match.count();
  const groupCount = await prisma.match.count({ where: { stage: "group" } });
  const koCount = await prisma.match.count({ where: { stage: { in: koStages } } });
  console.log(`📊 Total matches en DB: ${total}`);
  console.log(`   Group stage: ${groupCount}`);
  console.log(`   Knockout: ${koCount}`);
  console.log(`   Otros: ${total - groupCount - koCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
