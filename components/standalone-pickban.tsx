"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { FlagClan } from "@/components/flag-clan"
import { cn } from "@/lib/utils"

interface TeamInfo {
  name: string
  tag: string
  avatar: string | null
}

interface PickBanStep {
  team: "a" | "b"
  action: "ban" | "pick"
}

interface SessionData {
  id: string
  format: string
  formatInfo: {
    id: string
    name: string
    totalMaps: number
    steps: PickBanStep[]
    poolSize: number
  }
  status: string
  team1: TeamInfo
  team2: TeamInfo
  mapPool: string[]
  banned: { mapName: string; teamId: string; step: number }[]
  picked: { mapName: string; teamId: string; step: number }[]
  decider: string | null
  availableMaps: string[]
  currentStep: number
  currentTeam: "a" | "b" | null
  currentAction: "ban" | "pick" | null
  isCompleted: boolean
  mapOrder: string[]
  actions: { step: number; action: string; mapName: string; team: string }[]
}

interface StandalonePickBanProps {
  sessionId: string
  teamSide?: "a" | "b" | null
}

const ACTION_LABELS = {
  ban: "BAN",
  pick: "PICK",
} as const

const ACTION_VERBS = {
  ban: "banear",
  pick: "pickear",
} as const

const ACTION_BUTTON_LABELS = {
  ban: "Banear",
  pick: "Pickear",
} as const

const ACTION_PROGRESS_LABELS = {
  ban: "Banear en curso",
  pick: "Pickear en curso",
} as const

const MAP_STATUS_LABELS = {
  available: "Disponible",
  banned: "Baneado",
  picked: "Pickeado",
  decider: "Decider",
} as const

function getMapImageUrl(mapName: string) {
  return `/levelshots/${mapName}.jpg`
}

function getTeamAccent(team: "a" | "b") {
  return team === "a"
    ? {
        text: "text-red-500",
        badge: "bg-red-500/[0.12] text-red-600 border-red-500/20",
        activeAvatar: "border-red-500/60",
      }
    : {
        text: "text-blue-600",
        badge: "bg-blue-500/[0.12] text-blue-700 border-blue-500/20",
        activeAvatar: "border-blue-500/60",
      }
}

function TeamAvatar({
  team,
  info,
  isActive,
  size = "default",
}: {
  team: "a" | "b"
  info: TeamInfo
  isActive: boolean
  size?: "default" | "sm"
}) {
  return (
    <FlagClan
      clanTag={info.tag || info.name || team}
      clanName={info.name}
      clanAvatar={info.avatar || undefined}
      size={size === "sm" ? "sm" : "lg"}
      showTooltip={false}
    />
  )
}

