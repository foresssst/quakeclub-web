"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { use } from "react"
import { GroupsTab } from "@/components/esport/tournament-groups/groups-tab"
import { StandingsTab } from "@/components/esport/standings/standings-tab"
import { CalendarTab } from "@/components/esport/calendar/calendar-tab"
import { BracketTab } from "@/components/esport/playoff-bracket/bracket-tab"
import { EliminationBracket } from "@/components/esport/elimination-bracket/elimination-bracket"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { FlagClan } from "@/components/flag-clan"
import { LoadingScreen } from "@/components/loading-screen"

function TournamentMarkdown({ content }: { content: string }) {
    return (
        <div className="max-w-none font-opensans tracking-normal">
            <ReactMarkdown
                remarkPlugins={[remarkBreaks, remarkGfm]}
                disallowedElements={["script", "iframe", "object", "embed"]}
                unwrapDisallowed={true}
                skipHtml={false}
                components={{
                    h1: ({ children }) => (
                        <h1 className="mb-6 mt-10 font-tiktok text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="mb-4 mt-8 font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="mb-3 mt-6 text-lg font-bold uppercase tracking-wide text-foreground">
                            {children}
                        </h3>
                    ),
                    p: ({ children, node }) => {
                        const hasLevelshots = node?.children?.some(
                            (child: any) => child.tagName === 'img' && child.properties?.src?.includes('/levelshots/')
                        )
                        if (hasLevelshots) {
                            // Group children into sections: text label -> images below it
                            const childArray = Array.isArray(children) ? children : [children]
                            const sections: { label: string | null; images: React.ReactNode[] }[] = []
                            let current: { label: string | null; images: React.ReactNode[] } = { label: null, images: [] }

                            childArray.forEach((child: any) => {
                                if (typeof child === 'string' && child.trim()) {
                                    // New text label = new section
                                    if (current.label !== null || current.images.length > 0) {
                                        sections.push(current)
                                    }
                                    current = { label: child.trim(), images: [] }
                                } else if (child?.type === 'br') {
                                    // skip
                                } else if (child) {
                                    current.images.push(child)
                                }
                            })
                            if (current.label !== null || current.images.length > 0) {
                                sections.push(current)
                            }

                            return (
                                <span className="block my-4">
                                    {sections.map((section, i) => (
                                        <span key={i} className="block mb-6 last:mb-0">
                                            {section.label && (
                                                <span className="block text-[13px] font-bold uppercase tracking-[0.18em] text-foreground/50 mb-3 mt-2">
                                                    {section.label}
                                                </span>
                                            )}
                                            {section.images.length > 0 && (
                                                <span className="block flex flex-wrap mx-[-2px] sm:mx-[-3px]">
                                                    {section.images}
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                </span>
                            )
                        }
                        return <p className="mb-6 text-[15px] sm:text-base leading-relaxed text-foreground/70">{children}</p>
                    },
                    br: () => <br className="my-2" />,
                    strong: ({ children }) => (
                        <strong className="font-bold text-foreground">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-foreground/60">{children}</em>
                    ),
                    ul: ({ children }) => (
                        <ul className="mb-6 ml-6 list-disc space-y-3 text-foreground/70">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="mb-6 ml-6 list-decimal space-y-3 text-foreground/70">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-[15px] sm:text-base leading-relaxed pl-1.5">{children}</li>
                    ),
                    a: ({ children, href }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-2 transition-colors hover:decoration-foreground/55"
                        >
                            {children}
                        </a>
                    ),
                    hr: () => (
                        <hr className="my-10 border-foreground/[0.08]" />
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="my-5 border-l-4 border-foreground/12 bg-foreground/[0.04] py-2 pl-5 text-foreground/60 italic">
                            {children}
                        </blockquote>
                    ),
                    img: ({ src, alt }) => {
                        const srcString = typeof src === 'string' ? src : undefined

                        if (srcString && srcString.includes('/levelshots/')) {
                            const mapName = alt || srcString.split('/').pop()?.replace('.jpg', '') || 'Map'
                            return (
                                <span className="inline-block w-[calc(50%-4px)] sm:w-[calc(33.333%-6px)] align-top m-[2px] sm:m-[3px]">
                                    <span className="block relative aspect-[16/10] rounded-lg overflow-hidden group">
                                        <img
                                            src={srcString}
                                            alt={mapName}
                                            className="absolute inset-0 w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.src = "/levelshots/default.jpg"
                                            }}
                                        />
                                        <span className="absolute inset-0 bg-black/38" />
                                        <span className="absolute bottom-0 left-0 right-0 px-2.5 py-2">
                                            <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white drop-shadow-lg">
                                                {mapName}
                                            </span>
                                        </span>
                                    </span>
                                </span>
                            )
                        }

                        return (
                            <span className="my-6 block">
                                <img
                                    src={srcString || "/branding/logo.png"}
                                    alt={alt || "Imagen del torneo"}
                                    className="mx-auto max-w-full rounded-lg"
                                    style={{ maxHeight: "600px", objectFit: "contain" }}
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                />
                            </span>
                        )
                    },
                    code: ({ children }) => (
                        <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-sm text-foreground">
                            {children}
                        </code>
                    ),
                    pre: ({ children }) => (
                        <pre className="my-5 overflow-x-auto rounded-lg bg-foreground/[0.04] p-5 font-mono text-sm text-foreground/70">
                            {children}
                        </pre>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

function TabButton({ label, tab, activeTab, onClick }: { label: string; tab: string; activeTab: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`relative px-5 py-3.5 text-[13px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab
                    ? "text-foreground"
                    : "text-[var(--qc-text-muted)] hover:text-foreground"
            }`}
        >
            {label}
            {activeTab === tab && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-foreground rounded-full" />
            )}
        </button>
    )
}

function InfoContentCard({
    title,
    eyebrow,
    children,
    className = "",
}: {
    title: string
    eyebrow?: string
    children: any
    className?: string
}) {
    return (
        <section className={`rounded-[28px] border border-foreground/[0.06] bg-card p-6 sm:p-7 shadow-[0_16px_36px_rgba(18,18,22,0.08)] ${className}`}>
            <div className="mb-5">
                {eyebrow && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">
                        {eyebrow}
                    </p>
                )}
                <h3 className="mt-2 text-[18px] font-bold uppercase tracking-[0.08em] text-foreground">
                    {title}
                </h3>
            </div>
            {children}
        </section>
    )
}

export default function TournamentPageContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [activeTab, setActiveTab] = useState<"info" | "bracket" | "grupos" | "tabla" | "calendario" | "playoffs">("info")

    const validTabs = ["info", "bracket", "grupos", "tabla", "calendario", "playoffs"] as const
    type TabType = typeof validTabs[number]

    useEffect(() => {
        const hash = window.location.hash.replace('#', '') as TabType
        if (validTabs.includes(hash)) {
            setActiveTab(hash)
        }
    }, [])

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        window.history.replaceState(null, '', `#${tab}`)
    }

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '') as TabType
            if (validTabs.includes(hash)) {
                setActiveTab(hash)
            }
        }
        window.addEventListener('hashchange', handleHashChange)
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [])

    const { data: authData } = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
            const res = await fetch('/api/auth/me')
            if (!res.ok) return { user: null }
            return res.json()
        }
    })

    const { data: clanData } = useQuery({
        queryKey: ['myClan', authData?.user?.steamId],
        queryFn: async () => {
            if (!authData?.user?.steamId) return null
            const res = await fetch(`/api/clans/my-membership?steamId=${authData.user.steamId}`)
            if (!res.ok) return null
            return res.json()
        },
        enabled: !!authData?.user?.steamId
    })

    const queryClient = useQueryClient()

    // Get pending invitations for this tournament
    const { data: invitationsData } = useQuery({
        queryKey: ['tournament-invitations', id, authData?.user?.steamId],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${id}/invitations`)
            if (!res.ok) return { invitations: [] }
            return res.json()
        },
        enabled: !!authData?.user?.steamId
    })

    const { data: tournament, isLoading, error } = useQuery({
        queryKey: ['tournament', id],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${id}`)
            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Error al cargar torneo')
            }
            const data = await res.json()
            return data.tournament || data
        },
        refetchOnMount: 'always',
        staleTime: 0,
        refetchOnWindowFocus: true
    })

    if (isLoading) {
        return <LoadingScreen />
    }

    if (error || !tournament) {
        return (
            <div className="relative min-h-screen">
                <div className="pt-8 sm:pt-12 text-center px-3 sm:px-4">
                    <div className="bg-card border border-foreground/[0.06] rounded-2xl p-8 max-w-md mx-auto">
                        <div className="text-red-600 mb-2 font-bold">Torneo no encontrado</div>
                        {error && <div className="text-foreground/40 text-sm">{(error as Error).message}</div>}
                        <Link href="/esport" className="inline-block mt-4 text-[var(--qc-text-secondary)] hover:text-foreground text-sm font-medium transition-colors">
                            &larr; Volver a torneos
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const userClan = clanData?.clan
    const userRegistration = userClan && tournament?.registrations?.find(
        (r: any) => r.clan?.id === userClan.id || r.clanId === userClan.id
    )
    // Check if user has a tournament team registered
    const userTeamRegistration = authData?.user?.steamId && tournament?.registrations?.find(
        (r: any) => r.tournamentTeam && r.participantType === 'TEAM'
    )
    const isAlreadyRegistered = !!userRegistration || !!userTeamRegistration
    const isPendingApproval = userRegistration?.status === 'PENDING' || userTeamRegistration?.status === 'PENDING'
    const isApproved = userRegistration?.status === 'APPROVED' || userTeamRegistration?.status === 'APPROVED'
    const isFounder = clanData?.role === 'FOUNDER'

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'REGISTRATION_OPEN': 'Inscripciones Abiertas',
            'IN_PROGRESS': 'En Curso',
            'COMPLETED': 'Finalizado',
            'UPCOMING': 'Proximamente'
        }
        return labels[status] || status
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'REGISTRATION_OPEN': return 'bg-foreground/[0.08] text-foreground border border-foreground/[0.10] backdrop-blur-sm'
            case 'IN_PROGRESS': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-sm'
            case 'COMPLETED': return 'bg-foreground/[0.05] text-foreground/55 border border-foreground/[0.08] backdrop-blur-sm'
            default: return 'bg-foreground/[0.05] text-foreground/55 border border-foreground/[0.08] backdrop-blur-sm'
        }
    }

    const getGameTypeLabel = (gameType: string | undefined) => {
        if (!gameType) return 'N/A'
        const labels: Record<string, string> = {
            'ca': 'Clan Arena',
            'ctf': 'Capture the Flag',
            'tdm': 'Team Deathmatch',
            'duel': 'Duel',
            'ffa': 'Free For All'
        }
        return labels[gameType.toLowerCase()] || gameType.toUpperCase()
    }

    const isCustomTournament = tournament.tournamentType === 'CUSTOM_GROUP'
    const isEliminationTournament = tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION'
    const showRegistrationCTA = tournament.status === 'REGISTRATION_OPEN'
    const canRegister = showRegistrationCTA && !isAlreadyRegistered && isFounder
    const approvedTeams = (tournament.registrations?.filter((r: any) => r.status === 'APPROVED') || []).sort((a: any, b: any) => {
        const aName = (a.tournamentTeam?.tag || a.clan?.tag || a.player?.username || '').toLowerCase()
        const bName = (b.tournamentTeam?.tag || b.clan?.tag || b.player?.username || '').toLowerCase()
        return aName.localeCompare(bName)
    })

    const formatLabel = tournament.format === 'DOUBLE_ELIMINATION'
        ? 'Double Elimination'
        : tournament.format === 'SINGLE_ELIMINATION'
            ? 'Single Elimination'
            : tournament.format === 'ROUND_ROBIN'
                ? 'Round Robin'
                : tournament.format

    const startsAtLabel = tournament.startsAt
        ? format(new Date(tournament.startsAt), 'dd MMM yyyy', { locale: es })
        : 'Por definir'

    const registrationWindowLabel = tournament.registrationOpens || tournament.registrationCloses
        ? [
            tournament.registrationOpens
                ? format(new Date(tournament.registrationOpens), 'dd MMM', { locale: es })
                : 'Ahora',
            tournament.registrationCloses
                ? format(new Date(tournament.registrationCloses), 'dd MMM', { locale: es })
                : 'Sin cierre'
        ].join(' - ')
        : 'Sin ventana publicada'

    const rosterLabel = tournament.teamBased
        ? tournament.minRosterSize && tournament.maxRosterSize
            ? `${tournament.minRosterSize}-${tournament.maxRosterSize} jugadores`
            : tournament.maxRosterSize
                ? `Hasta ${tournament.maxRosterSize} jugadores`
                : 'Plantel flexible'
        : 'Competencia individual'

    const seriesLabel = tournament.mapsPerMatch
        ? `${tournament.mapsPerMatch} ${tournament.mapsPerMatch === 1 ? 'mapa' : 'mapas'} por serie`
        : 'Serie oficial por definir'

    const hasStructuredInfo = Boolean(
        tournament.tournamentRules ||
        tournament.rules ||
        tournament.prizes ||
        tournament.scheduleNotes
    )

    return (
        <div className="relative min-h-screen">
            <div className="pt-8 sm:pt-12 max-w-[1100px] mx-auto px-3 sm:px-4 pb-12 space-y-4">
                {/* Top Ad */}

                {/* Main Container */}
                <div className="overflow-hidden rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.08)]">

                    {/* ═══ HERO BANNER ═══ */}
                    <div className="relative w-full h-[280px] sm:h-[360px] lg:h-[420px] overflow-hidden bg-foreground">
                        {tournament.imageUrl ? (
                            <Image
                                src={tournament.imageUrl}
                                alt={tournament.name}
                                fill
                                className="object-cover"
                                priority
                                unoptimized
                            />
                        ) : (
                            <div className="absolute inset-0 bg-[var(--qc-bg-medium)]" />
                        )}

                        <div className="absolute inset-0 bg-black/48" />

                        {/* Status badge */}
                        <span className={`absolute top-4 right-4 sm:top-6 sm:right-6 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${getStatusStyle(tournament.status)}`}>
                            {getStatusLabel(tournament.status)}
                        </span>

                        {/* Title area */}
                        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 lg:p-10">
                            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/40 mb-3">
                                {getGameTypeLabel(tournament.gameType)}
                            </span>
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-[1.1] max-w-3xl tracking-tight [text-shadow:0_3px_22px_rgba(0,0,0,0.5)]">
                                {tournament.name}
                            </h1>
                        </div>
                    </div>

                    {/* ═══ TABS ═══ */}
                    <div className="flex overflow-x-auto bg-[var(--qc-bg-pure)] border-b border-foreground/[0.06]">
                        <TabButton label="Info" tab="info" activeTab={activeTab} onClick={() => handleTabChange("info")} />
                        {isEliminationTournament && !isCustomTournament && (
                            <TabButton label="Bracket" tab="bracket" activeTab={activeTab} onClick={() => handleTabChange("bracket")} />
                        )}
                        {isCustomTournament && (
                            <>
                                <TabButton label="Grupos" tab="grupos" activeTab={activeTab} onClick={() => handleTabChange("grupos")} />
                                <TabButton label="Tabla" tab="tabla" activeTab={activeTab} onClick={() => handleTabChange("tabla")} />
                                <TabButton label="Calendario" tab="calendario" activeTab={activeTab} onClick={() => handleTabChange("calendario")} />
                                <TabButton label="Playoffs" tab="playoffs" activeTab={activeTab} onClick={() => handleTabChange("playoffs")} />
                            </>
                        )}
                    </div>

                    {/* ═══ CONTENT ═══ */}
                    <div className="bg-card normal-case">
                        {activeTab === "info" && (
                            <div className="p-5 sm:p-8 md:p-10 space-y-8">
                                <section className="grid gap-8 border-b border-foreground/[0.06] pb-8 xl:grid-cols-[minmax(0,1.15fr)_320px]">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">
                                            Vista general
                                        </p>
                                        <h2 className="mt-3 text-[26px] font-bold uppercase tracking-[0.06em] text-foreground">
                                            Descripcion
                                        </h2>
                                        <p className="mt-5 text-[16px] leading-[1.9] text-[var(--qc-text-secondary)] font-opensans">
                                            {tournament.description || 'Aun no se ha publicado una descripcion extendida para este torneo, pero ya puedes revisar su formato, estado y detalles clave en esta ficha.'}
                                        </p>
                                        <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-foreground/[0.06] pt-5">
                                            <div className="min-w-[150px]">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">Formato</p>
                                                <p className="mt-2 text-[16px] font-bold uppercase tracking-[0.04em] text-foreground">{formatLabel}</p>
                                            </div>
                                            <div className="min-w-[150px]">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">Inscripciones</p>
                                                <p className="mt-2 text-[16px] font-bold uppercase tracking-[0.04em] text-foreground">{registrationWindowLabel}</p>
                                            </div>
                                            <div className="min-w-[150px]">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">Series</p>
                                                <p className="mt-2 text-[16px] font-bold uppercase tracking-[0.04em] text-foreground">{seriesLabel}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <aside className="xl:border-l xl:border-foreground/[0.06] xl:pl-8">
                                        <div className="space-y-4 xl:pt-9">
                                            <div className="border-b border-foreground/[0.06] pb-4">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">Inicio</p>
                                                <p className="mt-2 text-[18px] font-bold uppercase tracking-[0.04em] text-foreground">{startsAtLabel}</p>
                                                <p className="mt-1 text-[13px] leading-relaxed text-[var(--qc-text-secondary)]">Fecha oficial de arranque.</p>
                                            </div>
                                            <div className="border-b border-foreground/[0.06] pb-4">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">Plantel</p>
                                                <p className="mt-2 text-[18px] font-bold uppercase tracking-[0.04em] text-foreground">{rosterLabel}</p>
                                                <p className="mt-1 text-[13px] leading-relaxed text-[var(--qc-text-secondary)]">{tournament.teamBased ? 'Configuracion minima y maxima del roster competitivo.' : 'Modo de participacion individual.'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">Resumen</p>
                                                <p className="mt-2 text-[18px] font-bold uppercase tracking-[0.04em] text-foreground">
                                                    {approvedTeams.length} equipos · {tournament.matches?.length || 0} partidos
                                                </p>
                                                <p className="mt-1 text-[13px] leading-relaxed text-[var(--qc-text-secondary)]">
                                                    {getStatusLabel(tournament.status)} · {getGameTypeLabel(tournament.gameType)}
                                                </p>
                                            </div>
                                        </div>
                                    </aside>
                                </section>

                                {hasStructuredInfo && (
                                    <section className="space-y-0">
                                        {tournament.tournamentRules && (
                                            <div className="mb-0">
                                                <div className="border-b border-foreground/[0.06] pb-5 mb-8">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">
                                                        Estructura y funcionamiento
                                                    </p>
                                                    <h2 className="mt-3 text-[26px] font-bold uppercase tracking-[0.06em] text-foreground">
                                                        Bases del Torneo
                                                    </h2>
                                                </div>
                                                <div className="prose prose-lg max-w-none normal-case">
                                                    <TournamentMarkdown content={tournament.tournamentRules} />
                                                </div>
                                            </div>
                                        )}

                                        {tournament.rules && (
                                            <div className={tournament.tournamentRules ? "mt-12 pt-10 border-t-2 border-foreground/[0.08]" : ""}>
                                                <div className="border-b border-foreground/[0.06] pb-5 mb-8">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">
                                                        Normas oficiales
                                                    </p>
                                                    <h2 className="mt-3 text-[26px] font-bold uppercase tracking-[0.06em] text-foreground">
                                                        Reglas
                                                    </h2>
                                                </div>
                                                <div className="prose prose-lg max-w-none normal-case">
                                                    <TournamentMarkdown content={tournament.rules} />
                                                </div>
                                            </div>
                                        )}

                                        {tournament.prizes && (
                                            <div className={(tournament.tournamentRules || tournament.rules) ? "mt-12 pt-10 border-t-2 border-foreground/[0.08]" : ""}>
                                                <div className="border-b border-foreground/[0.06] pb-5 mb-8">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">
                                                        Que esta en juego
                                                    </p>
                                                    <h2 className="mt-3 text-[26px] font-bold uppercase tracking-[0.06em] text-foreground">
                                                        Premios
                                                    </h2>
                                                </div>
                                                <div className="prose prose-lg max-w-none normal-case">
                                                    <TournamentMarkdown content={tournament.prizes} />
                                                </div>
                                            </div>
                                        )}

                                        {tournament.scheduleNotes && (
                                            <div className="mt-12 pt-10 border-t-2 border-foreground/[0.08]">
                                                <div className="border-b border-foreground/[0.06] pb-5 mb-8">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">
                                                        Programacion
                                                    </p>
                                                    <h2 className="mt-3 text-[26px] font-bold uppercase tracking-[0.06em] text-foreground">
                                                        Notas de Calendario
                                                    </h2>
                                                </div>
                                                <div className="prose prose-lg max-w-none normal-case">
                                                    <TournamentMarkdown content={tournament.scheduleNotes} />
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* Pending Invitations */}
                                {invitationsData?.invitations?.length > 0 && (
                                    <section className="rounded-xl border border-foreground/20 bg-foreground/5 overflow-hidden">
                                        <div className="px-5 py-3 border-b border-foreground/10 bg-foreground/10">
                                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground font-tiktok">
                                                Invitaciones pendientes
                                            </h3>
                                        </div>
                                        <div className="divide-y divide-foreground/[0.06]">
                                            {invitationsData.invitations.map((inv: any) => (
                                                <div key={inv.id} className="px-5 py-4 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-sm font-bold text-foreground">
                                                            [{inv.team?.tag}] {inv.team?.name}
                                                        </span>
                                                        <p className="text-xs text-foreground/40 mt-0.5">
                                                            Capitan: {inv.team?.captain?.username || 'Desconocido'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                const res = await fetch(`/api/esport/tournaments/${id}/invitations/${inv.id}/respond`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ action: 'accept' })
                                                                })
                                                                if (res.ok) {
                                                                    queryClient.invalidateQueries({ queryKey: ['tournament-invitations', id] })
                                                                } else {
                                                                    const err = await res.json()
                                                                    alert(err.error || 'Error')
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 bg-foreground/10 border border-foreground/30 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/20 transition-colors"
                                                        >
                                                            Aceptar
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const res = await fetch(`/api/esport/tournaments/${id}/invitations/${inv.id}/respond`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ action: 'reject' })
                                                                })
                                                                if (res.ok) {
                                                                    queryClient.invalidateQueries({ queryKey: ['tournament-invitations', id] })
                                                                } else {
                                                                    const err = await res.json()
                                                                    alert(err.error || 'Error')
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 uppercase tracking-wider hover:bg-red-500/20 transition-colors"
                                                        >
                                                            Rechazar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Registration CTA */}
                                {showRegistrationCTA && (
                                    <section className="rounded-[28px] border border-foreground/[0.06] bg-card px-6 py-6 shadow-[0_16px_36px_rgba(18,18,22,0.08)]">
                                        {isApproved ? (
                                            <>
                                                <h3 className="text-sm font-bold text-emerald-400 mb-1 uppercase tracking-[0.08em]">
                                                    Tu clan esta inscrito
                                                </h3>
                                                <p className="text-[14px] text-[var(--qc-text-secondary)] font-opensans tracking-normal">
                                                    Tu clan <span className="text-foreground font-bold">[{userClan?.tag}]</span> esta confirmado para este torneo
                                                </p>
                                            </>
                                        ) : isPendingApproval ? (
                                            <>
                                                <h3 className="text-sm font-bold text-amber-400 mb-1 uppercase tracking-[0.08em]">
                                                    Inscripcion pendiente
                                                </h3>
                                                <p className="text-[14px] text-[var(--qc-text-secondary)] font-opensans tracking-normal">
                                                    Tu clan <span className="text-foreground font-bold">[{userClan?.tag}]</span> esta pendiente de aprobacion
                                                </p>
                                            </>
                                        ) : canRegister ? (
                                            <>
                                                <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-[0.08em]">
                                                    Inscripciones abiertas
                                                </h3>
                                                <p className="text-[14px] text-[var(--qc-text-secondary)] mb-5 font-opensans tracking-normal">
                                                    Inscribe a tu clan o crea un equipo para participar en este torneo
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    <Link
                                                        href={`/esport/${id}/inscribir`}
                                                        className="inline-block px-6 py-3 bg-foreground text-background text-sm font-bold rounded-lg hover:opacity-92 transition-opacity"
                                                    >
                                                        Inscribir mi clan
                                                    </Link>
                                                    <Link
                                                        href={`/esport/${id}/equipo`}
                                                        className="inline-block px-6 py-3 bg-foreground/[0.06] text-foreground text-sm font-bold rounded-lg hover:bg-foreground/[0.10] transition-colors border border-foreground/[0.10]"
                                                    >
                                                        Crear equipo de torneo
                                                    </Link>
                                                </div>
                                            </>
                                        ) : !authData?.user ? (
                                            <>
                                                <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-[0.08em]">
                                                    Inscripciones abiertas
                                                </h3>
                                                <p className="text-[14px] text-[var(--qc-text-secondary)] mb-5 font-opensans tracking-normal">
                                                    Inicia sesion para inscribir tu clan o crear un equipo
                                                </p>
                                                <Link
                                                    href={`/login?returnTo=/esport/${id}`}
                                                    className="inline-block px-6 py-3 bg-foreground text-background text-sm font-bold rounded-lg hover:opacity-92 transition-opacity"
                                                >
                                                    Iniciar sesion
                                                </Link>
                                            </>
                                        ) : !userClan ? (
                                            <>
                                                <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-[0.08em]">
                                                    Inscripciones abiertas
                                                </h3>
                                                <p className="text-[14px] text-[var(--qc-text-secondary)] mb-5 font-opensans tracking-normal">
                                                    Crea un equipo de torneo o un clan para participar
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    <Link
                                                        href={`/esport/${id}/equipo`}
                                                        className="inline-block px-6 py-3 bg-foreground text-background text-sm font-bold rounded-lg hover:opacity-92 transition-opacity"
                                                    >
                                                        Crear equipo de torneo
                                                    </Link>
                                                    <Link
                                                        href="/clanes/create"
                                                        className="inline-block px-6 py-3 bg-foreground/[0.06] text-foreground text-sm font-bold rounded-lg hover:bg-foreground/[0.10] transition-colors border border-foreground/[0.10]"
                                                    >
                                                        Crear un clan
                                                    </Link>
                                                </div>
                                            </>
                                        ) : !isFounder ? (
                                            <>
                                                <h3 className="text-sm font-bold text-foreground mb-1 uppercase tracking-[0.08em]">
                                                    Inscripciones abiertas
                                                </h3>
                                                <p className="text-[14px] text-[var(--qc-text-secondary)] mb-5 font-opensans tracking-normal">
                                                    Solo el fundador del clan puede inscribirlo, pero puedes crear un equipo de torneo
                                                </p>
                                                <Link
                                                    href={`/esport/${id}/equipo`}
                                                    className="inline-block px-6 py-3 bg-foreground text-background text-sm font-bold rounded-lg hover:opacity-92 transition-opacity"
                                                >
                                                    Crear equipo de torneo
                                                </Link>
                                            </>
                                        ) : null}
                                    </section>
                                )}

                                {/* Registered Teams */}
                                {approvedTeams.length > 0 && (
                                    <section className="rounded-[32px] border border-foreground/[0.06] bg-card p-6 sm:p-7 shadow-[0_16px_36px_rgba(18,18,22,0.08)]">
                                        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--qc-text-muted)] font-tiktok">
                                                    Participacion confirmada
                                                </p>
                                                <h3 className="mt-2 text-[20px] font-bold uppercase tracking-[0.08em] text-foreground">
                                                    Equipos inscritos
                                                </h3>
                                            </div>
                                            <span className="rounded-full border border-foreground/[0.08] bg-foreground/[0.05] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground tabular-nums">
                                                {approvedTeams.length}{tournament.maxParticipants ? ` / ${tournament.maxParticipants}` : ''}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {approvedTeams.map((reg: any) => {
                                                const teamInfo = reg.tournamentTeam || reg.clan
                                                const teamLink = reg.clan?.slug ? `/clanes/${reg.clan.slug}` : null
                                                const avatarUrl = teamInfo?.avatarUrl
                                                const tag = teamInfo?.tag || '??'
                                                const name = teamInfo?.name || reg.player?.username || 'TBD'

                                                const cardContent = (
                                                    <>
                                                        <FlagClan
                                                            clanTag={tag}
                                                            clanName={name}
                                                            clanAvatar={avatarUrl || undefined}
                                                            size="lg"
                                                            showTooltip={false}
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="text-[13px] font-bold text-foreground truncate">
                                                                [{tag}] {name}
                                                            </div>
                                                            {reg.roster?.length > 0 && (
                                                                <div className="text-[11px] text-[var(--qc-text-secondary)] mt-0.5">
                                                                    {reg.roster.length} jugadores
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )

                                                return teamLink ? (
                                                    <Link
                                                        key={reg.id}
                                                        href={teamLink}
                                                        className="flex items-center gap-3 p-3 rounded-[20px] bg-foreground/[0.03] border border-foreground/[0.04] hover:border-foreground/[0.10] transition-all group"
                                                    >
                                                        {cardContent}
                                                    </Link>
                                                ) : (
                                                    <div
                                                        key={reg.id}
                                                        className="flex items-center gap-3 p-3 rounded-[20px] bg-foreground/[0.03] border border-foreground/[0.04] hover:border-foreground/[0.10] transition-all group"
                                                    >
                                                        {cardContent}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}

                        {activeTab === "bracket" && isEliminationTournament && !isCustomTournament && (
                            <EliminationBracket
                                tournamentId={id}
                                format={tournament.format as 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION'}
                            />
                        )}

                        {activeTab === "grupos" && isCustomTournament && (
                            <GroupsTab tournamentId={id} />
                        )}

                        {activeTab === "tabla" && isCustomTournament && (
                            <StandingsTab tournamentId={id} />
                        )}

                        {activeTab === "calendario" && isCustomTournament && (
                            <CalendarTab tournamentId={id} />
                        )}

                        {activeTab === "playoffs" && isCustomTournament && (
                            <BracketTab tournamentId={id} />
                        )}
                    </div>
                </div>

                {/* Bottom Ad */}

                {/* Back Link */}
                <div className="mt-4 text-center">
                    <Link
                        href="/esport"
                        className="text-[13px] text-[var(--qc-text-muted)] hover:text-foreground transition-colors"
                    >
                        &larr; Volver a torneos
                    </Link>
                </div>
            </div>
        </div>
    )
}
