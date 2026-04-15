import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function countOverlap(teamSteamIds: string[], pool: Set<string>) {
  let count = 0

  for (const steamId of teamSteamIds) {
    if (pool.has(steamId)) count++
  }

  return count
}

function requiredOverlap(teamSize: number, poolSize: number) {
  if (teamSize === 0 || poolSize === 0) return Infinity
  return Math.min(2, teamSize, poolSize)
}

function clusterMatchesByTime<T extends { timestamp: Date }>(matches: T[], maxGapMs = 90 * 60 * 1000) {
  const clusters: T[][] = []

  for (const match of matches) {
    const currentCluster = clusters[clusters.length - 1]

    if (!currentCluster) {
      clusters.push([match])
      continue
    }

    const lastMatch = currentCluster[currentCluster.length - 1]
    if (match.timestamp.getTime() - lastMatch.timestamp.getTime() <= maxGapMs) {
      currentCluster.push(match)
      continue
    }

    clusters.push([match])
  }

  return clusters
}

export async function GET() {
  try {
    // Fetch active tournaments (IN_PROGRESS first, then REGISTRATION_OPEN/CLOSED)
    const tournaments = await prisma.tournament.findMany({
      where: {
        status: {
          in: ["IN_PROGRESS", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"],
        },
      },
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
      include: {
        registrations: {
          where: {
            status: { in: ["APPROVED", "CHECKED_IN"] },
          },
          include: {
            clan: {
              select: {
                id: true,
                name: true,
                tag: true,
                slug: true,
                avatarUrl: true,
              },
            },
            player: {
              select: {
                id: true,
                steamId: true,
                username: true,
              },
            },
            roster: {
              select: {
                player: {
                  select: {
                    steamId: true,
                    username: true,
                  },
                },
              },
            },
            tournamentTeam: {
              select: {
                id: true,
                name: true,
                tag: true,
                avatarUrl: true,
                members: {
                  where: {
                    status: "ACCEPTED",
                  },
                  select: {
                    player: {
                      select: {
                        steamId: true,
                        username: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        matches: {
          orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
          include: {
            participant1Reg: {
              include: {
                clan: {
                  select: {
                    id: true,
                    name: true,
                    tag: true,
                    slug: true,
                    avatarUrl: true,
                  },
                },
                tournamentTeam: {
                  select: {
                    id: true,
                    name: true,
                    tag: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            participant2Reg: {
              include: {
                clan: {
                  select: {
                    id: true,
                    name: true,
                    tag: true,
                    slug: true,
                    avatarUrl: true,
                  },
                },
                tournamentTeam: {
                  select: {
                    id: true,
                    name: true,
                    tag: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            winner: {
              include: {
                clan: {
                  select: {
                    id: true,
                    name: true,
                    tag: true,
                    slug: true,
                    avatarUrl: true,
                  },
                },
                tournamentTeam: {
                  select: {
                    id: true,
                    name: true,
                    tag: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            maps: {
              orderBy: { mapNumber: "asc" },
              select: {
                id: true,
                mapNumber: true,
                mapName: true,
                score1: true,
                score2: true,
                status: true,
                playedAt: true,
              },
            },
          },
        },
        _count: {
          select: {
            registrations: true,
            matches: true,
          },
        },
      },
    })

    // Separate active (IN_PROGRESS) from upcoming
    const active = tournaments.filter((t) => t.status === "IN_PROGRESS")
    const upcoming = tournaments.filter(
      (t) => t.status === "REGISTRATION_OPEN" || t.status === "REGISTRATION_CLOSED"
    )

    // If no active, try to get the last completed tournament
    let lastCompleted = null
    if (active.length === 0) {
      lastCompleted = await prisma.tournament.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { endsAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          gameType: true,
          format: true,
          status: true,
          endsAt: true,
        },
      })
    }

    // For each active tournament, compute bracket summary
    const activeSummaries = await Promise.all(active.map(async (t) => {
      // Resolve team from registration
      const resolveTeam = (reg: any) => {
        if (!reg) return null
        return reg.tournamentTeam || reg.clan || null
      }

      const clanIds = t.registrations
        .map((reg) => reg.clan?.id || reg.clanId)
        .filter((id): id is string => Boolean(id))

      const clanMembers = clanIds.length > 0
        ? await prisma.clanMember.findMany({
            where: {
              clanId: { in: clanIds },
            },
            select: {
              clanId: true,
              steamId: true,
            },
          })
        : []

      const clanMembersByClanId = new Map<string, string[]>()
      for (const member of clanMembers) {
        const current = clanMembersByClanId.get(member.clanId) || []
        current.push(member.steamId)
        clanMembersByClanId.set(member.clanId, current)
      }

      const registrationPools = new Map<string, Set<string>>()
      for (const registration of t.registrations) {
        const steamIds = new Set<string>()

        if (registration.player?.steamId) {
          steamIds.add(registration.player.steamId)
        }

        for (const rosterMember of registration.roster || []) {
          if (rosterMember.player?.steamId) {
            steamIds.add(rosterMember.player.steamId)
          }
        }

        for (const teamMember of registration.tournamentTeam?.members || []) {
          if (teamMember.player?.steamId) {
            steamIds.add(teamMember.player.steamId)
          }
        }

        const clanId = registration.clan?.id || registration.clanId
        if (clanId) {
          for (const steamId of clanMembersByClanId.get(clanId) || []) {
            steamIds.add(steamId)
          }
        }

        registrationPools.set(registration.id, steamIds)
      }

      const ladderSearchStart = t.startsAt
        ? new Date(t.startsAt.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

      const competitiveMatches = await prisma.match.findMany({
        where: {
          gameStatus: "SUCCESS",
          serverType: "competitive",
          gameType: { equals: t.gameType, mode: "insensitive" },
          timestamp: {
            gte: ladderSearchStart,
          },
          PlayerMatchStats: {
            some: {},
          },
        },
        orderBy: {
          timestamp: "asc",
        },
        select: {
          id: true,
          matchId: true,
          map: true,
          timestamp: true,
          team1Score: true,
          team2Score: true,
          PlayerMatchStats: {
            select: {
              steamId: true,
              team: true,
            },
          },
        },
      })

      const resolvedCompetitiveMatches = competitiveMatches.map((match) => {
        const team1SteamIds = match.PlayerMatchStats.filter((player) => player.team === 1).map((player) => player.steamId)
        const team2SteamIds = match.PlayerMatchStats.filter((player) => player.team === 2).map((player) => player.steamId)

        return {
          id: match.id,
          matchId: match.matchId,
          map: match.map,
          timestamp: match.timestamp,
          team1Score: match.team1Score ?? 0,
          team2Score: match.team2Score ?? 0,
          team1SteamIds,
          team2SteamIds,
        }
      })

      const playableMatches = t.matches.filter((m) => m.status !== "BYE")
      const completedMatches = playableMatches.filter((m) => m.status === "COMPLETED")
      const pendingMatches = playableMatches.filter((m) => m.status === "PENDING" || m.status === "IN_PROGRESS")
      const totalMatches = playableMatches.length

      const resolveLinkedLadderMatches = (match: (typeof t.matches)[number], usedCompetitiveMatchIds: Set<string>) => {
        if (!match.participant1Id || !match.participant2Id) return []

        const pool1 = registrationPools.get(match.participant1Id)
        const pool2 = registrationPools.get(match.participant2Id)
        if (!pool1 || !pool2 || pool1.size === 0 || pool2.size === 0) return []

        const candidates = resolvedCompetitiveMatches
          .filter((competitiveMatch) => !usedCompetitiveMatchIds.has(competitiveMatch.id))
          .map((competitiveMatch) => {
            const directScore =
              countOverlap(competitiveMatch.team1SteamIds, pool1) +
              countOverlap(competitiveMatch.team2SteamIds, pool2)
            const swappedScore =
              countOverlap(competitiveMatch.team1SteamIds, pool2) +
              countOverlap(competitiveMatch.team2SteamIds, pool1)

            const directMatch =
              countOverlap(competitiveMatch.team1SteamIds, pool1) >= requiredOverlap(competitiveMatch.team1SteamIds.length, pool1.size) &&
              countOverlap(competitiveMatch.team2SteamIds, pool2) >= requiredOverlap(competitiveMatch.team2SteamIds.length, pool2.size)

            const swappedMatch =
              countOverlap(competitiveMatch.team1SteamIds, pool2) >= requiredOverlap(competitiveMatch.team1SteamIds.length, pool2.size) &&
              countOverlap(competitiveMatch.team2SteamIds, pool1) >= requiredOverlap(competitiveMatch.team2SteamIds.length, pool1.size)

            if (!directMatch && !swappedMatch) return null

            const orientation = directScore >= swappedScore ? "direct" : "swapped"
            let team1SeriesWin = 0
            let team2SeriesWin = 0

            if (competitiveMatch.team1Score !== competitiveMatch.team2Score) {
              const team1WonInCompetitive = competitiveMatch.team1Score > competitiveMatch.team2Score
              if (orientation === "direct") {
                team1SeriesWin = team1WonInCompetitive ? 1 : 0
                team2SeriesWin = team1WonInCompetitive ? 0 : 1
              } else {
                team1SeriesWin = team1WonInCompetitive ? 0 : 1
                team2SeriesWin = team1WonInCompetitive ? 1 : 0
              }
            }

            return {
              ...competitiveMatch,
              orientation,
              team1SeriesWin,
              team2SeriesWin,
            }
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))

        if (candidates.length === 0) return []

        const expectedMatches = (match.score1 ?? 0) + (match.score2 ?? 0)
        const referenceMoment = match.completedAt || match.officialDate || match.scheduledFor || match.tentativeDate || match.updatedAt
        const clusters = clusterMatchesByTime(candidates)

        const scoredClusters = clusters.map((cluster) => {
          const wins1 = cluster.reduce((sum, current) => sum + current.team1SeriesWin, 0)
          const wins2 = cluster.reduce((sum, current) => sum + current.team2SeriesWin, 0)
          const exactScore = wins1 === (match.score1 ?? 0) && wins2 === (match.score2 ?? 0)
          const exactLength = expectedMatches > 0 ? cluster.length === expectedMatches : true
          const lastTimestamp = cluster[cluster.length - 1]?.timestamp?.getTime() || 0
          const timePenalty = referenceMoment ? Math.abs(lastTimestamp - referenceMoment.getTime()) : 0
          const scorePenalty =
            Math.abs(wins1 - (match.score1 ?? 0)) +
            Math.abs(wins2 - (match.score2 ?? 0)) +
            Math.abs(cluster.length - expectedMatches)

          return {
            cluster,
            exactScore,
            exactLength,
            scorePenalty,
            timePenalty,
          }
        })

        scoredClusters.sort((a, b) => {
          if (a.exactScore !== b.exactScore) return a.exactScore ? -1 : 1
          if (a.exactLength !== b.exactLength) return a.exactLength ? -1 : 1
          if (a.scorePenalty !== b.scorePenalty) return a.scorePenalty - b.scorePenalty
          if (a.timePenalty !== b.timePenalty) return a.timePenalty - b.timePenalty
          return b.cluster[b.cluster.length - 1].timestamp.getTime() - a.cluster[a.cluster.length - 1].timestamp.getTime()
        })

        return scoredClusters[0]?.cluster || []
      }

      const usedCompetitiveMatchIds = new Set<string>()
      const linkedMatchesByTournamentMatchId = new Map<string, ReturnType<typeof resolveLinkedLadderMatches>>()

      const completedMatchesChronological = [...completedMatches].sort((a, b) => {
        const dateA = a.completedAt || a.officialDate || a.scheduledFor || a.tentativeDate || a.updatedAt
        const dateB = b.completedAt || b.officialDate || b.scheduledFor || b.tentativeDate || b.updatedAt
        return dateA.getTime() - dateB.getTime()
      })

      for (const completedMatch of completedMatchesChronological) {
        const linkedMatches = resolveLinkedLadderMatches(completedMatch, usedCompetitiveMatchIds)
        linkedMatchesByTournamentMatchId.set(completedMatch.id, linkedMatches)

        for (const linkedMatch of linkedMatches) {
          usedCompetitiveMatchIds.add(linkedMatch.id)
        }
      }

      const mapMatchTimelineItem = (m: (typeof t.matches)[number]) => {
        const linkedMatches = linkedMatchesByTournamentMatchId.get(m.id) || []

        return {
        id: m.id,
        round: m.round,
        matchNumber: m.matchNumber,
        bracket: m.bracket,
        roundText: m.roundText,
        status: m.status,
        score1: m.score1,
        score2: m.score2,
        team1: resolveTeam(m.participant1Reg),
        team2: resolveTeam(m.participant2Reg),
        winner: resolveTeam(m.winner),
        completedAt: m.completedAt,
        updatedAt: m.updatedAt,
        scheduledFor: m.scheduledFor,
        officialDate: m.officialDate,
        tentativeDate: m.tentativeDate,
        bestOf: m.bestOf,
        maps: m.maps.map((map) => ({
          id: map.id,
          mapNumber: map.mapNumber,
          mapName: map.mapName,
          score1: map.score1,
          score2: map.score2,
          status: map.status,
          playedAt: map.playedAt,
        })),
        linkedLadderMatchId: linkedMatches[linkedMatches.length - 1]?.id || null,
        linkedLadderMatchIds: linkedMatches.map((linkedMatch) => linkedMatch.id),
      }
      }

      // Recent results (last 3 completed)
      const recentResults = completedMatches
        .sort((a, b) => {
          const dateA = a.completedAt || a.updatedAt
          const dateB = b.completedAt || b.updatedAt
          return dateB.getTime() - dateA.getTime()
        })
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          team1: resolveTeam(m.participant1Reg),
          team2: resolveTeam(m.participant2Reg),
          score1: m.score1,
          score2: m.score2,
          winner: resolveTeam(m.winner),
          round: m.round,
          roundText: m.roundText,
        }))

      // Participating clans/teams
      const participants = t.registrations.map((r) => ({
        id: r.id,
        team: r.tournamentTeam || r.clan || null,
      })).filter((p) => p.team !== null)

      const playedTimeline = completedMatches
        .sort((a, b) => {
          const dateA = a.completedAt || a.updatedAt
          const dateB = b.completedAt || b.updatedAt
          return dateB.getTime() - dateA.getTime()
        })
        .map(mapMatchTimelineItem)

      const upcomingTimeline = pendingMatches
        .filter((m) => m.participant1Reg || m.participant2Reg)
        .sort((a, b) => {
          const dateA = a.officialDate || a.scheduledFor || a.tentativeDate || a.updatedAt
          const dateB = b.officialDate || b.scheduledFor || b.tentativeDate || b.updatedAt
          return dateA.getTime() - dateB.getTime()
        })
        .map(mapMatchTimelineItem)

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        gameType: t.gameType,
        format: t.format,
        status: t.status,
        startsAt: t.startsAt,
        imageUrl: t.imageUrl,
        notice: t.scheduleNotes || null,
        totalMatches,
        completedMatches: completedMatches.length,
        pendingMatches: pendingMatches.length,
        participants,
        recentResults,
        bracketMatches: t.matches.map((m) => ({
          id: m.id,
          round: m.round,
          matchNumber: m.matchNumber,
          bracket: m.bracket,
          roundText: m.roundText,
          status: m.status,
          score1: m.score1,
          score2: m.score2,
          team1: resolveTeam(m.participant1Reg),
          team2: resolveTeam(m.participant2Reg),
          winner: resolveTeam(m.winner),
        })),
        matchTimeline: {
          played: playedTimeline,
          upcoming: upcomingTimeline,
        },
      }
    }))

    return NextResponse.json({
      active: activeSummaries,
      upcoming: upcoming.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        gameType: t.gameType,
        format: t.format,
        status: t.status,
        startsAt: t.startsAt,
        imageUrl: t.imageUrl,
        participantCount: t.registrations.length,
      })),
      lastCompleted,
    })
  } catch (error) {
    console.error("Error fetching active tournament:", error)
    return NextResponse.json({ active: [], upcoming: [], lastCompleted: null })
  }
}
