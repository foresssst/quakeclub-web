import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserBySteamId } from "@/lib/auth"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ steamId: string }> }
) {
    try {
        const { steamId } = await params

        const player = await prisma.player.findUnique({
            where: { steamId },
            select: {
                id: true,
                username: true,
                avatar: true,
                banner: true,
                coverPresetId: true,
                countryCode: true,
            },
        })

        if (!player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 })
        }

        // Fetch latest match name to get the most accurate username
        const lastMatch = await prisma.playerMatchStats.findFirst({
            where: { steamId },
            orderBy: { createdAt: 'desc' },
            select: { playerName: true }
        })

        const displayUsername = lastMatch?.playerName || player.username

        // Resolve Avatar (Auth JSON > Prisma)
        const authUser = getUserBySteamId(steamId)
        const displayAvatar = authUser?.avatar || player.avatar

        // Resolve Banner (Custom > Preset)
        let displayBanner = authUser?.banner || player.banner
        if (!displayBanner && player.coverPresetId) {
            const preset = await prisma.coverPreset.findUnique({
                where: { id: player.coverPresetId }
            })
            if (preset) {
                displayBanner = preset.imageUrl
            }
        }

        // Fetch ratings separately
        const ratings = await prisma.playerRating.findMany({
            where: { steamId },
            select: {
                rating: true,
            },
        })

        // Calculate average ELO (default 900 para nuevos jugadores)
        const avgElo = ratings.length > 0
            ? Math.round(
                ratings.reduce((sum: number, r) => sum + r.rating, 0) / ratings.length
            )
            : 900

        // Fetch K/D stats
        const stats = await prisma.playerMatchStats.aggregate({
            where: { steamId },
            _sum: {
                kills: true,
                deaths: true,
            },
        })

        const kills = stats._sum.kills || 0
        const deaths = stats._sum.deaths || 0
        const kd = (kills / Math.max(deaths, 1)).toFixed(2)

        // Fetch active clan
        const clanMember = await prisma.clanMember.findFirst({
            where: { playerId: player.id },
            include: {
                Clan: true,
            },
        })

        // Fetch active title
        const activePlayerTitle = await prisma.playerTitle.findFirst({
            where: {
                playerId: player.id,
                isActive: true,
            },
            include: {
                title: true,
            },
        })

        return NextResponse.json({
            username: displayUsername,
            avatar: displayAvatar,
            banner: displayBanner,
            countryCode: player.countryCode,
            elo: avgElo,
            kd: kd,
            clan: clanMember?.Clan ? {
                tag: clanMember.Clan.tag,
                name: clanMember.Clan.name,
                avatarUrl: clanMember.Clan.avatarUrl,
            } : null,
            title: activePlayerTitle?.title ? {
                name: activePlayerTitle.title.name,
                color: activePlayerTitle.title.titleColor,
            } : null,
        })
    } catch (error) {
        console.error("[Player Hover Info] Error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
