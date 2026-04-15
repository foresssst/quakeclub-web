import { prisma } from "../lib/prisma"

const DEFAULT_TOURNAMENT_REF = "liga-dpr-clan-arena-segunda-edicion"
const PATCH_NOTE =
  "Patched to avoid immediate lower-bracket rematch caused by unbalanced BYE generation."

type MatchWithParticipants = Awaited<ReturnType<typeof loadTournament>>["matches"][number]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function getArgValue(flag: string): string | undefined {
  const args = process.argv.slice(2)
  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) return inline.slice(flag.length + 1)

  const index = args.indexOf(flag)
  if (index >= 0) return args[index + 1]

  return undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag)
}

async function loadTournament(ref: string) {
  const tournament = await prisma.tournament.findFirst({
    where: {
      OR: [{ id: ref }, { slug: ref }],
    },
    include: {
      matches: {
        orderBy: [{ bracket: "asc" }, { round: "asc" }, { matchNumber: "asc" }],
        include: {
          participant1Reg: {
            include: {
              clan: {
                select: { tag: true, name: true },
              },
            },
          },
          participant2Reg: {
            include: {
              clan: {
                select: { tag: true, name: true },
              },
            },
          },
          winner: {
            include: {
              clan: {
                select: { tag: true, name: true },
              },
            },
          },
        },
      },
    },
  })

  assert(tournament, `Tournament not found: ${ref}`)
  return tournament
}

function findMatch(
  matches: MatchWithParticipants[],
  bracket: string,
  round: number,
  matchNumber: number
) {
  const match = matches.find(
    (item) =>
      item.bracket === bracket &&
      item.round === round &&
      item.matchNumber === matchNumber
  )

  assert(match, `Missing match ${bracket} R${round} M${matchNumber}`)
  return match
}

function getLoserId(match: MatchWithParticipants) {
  assert(match.participant1Id && match.participant2Id, `Match ${match.id} does not have both participants`)
  assert(match.winnerId, `Match ${match.id} does not have a winner`)

  return match.winnerId === match.participant1Id
    ? match.participant2Id
    : match.participant1Id
}

function formatClan(reg: MatchWithParticipants["participant1Reg"] | MatchWithParticipants["participant2Reg"] | MatchWithParticipants["winner"]) {
  return reg?.clan?.tag || "TBD"
}

