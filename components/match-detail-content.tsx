"use client"

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Sword, Target, Zap, ChevronUp, ChevronDown, ArrowLeftRight, ChevronRight} from 'lucide-react'
import { PlayerAvatar } from "@/components/player-avatar"
import { FlagCountry } from "@/components/flag-country"
import { IdentityBadges } from "@/components/identity-badges"
import { parseQuakeColors } from "@/lib/quake-colors"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { useQuery } from "@tanstack/react-query"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"
import { LoadingScreen } from "@/components/loading-screen"
import { useTranslations } from "next-intl"

// Nombres de armas para display
const WEAPON_NAMES: Record<string, string> = {
  RL: 'Rocket Launcher',
  LG: 'Lightning Gun',
  RG: 'Railgun',
  SG: 'Shotgun',
  MG: 'Machine Gun',
  PG: 'Plasma Gun',
  GL: 'Grenade Launcher',
  GT: 'Gauntlet',
  HMG: 'Heavy Machine Gun',
}

// Iconos de armas
const WEAPON_ICONS: Record<string, string> = {
  RL: '/weapons/rocket.png',
  LG: '/weapons/lightning.png',
  RG: '/weapons/railgun.png',
  SG: '/weapons/shotgun.png',
  MG: '/weapons/machinegun.png',
  PG: '/weapons/plasma.png',
  GL: '/weapons/grenade.png',
  HMG: '/weapons/hmg.png',
}

interface WeaponStat {
  weapon: string
  kills: number
  hits: number
  shots: number
  damage: number
  accuracy: number
}

interface PlayerClan {
  id: string
  tag: string
  slug: string
  name: string
  avatarUrl?: string | null
}

interface PlayerMedals {
  accuracy: number
  assists: number
  captures: number
  combokill: number
  defends: number
  excellent: number
  firstfrag: number
  headshot: number
  humiliation: number
  impressive: number
  midair: number
  perfect: number
  perforated: number
  quadgod: number
  rampage: number
  revenge: number
}

interface PlayerInMatch {
  id: string
  steamId: string
  playerName: string
  kills: number
  deaths: number
  score: number
  team?: number
  damageDealt: number
  damageTaken: number
  aliveTime?: number
  rounds?: number
  roundsWon?: number
  flagsCaptured?: number
  flagsReturned?: number
  flagPicks?: number
  flagDrops?: number
  carrierTakedowns?: number
  performance?: number
  kdRatio: string
  eloChange: number
  eloBefore?: number
  eloAfter?: number
  countryCode?: string | null
  clan?: PlayerClan | null
  weapons: WeaponStat[]
  medals?: PlayerMedals
  statusMessage?: string | null
}

interface MatchDetail {
  match: {
    id: string
    map: string
    gameType: string
    playedAt: string
    duration?: number
    team1Score?: number
    team2Score?: number
    winner?: number | null // 0=empate, 1=team1, 2=team2, null=FFA/Duel
    // Estado del match
    gameStatus?: string
    isRated?: boolean
    isAborted?: boolean
  }
  players: {
    all: PlayerInMatch[]
    team1?: PlayerInMatch[]
    team2?: PlayerInMatch[]
    ffa?: PlayerInMatch[]
  }
  totalPlayers: number
}

