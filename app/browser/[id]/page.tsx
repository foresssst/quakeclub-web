"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from 'lucide-react'
import { parseQuakeColors } from "@/lib/quake-colors"
import Link from "next/link"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { IdentityBadges } from "@/components/identity-badges"
import { FlagCountry } from "@/components/flag-country"
import { PlayerAvatar } from "@/components/player-avatar"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

function getMapImageUrl(mapName: string | undefined): string {
    if (!mapName) return "/levelshots/default.jpg"
    const cleanMapName = mapName.toLowerCase().trim()
    return `/levelshots/${cleanMapName}.jpg`
}

interface Player {
    name: string
    score: number
    duration: number
    steamId?: string
    odaId?: string
    avatar?: string
    elo?: number
    country?: string
    clan?: {
        tag: string
        name: string
        avatarUrl: string | null
        slug: string | null
    }
}

interface ServerDetail {
    ip: string
    port: number
    ping: number
    name: string
    map: string
    game: string
    gameType: string
    players: number
    maxPlayers: number
    bots: number
    serverType: string
    os: string
    hasPassword: boolean
    vac: boolean
    version: string
    keywords: string
    teamScores?: { red: number; blue: number }
    timelimit?: number
    fraglimit?: number
    roundlimit?: number
    gameState?: string
    playerList: Player[]
    // From servers-global
    country?: string
    countryCode?: string
    region?: string
    isOurs?: boolean
}

