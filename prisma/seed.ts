import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * SEED — equipos, partidos y horarios OFICIALES del Mundial 2026.
 * Fuente: openfootball/worldcup.json (datos oficiales FIFA).
 *
 * Todas las fechas se guardan en UTC. El display en la app se ajusta
 * automáticamente a la zona horaria del usuario.
 */

// ===========================================================================
// 48 equipos por grupo
// ===========================================================================
const GROUPS: Record<string, Array<{ name: string; flag: string; rank: number }>> = {
  A: [
    { name: "México", flag: "🇲🇽", rank: 15 },
    { name: "Sudáfrica", flag: "🇿🇦", rank: 64 },
    { name: "Corea del Sur", flag: "🇰🇷", rank: 23 },
    { name: "Chequia", flag: "🇨🇿", rank: 37 },
  ],
  B: [
    { name: "Canadá", flag: "🇨🇦", rank: 41 },
    { name: "Bosnia-Herzegovina", flag: "🇧🇦", rank: 49 },
    { name: "Qatar", flag: "🇶🇦", rank: 57 },
    { name: "Suiza", flag: "🇨🇭", rank: 20 },
  ],
  C: [
    { name: "Brasil", flag: "🇧🇷", rank: 6 },
    { name: "Marruecos", flag: "🇲🇦", rank: 8 },
    { name: "Haití", flag: "🇭🇹", rank: 80 },
    { name: "Escocia", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", rank: 34 },
  ],
  D: [
    { name: "Estados Unidos", flag: "🇺🇸", rank: 16 },
    { name: "Paraguay", flag: "🇵🇾", rank: 56 },
    { name: "Australia", flag: "🇦🇺", rank: 24 },
    { name: "Turquía", flag: "🇹🇷", rank: 29 },
  ],
  E: [
    { name: "Alemania", flag: "🇩🇪", rank: 10 },
    { name: "Curazao", flag: "🇨🇼", rank: 88 },
    { name: "Costa de Marfil", flag: "🇨🇮", rank: 45 },
    { name: "Ecuador", flag: "🇪🇨", rank: 46 },
  ],
  F: [
    { name: "Países Bajos", flag: "🇳🇱", rank: 7 },
    { name: "Japón", flag: "🇯🇵", rank: 18 },
    { name: "Suecia", flag: "🇸🇪", rank: 28 },
    { name: "Túnez", flag: "🇹🇳", rank: 32 },
  ],
  G: [
    { name: "Bélgica", flag: "🇧🇪", rank: 9 },
    { name: "Egipto", flag: "🇪🇬", rank: 35 },
    { name: "Irán", flag: "🇮🇷", rank: 22 },
    { name: "Nueva Zelanda", flag: "🇳🇿", rank: 96 },
  ],
  H: [
    { name: "España", flag: "🇪🇸", rank: 2 },
    { name: "Cabo Verde", flag: "🇨🇻", rank: 71 },
    { name: "Arabia Saudí", flag: "🇸🇦", rank: 53 },
    { name: "Uruguay", flag: "🇺🇾", rank: 17 },
  ],
  I: [
    { name: "Francia", flag: "🇫🇷", rank: 1 },
    { name: "Senegal", flag: "🇸🇳", rank: 14 },
    { name: "Iraq", flag: "🇮🇶", rank: 68 },
    { name: "Noruega", flag: "🇳🇴", rank: 26 },
  ],
  J: [
    { name: "Argentina", flag: "🇦🇷", rank: 3 },
    { name: "Argelia", flag: "🇩🇿", rank: 50 },
    { name: "Austria", flag: "🇦🇹", rank: 30 },
    { name: "Jordania", flag: "🇯🇴", rank: 72 },
  ],
  K: [
    { name: "Portugal", flag: "🇵🇹", rank: 5 },
    { name: "RD del Congo", flag: "🇨🇩", rank: 61 },
    { name: "Uzbekistán", flag: "🇺🇿", rank: 74 },
    { name: "Colombia", flag: "🇨🇴", rank: 13 },
  ],
  L: [
    { name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", rank: 4 },
    { name: "Croacia", flag: "🇭🇷", rank: 11 },
    { name: "Ghana", flag: "🇬🇭", rank: 60 },
    { name: "Panamá", flag: "🇵🇦", rank: 67 },
  ],
};

// Helper: convert "YYYY-MM-DD HH:MM UTC-N" to a Date in UTC
function utc(date: string, hour: number, minute: number, offsetFromUTC: number): Date {
  // local time + (-offsetFromUTC) = UTC. E.g. "13:00 UTC-6" → UTC 19:00
  const utcHour = hour + Math.abs(offsetFromUTC) * (offsetFromUTC < 0 ? 1 : -1);
  // Build ISO string carefully handling day overflow
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(utcHour, minute, 0, 0);
  return d;
}

// ===========================================================================
// 72 partidos de fase de grupos — horarios oficiales FIFA
// ===========================================================================
// home/away es team1/team2 del schedule oficial. matchday es la jornada (1-3).

type GroupMatchData = {
  group: string;
  matchday: number;
  date: string;
  hourLocal: number;
  minuteLocal: number;
  utcOffset: number;
  home: string;
  away: string;
  venue: string;
};

const GROUP_MATCHES: GroupMatchData[] = [
  // Group A
  { group: "A", matchday: 1, date: "2026-06-11", hourLocal: 13, minuteLocal: 0, utcOffset: -6, home: "México", away: "Sudáfrica", venue: "Estadio Azteca, CDMX" },
  { group: "A", matchday: 1, date: "2026-06-11", hourLocal: 20, minuteLocal: 0, utcOffset: -6, home: "Corea del Sur", away: "Chequia", venue: "Estadio Akron, Guadalajara" },
  { group: "A", matchday: 2, date: "2026-06-18", hourLocal: 12, minuteLocal: 0, utcOffset: -4, home: "Chequia", away: "Sudáfrica", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "A", matchday: 2, date: "2026-06-18", hourLocal: 19, minuteLocal: 0, utcOffset: -6, home: "México", away: "Corea del Sur", venue: "Estadio Akron, Guadalajara" },
  { group: "A", matchday: 3, date: "2026-06-24", hourLocal: 19, minuteLocal: 0, utcOffset: -6, home: "Chequia", away: "México", venue: "Estadio Azteca, CDMX" },
  { group: "A", matchday: 3, date: "2026-06-24", hourLocal: 19, minuteLocal: 0, utcOffset: -6, home: "Sudáfrica", away: "Corea del Sur", venue: "Estadio BBVA, Monterrey" },

  // Group B
  { group: "B", matchday: 1, date: "2026-06-12", hourLocal: 15, minuteLocal: 0, utcOffset: -4, home: "Canadá", away: "Bosnia-Herzegovina", venue: "BMO Field, Toronto" },
  { group: "B", matchday: 1, date: "2026-06-13", hourLocal: 12, minuteLocal: 0, utcOffset: -7, home: "Qatar", away: "Suiza", venue: "Levi's Stadium, SF Bay Area" },
  { group: "B", matchday: 2, date: "2026-06-18", hourLocal: 12, minuteLocal: 0, utcOffset: -7, home: "Suiza", away: "Bosnia-Herzegovina", venue: "SoFi Stadium, Los Angeles" },
  { group: "B", matchday: 2, date: "2026-06-18", hourLocal: 15, minuteLocal: 0, utcOffset: -7, home: "Canadá", away: "Qatar", venue: "BC Place, Vancouver" },
  { group: "B", matchday: 3, date: "2026-06-24", hourLocal: 12, minuteLocal: 0, utcOffset: -7, home: "Suiza", away: "Canadá", venue: "BC Place, Vancouver" },
  { group: "B", matchday: 3, date: "2026-06-24", hourLocal: 12, minuteLocal: 0, utcOffset: -7, home: "Bosnia-Herzegovina", away: "Qatar", venue: "Lumen Field, Seattle" },

  // Group C
  { group: "C", matchday: 1, date: "2026-06-13", hourLocal: 18, minuteLocal: 0, utcOffset: -4, home: "Brasil", away: "Marruecos", venue: "MetLife Stadium, New Jersey" },
  { group: "C", matchday: 1, date: "2026-06-13", hourLocal: 21, minuteLocal: 0, utcOffset: -4, home: "Haití", away: "Escocia", venue: "Gillette Stadium, Boston" },
  { group: "C", matchday: 2, date: "2026-06-19", hourLocal: 18, minuteLocal: 0, utcOffset: -4, home: "Escocia", away: "Marruecos", venue: "Gillette Stadium, Boston" },
  { group: "C", matchday: 2, date: "2026-06-19", hourLocal: 21, minuteLocal: 0, utcOffset: -4, home: "Brasil", away: "Haití", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "C", matchday: 3, date: "2026-06-24", hourLocal: 18, minuteLocal: 0, utcOffset: -4, home: "Escocia", away: "Brasil", venue: "Hard Rock Stadium, Miami" },
  { group: "C", matchday: 3, date: "2026-06-24", hourLocal: 18, minuteLocal: 0, utcOffset: -4, home: "Marruecos", away: "Haití", venue: "Mercedes-Benz Stadium, Atlanta" },

  // Group D
  { group: "D", matchday: 1, date: "2026-06-12", hourLocal: 18, minuteLocal: 0, utcOffset: -7, home: "Estados Unidos", away: "Paraguay", venue: "SoFi Stadium, Los Angeles" },
  { group: "D", matchday: 1, date: "2026-06-13", hourLocal: 21, minuteLocal: 0, utcOffset: -7, home: "Australia", away: "Turquía", venue: "BC Place, Vancouver" },
  { group: "D", matchday: 2, date: "2026-06-19", hourLocal: 12, minuteLocal: 0, utcOffset: -7, home: "Estados Unidos", away: "Australia", venue: "Lumen Field, Seattle" },
  { group: "D", matchday: 2, date: "2026-06-19", hourLocal: 21, minuteLocal: 0, utcOffset: -7, home: "Turquía", away: "Paraguay", venue: "Levi's Stadium, SF Bay Area" },
  { group: "D", matchday: 3, date: "2026-06-25", hourLocal: 19, minuteLocal: 0, utcOffset: -7, home: "Turquía", away: "Estados Unidos", venue: "SoFi Stadium, Los Angeles" },
  { group: "D", matchday: 3, date: "2026-06-25", hourLocal: 19, minuteLocal: 0, utcOffset: -7, home: "Paraguay", away: "Australia", venue: "Levi's Stadium, SF Bay Area" },

  // Group E
  { group: "E", matchday: 1, date: "2026-06-14", hourLocal: 12, minuteLocal: 0, utcOffset: -5, home: "Alemania", away: "Curazao", venue: "NRG Stadium, Houston" },
  { group: "E", matchday: 1, date: "2026-06-14", hourLocal: 19, minuteLocal: 0, utcOffset: -4, home: "Costa de Marfil", away: "Ecuador", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "E", matchday: 2, date: "2026-06-20", hourLocal: 16, minuteLocal: 0, utcOffset: -4, home: "Alemania", away: "Costa de Marfil", venue: "BMO Field, Toronto" },
  { group: "E", matchday: 2, date: "2026-06-20", hourLocal: 19, minuteLocal: 0, utcOffset: -5, home: "Ecuador", away: "Curazao", venue: "Arrowhead Stadium, Kansas City" },
  { group: "E", matchday: 3, date: "2026-06-25", hourLocal: 16, minuteLocal: 0, utcOffset: -4, home: "Curazao", away: "Costa de Marfil", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "E", matchday: 3, date: "2026-06-25", hourLocal: 16, minuteLocal: 0, utcOffset: -4, home: "Ecuador", away: "Alemania", venue: "MetLife Stadium, New Jersey" },

  // Group F
  { group: "F", matchday: 1, date: "2026-06-14", hourLocal: 15, minuteLocal: 0, utcOffset: -5, home: "Países Bajos", away: "Japón", venue: "AT&T Stadium, Dallas" },
  { group: "F", matchday: 1, date: "2026-06-14", hourLocal: 20, minuteLocal: 0, utcOffset: -6, home: "Suecia", away: "Túnez", venue: "Estadio BBVA, Monterrey" },
  { group: "F", matchday: 2, date: "2026-06-20", hourLocal: 12, minuteLocal: 0, utcOffset: -5, home: "Países Bajos", away: "Suecia", venue: "NRG Stadium, Houston" },
  { group: "F", matchday: 2, date: "2026-06-20", hourLocal: 22, minuteLocal: 0, utcOffset: -6, home: "Túnez", away: "Japón", venue: "Estadio BBVA, Monterrey" },
  { group: "F", matchday: 3, date: "2026-06-25", hourLocal: 18, minuteLocal: 0, utcOffset: -5, home: "Japón", away: "Suecia", venue: "AT&T Stadium, Dallas" },
  { group: "F", matchday: 3, date: "2026-06-25", hourLocal: 18, minuteLocal: 0, utcOffset: -5, home: "Túnez", away: "Países Bajos", venue: "Arrowhead Stadium, Kansas City" },

  // Group G
  { group: "G", matchday: 1, date: "2026-06-15", hourLocal: 12, minuteLocal: 0, utcOffset: -7, home: "Bélgica", away: "Egipto", venue: "Lumen Field, Seattle" },
  { group: "G", matchday: 1, date: "2026-06-15", hourLocal: 18, minuteLocal: 0, utcOffset: -7, home: "Irán", away: "Nueva Zelanda", venue: "SoFi Stadium, Los Angeles" },
  { group: "G", matchday: 2, date: "2026-06-21", hourLocal: 12, minuteLocal: 0, utcOffset: -7, home: "Bélgica", away: "Irán", venue: "SoFi Stadium, Los Angeles" },
  { group: "G", matchday: 2, date: "2026-06-21", hourLocal: 18, minuteLocal: 0, utcOffset: -7, home: "Nueva Zelanda", away: "Egipto", venue: "BC Place, Vancouver" },
  { group: "G", matchday: 3, date: "2026-06-26", hourLocal: 20, minuteLocal: 0, utcOffset: -7, home: "Egipto", away: "Irán", venue: "Lumen Field, Seattle" },
  { group: "G", matchday: 3, date: "2026-06-26", hourLocal: 20, minuteLocal: 0, utcOffset: -7, home: "Nueva Zelanda", away: "Bélgica", venue: "BC Place, Vancouver" },

  // Group H
  { group: "H", matchday: 1, date: "2026-06-15", hourLocal: 12, minuteLocal: 0, utcOffset: -4, home: "España", away: "Cabo Verde", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "H", matchday: 1, date: "2026-06-15", hourLocal: 18, minuteLocal: 0, utcOffset: -4, home: "Arabia Saudí", away: "Uruguay", venue: "Hard Rock Stadium, Miami" },
  { group: "H", matchday: 2, date: "2026-06-21", hourLocal: 12, minuteLocal: 0, utcOffset: -4, home: "España", away: "Arabia Saudí", venue: "Mercedes-Benz Stadium, Atlanta" },
  { group: "H", matchday: 2, date: "2026-06-21", hourLocal: 18, minuteLocal: 0, utcOffset: -4, home: "Uruguay", away: "Cabo Verde", venue: "Hard Rock Stadium, Miami" },
  { group: "H", matchday: 3, date: "2026-06-26", hourLocal: 19, minuteLocal: 0, utcOffset: -5, home: "Cabo Verde", away: "Arabia Saudí", venue: "NRG Stadium, Houston" },
  { group: "H", matchday: 3, date: "2026-06-26", hourLocal: 18, minuteLocal: 0, utcOffset: -6, home: "Uruguay", away: "España", venue: "Estadio Akron, Guadalajara" },

  // Group I
  { group: "I", matchday: 1, date: "2026-06-16", hourLocal: 15, minuteLocal: 0, utcOffset: -4, home: "Francia", away: "Senegal", venue: "MetLife Stadium, New Jersey" },
  { group: "I", matchday: 1, date: "2026-06-16", hourLocal: 18, minuteLocal: 0, utcOffset: -4, home: "Iraq", away: "Noruega", venue: "Gillette Stadium, Boston" },
  { group: "I", matchday: 2, date: "2026-06-22", hourLocal: 17, minuteLocal: 0, utcOffset: -4, home: "Francia", away: "Iraq", venue: "Lincoln Financial Field, Philadelphia" },
  { group: "I", matchday: 2, date: "2026-06-22", hourLocal: 20, minuteLocal: 0, utcOffset: -4, home: "Noruega", away: "Senegal", venue: "MetLife Stadium, New Jersey" },
  { group: "I", matchday: 3, date: "2026-06-26", hourLocal: 15, minuteLocal: 0, utcOffset: -4, home: "Noruega", away: "Francia", venue: "Gillette Stadium, Boston" },
  { group: "I", matchday: 3, date: "2026-06-26", hourLocal: 15, minuteLocal: 0, utcOffset: -4, home: "Senegal", away: "Iraq", venue: "BMO Field, Toronto" },

  // Group J
  { group: "J", matchday: 1, date: "2026-06-16", hourLocal: 20, minuteLocal: 0, utcOffset: -5, home: "Argentina", away: "Argelia", venue: "Arrowhead Stadium, Kansas City" },
  { group: "J", matchday: 1, date: "2026-06-16", hourLocal: 21, minuteLocal: 0, utcOffset: -7, home: "Austria", away: "Jordania", venue: "Levi's Stadium, SF Bay Area" },
  { group: "J", matchday: 2, date: "2026-06-22", hourLocal: 12, minuteLocal: 0, utcOffset: -5, home: "Argentina", away: "Austria", venue: "AT&T Stadium, Dallas" },
  { group: "J", matchday: 2, date: "2026-06-22", hourLocal: 20, minuteLocal: 0, utcOffset: -7, home: "Jordania", away: "Argelia", venue: "Levi's Stadium, SF Bay Area" },
  { group: "J", matchday: 3, date: "2026-06-27", hourLocal: 21, minuteLocal: 0, utcOffset: -5, home: "Argelia", away: "Austria", venue: "Arrowhead Stadium, Kansas City" },
  { group: "J", matchday: 3, date: "2026-06-27", hourLocal: 21, minuteLocal: 0, utcOffset: -5, home: "Jordania", away: "Argentina", venue: "AT&T Stadium, Dallas" },

  // Group K
  { group: "K", matchday: 1, date: "2026-06-17", hourLocal: 12, minuteLocal: 0, utcOffset: -5, home: "Portugal", away: "RD del Congo", venue: "NRG Stadium, Houston" },
  { group: "K", matchday: 1, date: "2026-06-17", hourLocal: 20, minuteLocal: 0, utcOffset: -6, home: "Uzbekistán", away: "Colombia", venue: "Estadio Azteca, CDMX" },
  { group: "K", matchday: 2, date: "2026-06-23", hourLocal: 12, minuteLocal: 0, utcOffset: -5, home: "Portugal", away: "Uzbekistán", venue: "NRG Stadium, Houston" },
  { group: "K", matchday: 2, date: "2026-06-23", hourLocal: 20, minuteLocal: 0, utcOffset: -6, home: "Colombia", away: "RD del Congo", venue: "Estadio Akron, Guadalajara" },
  { group: "K", matchday: 3, date: "2026-06-27", hourLocal: 19, minuteLocal: 30, utcOffset: -4, home: "Colombia", away: "Portugal", venue: "Hard Rock Stadium, Miami" },
  { group: "K", matchday: 3, date: "2026-06-27", hourLocal: 19, minuteLocal: 30, utcOffset: -4, home: "RD del Congo", away: "Uzbekistán", venue: "Mercedes-Benz Stadium, Atlanta" },

  // Group L
  { group: "L", matchday: 1, date: "2026-06-17", hourLocal: 15, minuteLocal: 0, utcOffset: -5, home: "Inglaterra", away: "Croacia", venue: "AT&T Stadium, Dallas" },
  { group: "L", matchday: 1, date: "2026-06-17", hourLocal: 19, minuteLocal: 0, utcOffset: -4, home: "Ghana", away: "Panamá", venue: "BMO Field, Toronto" },
  { group: "L", matchday: 2, date: "2026-06-23", hourLocal: 16, minuteLocal: 0, utcOffset: -4, home: "Inglaterra", away: "Ghana", venue: "Gillette Stadium, Boston" },
  { group: "L", matchday: 2, date: "2026-06-23", hourLocal: 19, minuteLocal: 0, utcOffset: -4, home: "Panamá", away: "Croacia", venue: "BMO Field, Toronto" },
  { group: "L", matchday: 3, date: "2026-06-27", hourLocal: 17, minuteLocal: 0, utcOffset: -4, home: "Panamá", away: "Inglaterra", venue: "MetLife Stadium, New Jersey" },
  { group: "L", matchday: 3, date: "2026-06-27", hourLocal: 17, minuteLocal: 0, utcOffset: -4, home: "Croacia", away: "Ghana", venue: "Lincoln Financial Field, Philadelphia" },
];

// ===========================================================================
// Knockout — fechas, horas, venues y placeholders OFICIALES de FIFA 2026
// ===========================================================================
// Los placeholders siguen el bracket oficial. Ej: "1A" = ganador grupo A.
// "3CDEF" = mejor tercero de los grupos C, D, E, F (asignado dinámicamente).
// "W73" = ganador del partido 73. "L101" = perdedor del partido 101.
type KnockoutMatchData = {
  stage: string;
  matchNum: number;
  label: string;
  homePlaceholder: string;
  awayPlaceholder: string;
  date: string;
  hourLocal: number;
  minuteLocal: number;
  utcOffset: number;
  venue: string;
};

const KNOCKOUT_MATCHES: KnockoutMatchData[] = [
  // Round of 32 (16 partidos) — 28 jun a 3 jul
  { stage: "r32", matchNum: 73, label: "R32 · Partido 73", homePlaceholder: "2A", awayPlaceholder: "2B", date: "2026-06-28", hourLocal: 12, minuteLocal: 0, utcOffset: -7, venue: "SoFi Stadium, Los Angeles" },
  { stage: "r32", matchNum: 74, label: "R32 · Partido 74", homePlaceholder: "1E", awayPlaceholder: "3ABCDF", date: "2026-06-29", hourLocal: 17, minuteLocal: 0, utcOffset: -4, venue: "Gillette Stadium, Boston" },
  { stage: "r32", matchNum: 75, label: "R32 · Partido 75", homePlaceholder: "1F", awayPlaceholder: "2C", date: "2026-06-29", hourLocal: 19, minuteLocal: 0, utcOffset: -6, venue: "Estadio BBVA, Monterrey" },
  { stage: "r32", matchNum: 76, label: "R32 · Partido 76", homePlaceholder: "1C", awayPlaceholder: "2F", date: "2026-06-29", hourLocal: 12, minuteLocal: 0, utcOffset: -5, venue: "NRG Stadium, Houston" },
  { stage: "r32", matchNum: 77, label: "R32 · Partido 77", homePlaceholder: "1I", awayPlaceholder: "3CDFGH", date: "2026-06-30", hourLocal: 17, minuteLocal: 0, utcOffset: -4, venue: "MetLife Stadium, New Jersey" },
  { stage: "r32", matchNum: 78, label: "R32 · Partido 78", homePlaceholder: "2E", awayPlaceholder: "2I", date: "2026-06-30", hourLocal: 12, minuteLocal: 0, utcOffset: -5, venue: "AT&T Stadium, Dallas" },
  { stage: "r32", matchNum: 79, label: "R32 · Partido 79", homePlaceholder: "1A", awayPlaceholder: "3CEFHI", date: "2026-06-30", hourLocal: 19, minuteLocal: 0, utcOffset: -6, venue: "Estadio Azteca, CDMX" },
  { stage: "r32", matchNum: 80, label: "R32 · Partido 80", homePlaceholder: "1L", awayPlaceholder: "3EHIJK", date: "2026-07-01", hourLocal: 12, minuteLocal: 0, utcOffset: -4, venue: "Mercedes-Benz Stadium, Atlanta" },
  { stage: "r32", matchNum: 81, label: "R32 · Partido 81", homePlaceholder: "1D", awayPlaceholder: "3BEFIJ", date: "2026-07-01", hourLocal: 17, minuteLocal: 0, utcOffset: -7, venue: "Levi's Stadium, SF Bay Area" },
  { stage: "r32", matchNum: 82, label: "R32 · Partido 82", homePlaceholder: "1G", awayPlaceholder: "3AEHIJ", date: "2026-07-01", hourLocal: 13, minuteLocal: 0, utcOffset: -7, venue: "Lumen Field, Seattle" },
  { stage: "r32", matchNum: 83, label: "R32 · Partido 83", homePlaceholder: "2K", awayPlaceholder: "2L", date: "2026-07-02", hourLocal: 19, minuteLocal: 0, utcOffset: -4, venue: "BMO Field, Toronto" },
  { stage: "r32", matchNum: 84, label: "R32 · Partido 84", homePlaceholder: "1H", awayPlaceholder: "2J", date: "2026-07-02", hourLocal: 12, minuteLocal: 0, utcOffset: -7, venue: "SoFi Stadium, Los Angeles" },
  { stage: "r32", matchNum: 85, label: "R32 · Partido 85", homePlaceholder: "1B", awayPlaceholder: "3EFGIJ", date: "2026-07-02", hourLocal: 17, minuteLocal: 0, utcOffset: -7, venue: "BC Place, Vancouver" },
  { stage: "r32", matchNum: 86, label: "R32 · Partido 86", homePlaceholder: "1J", awayPlaceholder: "2H", date: "2026-07-03", hourLocal: 18, minuteLocal: 0, utcOffset: -4, venue: "Hard Rock Stadium, Miami" },
  { stage: "r32", matchNum: 87, label: "R32 · Partido 87", homePlaceholder: "1K", awayPlaceholder: "3DEIJL", date: "2026-07-03", hourLocal: 20, minuteLocal: 30, utcOffset: -5, venue: "Arrowhead Stadium, Kansas City" },
  { stage: "r32", matchNum: 88, label: "R32 · Partido 88", homePlaceholder: "2D", awayPlaceholder: "2G", date: "2026-07-03", hourLocal: 13, minuteLocal: 0, utcOffset: -5, venue: "AT&T Stadium, Dallas" },
  // Round of 16 (8 partidos) — 4 a 7 jul
  { stage: "r16", matchNum: 89, label: "Octavos · Partido 89", homePlaceholder: "W74", awayPlaceholder: "W77", date: "2026-07-04", hourLocal: 17, minuteLocal: 0, utcOffset: -4, venue: "Lincoln Financial Field, Philadelphia" },
  { stage: "r16", matchNum: 90, label: "Octavos · Partido 90", homePlaceholder: "W73", awayPlaceholder: "W75", date: "2026-07-04", hourLocal: 12, minuteLocal: 0, utcOffset: -5, venue: "NRG Stadium, Houston" },
  { stage: "r16", matchNum: 91, label: "Octavos · Partido 91", homePlaceholder: "W76", awayPlaceholder: "W78", date: "2026-07-05", hourLocal: 16, minuteLocal: 0, utcOffset: -4, venue: "MetLife Stadium, New Jersey" },
  { stage: "r16", matchNum: 92, label: "Octavos · Partido 92", homePlaceholder: "W79", awayPlaceholder: "W80", date: "2026-07-05", hourLocal: 18, minuteLocal: 0, utcOffset: -6, venue: "Estadio Azteca, CDMX" },
  { stage: "r16", matchNum: 93, label: "Octavos · Partido 93", homePlaceholder: "W83", awayPlaceholder: "W84", date: "2026-07-06", hourLocal: 14, minuteLocal: 0, utcOffset: -5, venue: "AT&T Stadium, Dallas" },
  { stage: "r16", matchNum: 94, label: "Octavos · Partido 94", homePlaceholder: "W81", awayPlaceholder: "W82", date: "2026-07-06", hourLocal: 17, minuteLocal: 0, utcOffset: -7, venue: "Lumen Field, Seattle" },
  { stage: "r16", matchNum: 95, label: "Octavos · Partido 95", homePlaceholder: "W86", awayPlaceholder: "W88", date: "2026-07-07", hourLocal: 12, minuteLocal: 0, utcOffset: -4, venue: "Mercedes-Benz Stadium, Atlanta" },
  { stage: "r16", matchNum: 96, label: "Octavos · Partido 96", homePlaceholder: "W85", awayPlaceholder: "W87", date: "2026-07-07", hourLocal: 13, minuteLocal: 0, utcOffset: -7, venue: "BC Place, Vancouver" },
  // Cuartos (4 partidos) — 9 a 11 jul
  { stage: "qf", matchNum: 97, label: "Cuartos · Partido 97", homePlaceholder: "W89", awayPlaceholder: "W90", date: "2026-07-09", hourLocal: 16, minuteLocal: 0, utcOffset: -4, venue: "Gillette Stadium, Boston" },
  { stage: "qf", matchNum: 98, label: "Cuartos · Partido 98", homePlaceholder: "W93", awayPlaceholder: "W94", date: "2026-07-10", hourLocal: 12, minuteLocal: 0, utcOffset: -7, venue: "SoFi Stadium, Los Angeles" },
  { stage: "qf", matchNum: 99, label: "Cuartos · Partido 99", homePlaceholder: "W91", awayPlaceholder: "W92", date: "2026-07-11", hourLocal: 17, minuteLocal: 0, utcOffset: -4, venue: "Hard Rock Stadium, Miami" },
  { stage: "qf", matchNum: 100, label: "Cuartos · Partido 100", homePlaceholder: "W95", awayPlaceholder: "W96", date: "2026-07-11", hourLocal: 20, minuteLocal: 0, utcOffset: -5, venue: "Arrowhead Stadium, Kansas City" },
  // Semifinales (2 partidos) — 14 y 15 jul
  { stage: "sf", matchNum: 101, label: "Semi · Partido 101", homePlaceholder: "W97", awayPlaceholder: "W98", date: "2026-07-14", hourLocal: 14, minuteLocal: 0, utcOffset: -5, venue: "AT&T Stadium, Dallas" },
  { stage: "sf", matchNum: 102, label: "Semi · Partido 102", homePlaceholder: "W99", awayPlaceholder: "W100", date: "2026-07-15", hourLocal: 15, minuteLocal: 0, utcOffset: -4, venue: "Mercedes-Benz Stadium, Atlanta" },
  // Tercer lugar — 18 jul
  { stage: "third_place", matchNum: 103, label: "Tercer lugar", homePlaceholder: "L101", awayPlaceholder: "L102", date: "2026-07-18", hourLocal: 17, minuteLocal: 0, utcOffset: -4, venue: "Hard Rock Stadium, Miami" },
  // GRAN FINAL — 19 jul
  { stage: "final", matchNum: 104, label: "FINAL", homePlaceholder: "W101", awayPlaceholder: "W102", date: "2026-07-19", hourLocal: 15, minuteLocal: 0, utcOffset: -4, venue: "MetLife Stadium, New York/New Jersey" },
];

// ===========================================================================
// Main seed
// ===========================================================================
async function main() {
  console.log("🌱 Seeding database with OFFICIAL FIFA schedule...");

  await prisma.prediction.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();

  // Create teams
  const teamMap = new Map<string, string>();
  for (const [letter, teams] of Object.entries(GROUPS)) {
    for (const t of teams) {
      const team = await prisma.team.create({
        data: { name: t.name, flag: t.flag, groupLetter: letter, fifaRank: t.rank },
      });
      teamMap.set(t.name, team.id);
    }
  }
  console.log(`✓ Created ${teamMap.size} teams`);

  // Group stage matches
  for (const m of GROUP_MATCHES) {
    await prisma.match.create({
      data: {
        stage: "group",
        groupLetter: m.group,
        matchday: m.matchday,
        kickoff: utc(m.date, m.hourLocal, m.minuteLocal, m.utcOffset),
        venue: m.venue,
        homeTeamId: teamMap.get(m.home)!,
        awayTeamId: teamMap.get(m.away)!,
        label: `Grupo ${m.group} · J${m.matchday}`,
      },
    });
  }
  console.log(`✓ Created ${GROUP_MATCHES.length} group stage matches with REAL dates`);

  // Knockout matches (no teams yet — placeholders only)
  for (const k of KNOCKOUT_MATCHES) {
    await prisma.match.create({
      data: {
        stage: k.stage,
        kickoff: utc(k.date, k.hourLocal, k.minuteLocal, k.utcOffset),
        venue: k.venue,
        label: k.label,
        homeTeamPlaceholder: k.homePlaceholder,
        awayTeamPlaceholder: k.awayPlaceholder,
      },
    });
  }
  console.log(`✓ Created ${KNOCKOUT_MATCHES.length} knockout matches with placeholders`);

  console.log("✅ Seed complete with official Mundial 2026 schedule");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