async function main() {
  const tournamentRef =
    getArgValue("--tournament") ||
    process.argv
      .slice(2)
      .find((arg) => !arg.startsWith("--")) ||
    DEFAULT_TOURNAMENT_REF
  const apply = hasFlag("--apply")

  const tournament = await loadTournament(tournamentRef)

  assert(
    tournament.format === "DOUBLE_ELIMINATION",
    `Tournament ${tournament.name} is not DOUBLE_ELIMINATION`
  )

  const upperQf2 = findMatch(tournament.matches, "UPPER", 1, 2)
  const upperQf4 = findMatch(tournament.matches, "UPPER", 1, 4)
  const upperSf2 = findMatch(tournament.matches, "UPPER", 2, 2)
  const lowerR1M1 = findMatch(tournament.matches, "LOWER", 1, 1)
  const lowerR1M2 = findMatch(tournament.matches, "LOWER", 1, 2)
  const lowerR2M1 = findMatch(tournament.matches, "LOWER", 2, 1)
  const lowerR2M2 = findMatch(tournament.matches, "LOWER", 2, 2)
  const lowerR3M1 = findMatch(tournament.matches, "LOWER", 3, 1)

  assert(upperQf4.status === "COMPLETED", "Upper R1 M4 must already be completed")
  assert(upperSf2.status === "COMPLETED", "Upper R2 M2 must already be completed")
  assert(!upperQf2.winnerId, "Upper R1 M2 must still be unresolved for this patch")
  assert(
    lowerR1M1.nextMatchId === lowerR2M1.id,
    "Lower R1 M1 does not point to the expected Lower R2 M1 path"
  )

  const qf4LoserId = getLoserId(upperQf4)
  const sf2LoserId = getLoserId(upperSf2)

  assert(
    upperQf4.nextLoserMatchId === lowerR1M2.id || upperQf4.nextLoserMatchId === lowerR1M1.id,
    "Upper R1 M4 is not in a patchable state"
  )
  assert(
    upperSf2.nextLoserMatchId === lowerR2M2.id || upperSf2.nextLoserMatchId === lowerR3M1.id,
    "Upper R2 M2 is not in a patchable state"
  )
  assert(
    (!lowerR2M1.participant1Id && !lowerR2M1.participant2Id) ||
      lowerR2M1.participant1Id === qf4LoserId ||
      lowerR2M1.participant2Id === qf4LoserId,
    "Lower R2 M1 already advanced beyond the safe patch window"
  )
  assert(
    !lowerR3M1.participant2Id,
    "Lower R3 M1 already has both participants"
  )

  console.log("")
  console.log(`Tournament: ${tournament.name}`)
  console.log(`Mode: ${tournament.gameType} | Status: ${tournament.status}`)
  console.log("")
  console.log("Detected broken immediate rematch:")
  console.log(`- Upper R1 M4 loser: ${formatClan(upperQf4.winnerId === upperQf4.participant1Id ? upperQf4.participant2Reg : upperQf4.participant1Reg)}`)
  console.log(`- Upper R2 M2 loser: ${formatClan(upperSf2.winnerId === upperSf2.participant1Id ? upperSf2.participant2Reg : upperSf2.participant1Reg)}`)
  console.log(`- Current lower path: LR1=${formatClan(lowerR1M1.participant1Reg)}/${formatClan(lowerR1M1.participant2Reg)} | LR2=${formatClan(lowerR2M2.participant1Reg)}/${formatClan(lowerR2M2.participant2Reg)} | LR3=${formatClan(lowerR3M1.participant1Reg)}/${formatClan(lowerR3M1.participant2Reg)}`)
  console.log("")
  console.log("Patch plan:")
  console.log(`1. Move loser of Upper R1 M4 into Lower R1 M1 so it waits for loser of ${formatClan(upperQf2.participant1Reg)} vs ${formatClan(upperQf2.participant2Reg)}.`)
  console.log(`2. Seed ${formatClan(upperSf2.winnerId === upperSf2.participant1Id ? upperSf2.participant2Reg : upperSf2.participant1Reg)} directly into Lower R3 M1 so it only appears once in the active losers path.`)
  console.log("3. Disable the unused lower slots that were causing the rematch or duplicate visual trail.")
  console.log("")

  if (!apply) {
    console.log("Dry run only. No database changes were applied.")
    console.log(`Run with: npx tsx scripts/patch-double-elim-bye-rematch.ts --tournament ${tournament.slug || tournament.id} --apply`)
    return
  }

  await prisma.$transaction([
    prisma.tournamentMatch.update({
      where: { id: upperQf4.id },
      data: {
        nextLoserMatchId: lowerR1M1.id,
        notes: PATCH_NOTE,
      },
    }),
    prisma.tournamentMatch.update({
      where: { id: upperSf2.id },
      data: {
        nextLoserMatchId: lowerR3M1.id,
        notes: PATCH_NOTE,
      },
    }),
    prisma.tournamentMatch.update({
      where: { id: lowerR1M1.id },
      data: {
        participant1Id: qf4LoserId,
        participant2Id: null,
        winnerId: null,
        score1: null,
        score2: null,
        status: "BYE",
        notes: PATCH_NOTE,
      },
    }),
    prisma.tournamentMatch.update({
      where: { id: lowerR1M2.id },
      data: {
        participant1Id: null,
        participant2Id: null,
        winnerId: null,
        score1: null,
        score2: null,
        status: "BYE",
        nextMatchId: null,
        notes: PATCH_NOTE,
      },
    }),
    prisma.tournamentMatch.update({
      where: { id: lowerR2M2.id },
      data: {
        participant1Id: null,
        participant2Id: null,
        winnerId: null,
        score1: null,
        score2: null,
        status: "BYE",
        nextMatchId: null,
        notes: PATCH_NOTE,
      },
    }),
    prisma.tournamentMatch.update({
      where: { id: lowerR3M1.id },
      data: {
        participant1Id: sf2LoserId,
        participant2Id: null,
        winnerId: null,
        score1: null,
        score2: null,
        status: "BYE",
        notes: PATCH_NOTE,
      },
    }),
  ])

  console.log("Patch applied successfully.")
}

main()
  .catch((error) => {
    console.error("FATAL:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
