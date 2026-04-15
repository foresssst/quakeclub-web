import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Roles válidos
const VALID_ROLES = ["founder", "dev", "admin", "mod"]

// Configuración de roles para mostrar
const ROLE_INFO: Record<string, { name: string; description: string; color: string }> = {
  founder: {
    name: "Fundadores",
    description: "Los creadores y fundadores de QuakeClub. Responsables de la visión y dirección del proyecto.",
    color: "#FFD700",
  },
  dev: {
    name: "Desarrolladores",
    description: "El equipo de desarrollo que construye y mantiene la plataforma de QuakeClub.",
    color: "#B8B8B8",
  },
  admin: {
    name: "Administradores",
    description: "Administradores de la comunidad con acceso completo para gestionar servidores y usuarios.",
    color: "#FF66AB",
  },
  mod: {
    name: "Moderadores",
    description: "Moderadores que ayudan a mantener un ambiente positivo en la comunidad.",
    color: "#99CCFF",
  },
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const { role } = await params
    const roleLower = role.toLowerCase()

    // Validar rol
    if (!VALID_ROLES.includes(roleLower)) {
      return NextResponse.json(
        { error: "Rol no válido" },
        { status: 400 }
      )
    }

    // Buscar usuarios con este rol
    const players = await prisma.player.findMany({
      where: {
        roles: {
          has: roleLower,
        },
      },
      select: {
        id: true,
        steamId: true,
        username: true,
        avatar: true,
        countryCode: true,
        roles: true,
        lastSeen: true,
        PlayerRating: {
          where: {
            gameType: "ca",
            ratingType: "public",
          },
          select: {
            rating: true,
            totalGames: true,
          },
        },
      },
      orderBy: {
        username: "asc",
      },
    })

    // Formatear respuesta
    const users = players.map((player) => ({
      id: player.id,
      steamId: player.steamId,
      username: player.username,
      avatar: player.avatar,
      countryCode: player.countryCode,
      roles: player.roles,
      lastSeen: player.lastSeen,
      rating: player.PlayerRating[0]?.rating || null,
      gamesPlayed: player.PlayerRating[0]?.totalGames || 0,
    }))

    const roleInfo = ROLE_INFO[roleLower]

    return NextResponse.json({
      role: {
        id: roleLower,
        name: roleInfo.name,
        description: roleInfo.description,
        color: roleInfo.color,
        shortName: role.toUpperCase(),
      },
      users,
      totalUsers: users.length,
    })
  } catch (error) {
    console.error("Error fetching group members:", error)
    return NextResponse.json(
      { error: "Error al obtener miembros del grupo" },
      { status: 500 }
    )
  }
}
