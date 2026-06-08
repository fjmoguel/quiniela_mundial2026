/**
 * Maps our Spanish DB names to the various names used by external APIs.
 * Key = our DB name. Values = possible names from APIs (English, codes, etc.)
 */
export const TEAM_NAME_MAP: Record<string, string[]> = {
  "México": ["Mexico", "MEX"],
  "Sudáfrica": ["South Africa", "RSA"],
  "Corea del Sur": ["South Korea", "Korea Republic", "KOR"],
  "Chequia": ["Czech Republic", "Czechia", "CZE"],
  "Canadá": ["Canada", "CAN"],
  "Bosnia-Herzegovina": ["Bosnia and Herzegovina", "Bosnia", "BIH"],
  "Qatar": ["QAT"],
  "Suiza": ["Switzerland", "SUI", "SWI"],
  "Brasil": ["Brazil", "BRA"],
  "Marruecos": ["Morocco", "MAR"],
  "Haití": ["Haiti", "HAI"],
  "Escocia": ["Scotland", "SCO"],
  "Estados Unidos": ["United States", "USA", "United States of America"],
  "Paraguay": ["PAR"],
  "Australia": ["AUS"],
  "Turquía": ["Turkey", "Türkiye", "Turkiye", "TUR"],
  "Alemania": ["Germany", "GER"],
  "Curazao": ["Curaçao", "Curacao", "CUW"],
  "Costa de Marfil": ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire", "CIV"],
  "Ecuador": ["ECU"],
  "Países Bajos": ["Netherlands", "Holland", "NED"],
  "Japón": ["Japan", "JPN"],
  "Suecia": ["Sweden", "SWE"],
  "Túnez": ["Tunisia", "TUN"],
  "Bélgica": ["Belgium", "BEL"],
  "Egipto": ["Egypt", "EGY"],
  "Irán": ["Iran", "IR Iran", "IRN"],
  "Nueva Zelanda": ["New Zealand", "NZL"],
  "España": ["Spain", "ESP"],
  "Cabo Verde": ["Cape Verde", "CPV"],
  "Arabia Saudí": ["Saudi Arabia", "KSA", "SAU"],
  "Uruguay": ["URU"],
  "Francia": ["France", "FRA"],
  "Senegal": ["SEN"],
  "Iraq": ["Iraq", "IRQ"],
  "Noruega": ["Norway", "NOR"],
  "Argentina": ["ARG"],
  "Argelia": ["Algeria", "ALG"],
  "Austria": ["AUT"],
  "Jordania": ["Jordan", "JOR"],
  "Portugal": ["POR"],
  "RD del Congo": ["Congo DR", "DR Congo", "Democratic Republic of the Congo", "COD"],
  "Uzbekistán": ["Uzbekistan", "UZB"],
  "Colombia": ["COL"],
  "Inglaterra": ["England", "ENG"],
  "Croacia": ["Croatia", "CRO"],
  "Ghana": ["GHA"],
  "Panamá": ["Panama", "PAN"],
};

/**
 * Given an external API team name, return our DB name (or null if unknown).
 */
export function dbNameFromApiName(apiName: string): string | null {
  const trimmed = apiName.trim();
  for (const [dbName, aliases] of Object.entries(TEAM_NAME_MAP)) {
    if (dbName.toLowerCase() === trimmed.toLowerCase()) return dbName;
    if (aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return dbName;
  }
  return null;
}
