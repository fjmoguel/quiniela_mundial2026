/**
 * Reset SOLO las fechas y venues de partidos al schedule oficial.
 * NO borra predicciones de usuarios ni equipos. Solo actualiza:
 *   - kickoff (fecha/hora)
 *   - venue
 *
 * Útil cuando un sync de openfootball metió fechas raras.
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

// SAME hardcoded data as in seed.ts. Update both if changing.
const GROUP_MATCHES = [
  { group: "A", matchday: 1, date: "2026-06-11", h: 13, m: 0, off: -6, home: "México", away: "Sudáfrica", venue: "Estadio Azteca, CDMX" },
  { group: "A", matchday: 1, date: "2026-06-11", h: 20, m: 0, off: -6, home: "Corea del Sur", away: "Chequia", venue: "Estadio Akron, Guadalajara" },
  { group: "A", matchday: 2, date: "2026-06-18", h: 12, m: 0, off: -4, home: "Chequia", away: "Sudáfrica", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "A", matchday: 2, date: "2026-06-18", h: 19, m: 0, off: -6, home: "México", away: "Corea del Sur", venue: "Estadio Akron, Guadalajara" },
  { group: "A", matchday: 3, date: "2026-06-24", h: 19, m: 0, off: -6, home: "Chequia", away: "México", venue: "Estadio Azteca, CDMX" },
  { group: "A", matchday: 3, date: "2026-06-24", h: 19, m: 0, off: -6, home: "Sudáfrica", away: "Corea del Sur", venue: "Estadio BBVA, Monterrey" },

  { group: "B", matchday: 1, date: "2026-06-12", h: 15, m: 0, off: -4, home: "Canadá", away: "Bosnia-Herzegovina", venue: "BMO Field, Toronto" },
  { group: "B", matchday: 1, date: "2026-06-13", h: 12, m: 0, off: -7, home: "Qatar", away: "Suiza", venue: "Levi's Stadium, SF Bay Area" },
  { group: "B", matchday: 2, date: "2026-06-18", h: 12, m: 0, off: -7, home: "Suiza", away: "Bosnia-Herzegovina", venue: "SoFi Stadium, Los Angeles" },
  { group: "B", matchday: 2, date: "2026-06-18", h: 15, m: 0, off: -7, home: "Canadá", away: "Qatar", venue: "BC Place, Vancouver" },
  { group: "B", matchday: 3, date: "2026-06-24", h: 12, m: 0, off: -7, home: "Suiza", away: "Canadá", venue: "BC Place, Vancouver" },
  { group: "B", matchday: 3, date: "2026-06-24", h: 12, m: 0, off: -7, home: "Bosnia-Herzegovina", away: "Qatar", venue: "Lumen Field, Seattle" },

  { group: "C", matchday: 1, date: "2026-06-13", h: 18, m: 0, off: -4, home: "Brasil", away: "Marruecos", venue: "MetLife Stadium, New Jersey" },
  { group: "C", matchday: 1, date: "2026-06-13", h: 21, m: 0, off: -4, home: "Haití", away: "Escocia", venue: "Gillette Stadium, Boston" },
  { group: "C", matchday: 2, date: "2026-06-19", h: 18, m: 0, off: -4, home: "Escocia", away: "Marruecos", venue: "Gillette Stadium, Boston" },
  { group: "C", matchday: 2, date: "2026-06-19", h: 21, m: 0, off: -4, home: "Brasil", away: "Haití", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "C", matchday: 3, date: "2026-06-24", h: 18, m: 0, off: -4, home: "Escocia", away: "Brasil", venue: "Hard Rock Stadium, Miami" },
  { group: "C", matchday: 3, date: "2026-06-24", h: 18, m: 0, off: -4, home: "Marruecos", away: "Haití", venue: "Mercedes-Benz Stadium, Atlanta" },

  { group: "D", matchday: 1, date: "2026-06-12", h: 18, m: 0, off: -7, home: "Estados Unidos", away: "Paraguay", venue: "SoFi Stadium, Los Angeles" },
  { group: "D", matchday: 1, date: "2026-06-13", h: 21, m: 0, off: -7, home: "Australia", away: "Turquía", venue: "BC Place, Vancouver" },
  { group: "D", matchday: 2, date: "2026-06-19", h: 12, m: 0, off: -7, home: "Estados Unidos", away: "Australia", venue: "Lumen Field, Seattle" },
  { group: "D", matchday: 2, date: "2026-06-19", h: 21, m: 0, off: -7, home: "Turquía", away: "Paraguay", venue: "Levi's Stadium, SF Bay Area" },
  { group: "D", matchday: 3, date: "2026-06-25", h: 19, m: 0, off: -7, home: "Turquía", away: "Estados Unidos", venue: "SoFi Stadium, Los Angeles" },
  { group: "D", matchday: 3, date: "2026-06-25", h: 19, m: 0, off: -7, home: "Paraguay", away: "Australia", venue: "Levi's Stadium, SF Bay Area" },

  { group: "E", matchday: 1, date: "2026-06-14", h: 12, m: 0, off: -5, home: "Alemania", away: "Curazao", venue: "NRG Stadium, Houston" },
  { group: "E", matchday: 1, date: "2026-06-14", h: 19, m: 0, off: -4, home: "Costa de Marfil", away: "Ecuador", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "E", matchday: 2, date: "2026-06-20", h: 16, m: 0, off: -4, home: "Alemania", away: "Costa de Marfil", venue: "BMO Field, Toronto" },
  { group: "E", matchday: 2, date: "2026-06-20", h: 19, m: 0, off: -5, home: "Ecuador", away: "Curazao", venue: "Arrowhead Stadium, Kansas City" },
  { group: "E", matchday: 3, date: "2026-06-25", h: 16, m: 0, off: -4, home: "Curazao", away: "Costa de Marfil", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "E", matchday: 3, date: "2026-06-25", h: 16, m: 0, off: -4, home: "Ecuador", away: "Alemania", venue: "MetLife Stadium, New Jersey" },

  { group: "F", matchday: 1, date: "2026-06-14", h: 15, m: 0, off: -5, home: "Países Bajos", away: "Japón", venue: "AT&T Stadium, Dallas" },
  { group: "F", matchday: 1, date: "2026-06-14", h: 20, m: 0, off: -6, home: "Suecia", away: "Túnez", venue: "Estadio BBVA, Monterrey" },
  { group: "F", matchday: 2, date: "2026-06-20", h: 12, m: 0, off: -5, home: "Países Bajos", away: "Suecia", venue: "NRG Stadium, Houston" },
  { group: "F", matchday: 2, date: "2026-06-20", h: 22, m: 0, off: -6, home: "Túnez", away: "Japón", venue: "Estadio BBVA, Monterrey" },
  { group: "F", matchday: 3, date: "2026-06-25", h: 18, m: 0, off: -5, home: "Japón", away: "Suecia", venue: "AT&T Stadium, Dallas" },
  { group: "F", matchday: 3, date: "2026-06-25", h: 18, m: 0, off: -5, home: "Túnez", away: "Países Bajos", venue: "Arrowhead Stadium, Kansas City" },

  { group: "G", matchday: 1, date: "2026-06-15", h: 12, m: 0, off: -7, home: "Bélgica", away: "Egipto", venue: "Lumen Field, Seattle" },
  { group: "G", matchday: 1, date: "2026-06-15", h: 18, m: 0, off: -7, home: "Irán", away: "Nueva Zelanda", venue: "SoFi Stadium, Los Angeles" },
  { group: "G", matchday: 2, date: "2026-06-21", h: 12, m: 0, off: -7, home: "Bélgica", away: "Irán", venue: "SoFi Stadium, Los Angeles" },
  { group: "G", matchday: 2, date: "2026-06-21", h: 18, m: 0, off: -7, home: "Nueva Zelanda", away: "Egipto", venue: "BC Place, Vancouver" },
  { group: "G", matchday: 3, date: "2026-06-26", h: 20, m: 0, off: -7, home: "Egipto", away: "Irán", venue: "Lumen Field, Seattle" },
  { group: "G", matchday: 3, date: "2026-06-26", h: 20, m: 0, off: -7, home: "Nueva Zelanda", away: "Bélgica", venue: "BC Place, Vancouver" },

  { group: "H", matchday: 1, date: "2026-06-15", h: 12, m: 0, off: -4, home: "España", away: "Cabo Verde", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "H", matchday: 1, date: "2026-06-15", h: 18, m: 0, off: -4, home: "Arabia Saudí", away: "Uruguay", venue: "Hard Rock Stadium, Miami" },
  { group: "H", matchday: 2, date: "2026-06-21", h: 12, m: 0, off: -4, home: "España", away: "Arabia Saudí", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "H", matchday: 2, date: "2026-06-21", h: 18, m: 0, off: -4, home: "Uruguay", away: "Cabo Verde", venue: "Hard Rock Stadium, Miami" },
  { group: "H", matchday: 3, date: "2026-06-26", h: 19, m: 0, off: -5, home: "Cabo Verde", away: "Arabia Saudí", venue: "NRG Stadium, Houston" },
  { group: "H", matchday: 3, date: "2026-06-26", h: 18, m: 0, off: -6, home: "Uruguay", away: "España", venue: "Estadio Akron, Guadalajara" },

  { group: "I", matchday: 1, date: "2026-06-16", h: 15, m: 0, off: -4, home: "Francia", away: "Senegal", venue: "MetLife Stadium, New Jersey" },
  { group: "I", matchday: 1, date: "2026-06-16", h: 18, m: 0, off: -4, home: "Iraq", away: "Noruega", venue: "Gillette Stadium, Boston" },
  { group: "I", matchday: 2, date: "2026-06-22", h: 17, m: 0, off: -4, home: "Francia", away: "Iraq", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "I", matchday: 2, date: "2026-06-22", h: 20, m: 0, off: -4, home: "Noruega", away: "Senegal", venue: "MetLife Stadium, New Jersey" },
  { group: "I", matchday: 3, date: "2026-06-26", h: 15, m: 0, off: -4, home: "Noruega", away: "Francia", venue: "Gillette Stadium, Boston" },
  { group: "I", matchday: 3, date: "2026-06-26", h: 15, m: 0, off: -4, home: "Senegal", away: "Iraq", venue: "BMO Field, Toronto" },

  { group: "J", matchday: 1, date: "2026-06-16", h: 20, m: 0, off: -5, home: "Argentina", away: "Argelia", venue: "Arrowhead Stadium, Kansas City" },
  { group: "J", matchday: 1, date: "2026-06-16", h: 21, m: 0, off: -7, home: "Austria", away: "Jordania", venue: "Levi's Stadium, SF Bay Area" },
  { group: "J", matchday: 2, date: "2026-06-22", h: 12, m: 0, off: -5, home: "Argentina", away: "Austria", venue: "AT&T Stadium, Dallas" },
  { group: "J", matchday: 2, date: "2026-06-22", h: 20, m: 0, off: -7, home: "Jordania", away: "Argelia", venue: "Levi's Stadium, SF Bay Area" },
  { group: "J", matchday: 3, date: "2026-06-27", h: 21, m: 0, off: -5, home: "Argelia", away: "Austria", venue: "Arrowhead Stadium, Kansas City" },
  { group: "J", matchday: 3, date: "2026-06-27", h: 21, m: 0, off: -5, home: "Jordania", away: "Argentina", venue: "AT&T Stadium, Dallas" },

  { group: "K", matchday: 1, date: "2026-06-17", h: 12, m: 0, off: -5, home: "Portugal", away: "RD del Congo", venue: "NRG Stadium, Houston" },
  { group: "K", matchday: 1, date: "2026-06-17", h: 20, m: 0, off: -6, home: "Uzbekistán", away: "Colombia", venue: "Estadio Azteca, CDMX" },
  { group: "K", matchday: 2, date: "2026-06-23", h: 12, m: 0, off: -5, home: "Portugal", away: "Uzbekistán", venue: "NRG Stadium, Houston" },
  { group: "K", matchday: 2, date: "2026-06-23", h: 20, m: 0, off: -6, home: "Colombia", away: "RD del Congo", venue: "Estadio Akron, Guadalajara" },
  { group: "K", matchday: 3, date: "2026-06-27", h: 19, m: 30, off: -4, home: "Colombia", away: "Portugal", venue: "Hard Rock Stadium, Miami" },
  { group: "K", matchday: 3, date: "2026-06-27", h: 19, m: 30, off: -4, home: "RD del Congo", away: "Uzbekistán", venue: "Mercedes-Benz Stadium, Atlanta" },

  { group: "L", matchday: 1, date: "2026-06-17", h: 15, m: 0, off: -5, home: "Inglaterra", away: "Croacia", venue: "AT&T Stadium, Dallas" },
  { group: "L", matchday: 1, date: "2026-06-17", h: 19, m: 0, off: -4, home: "Ghana", away: "Panamá", venue: "BMO Field, Toronto" },
  { group: "L", matchday: 2, date: "2026-06-23", h: 16, m: 0, off: -4, home: "Inglaterra", away: "Ghana", venue: "Gillette Stadium, Boston" },
  { group: "L", matchday: 2, date: "2026-06-23", h: 19, m: 0, off: -4, home: "Panamá", away: "Croacia", venue: "BMO Field, Toronto" },
  { group: "L", matchday: 3, date: "2026-06-27", h: 17, m: 0, off: -4, home: "Panamá", away: "Inglaterra", venue: "MetLife Stadium, New Jersey" },
  { group: "L", matchday: 3, date: "2026-06-27", h: 17, m: 0, off: -4, home: "Croacia", away: "Ghana", venue: "Lincoln Financial Field, Philadelphia" },
];

async function main() {
  console.log("🔄 Reseteando fechas y venues de partidos de grupos...");
  const teams = await prisma.team.findMany();
  const teamByName = new Map(teams.map((t) => [t.name, t.id]));

  let updated = 0;
  for (const m of GROUP_MATCHES) {
    const homeId = teamByName.get(m.home);
    const awayId = teamByName.get(m.away);
    if (!homeId || !awayId) {
      console.warn(`⚠️ Skipping ${m.home} vs ${m.away} — equipo no encontrado`);
      continue;
    }
    // Find the match by teams + group + matchday
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
      console.warn(`⚠️ Match ${m.home} vs ${m.away} (Grupo ${m.group} J${m.matchday}) no encontrado`);
      continue;
    }
    await prisma.match.update({
      where: { id: match.id },
      data: {
        kickoff: utc(m.date, m.h, m.m, m.off),
        venue: m.venue,
        homeTeamId: homeId, // re-set order to match official schedule
        awayTeamId: awayId,
      },
    });
    updated++;
  }
  console.log(`✅ ${updated} partidos actualizados con fechas y venues oficiales`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
