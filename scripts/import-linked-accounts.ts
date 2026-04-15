import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

interface ScanAccount {
    steamId: string
    names: string[]
    primaryName: string
    sharedIps: string[]
}

interface ScanPair {
    accounts: ScanAccount[]
    sharedIps: string[]
    sharedNames: string[]
    confidence: 'high' | 'medium' | 'low'
    reason: string
    score: number
    accountCount: number
}

async function main() {
    const raw = fs.readFileSync('/tmp/linked_scan.json', 'utf-8')
    const pairs: ScanPair[] = JSON.parse(raw)

    console.log(`Found ${pairs.length} pairs\n`)

    // Clear existing
    await prisma.linkedAccount.deleteMany()
    await prisma.linkedAccountGroup.deleteMany()
    console.log('Cleared existing data\n')

    // Auto-confirm high confidence, rest pending
    let confirmed = 0
    let pending = 0
    let skipped = 0

    for (const pair of pairs) {
        const steamIds = pair.accounts.map(a => a.steamId)

        // Check for duplicate pair already imported
        const existing = await prisma.linkedAccount.findFirst({
            where: {
                steamId: steamIds[0],
                group: {
                    accounts: { some: { steamId: steamIds[1] } }
                }
            }
        })
        if (existing) { skipped++; continue }

        const players = await prisma.player.findMany({
            where: { steamId: { in: steamIds } },
            select: { id: true, steamId: true, username: true }
        })
        const playerMap = new Map(players.map(p => [p.steamId, p]))

        const autoConfirm = pair.confidence === 'high'
        const status = autoConfirm ? 'confirmed' : 'pending'
        const note = `${pair.reason} [${pair.confidence}]`

        await prisma.linkedAccountGroup.create({
            data: {
                status,
                note,
                accounts: {
                    create: pair.accounts.map((a, idx) => ({
                        steamId: a.steamId,
                        playerId: playerMap.get(a.steamId)?.id ?? null,
                        sharedIps: a.sharedIps || pair.sharedIps,
                        isPrimary: idx === 0,
                    }))
                }
            }
        })

        const tag = autoConfirm ? '✓' : '?'
        const nameA = playerMap.get(steamIds[0])?.username || pair.accounts[0].primaryName
        const nameB = playerMap.get(steamIds[1])?.username || pair.accounts[1].primaryName
        console.log(`${tag} [${pair.score}] ${nameA} ↔ ${nameB} — ${note}`)

        if (autoConfirm) confirmed++
        else pending++
    }

    console.log(`\n=== Resumen ===`)
    console.log(`Confirmados (alta): ${confirmed}`)
    console.log(`Pendientes (media/baja): ${pending}`)
    console.log(`Duplicados omitidos: ${skipped}`)
    console.log(`Total importados: ${confirmed + pending}`)

    await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
