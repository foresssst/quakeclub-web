/**
 * API de Actividad del Admin - QuakeClub
 * 
 * Obtiene actividad reciente del sitio para el panel de administración.
 * Incluye: clanes, solicitudes, invitaciones, miembros, torneos, partidas, jugadores.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Tipo de actividad
interface Activity {
  id: string
  type: 'clan_created' | 'join_request' | 'invitation' | 'member_joined' |
  'tournament_registration' | 'match_completed' | 'player_registered'
  timestamp: Date
  description: string
  metadata: Record<string, unknown>
}

/**
 * GET /api/admin/activity
 * Obtener actividad reciente de todo el sitio
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación de admin
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Parámetros de paginación
    const { searchParams } = new URL(request.url)
    // SEGURIDAD: Limitar el máximo a 200 para prevenir DoS
    const requestedLimit = parseInt(searchParams.get('limit') || '50')
    const limit = Math.min(Math.max(1, requestedLimit), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    const activities: Activity[] = []

    // 1. Clanes creados recientemente
    const recentClans = await prisma.clan.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        Player: {
          select: { username: true, steamId: true },
        },
      },
    })

    recentClans.forEach((clan) => {
      activities.push({
        id: `clan_${clan.id}`,
        type: 'clan_created',
        timestamp: clan.createdAt,
        description: `Nuevo clan creado: [${clan.tag}] ${clan.name}`,
        metadata: {
          clanId: clan.id,
          clanTag: clan.tag,
          clanName: clan.name,
          founder: clan.Player.username,
          founderSteamId: clan.Player.steamId,
        },
      })
    })

    // 2. Solicitudes de unión (join requests)
    const recentJoinRequests = await prisma.clanJoinRequest.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        Clan: {
          select: { tag: true, name: true },
        },
        Player: {
          select: { username: true, steamId: true },
        },
      },
    })

    recentJoinRequests.forEach((req) => {
      const statusText = req.status === 'PENDING' ? 'pendiente' :
        req.status === 'ACCEPTED' ? 'aceptada' : 'rechazada'
      activities.push({
        id: `joinreq_${req.id}`,
        type: 'join_request',
        timestamp: req.createdAt,
        description: `Solicitud ${statusText}: ${req.Player.username} → [${req.Clan.tag}]`,
        metadata: {
          requestId: req.id,
          status: req.status,
          playerUsername: req.Player.username,
          playerSteamId: req.Player.steamId,
          clanTag: req.Clan.tag,
          clanName: req.Clan.name,
        },
      })
    })

    // 3. Invitaciones
    const recentInvitations = await prisma.clanInvitation.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        Clan: {
          select: { tag: true, name: true },
        },
        Player_ClanInvitation_inviterIdToPlayer: {
          select: { username: true },
        },
        Player_ClanInvitation_inviteeIdToPlayer: {
          select: { username: true },
        },
      },
    })

    recentInvitations.forEach((inv) => {
      const statusText = inv.status === 'PENDING' ? 'enviada' :
        inv.status === 'ACCEPTED' ? 'aceptada' : 'rechazada'
      activities.push({
        id: `invitation_${inv.id}`,
        type: 'invitation',
        timestamp: inv.createdAt,
        description: `Invitación ${statusText}: [${inv.Clan.tag}] → ${inv.Player_ClanInvitation_inviteeIdToPlayer.username}`,
        metadata: {
          invitationId: inv.id,
          status: inv.status,
          inviter: inv.Player_ClanInvitation_inviterIdToPlayer.username,
          invitee: inv.Player_ClanInvitation_inviteeIdToPlayer.username,
          clanTag: inv.Clan.tag,
          clanName: inv.Clan.name,
        },
      })
    })

    // 4. Miembros que se unieron recientemente
    const recentMembers = await prisma.clanMember.findMany({
      take: 30,
      orderBy: { joinedAt: 'desc' },
      include: {
        Clan: {
          select: { tag: true, name: true },
        },
        Player: {
          select: { username: true, steamId: true },
        },
      },
    })

    recentMembers.forEach((member) => {
      activities.push({
        id: `member_${member.id}`,
        type: 'member_joined',
        timestamp: member.joinedAt,
        description: `${member.Player.username} se unió a [${member.Clan.tag}] como ${member.role}`,
        metadata: {
          memberId: member.id,
          playerUsername: member.Player.username,
          playerSteamId: member.Player.steamId,
          clanTag: member.Clan.tag,
          clanName: member.Clan.name,
          role: member.role,
        },
      })
    })

    // 5. Inscripciones a torneos
    const recentTournamentRegs = await prisma.tournamentRegistration.findMany({
      take: 30,
      orderBy: { registeredAt: 'desc' },
      include: {
        tournament: {
          select: { id: true, name: true },
        },
        clan: {
          select: { tag: true, name: true },
        },
      },
    })

    recentTournamentRegs.forEach((reg) => {
      activities.push({
        id: `tourney_reg_${reg.id}`,
        type: 'tournament_registration',
        timestamp: reg.registeredAt,
        description: `[${reg.clan?.tag || 'Equipo'}] se inscribió en: ${reg.tournament.name}`,
        metadata: {
          tournamentId: reg.tournament.id,
          tournamentName: reg.tournament.name,
          clanTag: reg.clan?.tag,
          clanName: reg.clan?.name,
        },
      })
    })

    // 6. Partidas completadas recientemente (usando modelo Match correcto)
    const recentMatches = await prisma.match.findMany({
      take: 30,
      where: {
        gameStatus: 'SUCCESS',
      },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        matchId: true,
        timestamp: true,
        team1Score: true,
        team2Score: true,
        winner: true,
        map: true,
        gameType: true,
      },
    })

    recentMatches.forEach((match) => {
      const winner = match.winner === 1 ? 'Equipo 1' :
        match.winner === 2 ? 'Equipo 2' : 'Empate'
      const score = `${match.team1Score || 0} - ${match.team2Score || 0}`

      activities.push({
        id: `match_${match.id}`,
        type: 'match_completed',
        timestamp: match.timestamp,
        description: `Partida ${match.gameType}: ${score} en ${match.map} (${winner})`,
        metadata: {
          matchId: match.matchId,
          score: score,
          map: match.map,
          gameType: match.gameType,
          winner: winner,
        },
      })
    })

    // 7. Nuevos jugadores registrados (últimos 7 días)
    const recentPlayers = await prisma.player.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        username: true,
        steamId: true,
        createdAt: true,
        countryCode: true,
      },
    })

    recentPlayers.forEach((player) => {
      activities.push({
        id: `player_${player.id}`,
        type: 'player_registered',
        timestamp: player.createdAt,
        description: `Nuevo jugador: ${player.username}${player.countryCode ? ` (${player.countryCode})` : ''}`,
        metadata: {
          playerId: player.id,
          username: player.username,
          steamId: player.steamId,
          countryCode: player.countryCode,
        },
      })
    })

    // Ordenar todas las actividades por timestamp (más recientes primero)
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Aplicar paginación
    const paginatedActivities = activities.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      activities: paginatedActivities,
      total: activities.length,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json(
      { error: 'Error al obtener actividad' },
      { status: 500 }
    )
  }
}
