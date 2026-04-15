import { prisma } from "@/lib/prisma"

type SeedValue = number | null | undefined
type DateValue = Date | string | null | undefined

export interface SeedableRegistration {
  id: string
  seed?: SeedValue
  registeredAt?: DateValue
}

export interface ApprovedSeedRecord {
  id: string
  seed: number | null
  registeredAt: Date
}

function toTimestamp(value: DateValue): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

export function compareRegistrationsBySeed<T extends SeedableRegistration>(a: T, b: T): number {
  const aSeed = a.seed ?? Number.MAX_SAFE_INTEGER
  const bSeed = b.seed ?? Number.MAX_SAFE_INTEGER

  if (aSeed !== bSeed) {
    return aSeed - bSeed
  }

  const registeredDiff = toTimestamp(a.registeredAt) - toTimestamp(b.registeredAt)
  if (registeredDiff !== 0) {
    return registeredDiff
  }

  return a.id.localeCompare(b.id)
}

export function sortRegistrationsBySeed<T extends SeedableRegistration>(registrations: T[]): T[] {
  return [...registrations].sort(compareRegistrationsBySeed)
}

async function getApprovedSeedRecords(tournamentId: string): Promise<ApprovedSeedRecord[]> {
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: "APPROVED",
    },
    select: {
      id: true,
      seed: true,
      registeredAt: true,
    },
  })

  return sortRegistrationsBySeed(registrations)
}

async function persistSeedOrder(registrations: ApprovedSeedRecord[]): Promise<ApprovedSeedRecord[]> {
  if (registrations.length === 0) {
    return []
  }

  await prisma.$transaction(
    registrations.map((registration, index) =>
      prisma.tournamentRegistration.update({
        where: { id: registration.id },
        data: { seed: index + 1 },
      })
    )
  )

  return registrations.map((registration, index) => ({
    ...registration,
    seed: index + 1,
  }))
}

export async function normalizeApprovedSeeds(tournamentId: string): Promise<ApprovedSeedRecord[]> {
  const registrations = await getApprovedSeedRecords(tournamentId)
  return persistSeedOrder(registrations)
}

export async function moveApprovedRegistrationToSeed(
  tournamentId: string,
  registrationId: string,
  targetSeed: number
): Promise<ApprovedSeedRecord[]> {
  const registrations = await getApprovedSeedRecords(tournamentId)
  const currentIndex = registrations.findIndex((registration) => registration.id === registrationId)

  if (currentIndex === -1) {
    throw new Error("Registration not found in approved seeding")
  }

  const boundedIndex = Math.min(Math.max(targetSeed, 1), registrations.length) - 1
  const [registration] = registrations.splice(currentIndex, 1)
  registrations.splice(boundedIndex, 0, registration)

  return persistSeedOrder(registrations)
}
