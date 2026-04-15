/**
 * Script para sincronizar wins/losses de todos los jugadores
 * basándose en los partidos reales en la base de datos.
 * 
 * Ejecutar con: npx tsx scripts/sync-wins-losses.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MatchResult {
  steamId: string
  gameType: string
  matchId: string
  team: number | null
  score: number
  winner: number | null
  team1Score: number
  team2Score: number
  eloChange: number | null
}

async function main() {
  console.log('🔄 Iniciando sincronización de wins/losses...\n')

  // Obtener todos los PlayerRating
  const ratings = await prisma.playerRating.findMany({
    include: {
      Player: {
        include: {
          PlayerMatchStats: {
            include: {
              Match: {
                select: {
                  id: true,
                  matchId: true,
                  gameType: true,
                  winner: true,
                  team1Score: true,
                  team2Score: true
                }
              }
            }
          }
        }
      }
    }
  })

  console.log(`📊 Procesando ${ratings.length} ratings...\n`)

  let totalUpdated = 0
  let totalErrors = 0
  const issues: string[] = []

  for (const rating of ratings) {
    try {
      // Filtrar partidas por gameType
      const gameTypeMatches = rating.Player.PlayerMatchStats.filter(
        pm => pm.Match.gameType?.toLowerCase() === rating.gameType.toLowerCase()
      )

      let calculatedWins = 0
      let calculatedLosses = 0

      for (const pm of gameTypeMatches) {
        const match = pm.Match
        let matchWinner = match.winner

        // Si winner no está definido, calcularlo desde scores
        if (matchWinner === null || matchWinner === undefined) {
          const t1Score = match.team1Score ?? 0
          const t2Score = match.team2Score ?? 0
          
          if (t1Score > t2Score) {
            matchWinner = 1
          } else if (t2Score > t1Score) {
            matchWinner = 2
          } else {
            // Scores iguales - usar score individual del jugador
            // Jugador con score > 0 gana
            // En DUEL: quien tiene más frags gana
            matchWinner = pm.score > 0 ? pm.team : (pm.team === 1 ? 2 : 1)
          }
        }

        // Determinar resultado
        const isTeamGame = pm.team !== null && pm.team !== undefined && pm.team > 0
        const gt = rating.gameType.toLowerCase()

        if (gt === 'duel') {
          // En DUEL: comparar scores de los 2 jugadores
          // El que tiene más score gana
          const allMatchStats = await prisma.playerMatchStats.findMany({
            where: { matchId: pm.matchId },
            select: { steamId: true, score: true }
          })
          
          if (allMatchStats.length === 2) {
            const myScore = pm.score
            const opponentScore = allMatchStats.find(s => s.steamId !== pm.steamId)?.score ?? 0
            
            if (myScore > opponentScore) {
              calculatedWins++
            } else if (myScore < opponentScore) {
              calculatedLosses++
            } else {
              // Empate técnico - usar eloDelta como desempate
              // Si ganaste ELO, cuenta como win
              if (pm.eloDelta && pm.eloDelta > 0) {
                calculatedWins++
              } else {
                calculatedLosses++
              }
            }
          } else {
            // Solo 1 jugador en el partido (raro), usar score
            if (pm.score > 0) {
              calculatedWins++
            } else {
              calculatedLosses++
            }
          }
        } else if (isTeamGame) {
          // Partidos de equipo: winner === team → WIN
          if (matchWinner === pm.team) {
            calculatedWins++
          } else {
            calculatedLosses++
          }
        } else if (gt === 'ffa') {
          // FFA: Solo RANK #1 gana, los demás pierden (como XonStat/QLStats)
          const allMatchStats = await prisma.playerMatchStats.findMany({
            where: { matchId: pm.matchId },
            select: { steamId: true, score: true }
          })

          if (allMatchStats.length > 0) {
            const maxScore = Math.max(...allMatchStats.map(s => s.score))
            // Solo el de mayor score gana (RANK 1)
            if (pm.score === maxScore && pm.score > 0) {
              calculatedWins++
            } else {
              calculatedLosses++
            }
          } else {
            calculatedLosses++
          }
        } else {
          // Otros modos sin equipos: usar score como indicador
          if (pm.score > 0) {
            calculatedWins++
          } else {
            calculatedLosses++
          }
        }
      }

      const totalGames = calculatedWins + calculatedLosses

      // Solo actualizar si hay discrepancia
      if (
        rating.wins !== calculatedWins ||
        rating.losses !== calculatedLosses ||
        rating.draws !== 0 ||
        rating.totalGames !== totalGames
      ) {
        await prisma.playerRating.update({
          where: { id: rating.id },
          data: {
            wins: calculatedWins,
            losses: calculatedLosses,
            draws: 0, // No hay draws en Quake Live
            totalGames: totalGames
          }
        })
        
        const change = `${rating.steamId} (${rating.gameType}): W:${rating.wins}→${calculatedWins}, L:${rating.losses}→${calculatedLosses}, G:${rating.totalGames}→${totalGames}`
        issues.push(change)
        totalUpdated++
        
        if (totalUpdated <= 20) {
          console.log(`✏️  ${change}`)
        }
      }
    } catch (error) {
      console.error(`❌ Error procesando ${rating.steamId} (${rating.gameType}):`, error)
      totalErrors++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Sincronización completada`)
  console.log(`   - Total ratings: ${ratings.length}`)
  console.log(`   - Actualizados: ${totalUpdated}`)
  console.log(`   - Errores: ${totalErrors}`)
  
  if (issues.length > 20) {
    console.log(`   - (${issues.length - 20} más no mostrados)`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
