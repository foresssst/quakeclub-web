/**
 * OVERLAY ELO RATINGS from March 25 backup on top of March 1 restore
 * - Updates existing PlayerRating records with newer values
 * - Creates new Player + PlayerRating for players who joined after March 1
 * Then restores the March 26 tournament
 */
import { prisma } from '../lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

const ELO_FILE = path.resolve(__dirname, 'elo-backup-2026-03-25T14-01-46.json')
const TOURNAMENT_FILE = path.resolve(__dirname, 'tournament-backup-liga-dpr-clan-arena-segunda-edicion-2026-03-26T18-20-29-166Z.json')

async function main() {
  // ===== STEP 1: Overlay ELO Ratings =====
  console.log('=== STEP 1: OVERLAY ELO RATINGS (March 25) ===\n')
  
  const eloBackup = JSON.parse(fs.readFileSync(ELO_FILE, 'utf-8'))
  const ratings = eloBackup.playerRatings as any[]
  console.log(`  Loaded ${ratings.length} ratings from backup`)
  
  // The backup uses steamId, not playerId. Also deviation instead of rd.
  const steamIds = new Set(ratings.map((r: any) => r.steamId))
  console.log(`  Unique players: ${steamIds.size}`)
  
  const existingPlayers = await prisma.player.findMany({ select: { id: true } })
  const existingPlayerIds = new Set(existingPlayers.map(p => p.id))
  console.log(`  Players in DB: ${existingPlayerIds.size}`)
  
  // Create new players that don't exist yet
  let newPlayers = 0
  for (const sid of steamIds) {
    if (!existingPlayerIds.has(sid)) {
      try {
        const ratingEntry = ratings.find((r: any) => r.steamId === sid)
        await prisma.player.create({
          data: {
            id: sid,
            steamId: sid,
            name: ratingEntry?.username || `Player_${sid.slice(-6)}`,
            updatedAt: new Date(),
          }
        })
        newPlayers++
        existingPlayerIds.add(sid)
      } catch (e) {
        // skip duplicates
      }
    }
  }
  console.log(`  New players created: ${newPlayers}`)
  
  // Upsert all ratings
  let updated = 0
  let created = 0
  for (const r of ratings) {
    const pid = r.steamId
    if (!existingPlayerIds.has(pid)) continue
    
    const winRate = r.totalGames > 0 ? r.wins / r.totalGames : 0
    
    try {
      const existing = await prisma.playerRating.findFirst({
        where: { playerId: pid, gameType: r.gameType }
      })
      
      if (existing) {
        await prisma.playerRating.update({
          where: { id: existing.id },
          data: {
            rating: r.rating,
            rd: r.deviation,
            wins: r.wins,
            losses: r.losses,
            totalGames: r.totalGames,
            winRate: winRate,
            updatedAt: new Date(),
          }
        })
        updated++
      } else {
        await prisma.playerRating.create({
          data: {
            playerId: pid,
            gameType: r.gameType,
            rating: r.rating,
            rd: r.deviation,
            wins: r.wins,
            losses: r.losses,
            totalGames: r.totalGames,
            winRate: winRate,
            updatedAt: new Date(),
          }
        })
        created++
      }
    } catch (e: any) {
      // skip errors
    }
  }
  console.log(`  Ratings updated: ${updated}, created: ${created}`)
  console.log(`  Total ratings now: ${await prisma.playerRating.count()}`)
  console.log(`  Total players now: ${await prisma.player.count()}`)

  // ===== STEP 2: Restore ZMQ Configs (newer ones from March 25+) =====
  console.log('\n=== STEP 2: UPDATE ZMQ CONFIGS ===\n')
  
  // The dump had 14 configs. We had 16 in the March restore. 
  // Let's check if any are missing and add them
  const zmqCount = await prisma.zmqServerConfig.count()
  console.log(`  ZMQ configs in DB: ${zmqCount}`)
  // The March ELO backup scripts had a full-restore that created 16 - let's keep what we have

  // ===== STEP 3: Restore Tournament (March 26) =====
  console.log('\n=== STEP 3: RESTORE TOURNAMENT (March 26) ===\n')
  
  if (!fs.existsSync(TOURNAMENT_FILE)) {
    console.log('  No tournament backup found, skipping')
  } else {
    const tBackup = JSON.parse(fs.readFileSync(TOURNAMENT_FILE, 'utf-8'))
    const t = tBackup.tournament

    // Delete old tournament from March 1 dump if it exists with same ID
    const existingT = await prisma.tournament.findUnique({ where: { id: t.id } })
    if (existingT) {
      // Delete dependent data first
      await prisma.tournamentMatch.deleteMany({ where: { tournamentId: t.id } })
      await prisma.tournamentRegistration.deleteMany({ where: { tournamentId: t.id } })
      await prisma.tournament.delete({ where: { id: t.id } })
      console.log(`  Deleted old tournament ${t.id}`)
    }

    // Create tournament
    await prisma.tournament.create({
      data: {
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description || '',
        gameType: t.gameType || 'ca',
        format: t.format || 'DOUBLE_ELIMINATION',
        teamBased: t.teamBased ?? true,
        maxParticipants: t.maxParticipants || 16,
        status: t.status || 'IN_PROGRESS',
        registrationOpens: t.registrationOpens ? new Date(t.registrationOpens) : null,
        registrationCloses: t.registrationCloses ? new Date(t.registrationCloses) : null,
        startsAt: t.startsAt ? new Date(t.startsAt) : null,
        endsAt: t.endsAt ? new Date(t.endsAt) : null,
        rules: t.rules || '',
        prizes: t.prizes || null,
        imageUrl: t.imageUrl || null,
        createdBy: t.createdBy || '',
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: new Date(),
        checkInEndTime: t.checkInEndTime ? new Date(t.checkInEndTime) : null,
        checkInStartTime: t.checkInStartTime ? new Date(t.checkInStartTime) : null,
        tournamentType: t.tournamentType || null,
        groupsCount: t.groupsCount ?? null,
        teamsPerGroup: t.teamsPerGroup ?? null,
        playoffFormat: t.playoffFormat || null,
        minRosterSize: t.minRosterSize ?? null,
        maxRosterSize: t.maxRosterSize ?? null,
        tournamentRules: t.tournamentRules || null,
        scheduleNotes: t.scheduleNotes || null,
        mapsPerMatch: t.mapsPerMatch ?? null,
        seasonId: t.seasonId || null,
      },
    })
    console.log(`  Tournament "${t.name}" created`)

    // Registrations - check if clans exist, create stubs if not
    const clanIds = new Set<string>()
    for (const reg of tBackup.registrations || []) {
      if (reg.clanId) clanIds.add(reg.clanId)
    }
    for (const clanId of clanIds) {
      const exists = await prisma.clan.findUnique({ where: { id: clanId } })
      if (!exists) {
        // Create stub clan
        const firstPlayer = await prisma.player.findFirst()
        if (firstPlayer) {
          try {
            const num = [...clanIds].indexOf(clanId) + 1
            await prisma.clan.create({
              data: {
                id: clanId,
                name: `Clan Recuperado ${num}`,
                tag: `RC${num}`,
                slug: `clan-recuperado-${num}`,
                founderId: firstPlayer.id,
                updatedAt: new Date(),
              }
            })
            console.log(`  Created stub clan ${clanId}`)
          } catch (e) {}
        }
      }
    }

    // Create registrations
    let regOk = 0
    for (const reg of tBackup.registrations || []) {
      try {
        await prisma.tournamentRegistration.create({
          data: {
            id: reg.id,
            tournamentId: t.id,
            participantType: reg.participantType || 'CLAN',
            playerId: reg.playerId || null,
            clanId: reg.clanId || null,
            tournamentTeamId: reg.tournamentTeamId || null,
            seed: reg.seed ?? null,
            status: reg.status || 'APPROVED',
            checkedInAt: reg.checkedInAt ? new Date(reg.checkedInAt) : null,
            registeredAt: reg.registeredAt ? new Date(reg.registeredAt) : new Date(),
            notes: reg.notes || null,
            groupId: reg.groupId || null,
            groupPosition: reg.groupPosition ?? null,
          },
        })
        regOk++
      } catch (e: any) {
        console.log(`  Reg FAIL: ${e.message?.slice(0, 80)}`)
      }
    }
    console.log(`  Registrations: ${regOk}/${(tBackup.registrations || []).length}`)

    // Create matches
    let matchOk = 0
    for (const m of tBackup.matches || []) {
      try {
        await prisma.tournamentMatch.create({
          data: {
            id: m.id,
            tournamentId: t.id,
            round: m.round ?? 0,
            matchNumber: m.matchNumber ?? 0,
            bracket: m.bracket || 'UPPER',
            participant1Id: m.participant1Id || null,
            participant2Id: m.participant2Id || null,
            winnerId: m.winnerId || null,
            score1: m.score1 ?? null,
            score2: m.score2 ?? null,
            status: m.status || 'PENDING',
            scheduledFor: m.scheduledFor ? new Date(m.scheduledFor) : null,
            startedAt: m.startedAt ? new Date(m.startedAt) : null,
            completedAt: m.completedAt ? new Date(m.completedAt) : null,
            streamUrl: m.streamUrl || null,
            vodUrl: m.vodUrl || null,
            notes: m.notes || null,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            updatedAt: new Date(),
            nextLoserMatchId: m.nextLoserMatchId || null,
            nextMatchId: m.nextMatchId || null,
            participant1: m.participant1 ?? undefined,
            participant2: m.participant2 ?? undefined,
            roundText: m.roundText || null,
            groupId: m.groupId || null,
            matchdayId: m.matchdayId || null,
            isPlayoff: m.isPlayoff ?? false,
            homeTeamId: m.homeTeamId || null,
            bestOf: m.bestOf ?? null,
            tentativeDate: m.tentativeDate ? new Date(m.tentativeDate) : null,
            officialDate: m.officialDate ? new Date(m.officialDate) : null,
            matchNotes: m.matchNotes || null,
          },
        })
        matchOk++
      } catch (e: any) {
        console.log(`  Match FAIL: ${e.message?.slice(0, 80)}`)
      }
    }
    console.log(`  Matches: ${matchOk}/${(tBackup.matches || []).length}`)
  }

  // ===== FINAL SUMMARY =====
  console.log('\n=== FINAL DATABASE STATE ===')
  const counts = {
    players: await prisma.player.count(),
    ratings: await prisma.playerRating.count(),
    matches: await prisma.match.count(),
    playerMatchStats: await prisma.playerMatchStats.count(),
    eloHistory: await prisma.eloHistory.count(),
    weaponStats: await prisma.weaponStats.count(),
    clans: await prisma.clan.count(),
    clanMembers: await prisma.clanMember.count(),
    badges: await prisma.badge.count(),
    titles: await prisma.title.count(),
    playerBadges: await prisma.playerBadge.count(),
    playerTitles: await prisma.playerTitle.count(),
    tournaments: await prisma.tournament.count(),
    tournamentRegs: await prisma.tournamentRegistration.count(),
    tournamentMatches: await prisma.tournamentMatch.count(),
    zmqConfigs: await prisma.zmqServerConfig.count(),
  }
  console.log(JSON.stringify(counts, null, 2))
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
