import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession, getAllUsers } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Obtener todos los usuarios registrados (tabla User)
    const registeredUsers = getAllUsers()
    const registeredSteamIds = registeredUsers.map(u => u.steamId).filter(Boolean)

    // Intentar obtener info de Player, pero si no existe, usar info de User
    const playersFromDB = await prisma.player.findMany({
      where: {
        steamId: {
          in: registeredSteamIds
        }
      },
      select: {
        id: true,
        steamId: true,
        username: true,
      }
    })

    // Crear un mapa de steamId -> player
    const playerMap = new Map(playersFromDB.map(p => [p.steamId, p]))

    // Para cada usuario registrado, usar su info de Player si existe, sino crear uno temporal
    const players = registeredUsers
      .filter(u => u.steamId) // Solo usuarios con steamId
      .map(user => {
        const existingPlayer = playerMap.get(user.steamId)
        if (existingPlayer) {
          return existingPlayer
        }
        // Si no tiene registro en Player, crear uno temporal con el username del User
        // Si el username es solo ^7 (código de color), usar el steamId como username
        let displayName = user.username
        if (!displayName || displayName === '^7' || displayName.trim() === '') {
          displayName = `Player_${user.steamId.slice(-6)}`
        }

        return {
          id: `temp_${user.steamId}`, // ID temporal para usuarios sin registro en Player
          steamId: user.steamId,
          username: displayName
        }
      })
      .sort((a, b) => (a.username || '').localeCompare(b.username || ''))

    return NextResponse.json({ players })
  } catch (error) {
    console.error("Error fetching players:", error)
    return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 })
  }
}
