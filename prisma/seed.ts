import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 12 groups × 4 teams = 48 teams
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

// Each group plays 6 matches across 3 matchdays. Standard pattern:
// MD1: T1 vs T2, T3 vs T4
// MD2: T1 vs T3, T4 vs T2
// MD3: T4 vs T1, T2 vs T3
const MATCHDAY_PAIRS: Array<[number, number]>[] = [
  [[0, 1], [2, 3]],
  [[0, 2], [3, 1]],
  [[3, 0], [1, 2]],
];

// Approximate kickoff schedule — admin should adjust these to real dates.
// Tournament runs June 11 to July 19, 2026. Group stage: June 11 - 27.
function groupKickoff(groupIdx: number, matchday: number, matchInDay: number): Date {
  // Group stage spans 17 days, we spread the 12 groups' 3 matchdays
  const baseDate = new Date("2026-06-11T15:00:00.000Z");
  const dayOffset = Math.floor(groupIdx / 2) + (matchday - 1) * 5;
  const hourOffset = matchInDay * 3 + (groupIdx % 2) * 1;
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(d.getUTCHours() + hourOffset);
  return d;
}

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data (predictions/results) — careful in production
  await prisma.prediction.deleteMany();
  await prisma.groupPrediction.deleteMany();
  await prisma.knockoutBracketPick.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();

  // Create teams
  const teamMap = new Map<string, { id: string; name: string }>();
  for (const [letter, teams] of Object.entries(GROUPS)) {
    for (const t of teams) {
      const team = await prisma.team.create({
        data: { name: t.name, flag: t.flag, groupLetter: letter, fifaRank: t.rank },
      });
      teamMap.set(t.name, { id: team.id, name: t.name });
    }
  }
  console.log(`✓ Created ${teamMap.size} teams`);

  // Create group stage matches
  const groupLetters = Object.keys(GROUPS);
  let matchCount = 0;
  for (let gi = 0; gi < groupLetters.length; gi++) {
    const letter = groupLetters[gi];
    const teams = GROUPS[letter];
    for (let md = 0; md < 3; md++) {
      const pairs = MATCHDAY_PAIRS[md];
      for (let pi = 0; pi < pairs.length; pi++) {
        const [h, a] = pairs[pi];
        await prisma.match.create({
          data: {
            stage: "group",
            groupLetter: letter,
            matchday: md + 1,
            kickoff: groupKickoff(gi, md + 1, pi),
            homeTeamId: teamMap.get(teams[h].name)!.id,
            awayTeamId: teamMap.get(teams[a].name)!.id,
            label: `Grupo ${letter} · J${md + 1}`,
          },
        });
        matchCount++;
      }
    }
  }
  console.log(`✓ Created ${matchCount} group stage matches`);

  // Create knockout placeholder slots (no teams yet — they fill in as tournament progresses)
  // R32: 16 matches | R16: 8 | QF: 4 | SF: 2 | Final: 1 | 3rd place: 1
  const knockoutStages = [
    { stage: "r32", count: 16, label: "Dieciseisavos" },
    { stage: "r16", count: 8, label: "Octavos" },
    { stage: "qf", count: 4, label: "Cuartos" },
    { stage: "sf", count: 2, label: "Semifinal" },
    { stage: "third_place", count: 1, label: "Tercer lugar" },
    { stage: "final", count: 1, label: "Final" },
  ];

  const knockoutBaseDate = new Date("2026-06-28T18:00:00.000Z");
  let dayOffset = 0;
  for (const ks of knockoutStages) {
    for (let i = 1; i <= ks.count; i++) {
      const kickoff = new Date(knockoutBaseDate);
      kickoff.setUTCDate(kickoff.getUTCDate() + dayOffset);
      kickoff.setUTCHours(kickoff.getUTCHours() + (i % 4) * 3);
      await prisma.match.create({
        data: {
          stage: ks.stage,
          kickoff,
          label: `${ks.label} ${ks.count > 1 ? i : ""}`.trim(),
        },
      });
      if (i % 4 === 0) dayOffset++;
    }
    dayOffset += 2;
  }
  console.log(`✓ Created knockout placeholders`);

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