export default function ServerDetailPage() {
    const params = useParams()
    const router = useRouter()
    const t = useTranslations("browser")
    const [imageError, setImageError] = useState(false)

    // Parse ID format: ip-port (e.g., "34-176-193-222-27960") or "ip.port"
    const parseServerId = (id: string): { ip: string; port: string } | null => {
        if (!id) return null
        const idStr = id as string

        // Format: "34-176-193-222-27960"
        if (idStr.includes("-")) {
            const parts = idStr.split("-")
            const port = parts.pop() || "27960"
            const ip = parts.join(".")
            return { ip, port }
        }

        // Formato: "<ip>.<port>", por ejemplo "10.0.0.1.27960"
        const parts = idStr.split(".")
        if (parts.length >= 5) {
            const port = parts.pop() || "27960"
            const ip = parts.join(".")
            return { ip, port }
        }

        return null
    }

    const serverAddress = parseServerId(params.id as string)

    // Fetch server info from servers-global for country info
    const { data: serversData } = useQuery({
        queryKey: ['servers-global'],
        queryFn: async () => {
            const res = await fetch('/api/servers-global')
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
        staleTime: 30000,
    })

    // Find the server in the global list for country info
    const serverFromList = useMemo(() => {
        if (!serversData || !serverAddress) return null
        const allServers = [...(serversData.our || []), ...(serversData.world || [])]
        return allServers.find((s: any) =>
            s.ip === serverAddress.ip && s.port === parseInt(serverAddress.port)
        )
    }, [serversData, serverAddress])

    // Fetch detailed server info via A2S
    const { data: serverDetail, isLoading } = useQuery<ServerDetail>({
        queryKey: ['server-detail', serverAddress?.ip, serverAddress?.port],
        queryFn: async () => {
            if (!serverAddress) throw new Error('Invalid server address')
            const res = await fetch(`/api/server-detail?ip=${serverAddress.ip}&port=${serverAddress.port}`)
            if (!res.ok) throw new Error('Failed to fetch')
            return res.json()
        },
        enabled: !!serverAddress,
        refetchInterval: 10000,
        staleTime: 5000,
    })

    // Merge data
    const server = useMemo(() => {
        if (!serverDetail) return null
        return {
            ...serverDetail,
            country: serverFromList?.country || serverDetail.country,
            countryCode: serverFromList?.countryCode || serverDetail.countryCode,
            region: serverFromList?.region,
            isOurs: serverFromList?.isOurs,
        }
    }, [serverDetail, serverFromList])

    const serverGameType = useMemo(() => {
        if (!server) return null
        if (server.gameType) return server.gameType.toLowerCase()
        const name = (server.name || '').toUpperCase()
        if (name.includes('DUEL')) return 'duel'
        if (name.includes('CA') || name.includes('CLAN ARENA')) return 'ca'
        if (name.includes('CTF')) return 'ctf'
        if (name.includes('TDM')) return 'tdm'
        if (name.includes('FFA')) return 'ffa'
        return null
    }, [server])

    // Format duration (seconds to mm:ss or Xh Xm)
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = Math.floor(seconds % 60)
        if (hours > 0) {
            return `${hours}h${mins}m`
        }
        return `${mins}m${secs}s`
    }

    const handleConnect = () => {
        if (server) {
            window.open(`steam://connect/${server.ip}:${server.port}`, "_blank")
        }
    }

    if (!serverAddress) {
        return (
            <div className="relative min-h-screen">
                <div className="container mx-auto px-3 sm:px-4 pt-8 sm:pt-12 pb-8 max-w-[1400px]">
                    <div className="mx-auto max-w-[800px] text-center">
                        <h1 className="font-tiktok text-2xl text-foreground mb-4">Invalid Server Address</h1>
                        <p className="text-gray-400 mb-6">The server address format is invalid.</p>
                        <Link href="/browser">
                            <Button className="border border-foreground/50 bg-transparent hover:bg-foreground/10">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Browser
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="relative min-h-screen">
                <div className="container mx-auto px-3 sm:px-4 pt-8 sm:pt-12 pb-8 max-w-[1400px]">
                    <div className="flex h-64 items-center justify-center">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-foreground/30 border-t-[#1a1a1e]"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!server || !server.name) {
        return (
            <div className="relative min-h-screen">
                <div className="container mx-auto px-3 sm:px-4 pt-8 sm:pt-12 pb-8 max-w-[1400px]">
                    <div className="mx-auto max-w-[800px] text-center">
                        <h1 className="font-tiktok text-2xl text-foreground mb-4">Server Not Found</h1>
                        <p className="text-gray-400 mb-6">The server is not responding or doesn&apos;t exist.</p>
                        <Link href="/browser">
                            <Button className="border border-foreground/50 bg-transparent hover:bg-foreground/10">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Browser
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Determine if it's a team game
    const isTeamGame = ['ca', 'ctf', 'tdm', 'ft'].includes(serverGameType || '')
    const playerList = server.playerList || []

    return (
        <div className="relative min-h-screen">
            {/* Background levelshot */}
            <div className="fixed inset-0 z-0 bg-black">
                <Image
                    src={imageError ? "/levelshots/default.jpg" : getMapImageUrl(server.map)}
                    alt={server.map || "Map"}
                    fill
                    className="object-cover opacity-30"
                    unoptimized
                    onError={() => setImageError(true)}
                />
                <div className="absolute inset-0 shadow-[inset_0_0_200px_80px_rgba(30,30,34,0.7)]" />
            </div>

            <div className="relative z-10 container mx-auto px-3 sm:px-4 pt-8 sm:pt-12 pb-6 md:pb-8 max-w-[1400px]">
                <div className="mx-auto max-w-[800px] space-y-4 md:space-y-6 animate-fade-up">
                    {/* Top Ad - In-Feed */}

                    {/* Server Info Card */}
                    <ContentContainer className="bg-card/98 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.06)]">
                        <ContentHeader>
                            <div className="space-y-3">
                                <Link
                                    href="/browser"
                                    className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    {t("backToServerBrowser")}
                                </Link>
                                <div className="flex items-center justify-between">
                                    <h1 className="font-tiktok text-lg md:text-2xl font-bold uppercase tracking-wider text-foreground">
                                        {t("serverDetails")}
                                    </h1>
                                </div>
                            </div>
                        </ContentHeader>

                        <div className="px-4 md:px-6 py-4 md:py-6">
                            <div className="flex flex-col sm:flex-row gap-4 md:gap-6 items-start">
                                {/* Map thumbnail */}
                                    <div className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-lg border border-foreground/[0.06] bg-[var(--qc-bg-pure)] sm:h-24 sm:w-32 md:h-28 md:w-40">
                                        <Image
                                            src={imageError ? "/levelshots/default.jpg" : getMapImageUrl(server.map)}
                                            alt={server.map || "Map"}
                                            fill
                                            className="object-cover"
                                        unoptimized
                                        onError={() => setImageError(true)}
                                    />
                                        <div className="absolute inset-0 bg-background/18" />
                                    </div>

                                <div className="flex-1 space-y-3 md:space-y-4 w-full">
                                    <h2 className="text-lg md:text-xl font-bold text-foreground break-words leading-tight text-shadow-sm">
                                        {parseQuakeColors(server.name)}
                                    </h2>

                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <span className="text-foreground/50 text-xs uppercase">{t("map")}:</span>
                                            <span className="uppercase font-semibold text-foreground truncate">{server.map || "Unknown"}</span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <span className="text-foreground/50 text-xs uppercase">{t("mode")}:</span>
                                            <span className="uppercase font-semibold text-foreground">{server.gameType}</span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <span className="text-foreground/50 text-xs uppercase">{t("players")}:</span>
                                            <span className="font-semibold text-foreground">
                                                <span className={server.players > 0 ? "text-green-600" : ""}>{server.players}</span>
                                                <span className="text-foreground/40">/{server.maxPlayers}</span>
                                            </span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <span className="text-foreground/50 text-xs uppercase hidden sm:inline">{t("country")}:</span>
                                            <div className="flex items-center gap-2">
                                                {server.countryCode && (
                                                    <FlagCountry countryCode={server.countryCode} countryName={server.country || ""} />
                                                )}
                                                <span className="text-foreground/70">{server.country || server.region || "Unknown"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Game state info */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/40">
                                        {server.gameState && (
                                            <span className={`uppercase ${server.gameState === "IN_PROGRESS" ? "text-green-600" : "text-foreground/40"}`}>
                                                {server.gameState === "IN_PROGRESS" ? t("inProgress") : server.gameState}
                                            </span>
                                        )}
                                    </div>

                                    {/* Server address */}
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-foreground/40">{t("address")}:</span>
                                        <code className="bg-foreground/[0.06] px-2 py-0.5 font-mono text-foreground/65">{server.ip}:{server.port}</code>
                                    </div>

                                    <Button
                                        onClick={handleConnect}
                                        className="h-9 w-full rounded-none border border-foreground/45 bg-foreground/10 px-6 text-xs font-semibold uppercase tracking-wider text-foreground transition-all hover:border-foreground hover:bg-foreground/18 md:h-10 md:w-auto md:text-sm"
                                    >
                                        {t("connectToServer")}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </ContentContainer>

                    {/* Team Scores (for team modes) */}
                    {isTeamGame && server.teamScores && (
                        <ContentContainer>
                            <div className="px-4 md:px-6 py-4">
                                <div className="flex items-center justify-center gap-6 py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 bg-white/30 rounded-lg" />
                                        <span className="text-2xl font-bold text-foreground/70">{server.teamScores.red}</span>
                                        <span className="text-xs text-foreground/40 uppercase">Red</span>
                                    </div>
                                    <span className="text-foreground/20 text-xl font-bold">vs</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-foreground/40 uppercase">Blue</span>
                                        <span className="text-2xl font-bold text-foreground/70">{server.teamScores.blue}</span>
                                        <div className="w-4 h-4 bg-white/20 rounded-lg" />
                                    </div>
                                </div>
                            </div>
                        </ContentContainer>
                    )}

                    {/* Player List */}
                    <ContentContainer className="bg-card/98 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.06)]">
                        <ContentHeader>
                            <div className="flex items-center justify-between">
                                <h2 className="font-tiktok text-base md:text-lg font-bold uppercase tracking-wider text-foreground">
                                    {t("activePlayers")}
                                </h2>
                                <span className="font-tiktok text-base md:text-lg text-foreground">
                                    {playerList.length}/{server.maxPlayers}
                                </span>
                            </div>
                        </ContentHeader>

                        <div className="px-4 md:px-6 py-4">
                            {playerList.length > 0 ? (
                                <div className="space-y-1">
                                    {/* Header row (desktop only) */}
                                    <div className="hidden md:grid grid-cols-[1fr_60px_80px_60px] gap-2 items-center px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/30 border-b border-foreground/[0.06]">
                                        <span>{t("player")}</span>
                                        <span className="text-center">{t("elo")}</span>
                                        <span className="text-center">{t("time")}</span>
                                        <span className="text-center">{t("score")}</span>
                                    </div>

                                    {/* Players sorted by score */}
                                    {[...playerList]
                                        .sort((a, b) => (b.score || 0) - (a.score || 0))
                                        .map((player, idx) => (
                                            <div
                                                key={idx}
                                                className="py-2 px-2 transition-colors hover:bg-foreground/[0.02]"
                                            >
                                                {/* Mobile layout */}
                                                <div className="flex md:hidden items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        {player.avatar || player.odaId ? (
                                                            <PlayerAvatar steamId={player.steamId || ""} playerName={player.name} avatarUrl={player.avatar} />
                                                        ) : (
                                                            <div className="h-6 w-6 flex-shrink-0 rounded bg-gray-200 flex items-center justify-center">
                                                                <span className="text-[10px] font-bold text-foreground/50">?</span>
                                                            </div>
                                                        )}
                                                        <IdentityBadges
                                                            countryCode={player.country}
                                                            countryName={player.country}
                                                            clanTag={player.clan?.tag}
                                                            clanName={player.clan?.name}
                                                            clanAvatar={player.clan?.avatarUrl || undefined}
                                                            clanHref={player.clan?.slug ? `/clanes/${player.clan.slug}` : undefined}
                                                            size="sm"
                                                            showTooltips={false}
                                                        />
                                                        {player.odaId ? (
                                                            <Link href={`/perfil/${player.steamId}`} className="truncate text-sm font-medium text-foreground/82 hover:text-foreground text-shadow-sm">
                                                                {parseQuakeColors(player.name)}
                                                            </Link>
                                                        ) : (
                                                            <span className="truncate text-sm font-medium text-foreground/82 text-shadow-sm">
                                                                {parseQuakeColors(player.name)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-base font-bold text-foreground flex-shrink-0 text-shadow-sm">
                                                        {player.score || 0}
                                                    </span>
                                                </div>

                                                {/* Desktop layout */}
                                                <div className="hidden md:grid grid-cols-[1fr_60px_80px_60px] gap-2 items-center">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {player.avatar || player.odaId ? (
                                                            <PlayerAvatar steamId={player.steamId || ""} playerName={player.name} avatarUrl={player.avatar} />
                                                        ) : (
                                                            <div className="h-7 w-7 flex-shrink-0 rounded bg-gray-200 flex items-center justify-center">
                                                                <span className="text-[10px] font-bold text-foreground/50">?</span>
                                                            </div>
                                                        )}
                                                        <IdentityBadges
                                                            countryCode={player.country}
                                                            countryName={player.country}
                                                            clanTag={player.clan?.tag}
                                                            clanName={player.clan?.name}
                                                            clanAvatar={player.clan?.avatarUrl || undefined}
                                                            clanHref={player.clan?.slug ? `/clanes/${player.clan.slug}` : undefined}
                                                            size="sm"
                                                            showTooltips={false}
                                                        />
                                                        {player.odaId ? (
                                                            <Link href={`/perfil/${player.steamId}`} className="truncate text-xs font-medium uppercase text-foreground/82 transition-colors hover:text-foreground hover:underline text-shadow-sm">
                                                                {parseQuakeColors(player.name)}
                                                            </Link>
                                                        ) : (
                                                            <span className="truncate text-xs font-medium uppercase text-foreground/82 text-shadow-sm">
                                                                {parseQuakeColors(player.name)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-center font-bold text-foreground/66 text-shadow-sm">
                                                        {player.elo || '-'}
                                                    </span>
                                                    <span className="text-xs text-center text-foreground/70 text-shadow-sm">
                                                        {formatDuration(player.duration)}
                                                    </span>
                                                    <span className="text-xs text-center font-bold text-foreground text-shadow-sm">
                                                        {player.score || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div className="flex h-24 md:h-32 items-center justify-center rounded border border-foreground/20 bg-foreground/[0.02]">
                                    <p className="text-xs md:text-sm text-gray-500">No players online</p>
                                </div>
                            )}
                        </div>
                    </ContentContainer>

                    {/* Bottom Ad - Display */}
                </div>
            </div>
        </div>
    )
}