export function StandalonePickBan({
  sessionId,
  teamSide = null,
}: StandalonePickBanProps) {
  const queryClient = useQueryClient()
  const [selectedMap, setSelectedMap] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<{ mapName: string; action: string; team: string } | null>(null)
  const prevStepRef = useRef<number>(-1)

  const { data, isLoading, error } = useQuery<SessionData>({
    queryKey: ["pickban-session", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/pickban/${sessionId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error")
      }
      return res.json()
    },
    refetchInterval: (query) => {
      const session = query.state.data as SessionData | undefined
      if (!session) return 3000
      if (session.isCompleted) return false
      if (!teamSide) return 2000
      if (session.currentTeam === teamSide) return false
      return 2000
    },
  })

  useEffect(() => {
    if (!data) return
    const currentStep = data.currentStep
    if (prevStepRef.current >= 0 && currentStep > prevStepRef.current) {
      const previousStep = prevStepRef.current
      const previousAction = data.actions.find((action) => action.step === previousStep)
      if (previousAction) {
        setLastAction({
          mapName: previousAction.mapName,
          action: previousAction.action,
          team: previousAction.team,
        })
        setTimeout(() => setLastAction(null), 2200)
      }
    }
    prevStepRef.current = currentStep
  }, [data?.actions, data?.currentStep])

  useEffect(() => {
    if (!data || !selectedMap) return
    if (!data.availableMaps.includes(selectedMap) || data.isCompleted || data.currentTeam !== teamSide) {
      setSelectedMap(null)
    }
  }, [data, selectedMap, teamSide])

  const actionMutation = useMutation({
    mutationFn: async (mapName: string) => {
      const res = await fetch(`/api/pickban/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: teamSide, mapName }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error")
      }
      return res.json()
    },
    onSuccess: () => {
      setSelectedMap(null)
      queryClient.invalidateQueries({ queryKey: ["pickban-session", sessionId] })
    },
  })

  if (isLoading) {
    return (
      <div className="glass-card-elevated rounded-[24px] border border-foreground/[0.06] px-6 py-16 text-center shadow-[0_14px_40px_-24px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-black/10 border-t-[#1a1a1e]" />
          <p className="font-tiktok text-lg font-bold uppercase tracking-[0.08em] text-foreground">Cargando sesion</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="glass-card-elevated rounded-[24px] border border-foreground/[0.06] px-6 py-16 text-center shadow-[0_14px_40px_-24px_rgba(0,0,0,0.45)]">
        <div className="space-y-2">
          <p className="font-tiktok text-lg font-bold uppercase tracking-[0.08em] text-foreground">
            Pick/ban no disponible
          </p>
          <p className="text-sm text-foreground/50">{(error as Error)?.message || "No se pudo cargar la sesion."}</p>
        </div>
      </div>
    )
  }

  const { formatInfo: format, team1, team2, mapPool } = data
  const isMyTurn = teamSide !== null && data.currentTeam === teamSide && !data.isCompleted
  const isSpectator = teamSide === null
  const currentTeamName = data.currentTeam === "a" ? team1.name : data.currentTeam === "b" ? team2.name : "el rival"
  const currentTeamInfo = data.currentTeam === "a" ? team1 : data.currentTeam === "b" ? team2 : null
  const activeAction = data.currentAction
  const activeActionLabel = activeAction ? ACTION_LABELS[activeAction] : null
  const activeActionVerb = activeAction ? ACTION_VERBS[activeAction] : "continuar"
  const currentStepLabel = data.isCompleted ? `${format.steps.length}/${format.steps.length}` : `${data.currentStep + 1}/${format.steps.length}`
  const latestRecordedAction = data.actions.length > 0 ? data.actions[data.actions.length - 1] : null
  const team1BanCount = data.banned.filter((item) => item.teamId === "team_a").length
  const team2BanCount = data.banned.filter((item) => item.teamId === "team_b").length
  const team1PickCount = data.picked.filter((item) => item.teamId === "team_a").length
  const team2PickCount = data.picked.filter((item) => item.teamId === "team_b").length
  const getMapStatus = (mapName: string) => {
    const ban = data.banned.find((item) => item.mapName === mapName)
    if (ban) return { status: "banned" as const, team: ban.teamId === "team_a" ? "a" : "b", step: ban.step }

    const pick = data.picked.find((item) => item.mapName === mapName)
    if (pick) return { status: "picked" as const, team: pick.teamId === "team_a" ? "a" : "b", step: pick.step }

    if (data.decider === mapName) return { status: "decider" as const, team: null, step: -1 }

    return { status: "available" as const, team: null, step: -1 }
  }

  const getTeamName = (team: string | null) => {
    if (team === "a") return team1.name
    if (team === "b") return team2.name
    return ""
  }

  const getTeamInfo = (team: string | null) => {
    if (team === "a") return team1
    if (team === "b") return team2
    return null
  }

  const getMapMetaLabel = (status: ReturnType<typeof getMapStatus>) => {
    if (status.status === "picked" && status.team) {
      return "Pickeado por:"
    }

    if (status.status === "banned" && status.team) {
      return "Baneado por:"
    }

    if (status.status === "decider") {
      return "Decider"
    }

    return null
  }

  const finalSeriesMaps = data.mapOrder.map((mapName, index) => {
    const pickedBy = data.picked.find((item) => item.mapName === mapName)
    const team = pickedBy ? (pickedBy.teamId === "team_a" ? "a" : "b") : null
    const isDecider = data.decider === mapName && index === data.mapOrder.length - 1

    return {
      mapName,
      index,
      team,
      info: getTeamInfo(team),
      isDecider,
    }
  })

  const orderedMapPool =
    data.isCompleted && data.mapOrder.length > 0
      ? [...data.mapOrder, ...mapPool.filter((mapName) => !data.mapOrder.includes(mapName))]
      : mapPool

  const statusLabel = data.isCompleted
    ? "La serie quedo lista para jugar."
    : isMyTurn
      ? `Selecciona un mapa para ${activeActionVerb}.`
      : `Esperando a ${currentTeamName} para ${activeActionVerb}.`

  const duelPanel = (
    <ContentContainer className="h-full rounded-[18px] sm:rounded-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 py-3.5 sm:px-5 sm:py-4">
        <h3 className="font-tiktok text-base font-bold uppercase tracking-[0.05em] text-foreground sm:text-lg">
          {team1.name} vs {team2.name}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">
          <span>{format.id.toUpperCase()}</span>
          <span>{format.poolSize} mapas</span>
          <span>Turno {currentStepLabel}</span>
        </div>
      </div>

      <div className="grid gap-px border-t border-foreground/[0.06] bg-foreground/[0.06] lg:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)]">
        <div
          className={cn(
            "overflow-hidden bg-[var(--qc-bg-medium)] px-4 py-4 sm:px-5 sm:py-[18px]",
            data.currentTeam === "a" && !data.isCompleted && "bg-red-500/[0.035]",
          )}
        >
          <div className="relative flex items-center gap-3 sm:gap-4">
            <TeamAvatar team="a" info={team1} isActive={data.currentTeam === "a" && !data.isCompleted} />
            <div className="min-w-0 flex-1">
              <h2 className="font-tiktok text-base font-bold uppercase tracking-[0.06em] text-foreground sm:text-lg">
                {team1.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                    data.currentTeam === "a" && !data.isCompleted
                      ? "border-red-500/20 bg-red-500/[0.12] text-red-600"
                      : "border-foreground/[0.06] bg-foreground/[0.03] text-foreground/48",
                  )}
                >
                  {data.currentTeam === "a" && !data.isCompleted ? "Turno activo" : "En espera"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/34">
                  {team1BanCount} baneos · {team1PickCount} pickeos
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center bg-[var(--qc-bg-pure)] px-2 py-3 text-center">
          <p className="font-tiktok text-lg font-bold uppercase tracking-[0.08em] text-foreground/75">VS</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground">
            {data.isCompleted ? "Listo" : activeActionLabel || "En curso"}
          </p>
        </div>

        <div
          className={cn(
            "overflow-hidden bg-[var(--qc-bg-medium)] px-4 py-4 sm:px-5 sm:py-[18px]",
            data.currentTeam === "b" && !data.isCompleted && "bg-blue-500/[0.04]",
          )}
        >
          <div className="relative flex items-center gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 text-right">
              <h2 className="font-tiktok text-base font-bold uppercase tracking-[0.06em] text-foreground sm:text-lg">
                {team2.name}
              </h2>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                    data.currentTeam === "b" && !data.isCompleted
                      ? "border-blue-500/20 bg-blue-500/[0.12] text-blue-700"
                      : "border-foreground/[0.06] bg-foreground/[0.03] text-foreground/48",
                  )}
                >
                  {data.currentTeam === "b" && !data.isCompleted ? "Turno activo" : "En espera"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/34">
                  {team2BanCount} baneos · {team2PickCount} pickeos
                </span>
              </div>
            </div>
            <TeamAvatar team="b" info={team2} isActive={data.currentTeam === "b" && !data.isCompleted} />
          </div>
        </div>
      </div>
    </ContentContainer>
  )

  const draftPanel = (
    <ContentContainer className="rounded-[18px] sm:rounded-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 py-3.5 sm:px-5 sm:py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/28">Draft</p>
          <h3 className="mt-1 font-tiktok text-base font-bold uppercase tracking-[0.05em] text-foreground sm:text-lg">
            Mappool y vetos
          </h3>
        </div>
        <div className="text-right text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40">
          <p>{data.availableMaps.length} disponibles</p>
          <p className="mt-1 text-foreground/28">{format.totalMaps} mapas a jugar</p>
        </div>
      </div>

      <div className="border-t border-foreground/[0.06] lg:grid lg:items-start lg:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0">
          <div className="px-4 py-3.5 sm:px-5 sm:py-4">
            <p className="max-w-3xl text-[13px] text-foreground/54">{statusLabel}</p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {data.isCompleted && finalSeriesMaps.length > 0 ? (
                finalSeriesMaps.map((finalMap) => (
                  <div
                    key={`${finalMap.mapName}-${finalMap.index}`}
                    className={cn(
                      "rounded-full border px-2 py-1",
                      finalMap.isDecider
                        ? "border-[#c9a961]/40 bg-[#c9a961]/18"
                        : finalMap.team === "a"
                          ? "border-red-500/12 bg-red-500/[0.05]"
                          : "border-blue-500/12 bg-blue-500/[0.05]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
                          finalMap.isDecider
                            ? "bg-[#c9a961]/30 text-[#7e6330]"
                            : "bg-foreground text-background",
                        )}
                      >
                        {finalMap.isDecider ? "DECIDER" : "PICK"}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
                        {finalMap.mapName}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {format.steps.map((step, index) => {
                    const isDone = index < data.currentStep || data.isCompleted
                    const isCurrent = index === data.currentStep && !data.isCompleted
                    const action = data.actions.find((item) => item.step === index)

                    return (
                      <div
                        key={index}
                        className={cn(
                          "rounded-full border px-2 py-1 transition-all duration-200",
                          isCurrent
                            ? "border-foreground bg-foreground text-background shadow-[0_14px_24px_-18px_rgba(0,0,0,0.7)]"
                            : isDone
                              ? step.team === "a"
                                ? "border-red-500/12 bg-red-500/[0.05]"
                                : "border-blue-500/12 bg-blue-500/[0.05]"
                              : "border-black/[0.05] bg-black/[0.025] text-foreground/50",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
                              step.action === "ban"
                                ? isCurrent
                                  ? "bg-red-500/20 text-red-300"
                                  : "bg-red-500/[0.12] text-red-600"
                                : isCurrent
                                  ? "bg-[#c9a961]/20 text-[#f0dba4]"
                                  : "bg-[#c9a961]/30 text-[#7e6330]",
                            )}
                          >
                            {ACTION_LABELS[step.action]}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-semibold uppercase tracking-[0.14em]",
                              isCurrent ? "text-background/90" : "text-foreground",
                            )}
                          >
                            {action ? action.mapName : isCurrent ? "Ahora" : "Pendiente"}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  <div
                    className={cn(
                      "rounded-full border px-2.5 py-1",
                      data.decider ? "border-[#c9a961]/40 bg-[#c9a961]/18" : "border-black/[0.05] bg-black/[0.025]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#c9a961]/35 bg-[#c9a961]/25 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#7e6330]">
                        Decider
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
                        {data.decider || "Pendiente"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-foreground/[0.06] px-4 py-4 sm:px-5 sm:py-[18px]">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-3">
              {orderedMapPool.map((mapName) => {
                const mapStatus = getMapStatus(mapName)
                const mapStatusInfo = mapStatus.team ? getTeamInfo(mapStatus.team) : null
                const isAvailable = mapStatus.status === "available"
                const canSelect = isAvailable && isMyTurn && !data.isCompleted
                const isSelected = selectedMap === mapName
                const isRecentlyActed = lastAction?.mapName === mapName

                return (
                  <button
                    key={mapName}
                    type="button"
                    onClick={() => canSelect && setSelectedMap(isSelected ? null : mapName)}
                    disabled={!canSelect}
                    className={cn(
                      "group relative overflow-hidden rounded-[14px] border border-foreground/[0.06] bg-card text-left transition-all duration-200",
                      mapStatus.status === "banned" && "opacity-55 saturate-0",
                      mapStatus.status === "picked" &&
                        (mapStatus.team === "a"
                          ? "ring-1 ring-red-500/35"
                          : "ring-1 ring-blue-500/35"),
                      mapStatus.status === "decider" && "ring-1 ring-[#c9a961]/35",
                      isSelected && "ring-2 ring-foreground/45 shadow-[0_18px_30px_-22px_rgba(0,0,0,0.8)]",
                      canSelect && !isSelected && "hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-24px_rgba(0,0,0,0.55)]",
                      !canSelect && isAvailable && "opacity-80",
                      isRecentlyActed && "animate-[pulse_0.65s_ease-in-out_2]",
                    )}
                    >
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <img src={getMapImageUrl(mapName)} alt={mapName} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/26" />
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                        {mapStatus.status === "picked" && (
                          <span className="rounded-full bg-foreground px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-background">
                            PICK
                          </span>
                        )}
                        {mapStatus.status === "banned" && (
                          <span className="rounded-full bg-red-500 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white">
                            BAN
                          </span>
                        )}
                        {mapStatus.status === "decider" && (
                          <span className="rounded-full bg-foreground px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#c9a961]">
                            DECIDER
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]">
                          <div className="flex h-full items-center justify-center">
                            <span className="rounded-full border border-foreground/[0.18] bg-[var(--qc-bg-darkest)]/78 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-foreground">
                              Seleccionado
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-foreground/[0.06] bg-[var(--qc-bg-medium)] px-3 py-2.5">
                      <div className="text-sm font-black uppercase tracking-[0.05em] text-foreground sm:text-[15px]">
                        {mapName}
                      </div>
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/44">
                        {MAP_STATUS_LABELS[mapStatus.status]}
                      </div>
                      {getMapMetaLabel(mapStatus) && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/34">
                          <span>{getMapMetaLabel(mapStatus)}</span>
                          {mapStatusInfo && mapStatus.team ? (
                            <TeamAvatar team={mapStatus.team} info={mapStatusInfo} isActive={false} size="sm" />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="border-t border-foreground/[0.06] bg-[var(--qc-bg-pure)]/40 lg:border-l lg:border-t-0">
          <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">Accion actual</h3>
              <div className="rounded-[16px] border border-foreground/[0.06] bg-[var(--qc-bg-medium)] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/34">
                  {data.isCompleted ? "Serie finalizada" : "Turno de"}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {!data.isCompleted && currentTeamInfo && data.currentTeam && (
                    <TeamAvatar team={data.currentTeam} info={currentTeamInfo} isActive />
                  )}
                  <p className="text-lg font-bold text-foreground">
                    {data.isCompleted ? "Serie confirmada" : currentTeamName}
                  </p>
                </div>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/40">
                  {data.isCompleted
                    ? "Lista para jugar"
                    : activeAction
                      ? ACTION_PROGRESS_LABELS[activeAction]
                      : "Esperando siguiente accion"}
                </p>
                {selectedMap && isMyTurn && (
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/36">
                    Marcado: {selectedMap}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-foreground/[0.06] pt-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">Resumen</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--qc-bg-medium)] p-2.5 text-center">
                  <p className="text-lg font-bold text-foreground">{data.availableMaps.length}</p>
                  <p className="text-[9px] uppercase text-foreground/30">Disponibles</p>
                </div>
                <div className="rounded-lg bg-[var(--qc-bg-medium)] p-2.5 text-center">
                  <p className="text-lg font-bold text-foreground">{data.actions.length}</p>
                  <p className="text-[9px] uppercase text-foreground/30">Movimientos</p>
                </div>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/36">
                {data.decider ? `Decider: ${data.decider}` : "Decider pendiente"}
              </div>
            </div>

            {!data.isCompleted && !isSpectator && (
              <div className="space-y-3 border-t border-foreground/[0.06] pt-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">Confirmacion</h3>
                <div className="rounded-[16px] border border-foreground/[0.06] bg-[var(--qc-bg-medium)] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/34">
                    {selectedMap ? "Mapa marcado" : "Mapa seleccionado"}
                  </p>
                  <p className="mt-2 text-lg font-bold text-foreground">{selectedMap || "Ninguno"}</p>
                  <p className="mt-2 text-sm text-foreground/54">
                    {isMyTurn
                      ? `Selecciona y confirma un mapa para ${activeActionVerb}.`
                      : "La confirmacion se habilita cuando sea tu turno."}
                  </p>
                  <button
                    type="button"
                    onClick={() => selectedMap && actionMutation.mutate(selectedMap)}
                    disabled={!selectedMap || !isMyTurn || actionMutation.isPending}
                    className="mt-4 w-full rounded-[12px] bg-foreground px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 disabled:opacity-45"
                  >
                    {actionMutation.isPending
                      ? "Procesando..."
                      : selectedMap
                        ? `${activeAction ? ACTION_BUTTON_LABELS[activeAction] : "Confirmar"} ${selectedMap}`
                        : "Selecciona un mapa"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 border-t border-foreground/[0.06] pt-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
                {data.isCompleted ? "Orden de serie" : "Ultimo movimiento"}
              </h3>
              {data.isCompleted && data.mapOrder.length > 0 ? (
                <div className="space-y-2">
                  {data.mapOrder.map((mapName, index) => (
                    <div
                      key={`${mapName}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-[var(--qc-bg-medium)] px-3 py-2"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/34">
                        Mapa {index + 1}
                      </span>
                      <span className="text-sm font-bold text-foreground">{mapName}</span>
                    </div>
                  ))}
                </div>
              ) : latestRecordedAction ? (
                <div className="rounded-[16px] border border-foreground/[0.06] bg-[var(--qc-bg-medium)] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/34">
                    {getTeamName(latestRecordedAction.team)}
                  </p>
                  <p className="mt-2 text-lg font-bold text-foreground">{latestRecordedAction.mapName}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/40">
                    {latestRecordedAction.action === "ban" ? "Mapa baneado" : "Mapa pickeado"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-foreground/44">Todavia no hay movimientos registrados.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </ContentContainer>
  )

  const finalOrderPanel =
    data.isCompleted && data.mapOrder.length > 0 ? (
      <ContentContainer>
        <ContentHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-foreground/34">Orden final</p>
            <h3 className="mt-1 font-tiktok text-lg font-bold uppercase tracking-[0.05em] text-foreground">
              Mapas a jugar en la serie
            </h3>
          </div>
          <div className="rounded-full border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/55">
            {data.mapOrder.length} mapas definidos
          </div>
        </ContentHeader>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {finalSeriesMaps.map((finalMap) => {
            const isDecider = finalMap.isDecider

            return (
              <div
                key={`${finalMap.mapName}-${finalMap.index}`}
                className={cn(
                  "overflow-hidden rounded-[22px] border bg-[var(--qc-bg-medium)]",
                  isDecider ? "border-[#c9a961]/45" : "border-foreground/[0.06]",
                )}
              >
                <div className="relative aspect-[16/10]">
                  <img src={getMapImageUrl(finalMap.mapName)} alt={finalMap.mapName} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/28" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[var(--qc-bg-darkest)]/72 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/70">
                      Mapa {finalMap.index + 1}
                    </span>
                    {isDecider && (
                      <span className="rounded-full border border-foreground/[0.10] bg-foreground/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-foreground">
                        Decider
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="text-base font-black uppercase tracking-[0.08em] text-[#f3ede4] sm:text-lg">
                      {finalMap.mapName}
                    </div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f3ede4]/72">
                      {isDecider ? "Decider" : "Mapa pickeado"}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 border-t border-foreground/[0.06] bg-[var(--qc-bg-medium)] px-3 py-3">
                  {finalMap.team && finalMap.info ? (
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/34">
                      <span>Pickeado por:</span>
                      <TeamAvatar team={finalMap.team} info={finalMap.info} isActive={false} size="sm" />
                    </div>
                  ) : (
                    <div className="inline-flex rounded-full border border-foreground/[0.10] bg-foreground/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/58">
                      Decider
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </ContentContainer>
    ) : null

  return (
    <div className="space-y-3 sm:space-y-4">
      {duelPanel}
      {draftPanel}
      {finalOrderPanel}
    </div>
  )
}