export function MatchDetailContent({ matchId }: { matchId: string }) {
  const t = useTranslations("matches")
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState<"basic" | "weapons" | "medals" | "ctf">("basic")
  const [weaponSortBy, setWeaponSortBy] = useState<'RL' | 'LG' | 'RG' | 'SG' | 'MG' | 'DMG' | null>(null)
  const [weaponSortDir, setWeaponSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set())

  const togglePlayerExpand = (playerId: string) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
  }

  const { data: matchData, isFetched: matchFetched } = useQuery({
    queryKey: ['match-detail', matchId],
    queryFn: async () => {
      const response = await fetch(`/api/matches/${matchId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch match data')
      }
      const data = await response.json()
      return data.success ? data : null
    },
    staleTime: 300000, // 5 minutes - match details don't change
    refetchOnMount: false, // No refetch on mount if data exists
    placeholderData: (previousData) => previousData,
  })

  // Mostrar loading hasta que los datos estén cargados
  if (!matchFetched) {
    return <LoadingScreen />
  }

  // Solo mostrar "no encontrado" si ya terminó de cargar y no hay datos
  if (!matchData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="font-tiktok text-2xl uppercase tracking-wider text-foreground">{t("notFound")}</p>
        <Link
          href="/"
          className="group inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60 bg-black/5 border border-[rgba(0,0,0,0.05)] rounded-lg hover:bg-foreground/10 hover:border-foreground/50 hover:text-foreground transition-all duration-200"
        >
          <ArrowLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
          {t("backToHome")}
        </Link>
      </div>
    )
  }

  const { match, players } = matchData

  // Función para formatear daño (4500 -> 4.5k)
  const formatDamage = (dmg: number) => {
    if (dmg >= 1000) {
      return `${(dmg / 1000).toFixed(1)}k`
    }
    return dmg.toString()
  }

  // Parsear statusMessage JSON para obtener ajustes de rating
  const parseStatusMessage = (statusMessage?: string | null): {
    adjustments: { type: string; reason: string }[];
    originalChange?: number;
    switchedTeam?: boolean;
  } | null => {
    if (!statusMessage) return null;
    // Backward compatibility: formato viejo era solo 'SWITCHED_TEAMS'
    if (statusMessage === 'SWITCHED_TEAMS') {
      return {
        adjustments: [{ type: 'Switched Teams', reason: 'Jugó más tiempo en el equipo contrario' }],
        switchedTeam: true,
      };
    }
    try {
      return JSON.parse(statusMessage);
    } catch {
      return null;
    }
  };

  // Renderizar ELO change con tooltip explicativo
  const renderEloChange = (player: PlayerInMatch, widthClass: string) => {
    const eloText = player.eloChange > 0 ? `+${player.eloChange}` : player.eloChange < 0 ? `${player.eloChange}` : '-';
    const colorClass = player.eloChange > 0 ? 'text-green-600' : player.eloChange < 0 ? 'text-red-500' : 'text-foreground/30';

    const status = parseStatusMessage(player.statusMessage);
    const hasAdjustments = status?.adjustments && status.adjustments.length > 0;

    // Traducir tipo de ajuste a etiqueta legible
    const getAdjLabel = (type: string): string => {
      const labels: Record<string, string> = {
        'Loss Forgiveness': 'Protección',
        'Upset Bonus': 'Bonus Upset',
        'Anti-Farming': 'Anti-Farming',
        'Margin of Victory': 'Marcador',
        'Experience Scaling': 'Experiencia',
        'Win Streak Bonus': 'Racha W',
        'Loss Streak Protection': 'Racha L',
        'Team Result': 'Equipo',
        'Quit Penalty': 'Abandono',
        'Winner Guarantee': 'Garantía',
        'Floor Protection': 'Piso ELO',
        'Majority Team': 'Cambio equipo',
        'Switched Teams': 'Cambio equipo',
      };
      return labels[type] || type;
    };

    // Color para cada tipo de ajuste
    const getAdjColor = (type: string, reason: string): string => {
      if (type === 'Quit Penalty') return 'text-red-400';
      if (type === 'Anti-Farming') return 'text-amber-400';
      if (type === 'Upset Bonus' || type === 'Win Streak Bonus') return 'text-green-400';
      if (type === 'Loss Forgiveness' || type === 'Loss Streak Protection' || type === 'Floor Protection') return 'text-blue-400';
      if (type === 'Winner Guarantee') return 'text-green-400';
      if (type === 'Team Result') {
        if (reason.includes('protegido') || reason.includes('ganó')) return 'text-green-400';
        if (reason.includes('perdió')) return 'text-red-400';
      }
      return 'text-foreground/50';
    };

    // Determinar razón cuando no hay cambio de ELO
    const getNoChangeReason = (): { title: string; detail: string } => {
      if (player.eloChange === null) return { title: 'Placement', detail: 'Aún no has completado las partidas de clasificación' };
      if (match.isAborted) return { title: 'Abortada', detail: 'La partida fue abortada, no cuenta para ELO' };
      if (!match.isRated) return { title: 'No rankeada', detail: 'Esta partida no es rankeada' };
      if (match.gameStatus === 'TOO_FEW_PLAYERS') return { title: 'Sin puntaje', detail: 'No había suficientes jugadores para que cuente' };
      if (match.gameStatus === 'TOO_SHORT') return { title: 'Muy corta', detail: 'La partida fue demasiado corta para contar' };
      // Check statusMessage for protected ELO
      if (hasAdjustments) {
        const teamResult = status!.adjustments.find(a => a.type === 'Team Result');
        if (teamResult?.reason?.includes('protegido')) {
          return { title: 'ELO protegido', detail: teamResult.reason };
        }
      }
      return { title: 'Sin cambio', detail: 'No hubo variación de ELO en esta partida' };
    };

    // Resumen principal del cambio
    const getSummary = (): string | null => {
      if (!hasAdjustments) {
        if (player.eloChange > 0) return 'Victoria directa';
        if (player.eloChange < 0) return 'Derrota directa';
        return null;
      }
      // Build summary from adjustments
      const types = status!.adjustments.map(a => a.type);
      if (types.includes('Quit Penalty')) return 'Penalización por abandono';
      if (types.includes('Winner Guarantee')) return 'Ganancia mínima garantizada';
      if (types.includes('Upset Bonus')) return 'Victoria contra rival superior';
      if (types.includes('Anti-Farming')) return 'Victoria contra rival inferior';
      if (types.includes('Loss Forgiveness')) return 'Derrota contra rival inferior';
      return null;
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${widthClass} text-center font-bold ${colorClass} cursor-help`}>
              {eloText}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[300px] p-3">
            {/* Rating transition */}
            {player.eloBefore != null && player.eloAfter != null && (
              <div className="flex items-center gap-1.5 mb-2 normal-case">
                <span className="text-[12px] font-bold text-foreground/80">{Math.round(player.eloBefore)}</span>
                <span className="text-[10px] text-foreground/30">→</span>
                <span className="text-[12px] font-bold text-foreground/80">{Math.round(player.eloAfter)}</span>
                {player.eloChange !== 0 && player.eloChange != null && (
                  <span className={`text-[11px] font-bold ml-1 ${colorClass}`}>
                    ({player.eloChange > 0 ? '+' : ''}{player.eloChange})
                  </span>
                )}
              </div>
            )}

            {(player.eloChange === 0 || player.eloChange === null || player.eloChange === undefined) ? (
              /* No change - show reason */
              (() => {
                const noChange = getNoChangeReason();
                return (
                  <div className="normal-case">
                    <p className="text-[11px] font-semibold text-foreground/70 mb-0.5">{noChange.title}</p>
                    <p className="text-[10px] text-foreground/45 leading-snug">{noChange.detail}</p>
                  </div>
                );
              })()
            ) : (
              /* Has change - show adjustments */
              <div className="normal-case">
                {/* Summary line */}
                {getSummary() && (
                  <p className="text-[11px] font-semibold text-foreground/70 mb-1.5">{getSummary()}</p>
                )}

                {/* Adjustment details */}
                {hasAdjustments ? (
                  <div className="space-y-1 border-t border-foreground/10 pt-1.5">
                    {status!.adjustments.map((adj, i) => (
                      <div key={i} className="flex gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider whitespace-nowrap mt-px ${getAdjColor(adj.type, adj.reason)}`}>
                          {getAdjLabel(adj.type)}
                        </span>
                        <span className="text-[10px] text-foreground/50 leading-snug">
                          {adj.reason}
                        </span>
                      </div>
                    ))}
                    {status!.originalChange != null && status!.originalChange !== player.eloChange && (
                      <p className="text-[9px] text-foreground/30 pt-0.5">
                        Cambio base: {status!.originalChange > 0 ? '+' : ''}{status!.originalChange} → final: {player.eloChange > 0 ? '+' : ''}{player.eloChange}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-foreground/45">
                    {player.eloChange > 0 ? 'ELO ganado por resultado de la partida' : 'ELO perdido por resultado de la partida'}
                  </p>
                )}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Función para calcular accuracy general del jugador
  const calculateOverallAccuracy = (weapons: WeaponStat[]) => {
    const totalShots = weapons.reduce((sum, w) => sum + w.shots, 0)
    const totalHits = weapons.reduce((sum, w) => sum + w.hits, 0)
    if (totalShots === 0) return 0
    return Math.round((totalHits / totalShots) * 100)
  }

  const renderPlayerRow = (player: PlayerInMatch, index: number, allPlayers?: PlayerInMatch[]) => {
    // Para duels, el ganador es quien tiene el mayor score, o si están empatados, quien ganó ELO
    let isWinner = false
    if (allPlayers && allPlayers.length === 2) {
      // Es un duel
      const [p1, p2] = allPlayers
      if (p1.score !== p2.score) {
        // Determinar por score
        isWinner = player.score > (p1.id === player.id ? p2.score : p1.score)
      } else {
        // Si están empatados en score, usar ELO change
        isWinner = player.eloChange > 0
      }
    }

    const totalDamage = player.weapons.reduce((sum, w) => sum + w.damage, 0) || player.damageDealt
    const overallAcc = calculateOverallAccuracy(player.weapons)

    return (
      <div
        key={player.id}
        className="flex items-center justify-between py-2.5 px-2 sm:px-4 transition-all duration-200 hover:bg-[rgba(0,0,0,0.04)] group"
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">

          {/* Avatar del jugador - clickeable al perfil */}
          <Link href={`/perfil/${player.steamId}`} className="flex-shrink-0">
            <PlayerAvatar steamId={player.steamId} playerName={player.playerName} size="sm" />
          </Link>

          <IdentityBadges
            countryCode={player.countryCode}
            countryName={player.countryCode}
            clanTag={player.clan?.tag}
            clanName={player.clan?.name}
            clanAvatar={player.clan?.avatarUrl}
            clanHref={player.clan?.slug ? `/clanes/${player.clan.slug}` : undefined}
            size="sm"
            showTooltips={false}
            clanClassName="hidden sm:inline-flex"
          />

          <Link href={`/perfil/${player.steamId}`} className="flex-1 min-w-[60px] truncate">
            <span className="text-xs font-semibold uppercase text-foreground inline-block">
              {parseQuakeColors(player.playerName)}
            </span>
          </Link>

          {/* Indicador de Cambio de Equipo */}
          {(() => {
            const status = parseStatusMessage(player.statusMessage);
            return status?.switchedTeam ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <ArrowLeftRight className="h-3.5 w-3.5 text-orange-400 flex-shrink-0 animate-pulse" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cambio de equipo detectado</p>
                    <p className="text-[10px] text-foreground/50">Jugó más tiempo en el equipo contrario</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null;
          })()}
        </div>

        {/* Stats - Mobile: score, K, D, ELO change */}
        <div className="flex sm:hidden items-center gap-1 text-[10px] flex-shrink-0">
          <span className="w-8 text-center text-foreground font-bold">{player.score}</span>
          <span className="w-6 text-center text-foreground/70 font-bold">{player.kills}</span>
          <span className="w-6 text-center text-foreground/40 font-bold">{player.deaths}</span>
          {renderEloChange(player, 'w-9')}
        </div>

        {/* Stats - Desktop: todas las columnas */}
        <div className="hidden sm:flex items-center gap-2 text-[10px] flex-shrink-0">
          <span className="w-10 text-center text-foreground font-bold">{player.score}</span>
          <span className="w-8 text-center text-foreground/60 font-bold">{player.performance ? player.performance.toFixed(1) : '-'}</span>
          <span className="w-6 text-center text-foreground/70 font-bold">{player.kills}</span>
          <span className="w-6 text-center text-foreground/40 font-bold">{player.deaths}</span>
          <span className="w-10 text-center text-[#333] font-bold">{formatDamage(totalDamage)}</span>
          <span className={`w-8 text-center font-bold ${overallAcc >= 35 ? 'text-foreground' : overallAcc >= 25 ? 'text-[#333]' : 'text-foreground/50'}`}>
            {overallAcc > 0 ? `${overallAcc}%` : '-'}
          </span>
          <span className="w-10 text-center text-foreground/70 font-medium">
            {(player.eloAfter || player.eloBefore) ? Math.round(player.eloAfter || player.eloBefore || 0) : <span className="text-foreground/30">-</span>}
          </span>
          {renderEloChange(player, 'w-12')}
        </div>
      </div>
    )
  }

  const renderTeam = (teamPlayers: PlayerInMatch[], _teamName: string, teamColor: string, teamNumber: number) => {
    const isWinner = match.winner === teamNumber
    const isDraw = match.winner === 0

    return (
      <div className="bg-card/98 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-3 rounded-lg overflow-hidden border border-[rgba(0,0,0,0.06)]">
        <div className={`border-l-4 ${teamColor === "red" ? "border-red-500/70 bg-red-500/[0.08]" : "border-blue-500/70 bg-blue-500/[0.08]"} px-2 sm:px-4 py-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`font-tiktok text-sm font-bold uppercase tracking-wider ${teamColor === "red" ? "text-red-500" : "text-blue-600"}`}>
                {teamColor === "red" ? t("teamRed") : t("teamBlue")}
              </span>

              {isDraw && (
                <span className="text-[10px] font-bold text-foreground/40 uppercase">{t("draw")}</span>
              )}
            </div>
            {/* Column headers - Mobile */}
            <div className="flex sm:hidden items-center gap-1 text-[9px] font-bold uppercase text-foreground/30 flex-shrink-0">
              <span className="w-8 text-center">SC</span>
              <span className="w-6 text-center">K</span>
              <span className="w-6 text-center">D</span>
              <span className="w-9 text-center">+/-</span>
            </div>
            {/* Column headers - Desktop */}
            <div className="hidden sm:flex items-center gap-2 text-[9px] font-bold uppercase text-foreground/30 flex-shrink-0">
              <span className="w-10 text-center">{t("score")}</span>
              <span className="w-8 text-center">PERF</span>
              <span className="w-6 text-center">K</span>
              <span className="w-6 text-center">D</span>
              <span className="w-10 text-center">DMG</span>
              <span className="w-8 text-center">ACC</span>
              <span className="w-10 text-center">{t("elo")}</span>
              <span className="w-12 text-center">+/-</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[rgba(0,0,0,0.03)]">
          {teamPlayers.map((player, index) => renderPlayerRow(player, index))}
        </div>
      </div>
    )
  }

  return (
    <>

      <div className="relative min-h-screen">
        {/* Mapa de fondo */}
        <div className="fixed inset-0 z-0 bg-black">
          <Image
            src={`/levelshots/${match.map.toLowerCase()}.jpg`}
            alt={match.map}
            fill
            className="object-cover opacity-30"
            unoptimized
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 shadow-[inset_0_0_200px_80px_rgba(30,30,34,0.7)]" />
        </div>

        <div className="relative z-10 container mx-auto pt-8 sm:pt-12 pb-8 px-3 sm:px-4 max-w-[1400px]">
          <div className="max-w-[1100px] mx-auto w-full space-y-4 animate-fade-up">
            {/* Anuncio arriba */}
            <div className="mb-4">
            </div>

            {/* Header con Score */}
            <div className="bg-card/98 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.06)] rounded-lg overflow-hidden animate-scale-fade [animation-delay:100ms]">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,0,0,0.05)]">
                <button
                  onClick={() => router.back()}
                  className="group inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60 bg-black/5 border border-[rgba(0,0,0,0.05)] rounded-lg hover:bg-foreground/10 hover:border-foreground/50 hover:text-foreground transition-all duration-200"
                >
                  <ArrowLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
                  {t("back")}
                </button>
                <div className="flex items-center gap-2 text-xs text-foreground/60">
                  <span className="font-tiktok uppercase font-bold text-foreground">{match.map}</span>
                  <span>•</span>
                  <span className="uppercase">{match.gameType}</span>
                  <span>•</span>
                  <span className="hidden sm:inline">
                    {new Date(match.playedAt).toLocaleDateString("es-CL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Score display for team games (CA, TDM, CTF) - NOT for Duel or FFA */}
              {match.team1Score !== undefined && match.team2Score !== undefined &&
                !['duel', 'ffa'].includes(match.gameType.toLowerCase()) && (
                  <div className="py-6 px-4">
                    <div className="flex items-center justify-center gap-6 sm:gap-12">
                      {/* Red Team */}
                      <div className={`text-center ${match.winner === 1 ? 'scale-110' : 'opacity-70'} transition-all`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-red-500/80 mb-1">
                          {t("teamRed")}
                        </div>
                        <div className={`text-5xl sm:text-6xl font-black ${match.winner === 1 ? 'text-red-500' : 'text-red-500/40'}`}>
                          {match.team1Score}
                        </div>
                      </div>

                      {/* VS */}
                      <div className="text-2xl sm:text-3xl font-bold text-foreground/20">-</div>

                      {/* Blue Team */}
                      <div className={`text-center ${match.winner === 2 ? 'scale-110' : 'opacity-70'} transition-all`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80 mb-1">
                          {t("teamBlue")}
                        </div>
                        <div className={`text-5xl sm:text-6xl font-black ${match.winner === 2 ? 'text-blue-600' : 'text-blue-600/40'}`}>
                          {match.team2Score}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Score display for Duel */}
              {match.gameType.toLowerCase() === 'duel' && players.all.length === 2 && (
                <div className="py-6 px-4">
                  <div className="flex items-center justify-center gap-6 sm:gap-12">
                    {players.all.map((player, idx) => {
                      const isWinner = player.eloChange > 0 || (player.score > players.all[1 - idx].score)
                      return (
                        <div key={player.id} className={`text-center ${isWinner ? 'scale-110' : 'opacity-70'} transition-all`}>
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <PlayerAvatar steamId={player.steamId} playerName={player.playerName} size="sm" />
                            <span className="text-xs font-bold uppercase truncate max-w-[100px] text-foreground">
                              {parseQuakeColors(player.playerName)}
                            </span>
                          </div>
                          <div className={`text-5xl sm:text-6xl font-black ${isWinner ? 'text-foreground' : 'text-foreground/40'}`}>
                            {player.score}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Warning banner for unrated/aborted matches */}
            {(!match.isRated || match.isAborted || (match.gameStatus && match.gameStatus !== "SUCCESS")) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-yellow-500/90">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium">
                    {match.isAborted
                      ? t("matchAborted")
                      : match.gameStatus === "TOO_FEW_PLAYERS"
                        ? t("matchTooFewPlayers")
                        : match.gameStatus === "TOO_SHORT"
                          ? t("matchTooShort")
                          : t("matchNotRated")}
                  </span>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-secondary border border-foreground/[0.08] rounded-xl p-1" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08) inset" }}>
              {[
                { id: 'basic' as const, label: t("general") },
                { id: 'weapons' as const, label: t("weapons") },
                { id: 'medals' as const, label: t("medalsTab") },
                ...(match.gameType.toLowerCase() === 'ctf' ? [{ id: 'ctf' as const, label: 'CTF Stats' }] : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-150 rounded-lg ${selectedTab === tab.id
                    ? 'bg-foreground text-white shadow-sm'
                    : 'text-[#333] hover:text-foreground hover:bg-black/5'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {selectedTab === 'basic' && (
              <>
                {/* Content - Basic View */}
                {players.team1 && players.team2 ? (
                  <>
                    {renderTeam(players.team1, "EQUIPO ROJO", "red", 1)}
                    {renderTeam(players.team2, "EQUIPO AZUL", "blue", 2)}
                  </>
                ) : (
                  <div className="bg-card/98 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] rounded-lg overflow-hidden border border-[rgba(0,0,0,0.06)]">
                    <div className="border-l-4 border-foreground bg-foreground/10 px-2 sm:px-4 py-2">
                      <div className="flex items-center justify-between">
                        <h2 className="font-tiktok text-sm font-bold uppercase tracking-wider text-foreground">
                          {t("results")}
                        </h2>
                        {/* Column headers - Mobile */}
                        <div className="flex sm:hidden items-center gap-1 text-[9px] font-bold uppercase text-foreground/30 flex-shrink-0">
                          <span className="w-8 text-center">SC</span>
                          <span className="w-6 text-center">K</span>
                          <span className="w-6 text-center">D</span>
                          <span className="w-9 text-center">+/-</span>
                        </div>
                        {/* Column headers - Desktop */}
                        <div className="hidden sm:flex items-center gap-2 text-[9px] font-bold uppercase text-foreground/30 flex-shrink-0">
                          <span className="w-10 text-center">{t("score")}</span>
                          <span className="w-8 text-center">PERF</span>
                          <span className="w-6 text-center">K</span>
                          <span className="w-6 text-center">D</span>
                          <span className="w-10 text-center">DMG</span>
                          <span className="w-8 text-center">ACC</span>
                          <span className="w-10 text-center">{t("elo")}</span>
                          <span className="w-12 text-center">+/-</span>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-[rgba(0,0,0,0.03)]">
                      {players.all.map((player: PlayerInMatch, index: number) => renderPlayerRow(player, index, match.gameType.toLowerCase() === 'duel' ? players.all : undefined))}
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedTab === 'weapons' && (() => {
              const handleSort = (col: 'RL' | 'LG' | 'RG' | 'SG' | 'MG' | 'DMG') => {
                if (weaponSortBy === col) {
                  setWeaponSortDir(weaponSortDir === 'desc' ? 'asc' : 'desc')
                } else {
                  setWeaponSortBy(col)
                  setWeaponSortDir('desc')
                }
              }

              const SortIcon = ({ col }: { col: 'RL' | 'LG' | 'RG' | 'SG' | 'MG' | 'DMG' }) => {
                if (weaponSortBy !== col) return null
                return weaponSortDir === 'desc'
                  ? <ChevronDown className="h-3 w-3 inline-block ml-0.5" />
                  : <ChevronUp className="h-3 w-3 inline-block ml-0.5" />
              }

              const sortPlayers = (teamPlayers: PlayerInMatch[]) => {
                if (!weaponSortBy) return teamPlayers
                return [...teamPlayers].sort((a, b) => {
                  const getAcc = (p: PlayerInMatch, w: string) => p.weapons.find(x => x.weapon === w)?.accuracy ?? 0
                  const getDmg = (p: PlayerInMatch) => p.weapons.reduce((sum, w) => sum + w.damage, 0) || p.damageDealt

                  let valA: number, valB: number
                  if (weaponSortBy === 'DMG') {
                    valA = getDmg(a)
                    valB = getDmg(b)
                  } else {
                    valA = getAcc(a, weaponSortBy)
                    valB = getAcc(b, weaponSortBy)
                  }
                  return weaponSortDir === 'desc' ? valB - valA : valA - valB
                })
              }

              // Lista de armas principales a mostrar
              const MAIN_WEAPONS = ['RL', 'LG', 'RG', 'SG', 'MG']

              const renderWeaponTable = (teamPlayers: PlayerInMatch[], teamColor?: 'red' | 'blue') => (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(0,0,0,0.05)]">
                        <th className="text-left py-1.5 px-2 text-[10px] font-bold uppercase text-foreground/40">{t("player")}</th>
                        {MAIN_WEAPONS.map(weapon => (
                          <th key={weapon} className="text-center py-1.5 px-1 text-[10px] font-bold uppercase text-foreground/40 w-[65px]">
                            {WEAPON_ICONS[weapon] && (
                              <Image
                                src={WEAPON_ICONS[weapon] || "/branding/logo.png"}
                                alt={weapon}
                                width={16}
                                height={16}
                                className="opacity-60 mx-auto"
                                unoptimized
                              />
                            )}
                          </th>
                        ))}
                        <th className="text-center py-1.5 px-1 text-[10px] font-bold uppercase text-foreground/40 w-[55px]">DMG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortPlayers(teamPlayers).map((player: PlayerInMatch) => {
                        const getWeaponData = (weapon: string) => player.weapons.find(w => w.weapon === weapon)
                        const totalDmg = player.weapons.reduce((sum, w) => sum + w.damage, 0) || player.damageDealt

                        return (
                          <tr key={player.id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.03]">
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1.5">
                                <PlayerAvatar steamId={player.steamId} playerName={player.playerName} size="sm" />
                                <IdentityBadges
                                  countryCode={player.countryCode}
                                  countryName={player.countryCode}
                                  clanTag={player.clan?.tag}
                                  clanName={player.clan?.name}
                                  clanAvatar={player.clan?.avatarUrl}
                                  clanHref={player.clan?.slug ? `/clanes/${player.clan.slug}` : undefined}
                                  size="sm"
                                  showTooltips={false}
                                  clanClassName="hidden sm:inline-flex"
                                />
                                <Link href={`/perfil/${player.steamId}`} className="truncate max-w-[90px]">
                                  <span className="text-xs font-semibold uppercase text-foreground inline-block">{parseQuakeColors(player.playerName)}</span>
                                </Link>
                              </div>
                            </td>
                            {MAIN_WEAPONS.map(weapon => {
                              const data = getWeaponData(weapon)
                              const acc = data?.accuracy ?? 0
                              return (
                                <td key={weapon} className="text-center py-1.5 px-0.5">
                                  {data && data.shots > 0 ? (
                                    <div className="leading-tight">
                                      <span className="font-bold text-xs text-black/90">
                                        {Math.round(acc)}%
                                      </span>
                                      <br />
                                      <span className="text-[9px] text-foreground/40">
                                        {data.hits}/{data.shots}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-foreground/20 text-xs">-</span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="text-center py-1.5 px-1">
                              <span className="font-bold text-xs text-foreground">{totalDmg.toLocaleString()}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )

              // Team game - separar por equipos
              if (players.team1 && players.team2) {
                return (
                  <div className="space-y-3">
                    {/* Team 1 - Red */}
                    <div className="bg-card/98 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-lg overflow-hidden">
                      <div className="border-l-4 border-red-500/70 bg-red-500/[0.08] px-4 py-2">
                        <h2 className="font-tiktok text-sm font-bold uppercase tracking-wider text-red-500">
                          {t("teamRed")}
                        </h2>
                      </div>
                      {renderWeaponTable(players.team1, 'red')}
                    </div>
                    {/* Team 2 - Blue */}
                    <div className="bg-card/98 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-lg overflow-hidden">
                      <div className="border-l-4 border-blue-500/70 bg-blue-500/[0.08] px-4 py-2">
                        <h2 className="font-tiktok text-sm font-bold uppercase tracking-wider text-blue-600">
                          {t("teamBlue")}
                        </h2>
                      </div>
                      {renderWeaponTable(players.team2, 'blue')}
                    </div>
                  </div>
                )
              }

              // FFA/Duel - todos juntos
              return (
                <div className="bg-card/98 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-lg overflow-hidden">
                  <div className="border-l-4 border-foreground bg-foreground/10 px-4 py-2">
                    <h2 className="font-tiktok text-sm font-bold uppercase tracking-wider text-foreground">
                      {t("weaponStatsTitle")}
                    </h2>
                  </div>
                  {renderWeaponTable(players.all)}
                </div>
              )
            })()}

            {selectedTab === 'medals' && (
              <div className="bg-card/98 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-lg overflow-hidden">
                <div className="border-l-4 border-foreground bg-foreground/10 px-4 py-3">
                  <h2 className="font-tiktok text-sm font-bold uppercase tracking-wider text-foreground">
                    {t("medalsTab")}
                  </h2>
                </div>
                <div className="p-3 sm:p-4 space-y-1">
                  {players.all.map((player: PlayerInMatch) => {
                    const medals = player.medals
                    if (!medals) return null
                    const earnedMedals = [
                      { name: 'Accuracy', count: medals.accuracy, img: '/medals/medal_accuracy.png' },
                      { name: 'Assist', count: medals.assists, img: '/medals/medal_assist.png' },
                      { name: 'Capture', count: medals.captures, img: '/medals/medal_capture.png' },
                      { name: 'Combokill', count: medals.combokill, img: '/medals/medal_combokill.png' },
                      { name: 'Defense', count: medals.defends, img: '/medals/medal_defense.png' },
                      { name: 'Excellent', count: medals.excellent, img: '/medals/medal_excellent.png' },
                      { name: 'First Frag', count: medals.firstfrag, img: '/medals/medal_firstfrag.png' },
                      { name: 'Headshot', count: medals.headshot, img: '/medals/medal_headshot.png' },
                      { name: 'Humiliation', count: medals.humiliation, img: '/medals/medal_gauntlet.png' },
                      { name: 'Impressive', count: medals.impressive, img: '/medals/medal_impressive.png' },
                      { name: 'Midair', count: medals.midair, img: '/medals/medal_midair.png' },
                      { name: 'Perfect', count: medals.perfect, img: '/medals/medal_perfect.png' },
                      { name: 'Perforated', count: medals.perforated, img: '/medals/medal_perforated.png' },
                      { name: 'Quad God', count: medals.quadgod, img: '/medals/medal_quadgod.png' },
                      { name: 'Rampage', count: medals.rampage, img: '/medals/medal_rampage.png' },
                      { name: 'Revenge', count: medals.revenge, img: '/medals/medal_revenge.png' },
                    ].filter(m => m.count > 0)

                    return (
                      <div key={player.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 px-2 bg-[rgba(0,0,0,0.02)] hover:bg-foreground/[0.04] rounded-lg transition-colors">
                        <div className="flex items-center gap-2 min-w-0 sm:min-w-[200px]">
                          <PlayerAvatar steamId={player.steamId} playerName={player.playerName} size="sm" />
                          <IdentityBadges
                            countryCode={player.countryCode}
                            countryName={player.countryCode}
                            clanTag={player.clan?.tag}
                            clanName={player.clan?.name}
                            clanAvatar={player.clan?.avatarUrl}
                            clanHref={player.clan?.slug ? `/clanes/${player.clan.slug}` : undefined}
                            size="sm"
                            showTooltips={false}
                            clanClassName="hidden sm:inline-flex"
                          />
                          <Link href={`/perfil/${player.steamId}`} className="truncate">
                            <span className="text-xs font-semibold uppercase text-foreground inline-block">{parseQuakeColors(player.playerName)}</span>
                          </Link>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-2.5 pl-0 sm:pl-0">
                          {earnedMedals.length > 0 ? earnedMedals.map((medal) => (
                            <TooltipProvider key={medal.name}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5 bg-black/5 hover:bg-black/10 border border-[rgba(0,0,0,0.05)] rounded-lg px-2.5 py-1.5 cursor-default transition-colors">
                                    <Image src={medal.img || "/branding/logo.png"} alt={medal.name} width={24} height={24} className="drop-shadow-lg" unoptimized />
                                    <span className="text-xs font-bold text-foreground/80">×{medal.count}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{medal.name}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )) : (
                            <span className="text-xs text-foreground/30 italic">{t("noMedals")}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* CTF Stats Tab */}
            {selectedTab === 'ctf' && match.gameType.toLowerCase() === 'ctf' && (
              <div className="space-y-3">
                {/* Team 1 CTF Stats */}
                {players.team1 && (
                  <div className="bg-card/98 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-lg overflow-hidden">
                    <div className="border-l-4 border-red-500/70 bg-red-500/[0.08] px-4 py-2">
                      <h2 className="font-tiktok text-sm font-bold uppercase tracking-wider text-red-500">
                        {t("teamRed")} - CTF Stats
                      </h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[rgba(0,0,0,0.06)]">
                            <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-foreground/40">{t("player")}</th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-16">
                              <span title="Capturas de Bandera">CAPS</span>
                            </th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-16">
                              <span title="Retornos de Bandera">RETURNS</span>
                            </th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-16">
                              <span title="Veces que tomó la bandera">PICKS</span>
                            </th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-16">
                              <span title="Veces que soltó la bandera (muerte)">DROPS</span>
                            </th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-20">
                              <span title="Bajas al portador de bandera">CARRIER K</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.team1.map((player: PlayerInMatch) => (
                            <tr key={player.id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.03]">
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <PlayerAvatar steamId={player.steamId} playerName={player.playerName} size="sm" />
                                  {player.countryCode && <FlagCountry countryCode={player.countryCode} countryName={player.countryCode} />}
                                  <Link href={`/perfil/${player.steamId}`} className="truncate max-w-[120px]">
                                    <span className="text-xs font-semibold uppercase text-foreground inline-block">{parseQuakeColors(player.playerName)}</span>
                                  </Link>
                                </div>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className={`font-bold text-sm ${(player.flagsCaptured || 0) > 0 ? 'text-green-600' : 'text-foreground/30'}`}>
                                  {player.flagsCaptured || 0}
                                </span>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className={`font-bold text-sm ${(player.flagsReturned || 0) > 0 ? 'text-foreground' : 'text-foreground/30'}`}>
                                  {player.flagsReturned || 0}
                                </span>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className="font-medium text-sm text-foreground/60">{player.flagPicks || 0}</span>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className={`font-medium text-sm ${(player.flagDrops || 0) > 0 ? 'text-foreground/50' : 'text-foreground/30'}`}>
                                  {player.flagDrops || 0}
                                </span>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className={`font-bold text-sm ${(player.carrierTakedowns || 0) > 0 ? 'text-foreground/70' : 'text-foreground/30'}`}>
                                  {player.carrierTakedowns || 0}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Team 2 CTF Stats */}
                {players.team2 && (
                  <div className="bg-card/98 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-lg overflow-hidden">
                    <div className="border-l-4 border-blue-500/70 bg-blue-500/[0.08] px-4 py-2">
                      <h2 className="font-tiktok text-sm font-bold uppercase tracking-wider text-blue-600">
                        {t("teamBlue")} - CTF Stats
                      </h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[rgba(0,0,0,0.06)]">
                            <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-foreground/40">{t("player")}</th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-16">
                              <span title="Capturas de Bandera">CAPS</span>
                            </th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-16">
                              <span title="Retornos de Bandera">RETURNS</span>
                            </th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-16">
                              <span title="Veces que tomó la bandera">PICKS</span>
                            </th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-16">
                              <span title="Veces que soltó la bandera (muerte)">DROPS</span>
                            </th>
                            <th className="text-center py-2 px-2 text-[10px] font-bold uppercase text-foreground/40 w-20">
                              <span title="Bajas al portador de bandera">CARRIER K</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.team2.map((player: PlayerInMatch) => (
                            <tr key={player.id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.03]">
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <PlayerAvatar steamId={player.steamId} playerName={player.playerName} size="sm" />
                                  {player.countryCode && <FlagCountry countryCode={player.countryCode} countryName={player.countryCode} />}
                                  <Link href={`/perfil/${player.steamId}`} className="truncate max-w-[120px]">
                                    <span className="text-xs font-semibold uppercase text-foreground inline-block">{parseQuakeColors(player.playerName)}</span>
                                  </Link>
                                </div>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className={`font-bold text-sm ${(player.flagsCaptured || 0) > 0 ? 'text-green-600' : 'text-foreground/30'}`}>
                                  {player.flagsCaptured || 0}
                                </span>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className={`font-bold text-sm ${(player.flagsReturned || 0) > 0 ? 'text-foreground' : 'text-foreground/30'}`}>
                                  {player.flagsReturned || 0}
                                </span>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className="font-medium text-sm text-foreground/60">{player.flagPicks || 0}</span>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className={`font-medium text-sm ${(player.flagDrops || 0) > 0 ? 'text-foreground/50' : 'text-foreground/30'}`}>
                                  {player.flagDrops || 0}
                                </span>
                              </td>
                              <td className="text-center py-2 px-2">
                                <span className={`font-bold text-sm ${(player.carrierTakedowns || 0) > 0 ? 'text-foreground/70' : 'text-foreground/30'}`}>
                                  {player.carrierTakedowns || 0}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Anuncio al final */}
            <div className="mt-6">
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
