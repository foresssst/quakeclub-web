import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"


// GET /api/clans/my-membership?steamId=...
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const steamId = searchParams.get("steamId")

        console.log('[DEBUG] /api/clans/my-membership - steamId:', steamId)

        if (!steamId) {
            console.log('[DEBUG] No steamId provided')
            return NextResponse.json(
                { error: "Steam ID requerido" },
                { status: 400 }
            )
        }

        // Find player and their clan membership
        const player = await prisma.player.findUnique({
            where: { steamId },
            include: {
                ClanMember: {
                    include: {
                        Clan: {
                            include: {
                                ClanMember: {
                                    include: {
                                        Player: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        console.log('[DEBUG] Player found:', player ? 'YES' : 'NO')
        console.log('[DEBUG] ClanMember count:', player?.ClanMember?.length || 0)

        if (!player) {
            console.log('[DEBUG] Player not found in database for steamId:', steamId)
            return NextResponse.json(
                { error: "Jugador no encontrado" },
                { status: 404 }
            )
        }

        const membership = player.ClanMember[0] // Assuming one clan per player for now

        if (!membership) {
            console.log('[DEBUG] No ClanMember relationship found for player:', player.username)
            return NextResponse.json({ clan: null })
        }

        console.log('[DEBUG] Returning clan:', membership.Clan?.name, '(', membership.Clan?.tag, ')')

        // Transform ClanMember array to members for frontend compatibility
        const clanData = {
            ...membership.Clan,
            members: membership.Clan.ClanMember?.map((m: any) => ({
                id: m.id,
                role: m.role,
                player: m.Player
            })) || []
        }

        return NextResponse.json({
            clan: clanData,
            role: membership.role
        })

    } catch (error) {
        console.error("Error fetching clan membership:", error)
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        )
    } finally {
        
    }
}
