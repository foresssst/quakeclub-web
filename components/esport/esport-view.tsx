"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { YouTubeFacade } from "@/components/youtube-facade"
import { LoadingScreen } from "@/components/loading-screen"
import { FlagClan } from "@/components/flag-clan"
import { TierBadgeInline } from "@/components/tier-badge"

interface Tournament {
    id: string
    slug?: string
    name: string
    description?: string
    status: string
    gameType?: string
    format?: string
    tournamentType?: string
    maxParticipants?: number
    startsAt?: string
    endsAt?: string
    imageUrl?: string
    _count?: {
        registrations: number
        matches: number
    }
}

interface Clan {
    slug?: string | null
    rank?: number
    tag: string
    inGameTag?: string | null
    name: string
    avatarUrl?: string
    avgElo?: number
    avgKd?: number
    members?: number
}

// Videos destacados de torneos anteriores
const FEATURED_VIDEOS = [
    {
        id: "9dhPoXPTW8U",
        title: "Gran Final Copa Clan Arena",
        description: "PRC vs PBS",
        mode: "CA"
    },
    {
        id: "rL-XnQD6FDU",
        title: "Semifinal Liga DPR",
        description: "T4 vs GET NAKED",
        mode: "CA"
    },
    {
        id: "2jL05bdp_-A",
        title: "Gran Final Liga DPR",
        description: "T4 vs ZP",
        mode: "CA"
    },
    {
        id: "1lyzz-VSaRw",
        title: "Gran Final Copa CTF Apertura",
        description: "UZ vs X",
        mode: "CTF"
    }
]

