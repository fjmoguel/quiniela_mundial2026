/**
 * Reset SOLO las fechas y venues de partidos al schedule oficial FIFA 2026.
 * NO borra predicciones de usuarios ni equipos.
 *
 * Cubre los 72 partidos de grupos (matchea por equipos) y los 32 de knockout
 * (matchea por el label "Partido X").
 *
 * Corre con: npx tsx prisma/reset-dates.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function utc(date: string, hour: number, minute: number, offsetFromUTC: number): Date {
  const utcHour = hour + Math.abs(offsetFromUTC) * (offsetFromUTC < 0 ? 1 : -1);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(utcHour, minute, 0, 0);
  return d;
}

// ===========================================================================
// FASE DE GRUPOS (72 partidos) — horarios LOCALES del venue
// ===========================================================================
const GROUP_MATCHES = [
  // Group A
  { group: "A", matchday: 1, date: "2026-06-11", h: 13, m: 0, off: -6, home: "México", away: "Sudáfrica", venue: "Estadio Azteca, CDMX" },
  { group: "A", matchday: 1, date: "2026-06-11", h: 20, m: 0, off: -6, home: "Corea del Sur", away: "Chequia", venue: "Estadio Akron, Guadalajara" },
  { group: "A", matchday: 2, date: "2026-06-18", h: 12, m: 0, off: -4, home: "Chequia", away: "Sudáfrica", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "A", matchday: 2, date: "2026-06-18", h: 19, m: 0, off: -6, home: "México", away: "Corea del Sur", venue: "Estadio Akron, Guadalajara" },
  { group: "A", matchday: 3, date: "2026-06-24", h: 19, m: 0, off: -6, home: "Chequia", away: "México", venue: "Estadio Azteca, CDMX" },
  { group: "A", matchday: 3, date: "2026-06-24", h: 19, m: 0, off: -6, home: "Sudáfrica", away: "Corea del Sur", venue: "Estadio BBVA, Monterrey" },

  // Group B
  { group: "B", matchday: 1, date: "2026-06-12", h: 15, m: 0, off: -4, home: "Canadá", away: "Bosnia-Herzegovina", venue: "BMO Field, Toronto" },
  { group: "B", matchday: 1, date: "2026-06-13", h: 12, m: 0, off: -7, home: "Qatar", away: "Suiza", venue: "Levi's Stadium, SF Bay Area" },
  { group: "B", matchday: 2, date: "2026-06-18", h: 12, m: 0, off: -7, home: "Suiza", away: "Bosnia-Herzegovina", venue: "SoFi Stadium, Los Angeles" },
  { group: "B", matchday: 2, date: "2026-06-18", h: 15, m: 0, off: -7, home: "Canadá", away: "Qatar", venue: "BC Place, Vancouver" },
  { group: "B", matchday: 3, date: "2026-06-24", h: 12, m: 0, off: -7, home: "Suiza", away: "Canadá", venue: "BC Place, Vancouver" },
  { group: "B", matchday: 3, date: "2026-06-24", h: 12, m: 0, off: -7, home: "Bosnia-Herzegovina", away: "Qatar", venue: "Lumen Field, Seattle" },

  // Group C
  { group: "C", matchday: 1, date: "2026-06-13", h: 18, m: 0, off: -4, home: "Brasil", away: "Marruecos", venue: "MetLife Stadium, New Jersey" },
  { group: "C", matchday: 1, date: "2026-06-13", h: 21, m: 0, off: -4, home: "Haití", away: "Escocia", venue: "Gillette Stadium, Boston" },
  { group: "C", matchday: 2, date: "2026-06-19", h: 18, m: 0, off: -4, home: "Escocia", away: "Marruecos", venue: "Gillette Stadium, Boston" },
  { group: "C", matchday: 2, date: "2026-06-19", h: 21, m: 0, off: -4, home: "Brasil", away: "Haití", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "C", matchday: 3, date: "2026-06-24", h: 18, m: 0, off: -4, home: "Escocia", away: "Brasil", venue: "Hard Rock Stadium, Miami" },
  { group: "C", matchday: 3, date: "2026-06-24", h: 18, m: 0, off: -4, home: "Marruecos", away: "Haití", venue: "Mercedes-Benz Stadium, Atlanta" },

  // Group D
  { group: "D", matchday: 1, date: "2026-06-12", h: 18, m: 0, off: -7, home: "Estados Unidos", away: "Paraguay", venue: "SoFi Stadium, Los Angeles" },
  { group: "D", matchday: 1, date: "2026-06-13", h: 21, m: 0, off: -7, home: "Australia", away: "Turquía", venue: "BC Place, Vancouver" },
  { group: "D", matchday: 2, date: "2026-06-19", h: 12, m: 0, off: -7, home: "Estados Unidos", away: "Australia", venue: "Lumen Field, Seattle" },
  { group: "D", matchday: 2, date: "2026-06-19", h: 21, m: 0, off: -7, home: "Turquía", away: "Paraguay", venue: "Levi's Stadium, SF Bay Area" },
  { group: "D", matchday: 3, date: "2026-06-25", h: 19, m: 0, off: -7, home: "Turquía", away: "Estados Unidos", venue: "SoFi Stadium, Los Angeles" },
  { group: "D", matchday: 3, date: "2026-06-25", h: 19, m: 0, off: -7, home: "Paraguay", away: "Australia", venue: "Levi's Stadium, SF Bay Area" },

  // Group E
  { group: "E", matchday: 1, date: "2026-06-14", h: 12, m: 0, off: -5, home: "Alemania", away: "Curazao", venue: "NRG Stadium, Houston" },
  { group: "E", matchday: 1, date: "2026-06-14", h: 19, m: 0, off: -4, home: "Costa de Marfil", away: "Ecuador", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "E", matchday: 2, date: "2026-06-20", h: 16, m: 0, off: -4, home: "Alemania", away: "Costa de Marfil", venue: "BMO Field, Toronto" },
  { group: "E", matchday: 2, date: "2026-06-20", h: 19, m: 0, off: -5, home: "Ecuador", away: "Curazao", venue: "Arrowhead Stadium, Kansas City" },
  { group: "E", matchday: 3, date: "2026-06-25", h: 16, m: 0, off: -4, home: "Curazao", away: "Costa de Marfil", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "E", matchday: 3, date: "2026-06-25", h: 16, m: 0, off: -4, home: "Ecuador", away: "Alemania", venue: "MetLife Stadium, New Jersey" },

  // Group F
  { group: "F", matchday: 1, date: "2026-06-14", h: 15, m: 0, off: -5, home: "Países Bajos", away: "Japón", venue: "AT&T Stadium, Dallas" },
  { group: "F", matchday: 1, date: "2026-06-14", h: 20, m: 0, off: -6, home: "Suecia", away: "Túnez", venue: "Estadio BBVA, Monterrey" },
  { group: "F", matchday: 2, date: "2026-06-20", h: 12, m: 0, off: -5, home: "Países Bajos", away: "Suecia", venue: "NRG Stadium, Houston" },
  { group: "F", matchday: 2, date: "2026-06-20", h: 22, m: 0, off: -6, home: "Túnez", away: "Japón", venue: "Estadio BBVA, Monterrey" },
  { group: "F", matchday: 3, date: "2026-06-25", h: 18, m: 0, off: -5, home: "Japón", away: "Suecia", venue: "AT&T Stadium, Dallas" },
  { group: "F", matchday: 3, date: "2026-06-25", h: 18, m: 0, off: -5, home: "Túnez", away: "Países Bajos", venue: "Arrowhead Stadium, Kansas City" },

  // Group G
  { group: "G", matchday: 1, date: "2026-06-15", h: 12, m: 0, off: -7, home: "Bélgica", away: "Egipto", venue: "Lumen Field, Seattle" },
  { group: "G", matchday: 1, date: "2026-06-15", h: 18, m: 0, off: -7, home: "Irán", away: "Nueva Zelanda", venue: "SoFi Stadium, Los Angeles" },
  { group: "G", matchday: 2, date: "2026-06-21", h: 12, m: 0, off: -7, home: "Bélgica", away: "Irán", venue: "SoFi Stadium, Los Angeles" },
  { group: "G", matchday: 2, date: "2026-06-21", h: 18, m: 0, off: -7, home: "Nueva Zelanda", away: "Egipto", venue: "BC Place, Vancouver" },
  { group: "G", matchday: 3, date: "2026-06-26", h: 20, m: 0, off: -7, home: "Egipto", away: "Irán", venue: "Lumen Field, Seattle" },
  { group: "G", matchday: 3, date: "2026-06-26", h: 20, m: 0, off: -7, home: "Nueva Zelanda", away: "Bélgica", venue: "BC Place, Vancouver" },

  // Group H
  { group: "H", matchday: 1, date: "2026-06-15", h: 12, m: 0, off: -4, home: "España", away: "Cabo Verde", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "H", matchday: 1, date: "2026-06-15", h: 18, m: 0, off: -4, home: "Arabia Saudí", away: "Uruguay", venue: "Hard Rock Stadium, Miami" },
  { group: "H", matchday: 2, date: "2026-06-21", h: 12, m: 0, off: -4, home: "España", away: "Arabia Saudí", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "H", matchday: 2, date: "2026-06-21", h: 18, m: 0, off: -4, home: "Uruguay", away: "Cabo Verde", venue: "Hard Rock Stadium, Miami" },
  { group: "H", matchday: 3, date: "2026-06-26", h: 19, m: 0, off: -5, home: "Cabo Verde", away: "Arabia Saudí", venue: "NRG Stadium, Houston" },
  { group: "H", matchday: 3, date: "2026-06-26", h: 18, m: 0, off: -6, home: "Uruguay", away: "España", venue: "Estadio Akron, Guadalajara" },

  // Group I
  { group: "I", matchday: 1, date: "2026-06-16", h: 15, m: 0, off: -4, home: "Francia", away: "Senegal", venue: "MetLife Stadium, New Jersey" },
  { group: "I", matchday: 1, date: "2026-06-16", h: 18, m: 0, off: -4, home: "Iraq", away: "Noruega", venue: "Gillette Stadium, Boston" },
  { group: "I", matchday: 2, date: "2026-06-22", h: 17, m: 0, off: -4, home: "Francia", away: "Iraq", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "I", matchday: 2, date: "2026-06-22", h: 20, m: 0, off: -4, home: "Noruega", away: "Senegal", venue: "MetLife Stadium, New Jersey" },
  { group: "I", matchday: 3, date: "2026-06-26", h: 15, m: 0, off: -4, home: "Noruega", away: "Francia", venue: "Gillette Stadium, Boston" },
  { group: "I", matchday: 3, date: "2026-06-26", h: 15, m: 0, off: -4, home: "Senegal", away: "Iraq", venue: "BMO Field, Toronto" },

  // Group J
  { group: "J", matchday: 1, date: "2026-06-16", h: 20, m: 0, off: -5, home: "Argentina", away: "Argelia", venue: "Arrowhead Stadium, Kansas City" },
  { group: "J", matchday: 1, date: "2026-06-16", h: 21, m: 0, off: -7, home: "Austria", away: "Jordania", venue: "Levi's Stadium, SF Bay Area" },
  { group: "J", matchday: 2, date: "2026-06-22", h: 12, m: 0, off: -5, home: "Argentina", away: "Austria", venue: "AT&T Stadium, Dallas" },
  { group: "J", matchday: 2, date: "2026-06-22", h: 20, m: 0, off: -7, home: "Jordania", away: "Argelia", venue: "Levi's Stadium, SF Bay Area" },
  { group: "J", matchday: 3, date: "2026-06-27", h: 21, m: 0, off: -5, home: "Argelia", away: "Austria", venue: "Arrowhead Stadium, Kansas City" },
  { group: "J", matchday: 3, date: "2026-06-27", h: 21, m: 0, off: -5, home: "Jordania", away: "Argentina", venue: "AT&T Stadium, Dallas" },

  // Group K
  { group: "K", matchday: 1, date: "2026-06-17", h: 12, m: 0, off: -5, home: "Portugal", away: "RD del Congo", venue: "NRG Stadium, Houston" },
  { group: "K", matchday: 1, date: "2026-06-17", h: 20, m: 0, off: -6, home: "Uzbekistán", away: "Colombia", venue: "Estadio Azteca, CDMX" },
  { group: "K", matchday: 2, date: "2026-06-23", h: 12, m: 0, off: -5, home: "Portugal", away: "Uzbekistán", venue: "NRG Stadium, Houston" },
  { group: "K", matchday: 2, date: "2026-06-23", h: 20, m: 0, off: -6, home: "Colombia", away: "RD del Congo", venue: "Estadio Akron, Guadalajara" },
  { group: "K", matchday: 3, date: "2026-06-27", h: 19, m: 30, off: -4, home: "Colombia", away: "Portugal", venue: "Hard Rock Stadium, Miami" },
  { group: "K", matchday: 3, date: "2026-06-27", h: 19, m: 30, off: -4, home: "RD del Congo", away: "Uzbekistán", venue: "Mercedes-Benz Stadium, Atlanta" },

  // Group L
  { group: "L", matchday: 1, date: "2026-06-17", h: 15, m: 0, off: -5, home: "Inglaterra", away: "Croacia", venue: "AT&T Stadium, Dallas" },
  { group: "L", matchday: 1, date: "2026-06-17", h: 19, m: 0, off: -4, home: "Ghana", away: "Panamá", venue: "BMO Field, Toronto" },
  { group: "L", matchday: 2, date: "2026-06-23", h: 16, m: 0, off: -4, home: "Inglaterra", away: "Ghana", venue: "Gillette Stadium, Boston" },
  { group: "L", matchday: 2, date: "2026-06-23", h: 19, m: 0, off: -4, home: "Panamá", away: "Croacia", venue: "BMO Field, Toronto" },
  { group: "L", matchday: 3, date: "2026-06-27", h: 17, m: 0, off: -4, home: "Panamá", away: "Inglaterra", venue: "MetLife Stadium, New Jersey" },
  { group: "L", matchday: 3, date: "2026-06-27", h: 17, m: 0, off: -4, home: "Croacia", away: "Ghana", venue: "Lincoln Financial Field, Philadelphia" },
];

// ===========================================================================
// KNOCKOUT (32 partidos: R32 hasta Final + 3er lugar)
// Horario en LOCAL del venue
// ===========================================================================
const KNOCKOUT_MATCHES = [
  // ===== R32 (16 partidos) — 28 jun a 3 jul =====
  { num: 73, stage: "r32", date: "2026-06-28", h: 12, m: 0, off: -7, venue: "SoFi Stadium, Los Angeles" }, // 2A vs 2B
  { num: 74, stage: "r32", date: "2026-06-29", h: 17, m: 0, off: -4, venue: "Gillette Stadium, Boston" }, // 1E vs 3°(ABCDF)
  { num: 75, stage: "r32", date: "2026-06-29", h: 19, m: 0, off: -6, venue: "Estadio BBVA, Monterrey" }, // 1F vs 2C
  { num: 76, stage: "r32", date: "2026-06-29", h: 12, m: 0, off: -5, venue: "NRG Stadium, Houston" }, // 1C vs 2F
  { num: 77, stage: "r32", date: "2026-06-30", h: 17, m: 0, off: -4, venue: "MetLife Stadium, New Jersey" }, // 1I vs 3°(CDFGH)
  { num: 78, stage: "r32", date: "2026-06-30", h: 12, m: 0, off: -5, venue: "AT&T Stadium, Dallas" }, // 2E vs 2I
  { num: 79, stage: "r32", date: "2026-06-30", h: 19, m: 0, off: -6, venue: "Estadio Azteca, CDMX" }, // 1A vs 3°(CEFHI)
  { num: 80, stage: "r32", date: "2026-07-01", h: 12, m: 0, off: -4, venue: "Mercedes-Benz Stadium, Atlanta" }, // 1L vs 3°(EHIJK)
  { num: 81, stage: "r32", date: "2026-07-01", h: 17, m: 0, off: -7, venue: "Levi's Stadium, SF Bay Area" }, // 1D vs 3°(BEFIJ)
  { num: 82, stage: "r32", date: "2026-07-01", h: 13, m: 0, off: -7, venue: "Lumen Field, Seattle" }, // 1G vs 3°(AEHIJ)
  { num: 83, stage: "r32", date: "2026-07-02", h: 19, m: 0, off: -4, venue: "BMO Field, Toronto" }, // 2K vs 2L
  { num: 84, stage: "r32", date: "2026-07-02", h: 12, m: 0, off: -7, venue: "SoFi Stadium, Los Angeles" }, // 1H vs 2J
  { num: 85, stage: "r32", date: "2026-07-02", h: 17, m: 0, off: -7, venue: "BC Place, Vancouver" }, // 1B vs 3°(EFGIJ)
  { num: 86, stage: "r32", date: "2026-07-03", h: 18, m: 0, off: -4, venue: "Hard Rock Stadium, Miami" }, // 1J vs 2H
  { num: 87, stage: "r32", date: "2026-07-03", h: 20, m: 30, off: -5, venue: "Arrowhead Stadium, Kansas City" }, // 1K vs 3°(DEIJL)
  { num: 88, stage: "r32", date: "2026-07-03", h: 13, m: 0, off: -5, venue: "AT&T Stadium, Dallas" }, // 2D vs 2G

  // ===== R16 (8 partidos) — 4 a 7 jul =====
  { num: 89, stage: "r16", date: "2026-07-04", h: 17, m: 0, off: -4, venue: "Lincoln Financial Field, Philadelphia" },
  { num: 90, stage: "r16", date: "2026-07-04", h: 12, m: 0, off: -5, venue: "NRG Stadium, Houston" },
  { num: 91, stage: "r16", date: "2026-07-05", h: 16, m: 0, off: -4, venue: "MetLife Stadium, New Jersey" },
  { num: 92, stage: "r16", date: "2026-07-05", h: 18, m: 0, off: -6, venue: "Estadio Azteca, CDMX" },
  { num: 93, stage: "r16", date: "2026-07-06", h: 14, m: 0, off: -5, venue: "AT&T Stadium, Dallas" },
  { num: 94, stage: "r16", date: "2026-07-06", h: 17, m: 0, off: -7, venue: "Lumen Field, Seattle" },
  { num: 95, stage: "r16", date: "2026-07-07", h: 12, m: 0, off: -4, venue: "Mercedes-Benz Stadium, Atlanta" },
  { num: 96, stage: "r16", date: "2026-07-07", h: 13, m: 0, off: -7, venue: "BC Place, Vancouver" },

  // ===== Cuartos (4 partidos) — 9 a 11 jul =====
  { num: 97, stage: "qf", date: "2026-07-09", h: 16, m: 0, off: -4, venue: "Gillette Stadium, Boston" },
  { num: 98, stage: "qf", date: "2026-07-10", h: 12, m: 0, off: -7, venue: "SoFi Stadium, Los Angeles" },
  { num: 99, stage: "qf", date: "2026-07-11", h: 17, m: 0, off: -4, venue: "Hard Rock Stadium, Miami" },
  { num: 100, stage: "qf", date: "2026-07-11", h: 20, m: 0, off: -5, venue: "Arrowhead Stadium, Kansas City" },

  // ===== Semis (2 partidos) — 14 y 15 jul =====
  { num: 101, stage: "sf", date: "2026-07-14", h: 14, m: 0, off: -5, venue: "AT&T Stadium, Dallas" },
  { num: 102, stage: "sf", date: "2026-07-15", h: 15, m: 0, off: -4, venue: "Mercedes-Benz Stadium, Atlanta" },

  // ===== Tercer lugar — 18 jul =====
  { num: 103, stage: "third_place", date: "2026-07-18", h: 17, m: 0, off: -4, venue: "Hard Rock Stadium, Miami" },

  // ===== GRAN FINAL — 19 jul =====
  { num: 104, stage: "final", date: "2026-07-19", h: 15, m: 0, off: -4, venue: "MetLife Stadium, New York/New Jersey" },
];

async function main() {
  console.log("🔄 Reseteando fechas y venues al schedule oficial FIFA 2026...\n");

  // === 1) Grupos ===
  console.log("📋 Fase de grupos:");
  const teams = await prisma.team.findMany();
  const teamByName = new Map(teams.map((t) => [t.name, t.id]));

  let groupUpdated = 0;
  for (const m of GROUP_MATCHES) {
    const homeId = teamByName.get(m.home);
    const awayId = teamByName.get(m.away);
    if (!homeId || !awayId) {
      console.warn(`   ⚠️ Skipping ${m.home} vs ${m.away} — equipo no encontrado`);
      continue;
    }
    const match = await prisma.match.findFirst({
      where: {
        stage: "group",
        groupLetter: m.group,
        matchday: m.matchday,
        OR: [
          { homeTeamId: homeId, awayTeamId: awayId },
          { homeTeamId: awayId, awayTeamId: homeId },
        ],
      },
    });
    if (!match) {
      console.warn(`   ⚠️ ${m.home} vs ${m.away} (G${m.group} J${m.matchday}) no encontrado`);
      continue;
    }
    await prisma.match.update({
      where: { id: match.id },
      data: {
        kickoff: utc(m.date, m.h, m.m, m.off),
        venue: m.venue,
        homeTeamId: homeId,
        awayTeamId: awayId,
      },
    });
    groupUpdated++;
  }
  console.log(`   ✅ ${groupUpdated}/72 partidos de grupos actualizados\n`);

  // === 2) Knockout (matchea por stage + número extraído del label, o posición) ===
  console.log("🏆 Knockout (R32 → Final):");
  const allKOMatches = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
    orderBy: { kickoff: "asc" },
  });

  // Extract match number from label - very lenient, tries multiple formats
  function extractMatchNum(label: string | null, stage: string): number | null {
    if (label) {
      // Try multiple patterns: "Partido X", "X (...)", "· X", just "X" anywhere
      const patterns = [/Partido\s+(\d+)/i, /·\s*(\d+)/, /\b(\d{2,3})\b/];
      for (const re of patterns) {
        const m = label.match(re);
        if (m) {
          const n = parseInt(m[1]);
          if (n >= 73 && n <= 104) return n;
        }
      }
    }
    if (stage === "third_place") return 103;
    if (stage === "final") return 104;
    return null;
  }

  const matchByNum = new Map<number, (typeof allKOMatches)[number]>();
  // First pass: extract from labels
  for (const m of allKOMatches) {
    const num = extractMatchNum(m.label, m.stage);
    if (num && !matchByNum.has(num)) matchByNum.set(num, m);
  }

  // Second pass (fallback): if some matches in a stage don't have a number,
  // assign them by position within the stage (kickoff order matches official order)
  const stageOrder: Record<string, number[]> = {
    r32: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
    r16: [89, 90, 91, 92, 93, 94, 95, 96],
    qf: [97, 98, 99, 100],
    sf: [101, 102],
    third_place: [103],
    final: [104],
  };
  for (const [stage, expectedNums] of Object.entries(stageOrder)) {
    const stageMatches = allKOMatches.filter((m) => m.stage === stage);
    const unassigned = stageMatches.filter((m) => {
      const num = extractMatchNum(m.label, m.stage);
      return !num || !matchByNum.has(num) || matchByNum.get(num)?.id !== m.id;
    });
    // For unassigned in this stage, try to fill the missing expectedNums
    const missingNums = expectedNums.filter((n) => !matchByNum.has(n));
    if (unassigned.length > 0 && missingNums.length > 0) {
      // Sort unassigned by kickoff
      unassigned.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
      for (let i = 0; i < Math.min(unassigned.length, missingNums.length); i++) {
        matchByNum.set(missingNums[i], unassigned[i]);
      }
    }
  }

  // Define correct label format per stage
  const labelByNum: Record<number, string> = {};
  for (const k of KNOCKOUT_MATCHES) {
    if (k.stage === "r32") labelByNum[k.num] = `R32 · Partido ${k.num}`;
    else if (k.stage === "r16") labelByNum[k.num] = `Octavos · Partido ${k.num}`;
    else if (k.stage === "qf") labelByNum[k.num] = `Cuartos · Partido ${k.num}`;
    else if (k.stage === "sf") labelByNum[k.num] = `Semi · Partido ${k.num}`;
    else if (k.stage === "third_place") labelByNum[k.num] = `Tercer lugar`;
    else if (k.stage === "final") labelByNum[k.num] = `FINAL`;
  }

  let koUpdated = 0;
  for (const k of KNOCKOUT_MATCHES) {
    const match = matchByNum.get(k.num);
    if (!match) {
      console.warn(`   ⚠️ Partido ${k.num} (${k.stage}) no encontrado en DB`);
      continue;
    }
    await prisma.match.update({
      where: { id: match.id },
      data: {
        kickoff: utc(k.date, k.h, k.m, k.off),
        venue: k.venue,
        label: labelByNum[k.num],
      },
    });
    koUpdated++;
  }
  console.log(`   ✅ ${koUpdated}/32 partidos de knockout actualizados\n`);

  console.log("✅ Reset completo. Las fechas ahora reflejan el schedule oficial de FIFA 2026.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
