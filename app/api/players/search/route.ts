import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAllUsers } from "@/lib/auth"


// GET /api/players/search?q=username
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get("q") || ""

        if (query.length < 2) {
            return NextResponse.json({ players: [] })
        }

        const registeredUsers = getAllUsers()
        const customAvatarBySteamId = new Map(
            registeredUsers
                .filter((user) => user.steamId)
                .map((user) => [user.steamId as string, user.avatar || null])
        )

        const players = await prisma.player.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: "insensitive" } },
                    { steamId: { contains: query } },
                ],
                deletedAt: null,
            },
            select: {
                id: true,
                username: true,
                steamId: true,
                avatar: true,
            },
            take: 20,
            orderBy: {
                username: "asc",
            },
        })

        return NextResponse.json({
            players: players.map((player) => ({
                ...player,
                avatar: customAvatarBySteamId.get(player.steamId) || player.avatar,
            })),
        })
    } catch (error) {
        console.error("Error searching players:", error)
        return NextResponse.json({ error: "Error buscando jugadores" }, { status: 500 })
    }
}
