import { type NextRequest, NextResponse } from "next/server"
import { getUserBySteamId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateSteamId } from "@/lib/security"
import { fetchWithTimeout } from "@/lib/steam"
import { getDisplayCountry } from "@/lib/country-detection"
import { getPlacementInfo } from "@/lib/ranking-visibility"
import { getProfileExtras } from "@/lib/profile-extras"

export async function GET(request: NextRequest, { params }: { params: Promise<{ steamId: string }> }) {
  try {
    const { steamId } = await params

    if (!steamId) {
      return NextResponse.json({ error: "Steam ID is required" }, { status: 400 })
    }

    if (!validateSteamId(steamId)) {
      return NextResponse.json({ error: "Invalid Steam ID format" }, { status: 400 })
    }

    // Primero buscar en Player (creado automáticamente al jugar)
    const player = await prisma.player.findUnique({
      where: { steamId },
    })

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Intentar buscar User registrado (opcional)
    const user = await getUserBySteamId(steamId)

    // Obtener ratings públicos por modo de juego desde la DB
    const publicRatings = await prisma.playerRating.findMany({
      where: {
        steamId,
        ratingType: "public",
      },
      select: {
        gameType: true,
        rating: true,
        totalGames: true,
        wins: true,
        losses: true,
        draws: true,
        lastPlayed: true,
      },
      orderBy: {
        totalGames: "desc",
      },
    })

    // Obtener ratings de liga (ladder off-season)
    const ladderRatings = await prisma.playerRating.findMany({
      where: {
        steamId,
        ratingType: "ladder",
      },
      select: {
        gameType: true,
        rating: true,
        totalGames: true,
        wins: true,
        losses: true,
        draws: true,
        lastPlayed: true,
      },
      orderBy: {
        totalGames: "desc",
      },
    })

    // Obtener ratings de temporadas activas
    const seasonRatings = await prisma.seasonRating.findMany({
      where: {
        steamId,
        season: {
          status: "ACTIVE",
        },
      },
      select: {
        gameType: true,
        rating: true,
        games: true,
        wins: true,
        losses: true,
        draws: true,
        lastPlayed: true,
        season: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        games: "desc",
      },
    })

    // Formatear ratings para el cliente (públicos - mantener compatibilidad)
    const formattedRatings = publicRatings.map((r) => {
      const placementInfo = getPlacementInfo(r.totalGames, r.gameType, "public")
      return {
        gameType: r.gameType.toUpperCase(),
        rating: placementInfo.isPlacement ? null : Math.round(r.rating),
        games: r.totalGames,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        lastPlayed: r.lastPlayed.toISOString(),
        gamesRemaining: placementInfo.gamesRemaining,
        minGames: placementInfo.minGames,
        isPlacement: placementInfo.isPlacement,
      }
    })

    // Formatear ratings de liga
    const formattedLadderRatings = ladderRatings.map((r) => {
      const placementInfo = getPlacementInfo(r.totalGames, r.gameType, "ladder")
      return {
        gameType: r.gameType.toUpperCase(),
        rating: placementInfo.isPlacement ? null : Math.round(r.rating),
        games: r.totalGames,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        lastPlayed: r.lastPlayed.toISOString(),
        gamesRemaining: placementInfo.gamesRemaining,
        minGames: placementInfo.minGames,
        isPlacement: placementInfo.isPlacement,
      }
    })

    // Formatear ratings de temporada
    const formattedSeasonRatings = seasonRatings.map((r) => ({
      gameType: r.gameType.toUpperCase(),
      rating: Math.round(r.rating),
      games: r.games,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      lastPlayed: r.lastPlayed.toISOString(),
      season: r.season,
    }))

    // Obtener clan del jugador si pertenece a uno
    const clanMembership = await prisma.clanMember.findFirst({
      where: {
        playerId: player.id,
      },
      include: {
        Clan: {
          select: {
            id: true,
            tag: true,
            slug: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    // Obtener título activo del jugador con información del título global
    const activePlayerTitle = await prisma.playerTitle.findFirst({
      where: {
        playerId: player.id,
        isActive: true,
      },
      include: {
        title: true,
      },
      orderBy: {
        priority: 'asc',
      },
    })

    // Obtener badges del jugador con información de los badges globales
    const playerBadges = await prisma.playerBadge.findMany({
      where: {
        playerId: player.id,
      },
      include: {
        badge: true,
      },
      orderBy: {
        awardedAt: 'desc',
      },
    })

    // Determinar avatar, banner y username: custom/steam > default
    // IMPORTANTE: Priorizar user.avatar (avatares personalizados) sobre player.avatar
    let avatarUrl = user?.avatar || player.avatar; // Avatar custom del user tiene prioridad
    let bannerUrl = player.banner; // Banner custom del player
    let username = player.username; // Username de la BD por defecto

    // Intentar obtener datos de Steam
    try {
      const steamApiKey = process.env.STEAM_API_KEY;
      if (steamApiKey) {
        const steamResponse = await fetchWithTimeout(
          `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamId}`,
          5000 // 5 segundos timeout
        );
        if (steamResponse.ok) {
          const steamData = await steamResponse.json();
          const steamProfile = steamData.response?.players?.[0];
          if (steamProfile) {
            // Usar username de Steam (con colores de Quake incluidos)
            username = steamProfile.personaname || player.username;

            // Solo usar avatar de Steam si no hay custom
            if (!avatarUrl && steamProfile.avatarfull) {
              avatarUrl = steamProfile.avatarfull;
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching Steam data:", err);
    }

    // Calculate overall rating (average of all game types)
    const visibleRatings = formattedRatings.filter((rating) => typeof rating.rating === "number")
    const overallRating = visibleRatings.length > 0
      ? Math.round(visibleRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / visibleRatings.length)
      : 0

    const profileExtras = getProfileExtras(steamId)

    return NextResponse.json({
      steamId: player.steamId,
      username: username, // Prioridad: Steam > BD
      avatar: avatarUrl, // Prioridad: custom > Steam > undefined
      banner: bannerUrl, // Banner custom del player
      bannerOffsetX: player.bannerOffsetX ?? 0, // Offset horizontal del banner en píxeles
      bannerOffsetY: player.bannerOffsetY ?? 0, // Offset vertical del banner en píxeles
      coverPresetId: player.coverPresetId, // ID del preset seleccionado
      countryCode: getDisplayCountry(player.countryCode, player.realCountryCode),
      createdAt: player.createdAt,
      isAdmin: user?.isAdmin || false,
      isRegistered: !!user, // true si tiene cuenta, false si solo jugó
      overallRating, // Overall rating calculado
      ratings: formattedRatings, // Ratings públicos (mantener compatibilidad)
      // Sistema de Liga
      ladderRatings: formattedLadderRatings, // Ratings de liga off-season
      seasonRatings: formattedSeasonRatings, // Ratings de temporada activa
      clan: clanMembership ? clanMembership.Clan : null, // Agregar clan simplificado
      roles: player.roles || [], // Roles del jugador: founder, dev, admin, mod
      // Moderation status
      isSuspended: player.isSuspended || false,
      isBanned: player.isBanned || false,
      suspendReason: player.suspendReason || null,
      banReason: player.banReason || null,
      title: activePlayerTitle ? {
        id: activePlayerTitle.title.id,
        title: activePlayerTitle.title.name,
        titleUrl: activePlayerTitle.title.titleUrl,
        titleColor: activePlayerTitle.title.titleColor,
      } : null,
      profileExtras,
      badges: playerBadges.map(pb => ({
        id: pb.badge.id,
        name: pb.badge.name,
        description: pb.badge.description,
        imageUrl: pb.badge.imageUrl,
        badgeUrl: pb.badge.badgeUrl,
        category: pb.badge.category,
        awardedAt: pb.awardedAt.toISOString(),
      })),
      // Quit tracker: conteo de quits activos en la ventana de 7 días
      activeQuits: await prisma.quitRecord.count({
        where: { steamId, expiresAt: { gt: new Date() } },
      }),
    })
  } catch (error) {
    console.error("Error fetching player:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