export function EsportView() {
    const [activeTab, setActiveTab] = useState<"upcoming" | "active" | "history">("upcoming")

    const { data, isFetched: tournamentsFetched } = useQuery({
        queryKey: ['tournaments'],
        queryFn: async () => {
            const res = await fetch('/api/esport/tournaments')
            if (!res.ok) throw new Error('Error')
            return res.json()
        }
    })

    // Fetch top clans desde el ranking real (respeta mínimo de miembros)
    const { data: clansData, isFetched: clansFetched } = useQuery({
        queryKey: ['top-clans-esport'],
        queryFn: async () => {
            const res = await fetch('/api/rankings/clans?limit=5&gameType=ca')
            if (!res.ok) return { clans: [] }
            return res.json()
        }
    })

    // Mostrar skeleton hasta que todo esté cargado
    const allDataLoaded = tournamentsFetched && clansFetched

    const activeTournaments: Tournament[] = data?.active || []
    const upcomingTournaments: Tournament[] = data?.upcoming || []
    const completedTournaments: Tournament[] = data?.completed || []
    const allTournaments = [...activeTournaments, ...upcomingTournaments, ...completedTournaments]
    const topClans: Clan[] = clansData?.clans?.slice(0, 5) || []

    const getGameTypeLabel = (gameType?: string) => {
        if (!gameType) return 'N/A'
        const labels: Record<string, string> = {
            'ca': 'Clan Arena',
            'ctf': 'CTF',
            'tdm': 'TDM',
            'duel': 'Duel',
            'ffa': 'FFA'
        }
        return labels[gameType.toLowerCase()] || gameType.toUpperCase()
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'REGISTRATION_OPEN': 'Inscripciones',
            'REGISTRATION_CLOSED': 'Cerrado',
            'IN_PROGRESS': 'En Curso',
            'COMPLETED': 'Finalizado',
            'UPCOMING': 'Proximo'
        }
        return labels[status] || status
    }

    const getFormatLabel = (tournament: Tournament) => {
        if (tournament.tournamentType === 'CUSTOM_GROUP') return 'Grupos + Playoffs'
        if (tournament.format === 'DOUBLE_ELIMINATION') return 'Double Elim'
        if (tournament.format === 'SINGLE_ELIMINATION') return 'Single Elim'
        return tournament.format || 'Estandar'
    }

    const formatTournamentDate = (dateStr?: string) => {
        if (!dateStr) return ''
        try {
            return format(new Date(dateStr), 'MMM yyyy', { locale: es })
        } catch {
            return ''
        }
    }

    const currentTournaments = activeTab === "active"
        ? activeTournaments
        : activeTab === "upcoming"
            ? upcomingTournaments
            : completedTournaments

    if (!allDataLoaded) {
        return <LoadingScreen compact />
    }

    return (
        <div className="flex flex-col lg:flex-row animate-fade-up">
            {/* LEFT SIDEBAR - Calendar */}
            <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-foreground/[0.06] bg-card">
                <div className="p-5">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground/40 mb-4 font-tiktok">
                        Calendario
                    </h3>
                    {allTournaments.length > 0 ? (
                        <div className="space-y-1">
                            {allTournaments.map((tournament) => (
                                <Link
                                    key={tournament.id}
                                    href={`/esport/${tournament.slug || tournament.id}`}
                                    className={`block p-4 transition-all cursor-pointer ${tournament.status === 'IN_PROGRESS' || tournament.status === 'REGISTRATION_OPEN'
                                        ? 'bg-foreground/10 border-l-2 border-foreground'
                                        : 'hover:bg-foreground/[0.03] border-l-2 border-transparent'
                                        }`}
                                >
                                    <div className="text-[9px] text-foreground/30 uppercase tracking-wider">
                                        {getGameTypeLabel(tournament.gameType)}
                                    </div>
                                    <div className={`text-[13px] font-bold mt-1 leading-snug ${tournament.status === 'IN_PROGRESS' || tournament.status === 'REGISTRATION_OPEN'
                                        ? 'text-foreground' : 'text-foreground/70'
                                        }`}>
                                        {tournament.name}
                                    </div>
                                    <div className="text-[10px] text-foreground/40 mt-1">
                                        {formatTournamentDate(tournament.startsAt) || getStatusLabel(tournament.status)}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-xs text-foreground/30">No hay torneos programados</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 min-w-0">
                {/* Tabs */}
                <div className="flex bg-card border-b border-foreground/[0.06]">
                    <button
                        onClick={() => setActiveTab("upcoming")}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all font-tiktok border-b-2 -mb-px ${activeTab === "upcoming"
                            ? "text-foreground border-foreground bg-foreground/5"
                            : "text-foreground/40 border-transparent hover:text-foreground/60"
                            }`}
                    >
                        Proximos
                        <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded-lg ${activeTab === "upcoming" ? "bg-foreground/20" : "bg-foreground/[0.06]"
                            }`}>
                            {upcomingTournaments.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("active")}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all font-tiktok border-b-2 -mb-px ${activeTab === "active"
                            ? "text-foreground border-foreground bg-foreground/5"
                            : "text-foreground/40 border-transparent hover:text-foreground/60"
                            }`}
                    >
                        En Curso
                        <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded-lg ${activeTab === "active" ? "bg-foreground/20" : "bg-foreground/[0.06]"
                            }`}>
                            {activeTournaments.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all font-tiktok border-b-2 -mb-px ${activeTab === "history"
                            ? "text-foreground border-foreground bg-foreground/5"
                            : "text-foreground/40 border-transparent hover:text-foreground/60"
                            }`}
                    >
                        Historial
                        <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded-lg ${activeTab === "history" ? "bg-foreground/20" : "bg-foreground/[0.06]"
                            }`}>
                            {completedTournaments.length}
                        </span>
                    </button>
                </div>

                {/* Tournament Grid */}
                <div className="p-4">
                    {currentTournaments.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-[var(--qc-text-muted)] text-[15px]">
                                {activeTab === "active" && "No hay torneos en curso."}
                                {activeTab === "upcoming" && "No hay torneos proximos."}
                                {activeTab === "history" && "No hay torneos finalizados."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {currentTournaments.map((tournament) => (
                                <Link
                                    key={tournament.id}
                                    href={`/esport/${tournament.slug || tournament.id}`}
                                    className={`group flex items-center gap-4 p-3 rounded-lg hover:bg-foreground/[0.03] transition-all ${
                                        tournament.status === 'COMPLETED' ? 'opacity-55' : ''
                                    }`}
                                >
                                    {/* Thumbnail */}
                                    <div className={`relative w-20 h-14 sm:w-24 sm:h-16 flex-shrink-0 rounded-lg overflow-hidden bg-foreground ${
                                        tournament.status === 'COMPLETED' ? 'grayscale' : ''
                                    }`}>
                                        {tournament.imageUrl ? (
                                            <Image
                                                src={tournament.imageUrl}
                                                alt={tournament.name}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-[var(--qc-bg-medium)] flex items-center justify-center">
                                                <span className="text-white/20 font-bold text-lg font-tiktok">
                                                    {tournament.name.substring(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-foreground leading-snug truncate">
                                            {tournament.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[11px] text-[var(--qc-text-secondary)]">
                                                {getGameTypeLabel(tournament.gameType)}
                                            </span>
                                            <span className="text-[11px] text-foreground/20">·</span>
                                            <span className="text-[11px] text-foreground/30">
                                                {getFormatLabel(tournament)}
                                            </span>
                                            <span className="text-[11px] text-foreground/20">·</span>
                                            <span className="text-[11px] text-[var(--qc-text-muted)]">
                                                {tournament._count?.registrations || 0}/{tournament.maxParticipants || '?'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <span className={`hidden sm:inline-block flex-shrink-0 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-full ${
                                        tournament.status === 'IN_PROGRESS'
                                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                                            : tournament.status === 'REGISTRATION_OPEN'
                                                ? 'bg-foreground/[0.04] text-foreground border border-foreground/[0.06]'
                                                : 'bg-foreground/[0.03] text-foreground/30 border border-foreground/[0.04]'
                                    }`}>
                                        {getStatusLabel(tournament.status)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Featured Videos Section */}
                <div className="border-t border-foreground/[0.06] p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-tiktok">
                            Revive algunos encuentros de nuestros torneos
                        </h3>
                        <div className="h-px flex-1 bg-foreground/20" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {FEATURED_VIDEOS.map((video, index) => (
                            <div
                                key={index}
                                className="group bg-card border border-foreground/[0.06] rounded-xl overflow-hidden hover:border-foreground/[0.12] transition-all"
                            >
                                <div className="aspect-video relative">
                                    <YouTubeFacade
                                        videoId={video.id}
                                        title={video.title}
                                    />
                                </div>
                                <div className="p-3 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wide group-hover:text-foreground transition-colors truncate">
                                            {video.title}
                                        </h4>
                                        <p className="text-[10px] text-foreground/40 mt-0.5">
                                            {video.description}
                                        </p>
                                    </div>
                                    <span className="px-1.5 py-0.5 text-[8px] font-bold bg-foreground/20 text-foreground flex-shrink-0">
                                        {video.mode}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 text-center">
                        <a
                            href="https://www.youtube.com/@QuakeClubCL"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-[10px] text-foreground/30 hover:text-foreground transition-colors uppercase tracking-wider"
                        >
                            Ver mas en YouTube
                        </a>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-foreground/[0.06] bg-card">
                {/* Top Clanes */}
                <div className="p-4 border-b border-foreground/[0.06]">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-3 font-tiktok">
                        Top Clanes
                    </h3>
                    {topClans.length > 0 ? (
                        <div className="space-y-2">
                            {topClans.map((clan, index) => (
                                <Link
                                    key={clan.slug || `${clan.tag}-${index}`}
                                    href={clan.slug ? `/clanes/${clan.slug}` : "/clanes/rankings?gameType=ca"}
                                    className="flex items-center gap-3 p-2 hover:bg-foreground/[0.04] transition-colors rounded-lg group"
                                >
                                    <span className={`text-sm font-bold w-5 ${index === 0 ? 'text-foreground' :
                                        index === 1 ? 'text-foreground/50' :
                                            index === 2 ? 'text-foreground/30' :
                                                'text-foreground/20'
                                        }`}>
                                        {index + 1}
                                    </span>
                                    <FlagClan
                                        clanTag={clan.tag}
                                        clanName={clan.name}
                                        clanAvatar={clan.avatarUrl}
                                        size="md"
                                        showTooltip={false}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-foreground group-hover:text-foreground transition-colors truncate text-shadow-sm">
                                            {clan.name}
                                        </div>
                                        {clan.avgElo && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="icon-shadow"><TierBadgeInline elo={Math.round(clan.avgElo)} gameType="ca" size="xs" /></span>
                                                <span className="text-xs text-foreground font-medium text-shadow-sm">{Math.round(clan.avgElo)}</span>
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-xs text-foreground/30">Sin datos de ranking</p>
                        </div>
                    )}
                    <Link
                        href="/clanes/rankings?gameType=ca"
                        className="block mt-3 text-[10px] text-foreground hover:underline uppercase tracking-wider"
                    >
                        Ver ranking completo
                    </Link>
                </div>

                {/* Stats */}
                <div className="p-4 border-b border-foreground/[0.06]">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-3 font-tiktok">
                        Estadisticas
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-foreground/40 uppercase">Torneos activos</span>
                            <span className="text-sm font-bold text-foreground">{activeTournaments.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-foreground/40 uppercase">Proximos</span>
                            <span className="text-sm font-bold text-foreground">{upcomingTournaments.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-foreground/40 uppercase">Finalizados</span>
                            <span className="text-sm font-bold text-foreground">{completedTournaments.length}</span>
                        </div>
                    </div>
                </div>

                {/* Redes */}
                <div className="p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-3 font-tiktok">
                        Redes
                    </h3>
                    <div className="space-y-2">
                        <a
                            href="https://quakeclub.com/discord"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2 hover:bg-foreground/[0.04] transition-colors rounded-lg text-foreground/60 hover:text-foreground"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
                            </svg>
                            <span className="text-xs">Discord</span>
                        </a>
                        <a
                            href="https://www.youtube.com/@QuakeClubCL"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2 hover:bg-foreground/[0.04] transition-colors rounded-lg text-foreground/60 hover:text-foreground"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                            </svg>
                            <span className="text-xs">YouTube</span>
                        </a>
                        <a
                            href="https://twitch.tv/quakeclub"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2 hover:bg-foreground/[0.04] transition-colors rounded-lg text-foreground/60 hover:text-foreground"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                            </svg>
                            <span className="text-xs">Twitch</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
